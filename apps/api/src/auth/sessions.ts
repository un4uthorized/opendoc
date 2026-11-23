/**
 * Server-side sessions behind an httpOnly cookie. The cookie holds a random token; the database
 * holds only its SHA-256, so a leaked database doesn't hand out live sessions. Logging out, an
 * admin resetting someone's MFA or a password change delete rows, and the session is gone at once.
 */
import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import type { Config } from '../config.ts';
import { one, type Queryable } from '../db.ts';
import { HttpError } from '../http.ts';
import { newToken, sha256 } from '../security/crypto.ts';

/** password checked, waiting for the code (mfa) or for the authenticator to be set up (enroll). */
export type Stage = 'mfa' | 'enroll' | 'active';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  owner: boolean;
  /** The setup account (ADMIN_EMAIL): password only, manages the installation's admins and nothing else. */
  setup: boolean;
  /**
   * Uses the admin panel: owner, or admin or editor of at least one project (editors only see
   * the content screens). Lands on /admin after signing in.
   */
  admin: boolean;
  mfa: boolean;
}

export interface Session {
  tokenHash: string;
  stage: Stage;
  attempts: number;
  user: SessionUser;
}

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

const pendingTtlMs = 10 * 60_000;
const idleTtlMs = 7 * 86_400_000;
const absoluteTtlMs = 30 * 86_400_000;
/** The setup account has no second factor, so its sessions are short. */
const setupIdleTtlMs = 60 * 60_000;
const setupAbsoluteTtlMs = 12 * 60 * 60_000;
const lifetimes = (setup: boolean) => (setup ? { idle: setupIdleTtlMs, absolute: setupAbsoluteTtlMs } : { idle: idleTtlMs, absolute: absoluteTtlMs });
/** last_seen_at is written at most this often, not on every request. */
const touchEveryMs = 60_000;

/** `__Host-` binds the cookie to this exact host over HTTPS (no Domain, Path=/). */
export const cookieName = (config: Config) => (config.secureCookies ? '__Host-opendoc_session' : 'opendoc_session');

function cookieOptions(config: Config, maxAge?: number): CookieOptions {
  return { httpOnly: true, secure: config.secureCookies, sameSite: 'lax', path: '/', ...(maxAge ? { maxAge } : {}) };
}

export async function startSession(db: Queryable, config: Config, req: Request, res: Response, userId: string, stage: Stage, setup = false) {
  const token = newToken();
  const { idle, absolute } = lifetimes(setup);
  const ttl = stage === 'active' ? idle : pendingTtlMs;
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, stage, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + $6 * interval '1 millisecond')`,
    [sha256(token), userId, stage, req.get('user-agent')?.slice(0, 300) ?? null, req.ip ?? null, ttl],
  );
  res.cookie(cookieName(config), token, cookieOptions(config, stage === 'active' ? absolute : undefined));
}

/**
 * Replaces the current session with a new token at a new stage. A new token on every privilege
 * change means a token seen before login (fixation) never becomes a signed-in one.
 */
export async function rotateSession(db: Queryable, config: Config, req: Request, res: Response, stage: Stage) {
  const session = req.session!;
  await db.query('DELETE FROM sessions WHERE token_hash = $1', [session.tokenHash]);
  await startSession(db, config, req, res, session.user.id, stage, session.user.setup);
}

/** Deletes the current session row without touching the cookie (a new one is about to be set). */
export async function dropSession(db: Queryable, req: Request) {
  if (req.session) await db.query('DELETE FROM sessions WHERE token_hash = $1', [req.session.tokenHash]);
}

export async function endSession(db: Queryable, config: Config, req: Request, res: Response) {
  if (req.session) await db.query('DELETE FROM sessions WHERE token_hash = $1', [req.session.tokenHash]);
  res.clearCookie(cookieName(config), cookieOptions(config));
}

/** Signs the user out everywhere except, optionally, the current session. */
export async function endOtherSessions(db: Queryable, userId: string, keepTokenHash?: string) {
  await db.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash IS DISTINCT FROM $2', [userId, keepTokenHash ?? null]);
}

interface Row {
  token_hash: string; stage: Stage; attempts: number; expires_at: Date; created_at: Date; last_seen_at: Date;
  user_id: string; name: string; email: string; owner: boolean; setup: boolean; admin: boolean; mfa: boolean;
}

/** Reads the session cookie, if any, into `req.session`. Never rejects the request by itself. */
export function loadSession(db: Queryable, config: Config): RequestHandler {
  return async (req, res, next) => {
    const token = req.cookies?.[cookieName(config)];
    if (typeof token !== 'string' || token.length > 100) return next();
    const row = await one<Row>(db,
      `SELECT s.token_hash, s.stage, s.attempts, s.expires_at, s.created_at, s.last_seen_at,
              u.id AS user_id, u.name, u.email, u.owner, u.setup, (u.mfa_secret IS NOT NULL) AS mfa,
              (u.owner OR EXISTS (SELECT 1 FROM members m WHERE m.user_id = u.id AND m.role IN ('admin', 'editor'))) AS admin
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [sha256(token)]);
    if (!row) {
      res.clearCookie(cookieName(config), cookieOptions(config));
      return next();
    }
    req.session = {
      tokenHash: row.token_hash,
      stage: row.stage,
      attempts: row.attempts,
      user: { id: row.user_id, name: row.name, email: row.email, owner: row.owner, setup: row.setup, admin: row.admin, mfa: row.mfa },
    };
    // Sliding expiry for signed-in sessions, capped by the absolute lifetime.
    if (row.stage === 'active' && Date.now() - row.last_seen_at.getTime() > touchEveryMs) {
      await db.query(
        `UPDATE sessions SET last_seen_at = now(),
                expires_at = LEAST(now() + $2 * interval '1 millisecond', created_at + $3 * interval '1 millisecond')
          WHERE token_hash = $1`,
        [row.token_hash, lifetimes(row.setup).idle, lifetimes(row.setup).absolute]);
      await db.query('UPDATE users SET last_active_at = now() WHERE id = $1', [row.user_id]);
    }
    next();
  };
}

/** Fully signed-in people (password + authenticator). The setup account is kept out. */
export const requireUser: RequestHandler = (req, _res, next) => {
  if (req.session?.stage !== 'active') return next(new HttpError(401, 'Entre para continuar.', 'UNAUTHENTICATED'));
  if (req.session.user.setup) return next(new HttpError(403, 'A conta de configuração só gerencia os admins.', 'SETUP_ONLY'));
  next();
};

/** Only the setup account. */
export const requireSetup: RequestHandler = (req, _res, next) => {
  if (req.session?.stage !== 'active') return next(new HttpError(401, 'Entre para continuar.', 'UNAUTHENTICATED'));
  if (!req.session.user.setup) return next(new HttpError(403, 'Só a conta de configuração gerencia os admins.'));
  next();
};

export const requireStage = (stage: Stage): RequestHandler => (req, _res, next) => {
  if (req.session?.stage === stage) return next();
  next(new HttpError(401, 'A verificação expirou. Entre de novo.', 'SESSION_EXPIRED'));
};

export const currentUser = (req: Request) => req.session!.user;

export async function purgeExpiredSessions(db: Queryable) {
  await db.query('DELETE FROM sessions WHERE expires_at <= now()');
}
