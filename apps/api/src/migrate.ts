/**
 * Applies the SQL files in `migrations/` in name order, each once, in its own transaction. An
 * advisory lock keeps two instances starting together from running them twice.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPool, type Db } from './db.ts';

const directory = fileURLToPath(new URL('../migrations/', import.meta.url));

export async function migrate(db: Db): Promise<string[]> {
  const client = await db.connect();
  const applied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('opendoc:migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((row) => row.name));
    const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(directory + file, 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Falha na migration ${file}: ${(error as Error).message}`, { cause: error });
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('opendoc:migrations'))").catch(() => {});
    client.release();
  }
  return applied;
}

// `pnpm migrate`
if (import.meta.main) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DATABASE_URL.');
  const db = createPool(url);
  const applied = await migrate(db);
  console.log(applied.length ? `Aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado.');
  await db.end();
}
