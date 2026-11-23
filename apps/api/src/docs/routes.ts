/**
 * What the public documentation (/docs) reads: only published versions, never drafts. Public
 * projects are open to anyone; private ones need a signed-in member (or the owner). A private
 * project answers 404 to everyone else, so its existence isn't revealed.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Config } from '../config.ts';
import { many, one, type Db } from '../db.ts';
import { notFound, parse, route } from '../http.ts';
import { sha256 } from '../security/crypto.ts';
import { hit } from '../security/rate-limit.ts';
import { projectAccess } from '../admin/access.ts';
import { getOrganization, type Branding, type Navigation } from '../admin/repository.ts';

interface Row {
  id: string; name: string; slug: string; description: string | null; visibility: 'public' | 'private'; branding: Branding | null;
  playground: boolean; default_version_id: string | null; navigation: Navigation;
}

/** What the docs send while someone reads: a page view or a search (from ⌘K, when it closes). */
const event = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('view'),
    page: z.string().min(1).max(200),
    label: z.string().max(300).optional(),
    method: z.string().max(10).optional(),
    path: z.string().max(500).optional(),
  }).strict(),
  z.object({
    kind: z.literal('search'),
    query: z.string().trim().min(1).max(200),
    results: z.number().int().min(0).max(10_000),
  }).strict(),
]);

export function docsRoutes(db: Db, config: Config) {
  const router = Router();

  /** The project behind a docs address, if this visitor may read it (private ones: members only). */
  async function visibleProject(req: Request) {
    const project = await one<Row>(db,
      'SELECT id, name, slug, description, visibility, branding, playground, default_version_id, navigation FROM projects WHERE slug = $1',
      [String(req.params.slug).toLowerCase()]);
    if (!project) throw notFound('Documentação');
    if (project.visibility === 'private') {
      const user = req.session?.stage === 'active' ? req.session.user : undefined;
      if (!user || !(await projectAccess(db, user, project.id))) throw notFound('Documentação');
    }
    return project;
  }

  /**
   * Analytics events. The visitor is a hash of the day, the IP and the browser, salted with a
   * server secret: unique visitors can be counted, but nobody can be followed across days or
   * identified from the database.
   */
  router.post('/docs/:slug/events', route(async (req, res) => {
    const input = parse(event, req.body);
    const project = await visibleProject(req);
    await hit(db, `events:ip:${sha256(req.ip ?? '')}`, 1000);
    const day = new Date().toISOString().slice(0, 10);
    const visitor = sha256(`${config.mfaKey.toString('base64')}:${day}:${req.ip ?? ''}:${req.get('user-agent') ?? ''}`);
    if (input.kind === 'view') {
      await db.query(
        'INSERT INTO docs_events (project_id, kind, page, label, method, path, visitor) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [project.id, 'view', input.page, input.label ?? null, input.method?.toUpperCase() ?? null, input.path ?? null, visitor]);
    } else {
      await db.query(
        'INSERT INTO docs_events (project_id, kind, query, results, visitor) VALUES ($1, $2, $3, $4, $5)',
        [project.id, 'search', input.query, input.results, visitor]);
    }
    res.status(204).end();
  }));

  /**
   * The documentations this visitor can open, with something published: public ones for
   * everyone, plus the private ones of the signed-in person's projects (all of them for owners).
   */
  router.get('/docs', route(async (req, res) => {
    const user = req.session?.stage === 'active' ? req.session.user : undefined;
    const rows = await many<{ name: string; slug: string; description: string | null }>(db,
      `SELECT p.name, p.slug, p.description FROM projects p
        WHERE EXISTS (SELECT 1 FROM versions v WHERE v.project_id = p.id AND v.published_at IS NOT NULL)
          AND (p.visibility = 'public' OR $1::boolean
               OR EXISTS (SELECT 1 FROM members m WHERE m.project_id = p.id AND m.user_id = $2::uuid))
        ORDER BY p.name`,
      [user?.owner ?? false, user?.id ?? null]);
    res.set('Cache-Control', 'private, no-store');
    res.json(rows.map((row) => ({ name: row.name, slug: row.slug, description: row.description ?? undefined })));
  }));

  router.get('/docs/:slug', route(async (req, res) => {
    const project = await visibleProject(req);
    res.set('Cache-Control', project.visibility === 'private' ? 'private, no-store' : 'public, max-age=60');

    const [organization, versions, pages] = await Promise.all([
      getOrganization(db),
      many<{ id: string; name: string; spec: string; changelog: string | null; deprecated: boolean; published_at: Date }>(db,
        'SELECT id, name, spec, changelog, deprecated, published_at FROM versions WHERE project_id = $1 AND published_at IS NOT NULL ORDER BY created_at, name', [project.id]),
      many<{ id: string; title: string; slug: string; body: string }>(db, 'SELECT id, title, slug, body FROM pages WHERE project_id = $1 ORDER BY position', [project.id]),
    ]);

    res.json({
      name: project.name,
      slug: project.slug,
      description: project.description ?? undefined,
      // No project branding: the organization's.
      branding: project.branding ?? organization.branding,
      playground: project.playground,
      navigation: project.navigation,
      defaultVersionId: versions.some((version) => version.id === project.default_version_id) ? project.default_version_id : versions.at(-1)?.id,
      versions: versions.map((version) => ({
        id: version.id,
        name: version.name,
        spec: version.spec,
        changelog: version.changelog ?? undefined,
        deprecated: version.deprecated || undefined,
        publishedAt: version.published_at.toISOString(),
      })),
      pages,
    });
  }));

  return router;
}
