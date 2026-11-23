/**
 * Admin data model. One organization per installation; each project has its own spec versions,
 * guide pages, branding override, users and invitations. An account (login + authenticator) is
 * shared across projects, but access is always granted per project. The server will expose these
 * same shapes.
 */

/** admin: everything in the project, including its users · editor: content · viewer: reads the docs. */
export type ProjectRole = 'admin' | 'editor' | 'viewer';
export type Visibility = 'public' | 'private';

/** Image per theme; either may be missing, and the other one is used in its place. */
export interface ImagePair {
  light?: string;
  dark?: string;
}

/** Same fallback chain as the docs: full logo → symbol + name → OpenDoc mark + name. */
export interface Branding {
  name: string;
  label?: string;
  logo?: ImagePair;
  symbol?: ImagePair;
  /** Accent color (hex). */
  accent?: string;
}

export interface Organization {
  id: string;
  name: string;
  branding: Branding;
}

export interface User {
  id: string;
  name: string;
  email: string;
  /** Installation owner: sees and manages every project and creates new ones. */
  owner?: boolean;
  mfa: boolean;
  lastActiveAt?: string;
}

export interface Invitation {
  id: string;
  email: string;
  projectId: string;
  role: ProjectRole;
  invitedAt: string;
  expiresAt: string;
}

export interface DocPage {
  id: string;
  title: string;
  slug: string;
  body: string;
}

export interface ProjectVersion {
  id: string;
  /** e.g. "v1", "2024-06". */
  name: string;
  /** Published spec (JSON text); empty until the first publish. */
  spec: string;
  /** Unpublished edits. */
  draft?: string;
  publishedAt?: string;
  updatedAt: string;
  deprecated?: boolean;
  /** Release notes in Markdown, shown in the docs' changelog. */
  changelog?: string;
}

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
}

/** How the API reference is grouped, independent of the spec. Keys are tag names. */
export interface NavigationSettings {
  /** Tag order; tags missing here keep the spec's order, after these. */
  order: string[];
  /** Display names that replace the tag name. */
  labels: Record<string, string>;
  /** Hidden tags, or single endpoints as "GET /path". */
  hidden: string[];
}

export type ActivityKind = 'spec' | 'content' | 'access' | 'settings';

export interface Activity {
  id: string;
  projectId: string;
  userId: string;
  kind: ActivityKind;
  /** Sentence after the person's name: "publicou a v1". */
  message: string;
  at: string;
  /** For publishes: the spec that went live, so it can be restored. */
  snapshot?: { versionId: string; versionName: string; spec: string };
}

export interface Project {
  id: string;
  /** What the signed-in person may do in this project (from the API). */
  access?: ProjectRole | 'owner';
  name: string;
  slug: string;
  description?: string;
  visibility: Visibility;
  /** Undefined: inherits the organization's branding. */
  branding?: Branding;
  playground: boolean;
  defaultVersionId: string;
  versions: ProjectVersion[];
  pages: DocPage[];
  members: ProjectMember[];
  navigation: NavigationSettings;
  createdAt: string;
  updatedAt: string;
}

export interface AdminState {
  organization: Organization;
  currentUserId: string;
  users: User[];
  invitations: Invitation[];
  projects: Project[];
  activity: Activity[];
}

export const projectRoleLabels: Record<ProjectRole, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Leitor' };
export const projectRoleDescriptions: Record<ProjectRole, string> = {
  admin: 'Tudo no projeto, inclusive usuários e configurações.',
  editor: 'Muda spec, páginas e aparência.',
  viewer: 'Só lê a documentação.',
};
export const visibilityLabels: Record<Visibility, string> = { public: 'Pública', private: 'Privada' };


/** An absolute http(s) URL. */
export const isHttpUrl = (value: string) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

/** Paths under /admin that can't be project slugs. */
export const reservedSlugs = new Set(['org', 'novo', 'conta']);

