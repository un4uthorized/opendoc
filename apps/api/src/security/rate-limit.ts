import { HttpError } from '../http.ts';
import type { Queryable } from '../db.ts';

/**
 * Fixed-window counter in Postgres, so every API instance shares it. One atomic upsert per hit:
 * an expired window restarts at 1.
 */
export async function hit(db: Queryable, key: string, maximum: number, windowMs = 15 * 60_000) {
  const { rows } = await db.query<{ count: number; expires_at: Date }>(
    `INSERT INTO rate_limits (key, count, expires_at) VALUES ($1, 1, now() + $2 * interval '1 millisecond')
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.expires_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
       expires_at = CASE WHEN rate_limits.expires_at <= now() THEN excluded.expires_at ELSE rate_limits.expires_at END
     RETURNING count, expires_at`,
    [key, windowMs],
  );
  const row = rows[0]!;
  if (row.count > maximum) {
    const retryAfter = Math.max(1, Math.ceil((row.expires_at.getTime() - Date.now()) / 1000));
    throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.', 'RATE_LIMITED', retryAfter);
  }
}

export async function clear(db: Queryable, key: string) {
  await db.query('DELETE FROM rate_limits WHERE key = $1', [key]);
}

export async function purgeExpired(db: Queryable) {
  await db.query('DELETE FROM rate_limits WHERE expires_at <= now()');
}
