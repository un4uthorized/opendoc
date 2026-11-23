import { createApp } from './app.ts';
import { bootstrap } from './bootstrap.ts';
import { loadConfig } from './config.ts';
import { createPool } from './db.ts';
import { migrate } from './migrate.ts';
import { purgeExpiredSessions } from './auth/sessions.ts';
import { purgeExpired } from './security/rate-limit.ts';

const config = loadConfig();
const db = createPool(config.databaseUrl);

const applied = await migrate(db);
if (applied.length) console.log(`Migrations aplicadas: ${applied.join(', ')}`);
await bootstrap(db, config);

const server = createApp(db, config).listen(config.port, config.host, () => {
  console.log(`API em http://${config.host}:${config.port}/api`);
});

const cleanup = setInterval(() => {
  Promise.all([purgeExpiredSessions(db), purgeExpired(db), db.query('DELETE FROM invitations WHERE expires_at < now() - interval \'30 days\'')])
    .catch((error) => console.error('Limpeza falhou:', error));
}, 15 * 60_000);
cleanup.unref();

function shutdown() {
  server.close(() => db.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
