/**
 * The signed-in person's own account, and accepting an invitation (which creates an account).
 */
import { Router } from 'express';
import { z } from 'zod';
import type { Config } from '../config.ts';
import { one, transaction, type Db } from '../db.ts';
import { HttpError, parse, route } from '../http.ts';
import {
  decryptSecret, hashPassword, newRecoveryCodes, passwordLength, sha256, verifyPassword, verifyTotp,
} from '../security/crypto.ts';
import { hit } from '../security/rate-limit.ts';
import { publicUser } from '../auth/routes.ts';
import { currentUser, dropSession, endOtherSessions, requireUser, startSession } from '../auth/sessions.ts';

const password = z.string()
  .min(passwordLength.min, `A senha precisa ter pelo menos ${passwordLength.min} caracteres.`)
  .max(passwordLength.max, `A senha pode ter até ${passwordLength.max} caracteres.`);
const name = z.string().trim().min(1).max(128);
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** project_id null: an invitation to be an admin of the installation (role "owner"). */
interface InvitationRow { id: string; email: string; role: string; project_id: string | null; project_name: string | null; expires_at: Date }

async function findInvitation(db: Db, rawToken: unknown) {
  const parsed = token.safeParse(rawToken);
  const row = parsed.success
    ? await one<InvitationRow>(db,
      `SELECT i.id, i.email, i.role, i.project_id, p.name AS project_name, i.expires_at
         FROM invitations i LEFT JOIN projects p ON p.id = i.project_id
        WHERE i.token_hash = $1 AND i.expires_at > now()`, [sha256(parsed.data)])
    : undefined;
  if (!row) throw new HttpError(404, 'Convite inválido ou expirado. Peça um novo a quem convidou você.', 'INVITATION_INVALID');
  return row;
}

export function accountRoutes(db: Db, config: Config) {
  const router = Router();

  /* Invitations (public: the token in the link is the credential) */

  router.get('/invitations/:token', route(async (req, res) => {
    await hit(db, `invite:ip:${sha256(req.ip ?? '')}`, 60);
    const invitation = await findInvitation(db, req.params.token);
    res.json({
      email: invitation.email,
      role: invitation.role,
      project: invitation.project_name ?? undefined,
      admin: invitation.project_id === null,
      expiresAt: invitation.expires_at.toISOString(),
    });
  }));

  /** Creates the account and signs in at stage "enroll": the authenticator comes next. */
  router.post('/invitations/:token/accept', route(async (req, res) => {
    await hit(db, `invite:ip:${sha256(req.ip ?? '')}`, 60);
    const body = parse(z.object({ name, password }).strict(), req.body);
    const invitation = await findInvitation(db, req.params.token);
    const passwordHash = await hashPassword(body.password);
    const userId = await transaction(db, async (client) => {
      // Locks the invitation: two tabs accepting at once create one account.
      const locked = await client.query('DELETE FROM invitations WHERE id = $1 AND expires_at > now() RETURNING id', [invitation.id]);
      if (!locked.rowCount) throw new HttpError(404, 'Convite inválido ou expirado.', 'INVITATION_INVALID');
      // An admin invitation (this one or another pending for the same email) makes an owner, who
      // sees every project; otherwise every pending project invitation becomes a membership.
      const owner = invitation.project_id === null
        || Boolean(await one(client, 'SELECT 1 FROM invitations WHERE email = $1 AND project_id IS NULL AND expires_at > now()', [invitation.email]));
      const user = await one<{ id: string }>(client,
        'INSERT INTO users (name, email, password_hash, owner) VALUES ($1, $2, $3, $4) RETURNING id', [body.name, invitation.email, passwordHash, owner]);
      if (!owner) {
        await client.query(
          `INSERT INTO members (project_id, user_id, role)
           SELECT project_id, $1::uuid, role FROM invitations WHERE email = $2 AND project_id IS NOT NULL AND expires_at > now()
           UNION ALL SELECT $3::uuid, $1::uuid, $4
           ON CONFLICT DO NOTHING`, [user!.id, invitation.email, invitation.project_id, invitation.role]);
      }
      await client.query('DELETE FROM invitations WHERE email = $1', [invitation.email]);
      return user!.id;
    });
    await dropSession(db, req);
    await startSession(db, config, req, res, userId, 'enroll');
    res.status(201).json({ stage: 'enroll' });
  }));

  /* Own account (signed in) */

  router.patch('/account', requireUser, route(async (req, res) => {
    const body = parse(z.object({ name }).strict(), req.body);
    const user = currentUser(req);
    await db.query('UPDATE users SET name = $2, updated_at = now() WHERE id = $1', [user.id, body.name]);
    res.json(publicUser({ ...user, name: body.name }));
  }));

  /** Signs out every other session. */
  router.put('/account/password', requireUser, route(async (req, res) => {
    const body = parse(z.object({ currentPassword: z.string().max(256), newPassword: password }).strict(), req.body);
    const user = currentUser(req);
    await hit(db, `password:user:${user.id}`, 10);
    const row = await one<{ password_hash: string }>(db, 'SELECT password_hash FROM users WHERE id = $1', [user.id]);
    if (!row || !(await verifyPassword(body.currentPassword, row.password_hash))) throw new HttpError(400, 'A senha atual está incorreta.', 'INVALID_PASSWORD');
    await db.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [user.id, await hashPassword(body.newPassword)]);
    await endOtherSessions(db, user.id, req.session!.tokenHash);
    res.status(204).end();
  }));

  /** New recovery codes (the old ones stop working); needs a current authenticator code. */
  router.post('/account/recovery-codes', requireUser, route(async (req, res) => {
    const body = parse(z.object({ code: z.string().trim() }).strict(), req.body);
    const user = currentUser(req);
    await hit(db, `mfa:user:${user.id}`, 10);
    const recovery = newRecoveryCodes();
    await transaction(db, async (client) => {
      const row = await one<{ mfa_secret: string | null; mfa_last_counter: string }>(client,
        'SELECT mfa_secret, mfa_last_counter FROM users WHERE id = $1 FOR UPDATE', [user.id]);
      const counter = row?.mfa_secret ? verifyTotp(decryptSecret(row.mfa_secret, config.mfaKey, user.id), body.code, Number(row.mfa_last_counter)) : null;
      if (counter === null) throw new HttpError(400, 'Código inválido ou já usado.', 'INVALID_CODE');
      await client.query('UPDATE users SET mfa_last_counter = $2, recovery_hashes = $3 WHERE id = $1', [user.id, counter, recovery.hashes]);
    });
    res.json({ recoveryCodes: recovery.codes });
  }));

  return router;
}
