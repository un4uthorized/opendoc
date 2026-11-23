/**
 * The admin's data, from the API (apps/api/src/admin/routes.ts). The whole visible state comes
 * from GET /api/admin/state; every mutation calls its route and then reloads that state, so every
 * screen (lists, history, counts) stays in step with the server. The functions keep the names and
 * return shapes the views already use.
 */
import { useSyncExternalStore } from 'react';
import { stringify } from 'yaml';
import { request } from '../../../auth/api';
import { openapi } from '../../docs/openapi';
import type { AdminState, Branding, DocPage, NavigationSettings, Project, ProjectRole, Visibility } from './types';

/** The sample spec, in YAML like every spec the admin keeps, with only the API (its guide is wiki content). */
export const sampleSpec = () => {
  const { description: _guide, ...info } = openapi.info;
  return stringify({ ...openapi, info }, { lineWidth: 0 });
};

type Snapshot = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; state: AdminState };

let snapshot: Snapshot = { status: 'loading' };
let loading: Promise<AdminState> | undefined;
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

/** Reloads everything the admin shows. */
export function refresh(): Promise<AdminState> {
  loading = request<AdminState>('GET', '/admin/state')
    .then((state) => { publish({ status: 'ready', state }); return state; })
    .catch((error: unknown) => {
      // A failed reload keeps what is on screen; only the first load shows the error.
      if (snapshot.status !== 'ready') publish({ status: 'error', message: errorMessage(error) });
      throw error;
    })
    .finally(() => { loading = undefined; });
  return loading;
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Loading state for the page shell; starts the first load. */
export function useAdminSnapshot(): Snapshot {
  const current = useSyncExternalStore(subscribe, () => snapshot);
  if (current.status === 'loading' && !loading) void refresh().catch(() => {});
  return current;
}

/** The loaded state. Only for components rendered after the shell saw it load. */
export function useAdminState(): AdminState {
  const current = useSyncExternalStore(subscribe, () => snapshot);
  if (current.status !== 'ready') throw new Error('Os dados do admin ainda não carregaram.');
  return current.state;
}

/** Calls the API, reloads the state and returns the project as it is now. */
async function changeProject(projectId: string, work: () => Promise<unknown>): Promise<Project> {
  await work();
  const state = await refresh();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error('Projeto não encontrado.');
  return project;
}

const projectPath = (projectId: string, rest = '') => `/projects/${projectId}${rest}`;
const versionPath = (projectId: string, versionId: string, rest = '') => projectPath(projectId, `/versions/${versionId}${rest}`);

export interface InviteResult { added: number; invited: number; skipped: number; links: { email: string; url: string }[] }

export const adminApi = {
  /* Organization */
  updateOrganization: async (change: { name?: string; branding?: Branding }) => {
    await request('PATCH', '/organization', change);
    await refresh();
  },

  /* Projects */
  /** `draft` starts v1 with that spec; `sample` with the sample spec. */
  createProject: async (input: { name: string; slug: string; description?: string; visibility: Visibility; sample: boolean; draft?: string }) => {
    const { sample, draft, ...rest } = input;
    const start = sample ? sampleSpec() : draft;
    const created = await request<Project>('POST', '/projects', { ...rest, ...(start ? { draft: start } : {}) });
    await refresh();
    return created;
  },
  updateProject: (projectId: string, change: Partial<Pick<Project, 'name' | 'slug' | 'description' | 'visibility' | 'playground' | 'defaultVersionId' | 'branding'>>) => {
    // An optional field set to undefined means "clear it", which JSON can only say with null.
    const body = Object.fromEntries(Object.entries(change).map(([key, value]) => [key, value === undefined ? null : value]));
    return changeProject(projectId, () => request('PATCH', projectPath(projectId), body));
  },
  deleteProject: async (projectId: string) => {
    await request('DELETE', projectPath(projectId));
    await refresh();
  },

  /* Versions and spec */
  createVersion: async (projectId: string, name: string, copyFrom?: string) => {
    const { versionId } = await request<{ versionId: string }>('POST', projectPath(projectId, '/versions'), { name, ...(copyFrom ? { copyFrom } : {}) });
    await refresh();
    return versionId;
  },
  saveDraft: (projectId: string, versionId: string, draft: string) =>
    changeProject(projectId, () => request('PUT', versionPath(projectId, versionId, '/draft'), { draft })),
  discardDraft: (projectId: string, versionId: string) =>
    changeProject(projectId, () => request('DELETE', versionPath(projectId, versionId, '/draft'))),
  publish: (projectId: string, versionId: string, spec: string) =>
    changeProject(projectId, () => request('POST', versionPath(projectId, versionId, '/publish'), { spec })),
  /** Puts a past published spec back as the version's draft (from Histórico). */
  restoreSnapshot: (projectId: string, activityId: string) =>
    changeProject(projectId, () => request('POST', projectPath(projectId, `/activity/${activityId}/restore`))),
  saveChangelog: (projectId: string, versionId: string, changelog: string) =>
    changeProject(projectId, () => request('PUT', versionPath(projectId, versionId, '/changelog'), { changelog })),
  setVersionDeprecated: (projectId: string, versionId: string, deprecated: boolean) =>
    changeProject(projectId, () => request('PATCH', versionPath(projectId, versionId), { deprecated })),
  deleteVersion: (projectId: string, versionId: string) =>
    changeProject(projectId, () => request('DELETE', versionPath(projectId, versionId))),

  /* Navigation */
  saveNavigation: (projectId: string, navigation: NavigationSettings) =>
    changeProject(projectId, () => request('PUT', projectPath(projectId, '/navigation'), navigation)),

  /* Guide pages */
  savePage: (projectId: string, page: Omit<DocPage, 'id'> & { id?: string }) => {
    const { id, ...body } = page;
    return changeProject(projectId, () => (id
      ? request('PUT', projectPath(projectId, `/pages/${id}`), body)
      : request('POST', projectPath(projectId, '/pages'), body)));
  },
  movePage: (projectId: string, pageId: string, offset: -1 | 1) =>
    changeProject(projectId, () => request('POST', projectPath(projectId, `/pages/${pageId}/move`), { offset })),
  deletePage: (projectId: string, pageId: string) =>
    changeProject(projectId, () => request('DELETE', projectPath(projectId, `/pages/${pageId}`))),

  /* Project users and invitations. Accounts are shared; access is per project. */
  /**
   * Emails with an account get access right away; the others get an invitation link, returned
   * here to be sent by whoever invited (the server sends no email).
   */
  invite: async (projectId: string, emails: string[], role: ProjectRole): Promise<InviteResult> => {
    const result = await request<InviteResult>('POST', projectPath(projectId, '/invitations'), { emails, role });
    await refresh();
    return result;
  },
  setMemberRole: (projectId: string, userIds: string[], role: ProjectRole) =>
    changeProject(projectId, () => request('PATCH', projectPath(projectId, '/members'), { userIds, role })),
  removeMembers: (projectId: string, userIds: string[]) =>
    changeProject(projectId, () => request('POST', projectPath(projectId, '/members/remove'), { userIds })),
  /** New link and new expiry; the old link stops working. */
  resendInvitation: async (invitationId: string) => {
    const result = await request<{ url: string }>('POST', `/invitations/${invitationId}/resend`);
    await refresh();
    return result;
  },
  revokeInvitation: async (invitationId: string) => {
    await request('DELETE', `/invitations/${invitationId}`);
    await refresh();
  },
  /** The authenticator belongs to the account, so this affects every project the person uses. */
  resetMfa: async (userId: string) => {
    await request('POST', `/users/${userId}/reset-mfa`);
    await refresh();
  },
};

/** Runs an API call and turns a failure into an error toast-friendly message. */
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Algo deu errado. Tente de novo.';
}
