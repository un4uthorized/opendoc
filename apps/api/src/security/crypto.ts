import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';

/* Passwords: scrypt, stored as "scrypt$N$r$p$salt$hash". */

const scryptParams = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const passwordLength = { min: 15, max: 128 };

function derive(password: string, salt: Buffer, params: { N: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, 64, { ...params, maxmem: scryptParams.maxmem }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, scryptParams);
  return ['scrypt', scryptParams.N, scryptParams.r, scryptParams.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await derive(password, Buffer.from(salt, 'base64url'), { N: Number(N), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Spent when the email doesn't exist, so the response time doesn't reveal which accounts exist. */
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword('opendoc-timing-equalizer');
  await verifyPassword(password, await dummyHash);
}

/* Opaque tokens (sessions, invitations): only the SHA-256 is stored. */

export const newToken = () => randomBytes(32).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/* TOTP (RFC 6238): 6 digits, 30 s, SHA-1 — what every authenticator app supports. */

const period = 30;

export const newTotpSecret = () => new Secret({ size: 20 }).base32;

export function totpUri(secret: string, account: string, issuer = 'OpenDoc') {
  return new TOTP({ issuer, label: account, algorithm: 'SHA1', digits: 6, period, secret: Secret.fromBase32(secret) }).toString();
}

/**
 * Returns the time step the code matched, or null. Codes at or before `lastCounter` are rejected,
 * so a code can't be used twice.
 */
export function verifyTotp(secret: string, code: string, lastCounter = -1, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period, secret: Secret.fromBase32(secret) });
  const delta = totp.validate({ token: code, timestamp: now, window: 1 });
  if (delta === null) return null;
  const counter = Math.floor(now / (period * 1000)) + delta;
  return counter > lastCounter ? counter : null;
}

/* Authenticator secrets at rest: AES-256-GCM, bound to the user id (AAD). */

const aad = (userId: string) => Buffer.from(`opendoc:totp:v1:${userId}`);

export function encryptSecret(secret: string, key: Buffer, userId: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aad(userId));
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return ['v1', nonce, data, cipher.getAuthTag()].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.');
}

export function decryptSecret(encoded: string, key: Buffer, userId: string): string {
  const [version, nonce, data, tag] = encoded.split('.');
  if (version !== 'v1' || !nonce || !data || !tag) throw new Error('Segredo de MFA em formato inválido.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'base64url'));
  decipher.setAAD(aad(userId));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/* Recovery codes: 10 single-use codes, shown once, stored hashed. */

const normalizeRecovery = (code: string) => code.replace(/[-\s]/g, '').toUpperCase();
export const hashRecoveryCode = (code: string) => sha256(normalizeRecovery(code));

export function newRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => randomBytes(6).toString('hex').toUpperCase().replace(/(.{6})(.{6})/, '$1-$2'));
  return { codes, hashes: codes.map(hashRecoveryCode) };
}
