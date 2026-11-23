/**
 * The installation's admins (owners), managed only by the setup account, mounted at /api/admins:
 *
 *   GET    /                            admins and pending admin invitations
 *   POST   /invitations                 invite by email (existing accounts are promoted at once)
 *   POST   /invitations/:id/resend      new link, new expiry
 *   DELETE /invitations/:id
 *   DELETE /:userId                     stops being an admin (the account stays)
 *   POST   /:userId/reset-mfa           sets up the authenticator again at the next login
 *
 * Invited admins sign in with password + authenticator, like everyone except the setup account.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { Config } from '../config.ts';
import { many, one, transaction, type Db } from '../db.ts';
import { HttpError, idParam, notFound, parse, route } from '../http.ts';
import { newToken, sha256 } from '../security/crypto.ts';
import { endOtherSessions, requireSetup } from '../auth/sessions.ts';

const invitationTtlMs = 7 * 86_400_000;
const emails = z.object({
  emails: z.array(z.string().trim().toLowerCase().max(254).pipe(z.email('E-mail inválido.'))).min(1).max(50),
}).strict();

export function adminsRoutes(db: Db, config: Config) {
  const router = Router();
  router.use(requireSetup);
  const inviteUrl = (token: string) => `${config.appUrl}/convite/${token}`;

  router.get('/', route(async (_req, res) => {
    const [admins, invitations] = await Promise.all([
      many<{ id: string; name: string; email: string; mfa: boolean; last_active_at: Date | null; created_at: Date }>(db,
        'SELECT id, name, email, (mfa_secret IS NOT NULL) AS mfa, last_active_at, created_at FROM users WHERE owner ORDER BY name'),
      many<{ id: string; email: string; invited_at: Date; expires_at: Date }>(db,
        'SELECT id, email, invited_at, expires_at FROM invitations WHERE project_id IS NULL ORDER BY invited_at DESC'),
    ]);
    res.json({
      admins: admins.map((row) => ({
        id: row.id, name: row.name, email: row.email, mfa: row.mfa,
        lastActiveAt: row.last_active_at?.toISOString(), createdAt: row.created_at.toISOString(),
      })),
      invitations: invitations.map((row) => ({
        id: row.id, email: row.email, invitedAt: row.invited_at.toISOString(), expiresAt: row.expires_at.toISOString(),
        expired: row.expires_at.getTime() <= Date.now(),
      })),
    });
  }));

  /**
   * Emails with an account become admins right away; the others get an invitation link, returned
   * here to be sent by the setup account (the server sends no email).
   */
  router.post('/invitations', route(async (req, res) => {
    const input = parse(emails, req.body);
    let added = 0;
    let skipped = 0;
    const links: { email: string; url: string }[] = [];
    await transaction(db, async (client) => {
      for (const email of new Set(input.emails)) {
        const account = await one<{ id: string; owner: boolean; setup: boolean }>(client, 'SELECT id, owner, setup FROM users WHERE email = $1', [email]);
        if (account) {
          if (account.owner || account.setup) { skipped++; continue; }
          await client.query('UPDATE users SET owner = true, updated_at = now() WHERE id = $1', [account.id]);
          added++;
          continue;
        }
        const token = newToken();
        const inserted = await client.query(
          `INSERT INTO invitations (project_id, email, role, token_hash, invited_by, expires_at)
           VALUES (NULL, $1, 'owner', $2, $3, now() + $4 * interval '1 millisecond')
           ON CONFLICT (email) WHERE project_id IS NULL DO NOTHING`,
          [email, sha256(token), req.session!.user.id, invitationTtlMs]);
        if (inserted.rowCount) links.push({ email, url: inviteUrl(token) });
        else skipped++;
      }
    });
    res.json({ added, invited: links.length, skipped, links });
  }));

  router.post('/invitations/:invitationId/resend', route(async (req, res) => {
    const invitationId = idParam(req, 'invitationId', 'Convite');
    const token = newToken();
    const updated = await db.query(
      `UPDATE invitations SET token_hash = $2, invited_at = now(), expires_at = now() + $3 * interval '1 millisecond'
        WHERE id = $1 AND project_id IS NULL`, [invitationId, sha256(token), invitationTtlMs]);
    if (!updated.rowCount) throw notFound('Convite');
    res.json({ url: inviteUrl(token) });
  }));

  router.delete('/invitations/:invitationId', route(async (req, res) => {
    const invitationId = idParam(req, 'invitationId', 'Convite');
    const deleted = await db.query('DELETE FROM invitations WHERE id = $1 AND project_id IS NULL', [invitationId]);
    if (!deleted.rowCount) throw notFound('Convite');
    res.status(204).end();
  }));

  /** The account stays (with its project memberships, if any); it just stops being an admin. */
  router.delete('/:userId', route(async (req, res) => {
    const userId = idParam(req, 'userId', 'Admin');
    const updated = await db.query('UPDATE users SET owner = false, updated_at = now() WHERE id = $1 AND owner', [userId]);
    if (!updated.rowCount) throw notFound('Admin');
    await endOtherSessions(db, userId);
    res.status(204).end();
  }));

  router.post('/:userId/reset-mfa', route(async (req, res) => {
    const userId = idParam(req, 'userId', 'Admin');
    const updated = await db.query(
      `UPDATE users SET mfa_secret = NULL, mfa_pending_secret = NULL, mfa_last_counter = -1, recovery_hashes = '{}', updated_at = now()
        WHERE id = $1 AND owner`, [userId]);
    if (!updated.rowCount) throw new HttpError(404, 'Admin não encontrado.');
    await endOtherSessions(db, userId);
    res.status(204).end();
  }));

  return router;
}
