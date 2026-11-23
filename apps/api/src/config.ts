/**
 * Environment, read and validated once at startup: the server refuses to start with an unsafe or
 * incomplete configuration instead of failing later on the first request.
 */
export interface Config {
  production: boolean;
  host: string;
  port: number;
  databaseUrl: string;
  /** 32 bytes; encrypts the authenticator secrets at rest. */
  mfaKey: Buffer;
  secureCookies: boolean;
  /** Express `trust proxy`: 1 behind one trusted reverse proxy, false otherwise. */
  trustProxy: 1 | false;
  /** Origins allowed to send state-changing requests (CSRF check). Empty: same host only. */
  allowedOrigins: string[];
  /** Public URL of the web app, used to build invitation links. */
  appUrl: string;
  /** Built web app (apps/web/dist) to serve next to the API, as in the Docker image. Unset: API only. */
  webDir?: string;
  admin?: { email: string; password: string; name: string };
}

type Env = Record<string, string | undefined>;

function bool(env: Env, name: string): boolean | undefined {
  const value = env[name];
  if (value === undefined || value === '') return undefined;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new Error(`${name} deve ser true ou false.`);
}

export function parseMfaKey(value: string | undefined): Buffer {
  const encoded = value?.trim() ?? '';
  const key = /^[A-Za-z0-9+/]{43}=?$/.test(encoded) ? Buffer.from(encoded, 'base64') : null;
  if (!key || key.length !== 32) {
    throw new Error('MFA_ENCRYPTION_KEY deve ser uma chave aleatória de 32 bytes em Base64 (gere com: openssl rand -base64 32).');
  }
  return key;
}

export function loadConfig(env: Env = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const secure = bool(env, 'COOKIE_SECURE');
  if (production && secure === false) throw new Error('COOKIE_SECURE=false não é permitido em produção.');

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('Defina DATABASE_URL.');

  const port = Number(env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error('PORT inválida.');

  const appUrl = (env.APP_URL?.trim() || 'http://localhost:5173').replace(/\/+$/, '');
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
  allowedOrigins.push(new URL(appUrl).origin);

  const adminEmail = env.ADMIN_EMAIL?.trim();
  const adminPassword = env.ADMIN_PASSWORD;

  return {
    production,
    host: env.HOST?.trim() || '127.0.0.1',
    port,
    databaseUrl,
    mfaKey: parseMfaKey(env.MFA_ENCRYPTION_KEY),
    secureCookies: secure ?? production,
    trustProxy: bool(env, 'TRUST_PROXY') ? 1 : false,
    allowedOrigins: [...new Set(allowedOrigins)],
    appUrl,
    webDir: env.WEB_DIR?.trim() || undefined,
    admin: adminEmail && adminPassword ? { email: adminEmail, password: adminPassword, name: env.ADMIN_NAME?.trim() || 'Administrador' } : undefined,
  };
}
