/**
 * Sign-in calls to the API (apps/api/src/auth/routes.ts). The session lives in an httpOnly
 * cookie the browser sends by itself; nothing here stores a token.
 */

/** password checked, waiting for the code (mfa) or for the authenticator to be set up (enroll). */
export type Stage = 'mfa' | 'enroll' | 'active';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  owner?: boolean;
  /** The setup account (ADMIN_EMAIL): signs in with the password alone and only manages admins. */
  setup?: boolean;
  /** Owner, or admin of at least one project. */
  admin: boolean;
  mfa: boolean;
}

export interface Me {
  stage: Stage;
  user: SessionUser;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** JSON request to the API (same origin, session cookie sent by the browser). Errors carry the API's message. */
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor. Confira sua conexão e tente de novo.');
  }
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!response.ok) {
    const error = (data ?? {}) as { error?: string; code?: string };
    throw new ApiError(response.status, error.error ?? 'Algo deu errado. Tente de novo.', error.code);
  }
  return data as T;
}

/** The current session, or null when signed out. */
export async function getMe(): Promise<Me | null> {
  try {
    return await request<Me>('GET', '/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export const authApi = {
  login: (email: string, password: string) => request<{ stage: Stage }>('POST', '/auth/login', { email, password }),
  verify: (code: string) => request<Me>('POST', '/auth/mfa/verify', { code }),
  setup: () => request<{ secret: string; uri: string; qrCode: string }>('POST', '/auth/mfa/setup'),
  enable: (code: string) => request<Me & { recoveryCodes: string[] }>('POST', '/auth/mfa/enable', { code }),
  logout: () => request<void>('POST', '/auth/logout'),
};

/** Where a signed-in person starts: the setup account manages admins, admins go to the admin, everyone else to the docs. */
export const homeFor = (user: SessionUser) => (user.setup ? '/admins' : user.admin ? '/admin' : '/docs');

/* Invitations (the token in the link is the credential) */

export interface InvitationInfo {
  email: string;
  /** Invitation to be an admin of the installation (no project). */
  admin: boolean;
  project?: string;
  role: string;
  expiresAt: string;
}

export const invitationApi = {
  get: (token: string) => request<InvitationInfo>('GET', `/invitations/${encodeURIComponent(token)}`),
  accept: (token: string, name: string, password: string) =>
    request<{ stage: 'enroll' }>('POST', `/invitations/${encodeURIComponent(token)}/accept`, { name, password }),
};

/* Installation admins (setup account only) */

export interface AdminAccount { id: string; name: string; email: string; mfa: boolean; lastActiveAt?: string; createdAt: string }
export interface AdminInvitation { id: string; email: string; invitedAt: string; expiresAt: string; expired: boolean }
export interface InviteResult { added: number; invited: number; skipped: number; links: { email: string; url: string }[] }

export const adminsApi = {
  list: () => request<{ admins: AdminAccount[]; invitations: AdminInvitation[] }>('GET', '/admins'),
  invite: (emails: string[]) => request<InviteResult>('POST', '/admins/invitations', { emails }),
  resend: (id: string) => request<{ url: string }>('POST', `/admins/invitations/${id}/resend`),
  revoke: (id: string) => request<void>('DELETE', `/admins/invitations/${id}`),
  remove: (id: string) => request<void>('DELETE', `/admins/${id}`),
  resetMfa: (id: string) => request<void>('POST', `/admins/${id}/reset-mfa`),
};
