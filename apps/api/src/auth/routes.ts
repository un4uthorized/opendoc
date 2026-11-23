/**
 * Sign-in with mandatory authenticator (TOTP):
 *
 *   POST /login            email + password → session at stage "mfa" (or "enroll" with no authenticator yet)
 *   POST /mfa/verify       6-digit code or recovery code → stage "active"
 *   POST /mfa/setup        (enroll) new secret + QR code
 *   POST /mfa/enable       (enroll) first code → stage "active" + recovery codes
 *   GET  /me               current stage and user
 *   POST /logout
 */
import { Router } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { Config } from '../config.ts';
import { one, transaction, type Db } from '../db.ts';
import { HttpError, parse, route } from '../http.ts';
import {
  burnPasswordCheck, decryptSecret, encryptSecret, hashRecoveryCode, newRecoveryCodes, newTotpSecret, sha256, totpUri, verifyPassword, verifyTotp,
} from '../security/crypto.ts';
import { clear, hit } from '../security/rate-limit.ts';
import { dropSession, endSession, requireStage, rotateSession, startSession, type Session } from './sessions.ts';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email('E-mail inválido.'));
const code = z.string().trim().min(6).max(32);
const maxCodeAttempts = 5;

export const publicUser = (user: Session['user']) => ({
  id: user.id, name: user.name, email: user.email, owner: user.owner || undefined, setup: user.setup || undefined, admin: user.admin, mfa: user.mfa,
});

interface MfaRow { mfa_secret: string | null; mfa_pending_secret: string | null; mfa_last_counter: string; recovery_hashes: string[] }

export function authRoutes(db: Db, config: Config) {
  const router = Router();
  const ipKey = (ip: string | undefined) => sha256(ip ?? 'unknown');

  router.post('/login', route(async (req, res) => {
    const body = parse(z.object({ email, password: z.string().min(1).max(256) }), req.body);
    await hit(db, `login:ip:${ipKey(req.ip)}`, 50);
    await hit(db, `login:email:${sha256(body.email)}`, 10);

    const user = await one<{ id: string; password_hash: string; mfa: boolean; setup: boolean }>(db,
      'SELECT id, password_hash, (mfa_secret IS NOT NULL) AS mfa, setup FROM users WHERE email = $1', [body.email]);
    if (!user) {
      await burnPasswordCheck(body.password);
      throw new HttpError(401, 'E-mail ou senha incorretos.', 'INVALID_CREDENTIALS');
    }
    if (!(await verifyPassword(body.password, user.password_hash))) throw new HttpError(401, 'E-mail ou senha incorretos.', 'INVALID_CREDENTIALS');

    await clear(db, `login:email:${sha256(body.email)}`);
    // Whatever session this browser had is replaced, not upgraded.
    await dropSession(db, req);
    // The setup account has no authenticator: the password is all it takes (and all it can do is
    // manage admins). Everyone else goes on to the code, or to set up the authenticator.
    const stage = user.setup ? 'active' : user.mfa ? 'mfa' : 'enroll';
    await startSession(db, config, req, res, user.id, stage, user.setup);
    if (user.setup) await db.query('UPDATE users SET last_active_at = now() WHERE id = $1', [user.id]);
    res.json({ stage });
  }));

  router.get('/me', (req, res) => {
    if (!req.session) {
      res.status(401).json({ error: 'Entre para continuar.', code: 'UNAUTHENTICATED' });
      return;
    }
    res.json({ stage: req.session.stage, user: publicUser(req.session.user) });
  });

  router.post('/logout', route(async (req, res) => {
    await endSession(db, config, req, res);
    res.status(204).end();
  }));

  router.post('/mfa/verify', requireStage('mfa'), route(async (req, res) => {
    const session = req.session!;
    const body = parse(z.object({ code }), req.body);
    await hit(db, `mfa:user:${session.user.id}`, 10);

    const ok = await transaction(db, async (client) => {
      const row = await one<MfaRow>(client, 'SELECT mfa_secret, mfa_pending_secret, mfa_last_counter, recovery_hashes FROM users WHERE id = $1 FOR UPDATE', [session.user.id]);
      if (!row?.mfa_secret) return false;
      // Recovery code: single use.
      const recovery = hashRecoveryCode(body.code);
      if (row.recovery_hashes.includes(recovery)) {
        await client.query('UPDATE users SET recovery_hashes = array_remove(recovery_hashes, $2) WHERE id = $1', [session.user.id, recovery]);
        return true;
      }
      const counter = verifyTotp(decryptSecret(row.mfa_secret, config.mfaKey, session.user.id), body.code, Number(row.mfa_last_counter));
      if (counter === null) return false;
      await client.query('UPDATE users SET mfa_last_counter = $2 WHERE id = $1', [session.user.id, counter]);
      return true;
    });

    if (!ok) {
      // A few wrong codes end the half-open session: the password must be typed again.
      if (session.attempts + 1 >= maxCodeAttempts) await endSession(db, config, req, res);
      else await db.query('UPDATE sessions SET attempts = attempts + 1 WHERE token_hash = $1', [session.tokenHash]);
      throw new HttpError(401, 'Código inválido ou já usado. Espere o próximo código do app ou use um código de recuperação.', 'INVALID_CODE');
    }
    await clear(db, `mfa:user:${session.user.id}`);
    await rotateSession(db, config, req, res, 'active');
    await db.query('UPDATE users SET last_active_at = now() WHERE id = $1', [session.user.id]);
    res.json({ stage: 'active', user: publicUser(session.user) });
  }));

  router.post('/mfa/setup', requireStage('enroll'), route(async (req, res) => {
    const { user } = req.session!;
    const secret = newTotpSecret();
    const updated = await db.query('UPDATE users SET mfa_pending_secret = $2 WHERE id = $1 AND mfa_secret IS NULL', [user.id, encryptSecret(secret, config.mfaKey, user.id)]);
    if (!updated.rowCount) throw new HttpError(409, 'O autenticador já está configurado. Entre de novo.');
    const uri = totpUri(secret, user.email);
    res.json({ secret, uri, qrCode: await QRCode.toDataURL(uri, { width: 240, margin: 2, errorCorrectionLevel: 'M' }) });
  }));

  router.post('/mfa/enable', requireStage('enroll'), route(async (req, res) => {
    const session = req.session!;
    const body = parse(z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Digite os 6 números do app.') }), req.body);
    await hit(db, `mfa:user:${session.user.id}`, 10);
    const recovery = newRecoveryCodes();

    const ok = await transaction(db, async (client) => {
      const row = await one<MfaRow>(client, 'SELECT mfa_secret, mfa_pending_secret, mfa_last_counter, recovery_hashes FROM users WHERE id = $1 FOR UPDATE', [session.user.id]);
      if (!row?.mfa_pending_secret || row.mfa_secret) throw new HttpError(409, 'Comece a configuração do autenticador de novo.', 'MFA_SETUP_EXPIRED');
      const counter = verifyTotp(decryptSecret(row.mfa_pending_secret, config.mfaKey, session.user.id), body.code);
      if (counter === null) return false;
      await client.query(
        `UPDATE users SET mfa_secret = mfa_pending_secret, mfa_pending_secret = NULL, mfa_last_counter = $2,
                recovery_hashes = $3, updated_at = now(), last_active_at = now() WHERE id = $1`,
        [session.user.id, counter, recovery.hashes]);
      return true;
    });
    if (!ok) throw new HttpError(400, 'Código inválido. Confira o horário do celular e digite o código atual.', 'INVALID_CODE');

    await clear(db, `mfa:user:${session.user.id}`);
    await rotateSession(db, config, req, res, 'active');
    res.json({ stage: 'active', user: publicUser({ ...session.user, mfa: true }), recoveryCodes: recovery.codes });
  }));

  return router;
}
