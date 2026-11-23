import type { AddressInfo } from 'node:net';
import { Secret, TOTP } from 'otpauth';
import { createApp } from '../src/app.ts';
import { bootstrap } from '../src/bootstrap.ts';
import { loadConfig } from '../src/config.ts';
import { createPool } from '../src/db.ts';
import { migrate } from '../src/migrate.ts';

/**
 * Tests run against a real PostgreSQL: TEST_DATABASE_URL (its tables are wiped on every start).
 * For example: podman run -d --rm -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=opendoc_test -p 127.0.0.1:55432:5432 postgres:18-alpine
 */
export const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://test:test@127.0.0.1:55432/opendoc_test';
/** The setup account (ADMIN_EMAIL / ADMIN_PASSWORD): password only, manages admins. */
export const setupAccount = { email: 'setup@example.com', password: 'setup-password-123456' };
const origin = 'http://localhost:5173';

export async function startServer() {
  const config = loadConfig({
    DATABASE_URL: databaseUrl,
    MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    ADMIN_EMAIL: setupAccount.email,
    ADMIN_PASSWORD: setupAccount.password,
    ADMIN_NAME: 'Configuração',
    APP_URL: origin,
  });
  const db = createPool(databaseUrl);
  await migrate(db);
  await db.query('TRUNCATE organization, users, sessions, projects, versions, pages, members, invitations, activity, rate_limits CASCADE');
  await bootstrap(db, config);
  const server = createApp(db, config).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    db,
    config,
    client: () => new Client(url),
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await db.end();
    },
  };
}

export interface Reply<T = any> { status: number; body: T; headers: Headers }

/** A browser stand-in: keeps the session cookie and sends the app's Origin. */
export class Client {
  url: string;
  cookie = '';
  constructor(url: string) {
    this.url = url;
  }

  async request<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Reply<T>> {
    const response = await fetch(this.url + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(method !== 'GET' ? { origin } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.getSetCookie().at(-1);
    if (setCookie) {
      const pair = setCookie.split(';')[0]!;
      this.cookie = pair.endsWith('=') ? '' : pair;
    }
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : undefined, headers: response.headers };
  }

  get = <T = any>(path: string) => this.request<T>('GET', path);
  post = <T = any>(path: string, body?: unknown) => this.request<T>('POST', path, body ?? {});
  put = <T = any>(path: string, body: unknown) => this.request<T>('PUT', path, body);
  patch = <T = any>(path: string, body: unknown) => this.request<T>('PATCH', path, body);
  delete = <T = any>(path: string) => this.request<T>('DELETE', path);
}

/** A code from `secret`, `steps` periods from now (codes can't be reused, so tests step forward). */
export function totp(secret: string, steps = 0) {
  return new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) }).generate({ timestamp: Date.now() + steps * 30_000 });
}


/**
 * The setup account invites `email` as an installation admin; a new client accepts it. The
 * returned client is signed in at stage "enroll" (authenticator not set up yet).
 */
export async function inviteAdmin(server: { client: () => Client }, email: string, password: string) {
  const setup = server.client();
  await setup.post('/api/auth/login', setupAccount);
  const invite = await setup.post('/api/admins/invitations', { emails: [email] });
  const token = String(invite.body.links?.[0]?.url ?? '').split('/convite/')[1];
  if (!token) throw new Error(`convite não criado: ${JSON.stringify(invite.body)}`);
  const client = server.client();
  const accepted = await client.post(`/api/invitations/${token}/accept`, { name: email.split('@')[0], password });
  if (accepted.status !== 201) throw new Error(JSON.stringify(accepted.body));
  return client;
}

/** An installation admin, signed in with the authenticator set up. */
export async function signedInAdmin(server: { client: () => Client }, email: string, password: string) {
  const client = await inviteAdmin(server, email, password);
  const setup = await client.post('/api/auth/mfa/setup');
  const enable = await client.post('/api/auth/mfa/enable', { code: totp(setup.body.secret) });
  if (enable.status !== 200) throw new Error(JSON.stringify(enable.body));
  return { client, secret: setup.body.secret as string, recoveryCodes: enable.body.recoveryCodes as string[] };
}

/** Someone invited to a project with `role` by `admin`, signed in with the authenticator set up. */
export async function projectMember(server: { client: () => Client }, admin: Client, projectId: string, email: string, role: 'admin' | 'editor' | 'viewer') {
  const invite = await admin.post(`/api/projects/${projectId}/invitations`, { emails: [email], role });
  const token = String(invite.body.links?.[0]?.url ?? '').split('/convite/')[1];
  if (!token) throw new Error(`convite não criado: ${JSON.stringify(invite.body)}`);
  const client = server.client();
  const accepted = await client.post(`/api/invitations/${token}/accept`, { name: email.split('@')[0], password: `${email}-senha-de-teste` });
  if (accepted.status !== 201) throw new Error(JSON.stringify(accepted.body));
  const setup = await client.post('/api/auth/mfa/setup');
  await client.post('/api/auth/mfa/enable', { code: totp(setup.body.secret) });
  return client;
}
