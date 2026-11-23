/**
 * Access is per project. The installation owner can do everything; everyone else has a role in
 * each project they belong to:
 *   viewer — reads the docs (private ones too)
 *   editor — spec, versions, pages, navigation and branding
 *   admin  — also members, invitations and the project's settings
 */
import { one, type Queryable } from '../db.ts';
import { forbidden, notFound } from '../http.ts';
import type { SessionUser } from '../auth/sessions.ts';

export type ProjectRole = 'admin' | 'editor' | 'viewer';
export type Access = ProjectRole | 'owner';

const rank: Record<Access, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

export const atLeast = (access: Access | null | undefined, minimum: Access) => !!access && rank[access] >= rank[minimum];

export async function projectAccess(db: Queryable, user: SessionUser, projectId: string): Promise<Access | null> {
  if (user.owner) return (await one(db, 'SELECT 1 FROM projects WHERE id = $1', [projectId])) ? 'owner' : null;
  const row = await one<{ role: ProjectRole }>(db, 'SELECT role FROM members WHERE project_id = $1 AND user_id = $2', [projectId, user.id]);
  return row?.role ?? null;
}

/**
 * Throws unless the user has at least `minimum` in the project. Projects the user can't see at
 * all answer 404, so their existence isn't revealed.
 */
export async function requireProject(db: Queryable, user: SessionUser, projectId: string, minimum: Access): Promise<Access> {
  const access = await projectAccess(db, user, projectId);
  if (!access) throw notFound('Projeto');
  if (!atLeast(access, minimum)) throw forbidden();
  return access;
}

export function requireOwner(user: SessionUser) {
  if (!user.owner) throw forbidden();
}
