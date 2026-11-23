import type { RequestHandler } from 'express';
import type { Config } from '../config.ts';
import { HttpError } from '../http.ts';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Second line of defense next to SameSite=Lax: a state-changing request must come from the app's
 * own origin. Browsers always send Origin on fetch POST/PUT/PATCH/DELETE; requests with neither
 * Origin nor Sec-Fetch-Site come from non-browser clients, which carry no ambient cookies.
 * Bodies are only parsed as JSON, so a cross-site HTML form can't produce a valid request either.
 */
export function csrfProtection(config: Config): RequestHandler {
  return (req, _res, next) => {
    if (safeMethods.has(req.method)) return next();
    const origin = req.get('origin');
    if (origin) {
      const self = `${req.protocol}://${req.get('host')}`;
      if (origin === self || config.allowedOrigins.includes(origin)) return next();
      return next(new HttpError(403, 'Origem não permitida.', 'CSRF'));
    }
    const site = req.get('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'none') return next(new HttpError(403, 'Origem não permitida.', 'CSRF'));
    next();
  };
}
