import { existsSync } from 'node:fs';
import { join } from 'node:path';
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

  app.use(express.json({ limit: '6mb' }));
  app.use(cookieParser());

  const api = express.Router();
  // JSON only: nothing under /api is a page, so its responses may load nothing at all.
  api.use(helmet({ contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
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
  if (config.webDir) serveWeb(app, config.webDir);
  app.use(errorHandler);
  return app;
}

/**
 * The built web app (Docker image): its files, and index.html for every other path so the
 * client-side routes (/admin, /docs/:slug, /convite/:token) load on refresh. Hashed assets are
 * cached for a year; index.html never, so a deploy shows up at once.
 */
function serveWeb(app: express.Express, webDir: string) {
  const index = join(webDir, 'index.html');
  if (!existsSync(index)) throw new Error(`WEB_DIR não tem index.html: ${webDir}`);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Editors (CodeMirror) and diagrams (Mermaid) set styles inline.
        styleSrc: ["'self'", "'unsafe-inline'"],
        // Logos are links to anywhere; responses shown in the test client become blob: URLs.
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'https:'],
        fontSrc: ["'self'", 'data:'],
        // The docs' test client calls the documented API, wherever it is.
        connectSrc: ["'self'", 'https:', 'http:'],
        frameSrc: ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  }));
  app.use('/assets', express.static(join(webDir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(webDir, { index: false, maxAge: '1h' }));
  app.get('/{*path}', (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
