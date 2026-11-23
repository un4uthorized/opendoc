import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { errorHandler, HttpError } from './http.ts';
import { csrfProtection } from './security/csrf.ts';
import { loadSession } from './auth/sessions.ts';
import { authRoutes } from './auth/routes.ts';
import { accountRoutes } from './account/routes.ts';
import { adminRoutes } from './admin/routes.ts';
import { adminsRoutes } from './admins/routes.ts';
import { docsRoutes } from './docs/routes.ts';

export function createApp(db: Db, config: Config) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // JSON only: the API serves no HTML.
  app.use(helmet({ contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(express.json({ limit: '6mb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  api.get('/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  });

  api.use(csrfProtection(config));
  api.use(loadSession(db, config));
  api.use('/auth', authRoutes(db, config));
  api.use(accountRoutes(db, config));
  api.use(docsRoutes(db, config));
  // Before adminRoutes, which turns away the setup account on every path it sees.
  api.use('/admins', adminsRoutes(db, config));
  api.use(adminRoutes(db, config));
  api.use((_req, _res, next) => next(new HttpError(404, 'Rota não encontrada.')));

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
