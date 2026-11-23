/**
 * Reads rows and returns them in the shapes the web app uses (apps/web/src/pages/admin/data/types.ts):
 * camelCase, ISO dates, optional fields left out instead of null.
 */
import { many, one, type Queryable } from '../db.ts';
import type { SessionUser } from '../auth/sessions.ts';
import { atLeast, type Access, type ProjectRole } from './access.ts';

export interface ImagePair { light?: string; dark?: string }
export interface Branding { name: string; label?: string; logo?: ImagePair; symbol?: ImagePair; accent?: string }
export interface Navigation { order: string[]; labels: Record<string, string>; hidden: string[] }
type ActivityKind = 'spec' | 'content' | 'access' | 'settings';
export interface Snapshot { versionId: string; versionName: string; spec: string }

const iso = (date: Date | null | undefined) => date?.toISOString();
/** Drops undefined keys so JSON matches the web app's optional fields. */
const compact = <T extends object>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

interface ProjectRow {
  id: string; name: string; slug: string; description: string | null; visibility: 'public' | 'private'; branding: Branding | null;
  playground: boolean; default_version_id: string | null; navigation: Navigation; created_at: Date; updated_at: Date;
}
interface VersionRow {
  id: string; project_id: string; name: string; spec: string; draft: string | null; changelog: string | null;
  deprecated: boolean; published_at: Date | null; updated_at: Date;
}
interface PageRow { id: string; project_id: string; title: string; slug: string; body: string }
interface MemberRow { project_id: string; user_id: string; role: ProjectRole }

const projectColumns = 'id, name, slug, description, visibility, branding, playground, default_version_id, navigation, created_at, updated_at';

/** Projects with versions, pages and members. Drafts only for editors and up; members only for admins. */
async function loadProjects(db: Queryable, rows: ProjectRow[], accessById: Map<string, Access>) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [versions, pages, members] = await Promise.all([
    many<VersionRow>(db, 'SELECT * FROM versions WHERE project_id = ANY($1) ORDER BY created_at, name', [ids]),
    many<PageRow>(db, 'SELECT id, project_id, title, slug, body FROM pages WHERE project_id = ANY($1) ORDER BY position', [ids]),
    many<MemberRow>(db, 'SELECT m.project_id, m.user_id, m.role FROM members m JOIN users u ON u.id = m.user_id WHERE m.project_id = ANY($1) ORDER BY u.name', [ids]),
  ]);
  return rows.map((row) => {
    const access = accessById.get(row.id);
    const canEdit = atLeast(access, 'editor');
    return compact({
      id: row.id,
      /** What the signed-in person may do here: owner, admin, editor or viewer. */
      access,
      name: row.name,
      slug: row.slug,
      description: row.description ?? undefined,
      visibility: row.visibility,
      branding: row.branding ?? undefined,
      playground: row.playground,
      defaultVersionId: row.default_version_id ?? '',
      versions: versions.filter((version) => version.project_id === row.id).map((version) => ({
        id: version.id,
        name: version.name,
        spec: version.spec,
        draft: canEdit ? version.draft ?? undefined : undefined,
        publishedAt: iso(version.published_at),
        updatedAt: iso(version.updated_at)!,
        deprecated: version.deprecated || undefined,
        changelog: version.changelog ?? undefined,
      })),
      pages: pages.filter((page) => page.project_id === row.id).map(({ id, title, slug, body }) => ({ id, title, slug, body })),
      members: atLeast(access, 'admin')
        ? members.filter((member) => member.project_id === row.id).map(({ user_id, role }) => ({ userId: user_id, role }))
        : [],
      navigation: row.navigation,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    });
  });
}

export async function getProject(db: Queryable, projectId: string, access: Access) {
  const rows = await many<ProjectRow>(db, `SELECT ${projectColumns} FROM projects WHERE id = $1`, [projectId]);
  return (await loadProjects(db, rows, new Map([[projectId, access]])))[0]!;
}

export async function getOrganization(db: Queryable) {
  const row = await one<{ name: string; branding: Branding }>(db, 'SELECT name, branding FROM organization');
  return { id: 'org', name: row?.name ?? 'OpenDoc', branding: row?.branding ?? { name: 'OpenDoc' } };
}

/** Everything the admin shows, filtered by what this user may see (`AdminState` in the web app). */
export async function getAdminState(db: Queryable, user: SessionUser) {
  const projectRows = user.owner
    ? await many<ProjectRow & { role: null }>(db, `SELECT ${projectColumns}, NULL AS role FROM projects ORDER BY name`)
    : await many<ProjectRow & { role: ProjectRole }>(db,
      `SELECT ${projectColumns.split(', ').map((column) => `p.${column}`).join(', ')}, m.role
         FROM projects p JOIN members m ON m.project_id = p.id AND m.user_id = $1
        -- The panel is for working on projects: where the person only reads, the docs are the place.
        WHERE m.role IN ('admin', 'editor')
        ORDER BY p.name`, [user.id]);
  const accessById = new Map<string, Access>(projectRows.map((row) => [row.id, row.role ?? 'owner']));
  const ids = (minimum: Access) => projectRows.filter((row) => atLeast(accessById.get(row.id), minimum)).map((row) => row.id);
  const adminIds = ids('admin');
  const editorIds = ids('editor');

  const [organization, projects, users, invitations, activity] = await Promise.all([
    getOrganization(db),
    loadProjects(db, projectRows, accessById),
    // The owner sees every account; project admins see the people in their projects.
    many<{ id: string; name: string; email: string; owner: boolean; mfa: boolean; last_active_at: Date | null }>(db,
      `SELECT id, name, email, owner, (mfa_secret IS NOT NULL) AS mfa, last_active_at FROM users
        WHERE NOT setup AND ($1 OR id = $2 OR owner OR id IN (SELECT user_id FROM members WHERE project_id = ANY($3)))
        ORDER BY name`, [user.owner, user.id, adminIds]),
    many<{ id: string; email: string; project_id: string; role: ProjectRole; invited_at: Date; expires_at: Date }>(db,
      'SELECT id, email, project_id, role, invited_at, expires_at FROM invitations WHERE project_id = ANY($1) ORDER BY invited_at DESC', [adminIds]),
    many<{ id: string; project_id: string; user_id: string | null; kind: ActivityKind; message: string; at: Date; snapshot: Snapshot | null }>(db,
      'SELECT id, project_id, user_id, kind, message, at, snapshot FROM activity WHERE project_id = ANY($1) ORDER BY at DESC LIMIT 300', [editorIds]),
  ]);

  return {
    organization,
    currentUserId: user.id,
    users: users.map((row) => compact({ id: row.id, name: row.name, email: row.email, owner: row.owner || undefined, mfa: row.mfa, lastActiveAt: iso(row.last_active_at) })),
    invitations: invitations.map((row) => ({ id: row.id, email: row.email, projectId: row.project_id, role: row.role, invitedAt: iso(row.invited_at)!, expiresAt: iso(row.expires_at)! })),
    projects,
    activity: activity.map((row) => compact({
      id: row.id, projectId: row.project_id, userId: row.user_id ?? '', kind: row.kind, message: row.message, at: iso(row.at)!, snapshot: row.snapshot ?? undefined,
    })),
  };
}

/** Records who did what in a project (the admin's Histórico). */
export async function logActivity(db: Queryable, projectId: string, userId: string, kind: ActivityKind, message: string, snapshot?: Snapshot) {
  await db.query('INSERT INTO activity (project_id, user_id, kind, message, snapshot) VALUES ($1, $2, $3, $4, $5)', [projectId, userId, kind, message, snapshot ?? null]);
}

export async function touchProject(db: Queryable, projectId: string) {
  await db.query('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId]);
}
