import type { Config } from './config.ts';
import { one, transaction, type Db } from './db.ts';
import { hashPassword, passwordLength, verifyPassword } from './security/crypto.ts';

/**
 * Every start: creates the organization row and keeps the setup account in line with ADMIN_EMAIL /
 * ADMIN_PASSWORD. The setup account signs in with the password alone and can only manage the
 * installation's admins, so the .env is its source of truth: changing ADMIN_PASSWORD (or the
 * email) there and restarting is how it is recovered.
 */
export async function bootstrap(db: Db, config: Config) {
  await db.query(`INSERT INTO organization (name, branding) VALUES ('OpenDoc', '{"name":"OpenDoc"}') ON CONFLICT DO NOTHING`);
  if (!config.admin) {
    const setup = await one(db, 'SELECT 1 FROM users WHERE setup');
    if (!setup) console.warn('Defina ADMIN_EMAIL e ADMIN_PASSWORD para criar a conta de configuração, que convida os admins.');
    return;
  }
  const { password, name } = config.admin;
  const email = config.admin.email.toLowerCase();
  if (password.length < passwordLength.min || password.length > passwordLength.max) {
    throw new Error(`ADMIN_PASSWORD precisa ter de ${passwordLength.min} a ${passwordLength.max} caracteres.`);
  }

  await transaction(db, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('opendoc:bootstrap'))");
    const current = await one<{ id: string; email: string }>(client, 'SELECT id, email FROM users WHERE setup');
    // Another email in .env: the previous setup account stops being one and loses its sessions.
    if (current && current.email !== email) {
      await client.query('UPDATE users SET setup = false WHERE id = $1', [current.id]);
      await client.query('DELETE FROM sessions WHERE user_id = $1', [current.id]);
    }
    const existing = await one<{ id: string; password_hash: string; setup: boolean }>(client, 'SELECT id, password_hash, setup FROM users WHERE email = $1', [email]);
    if (!existing) {
      await client.query('INSERT INTO users (name, email, password_hash, setup) VALUES ($1, $2, $3, true)', [name, email, await hashPassword(password)]);
      console.log(`Conta de configuração criada: ${email}`);
      return;
    }
    const samePassword = await verifyPassword(password, existing.password_hash);
    // An account that already had this email becomes the setup account: no authenticator, no
    // projects, no owner rights. Its sessions end so nothing keeps the old access.
    await client.query(
      `UPDATE users SET setup = true, owner = false, name = $2, mfa_secret = NULL, mfa_pending_secret = NULL,
              mfa_last_counter = -1, recovery_hashes = '{}', updated_at = now(),
              password_hash = COALESCE($3, password_hash)
        WHERE id = $1`,
      [existing.id, name, samePassword ? null : await hashPassword(password)]);
    await client.query('DELETE FROM members WHERE user_id = $1', [existing.id]);
    if (!existing.setup || !samePassword) {
      await client.query('DELETE FROM sessions WHERE user_id = $1', [existing.id]);
      console.log(`Conta de configuração atualizada: ${email}`);
    }
  });
}
