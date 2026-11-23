/**
 * Admin API, mounted at /api. Mirrors `adminApi` in apps/web/src/pages/admin/data/store.ts: each
 * mutation returns the same shape the web app's stand-in store returns (usually the full project).
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Config } from '../config.ts';
import { many, one, transaction, type Db, type Queryable } from '../db.ts';
import { HttpError, forbidden, idParam, notFound, parse, route } from '../http.ts';
import { newToken, sha256 } from '../security/crypto.ts';
import { currentUser, endOtherSessions, requireUser } from '../auth/sessions.ts';
import { atLeast, projectAccess, requireOwner, requireProject, type Access } from './access.ts';
import { getAdminState, getOrganization, getProject, logActivity, touchProject } from './repository.ts';
import * as schema from './schemas.ts';

const invitationTtlMs = 7 * 86_400_000;
const roleNames = { admin: 'admin', editor: 'editor', viewer: 'leitor' } as const;

async function versionName(db: Queryable, projectId: string, versionId: string) {
  const row = await one<{ name: string }>(db, 'SELECT name FROM versions WHERE id = $1 AND project_id = $2', [versionId, projectId]);
  if (!row) throw notFound('Versão');
  return row.name;
}

async function names(db: Queryable, userIds: string[]) {
  return (await many<{ name: string }>(db, 'SELECT name FROM users WHERE id = ANY($1) ORDER BY name', [userIds])).map((row) => row.name).join(', ');
}

export function adminRoutes(db: Db, config: Config) {
  const router = Router();
  router.use(requireUser);

  const inviteUrl = (token: string) => `${config.appUrl}/convite/${token}`;

  /** Runs `work` in a transaction after checking access; answers with the updated project. */
  async function projectChange(req: Request, minimum: Access, work: (client: Queryable, projectId: string, access: Access) => Promise<void>) {
    const user = currentUser(req);
    const projectId = idParam(req, 'projectId', 'Projeto');
    return transaction(db, async (client) => {
      const access = await requireProject(client, user, projectId, minimum);
      // Serializes concurrent edits of the same project (page order, default version…).
      await client.query('SELECT 1 FROM projects WHERE id = $1 FOR UPDATE', [projectId]);
      await work(client, projectId, access);
      await touchProject(client, projectId);
      return getProject(client, projectId, access);
    });
  }

  /* State */

  /** The admin panel's data: owners, project admins and editors. Everyone else reads the docs. */
  router.get('/admin/state', route(async (req, res) => {
    const user = currentUser(req);
    if (!user.admin) throw forbidden();
    res.json(await getAdminState(db, user));
  }));

  /* Organization (owner) */

  router.patch('/organization', route(async (req, res) => {
    requireOwner(currentUser(req));
    const change = parse(schema.organizationPatch, req.body);
    await db.query(
      'UPDATE organization SET name = COALESCE($1, name), branding = COALESCE($2, branding)',
      [change.name ?? null, change.branding ?? null]);
    res.json(await getOrganization(db));
  }));

  /* Projects */

  router.post('/projects', route(async (req, res) => {
    const user = currentUser(req);
    requireOwner(user);
    const input = parse(schema.projectCreate, req.body);
    const project = await transaction(db, async (client) => {
      const created = await one<{ id: string }>(client,
        'INSERT INTO projects (name, slug, description, visibility) VALUES ($1, $2, $3, $4) RETURNING id',
        [input.name, input.slug, input.description || null, input.visibility]);
      const version = await one<{ id: string }>(client,
        'INSERT INTO versions (project_id, name, draft) VALUES ($1, $2, $3) RETURNING id', [created!.id, 'v1', input.draft ?? null]);
      await client.query('UPDATE projects SET default_version_id = $2 WHERE id = $1', [created!.id, version!.id]);
      await logActivity(client, created!.id, user.id, 'settings', 'criou o projeto');
      return getProject(client, created!.id, 'owner');
    });
    res.status(201).json(project);
  }));

  router.patch('/projects/:projectId', route(async (req, res) => {
    const change = parse(schema.projectPatch, req.body);
    const user = currentUser(req);
    // The default version is content (editors); everything else, branding included, is a setting (admins).
    const settingsKeys = ['name', 'slug', 'description', 'visibility', 'playground', 'branding'] as const;
    const touchesSettings = settingsKeys.some((key) => key in change);
    res.json(await projectChange(req, touchesSettings ? 'admin' : 'editor', async (client, projectId) => {
      const columns: Record<string, unknown> = {};
      if (change.name !== undefined) columns.name = change.name;
      if (change.slug !== undefined) columns.slug = change.slug;
      if (change.description !== undefined) columns.description = change.description || null;
      if (change.visibility !== undefined) columns.visibility = change.visibility;
      if (change.playground !== undefined) columns.playground = change.playground;
      if (change.branding !== undefined) columns.branding = change.branding;
      if (change.defaultVersionId !== undefined) {
        await versionName(client, projectId, change.defaultVersionId);
        columns.default_version_id = change.defaultVersionId;
      }
      const keys = Object.keys(columns);
      if (!keys.length) return;
      await client.query(
        `UPDATE projects SET ${keys.map((key, index) => `${key} = $${index + 2}`).join(', ')} WHERE id = $1`,
        [projectId, ...Object.values(columns)]);

      let message = 'alterou as configurações';
      let kind: 'spec' | 'settings' = 'settings';
      if (change.defaultVersionId) { kind = 'spec'; message = `definiu a ${await versionName(client, projectId, change.defaultVersionId)} como versão padrão`; }
      else if ('branding' in change) message = 'alterou a aparência';
      else if (change.visibility) message = `deixou a documentação ${change.visibility === 'public' ? 'pública' : 'privada'}`;
      await logActivity(client, projectId, user.id, kind, message);
    }));
  }));

  router.delete('/projects/:projectId', route(async (req, res) => {
    const projectId = idParam(req, 'projectId', 'Projeto');
    // Access first: outside the project it doesn't exist (404); inside, only owners delete (403).
    await requireProject(db, currentUser(req), projectId, 'owner');
    const deleted = await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
    if (!deleted.rowCount) throw notFound('Projeto');
    res.status(204).end();
  }));

  /* Versions and spec (editors) */

  router.post('/projects/:projectId/versions', route(async (req, res) => {
    const input = parse(schema.versionCreate, req.body);
    const user = currentUser(req);
    let versionId = '';
    const project = await projectChange(req, 'editor', async (client, projectId) => {
      let draft: string | null = null;
      if (input.copyFrom) {
        const source = await one<{ spec: string; draft: string | null }>(client, 'SELECT spec, draft FROM versions WHERE id = $1 AND project_id = $2', [input.copyFrom, projectId]);
        if (!source) throw notFound('Versão');
        draft = source.draft ?? source.spec;
      }
      const row = await one<{ id: string }>(client, 'INSERT INTO versions (project_id, name, draft) VALUES ($1, $2, $3) RETURNING id', [projectId, input.name, draft]);
      versionId = row!.id;
      await logActivity(client, projectId, user.id, 'spec', `criou a versão ${input.name}`);
    });
    res.status(201).json({ versionId, project });
  }));

  router.put('/projects/:projectId/versions/:versionId/draft', route(async (req, res) => {
    const { draft } = parse(z.object({ draft: schema.specText }).strict(), req.body);
    const versionId = idParam(req, 'versionId', 'Versão');
    res.json(await projectChange(req, 'editor', async (client, projectId) => {
      const name = await versionName(client, projectId, versionId);
      await client.query('UPDATE versions SET draft = $2, updated_at = now() WHERE id = $1', [versionId, draft]);
      await logActivity(client, projectId, currentUser(req).id, 'spec', `salvou um rascunho da ${name}`);
    }));
  }));

  router.delete('/projects/:projectId/versions/:versionId/draft', route(async (req, res) => {
    const versionId = idParam(req, 'versionId', 'Versão');
    res.json(await projectChange(req, 'editor', async (client, projectId) => {
      await versionName(client, projectId, versionId);
      await client.query('UPDATE versions SET draft = NULL, updated_at = now() WHERE id = $1', [versionId]);
    }));
  }));

  router.post('/projects/:projectId/versions/:versionId/publish', route(async (req, res) => {
    const { spec } = parse(z.object({ spec: schema.specText.min(1, 'A spec está vazia.') }).strict(), req.body);
    const versionId = idParam(req, 'versionId', 'Versão');
    res.json(await projectChange(req, 'editor', async (client, projectId) => {
      const name = await versionName(client, projectId, versionId);
      await client.query('UPDATE versions SET spec = $2, draft = NULL, published_at = now(), updated_at = now() WHERE id = $1', [versionId, spec]);
      await logActivity(client, projectId, currentUser(req).id, 'spec', `publicou a ${name}`, { versionId, versionName: name, spec });
    }));
  }));

  router.put('/projects/:projectId/versions/:versionId/changelog', route(async (req, res) => {
    const { changelog } = parse(z.object({ changelog: z.string().max(200_000) }).strict(), req.body);
    const versionId = idParam(req, 'versionId', 'Versão');
    res.json(await projectChange(req, 'editor', async (client, projectId) => {
      const name = await versionName(client, projectId, versionId);
      await client.query('UPDATE versions SET changelog = $2 WHERE id = $1', [versionId, changelog.trim() || null]);
      await logActivity(client, projectId, currentUser(req).id, 'content', `editou o changelog da ${name}`);
    }));
  }));

  router.patch('/projects/:projectId/versions/:versionId', route(async (req, res) => {
    const { deprecated } = parse(z.object({ deprecated: z.boolean() }).strict(), req.body);
    const versionId = idParam(req, 'versionId', 'Versão');
    res.json(await projectChange(req, 'editor', async (client, projectId) => {
      await versionName(client, projectId, versionId);
      await client.query('UPDATE versions SET deprecated = $2 WHERE id = $1', [versionId, deprecated]);
    }));
  }));

  router.delete('/projects/:projectId/versions/:versionId', route(async (req, res) => {
    const versionId = idParam(req, 'versionId', 'Versão');
    res.json(await projectChange(req, 'editor', async (client, projectId) => {
      const name = await versionName(client, projectId, versionId);
      const project = await one<{ default_version_id: string }>(client, 'SELECT default_version_id FROM projects WHERE id = $1', [projectId]);
      if (project?.default_version_id === versionId) throw new HttpError(409, 'Escolha outra versão padrão antes de excluir esta.');
      await client.query('DELETE FROM versions WHERE id = $1', [versionId]);
      await logActivity(client, projectId, currentUser(req).id, 'spec', `excluiu a versão ${name}`);
    }));
  }));

  /**
   * A project's history, newest first, a page at a time (the overview's infinite list). The cursor
   * is the last item's id: the next page starts right after it, so items added meanwhile don't
   * shift or repeat what was already shown.
   */
  router.get('/projects/:projectId/activity', route(async (req, res) => {
    const projectId = idParam(req, 'projectId', 'Projeto');
    await requireProject(db, currentUser(req), projectId, 'editor');
    const { limit, after } = parse(z.object({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      after: z.uuid().optional(),
    }), req.query);
    const cursor = after
      ? await one<{ at: Date }>(db, 'SELECT at FROM activity WHERE id = $1 AND project_id = $2', [after, projectId])
      : undefined;
    if (after && !cursor) throw notFound('Registro');
    const rows = await many<{ id: string; user_id: string | null; user_name: string | null; kind: string; message: string; at: Date; snapshot: unknown }>(db,
      `SELECT a.id, a.user_id, u.name AS user_name, a.kind, a.message, a.at, a.snapshot
         FROM activity a LEFT JOIN users u ON u.id = a.user_id
        WHERE a.project_id = $1 AND ($2::timestamptz IS NULL OR (a.at, a.id) < ($2, $3::uuid))
        ORDER BY a.at DESC, a.id DESC
        LIMIT $4`,
      [projectId, cursor?.at ?? null, after ?? null, limit + 1]);
    const page = rows.slice(0, limit);
    res.json({
      items: page.map((row) => ({
        id: row.id,
        userId: row.user_id ?? '',
        userName: row.user_name ?? undefined,
        kind: row.kind,
        message: row.message,
        at: row.at.toISOString(),
        ...(row.snapshot ? { snapshot: row.snapshot } : {}),
      })),
      next: rows.length > limit ? page.at(-1)!.id : undefined,
    });
  }));

  /**
   * The project's docs usage over the last 7, 30 or 90 days (Analytics): views and unique visitors
   * (with the previous period, for the trend), views per day, the most read endpoints and wiki
   * pages, and searches, with the terms that found nothing.
   */
  router.get('/projects/:projectId/analytics', route(async (req, res) => {
    const projectId = idParam(req, 'projectId', 'Projeto');
    await requireProject(db, currentUser(req), projectId, 'admin');
    const { days } = parse(z.object({ days: z.enum(['7', '30', '90']).default('30').transform(Number) }), req.query);
    const since = `now() - make_interval(days => $2)`;
    const [totals, daily, endpoints, pages, missed] = await Promise.all([
      one<{ visits: number; visitors: number; previous: number; searches: number; missed: number }>(db,
        `SELECT
           count(*) FILTER (WHERE kind = 'view' AND at >= ${since})::int AS visits,
           count(DISTINCT visitor) FILTER (WHERE kind = 'view' AND at >= ${since})::int AS visitors,
           count(*) FILTER (WHERE kind = 'view' AND at < ${since} AND at >= now() - make_interval(days => $2 * 2))::int AS previous,
           count(*) FILTER (WHERE kind = 'search' AND at >= ${since})::int AS searches,
           count(*) FILTER (WHERE kind = 'search' AND results = 0 AND at >= ${since})::int AS missed
         FROM docs_events WHERE project_id = $1 AND at >= now() - make_interval(days => $2 * 2)`,
        [projectId, days]),
      many<{ day: string; views: number }>(db,
        `SELECT to_char(day, 'YYYY-MM-DD') AS day, count(e.id)::int AS views
           FROM generate_series(current_date - ($2::int - 1), current_date, interval '1 day') AS day
           LEFT JOIN docs_events e ON e.project_id = $1 AND e.kind = 'view' AND e.at >= day AND e.at < day + interval '1 day'
          GROUP BY day ORDER BY day`,
        [projectId, days]),
      many<{ method: string; path: string; label: string | null; views: number }>(db,
        `SELECT method, path, max(label) AS label, count(*)::int AS views FROM docs_events
          WHERE project_id = $1 AND kind = 'view' AND method IS NOT NULL AND at >= ${since}
          GROUP BY method, path ORDER BY views DESC, path LIMIT 8`,
        [projectId, days]),
      many<{ page: string; label: string | null; views: number }>(db,
        `SELECT page, max(label) AS label, count(*)::int AS views FROM docs_events
          WHERE project_id = $1 AND kind = 'view' AND page LIKE 'pagina-%' AND at >= ${since}
          GROUP BY page ORDER BY views DESC, page LIMIT 8`,
        [projectId, days]),
      many<{ term: string; count: number }>(db,
        `SELECT lower(query) AS term, count(*)::int AS count FROM docs_events
          WHERE project_id = $1 AND kind = 'search' AND results = 0 AND at >= ${since}
          GROUP BY lower(query) ORDER BY count DESC, term LIMIT 6`,
        [projectId, days]),
    ]);
    res.json({
      days,
      visits: totals?.visits ?? 0,
      previousVisits: totals?.previous ?? 0,
      visitors: totals?.visitors ?? 0,
      searches: totals?.searches ?? 0,
      searchesWithoutResults: totals?.missed ?? 0,
      daily: daily.map((row) => ({ day: row.day, views: row.views })),
      endpoints: endpoints.map((row) => ({ method: row.method, path: row.path, label: row.label ?? undefined, views: row.views })),
      pages: pages.map((row) => ({ page: row.page, title: row.label ?? row.page, views: row.views })),
      missedSearches: missed,
    });
  }));

  /** Puts a past published spec back as its version's draft (Histórico). */
  router.post('/projects/:projectId/activity/:activityId/restore', route(async (req, res) => {
    const activityId = idParam(req, 'activityId', 'Registro');
    res.json(await projectChange(req, 'editor', async (client, projectId) => {
      const entry = await one<{ at: Date; snapshot: { versionId: string; versionName: string; spec: string } | null }>(client,
        'SELECT at, snapshot FROM activity WHERE id = $1 AND project_id = $2', [activityId, projectId]);
      if (!entry) throw notFound('Registro');
      if (!entry.snapshot) throw new HttpError(400, 'Esse registro não tem uma spec para restaurar.');
      const { versionId, versionName: name, spec } = entry.snapshot;
      const updated = await client.query('UPDATE versions SET draft = $3, updated_at = now() WHERE id = $1 AND project_id = $2', [versionId, projectId, spec]);
      if (!updated.rowCount) throw new HttpError(409, `A versão ${name} foi excluída.`);
      await logActivity(client, projectId, currentUser(req).id, 'spec', `restaurou como rascunho a ${name} publicada em ${entry.at.toLocaleDateString('pt-BR')}`);
    }));
  }));

  /* Navigation and guide pages (editors) */

  router.put('/projects/:projectId/navigation', route(async (req, res) => {
    const navigation = parse(schema.navigation, req.body);
    res.json(await projectChange(req, 'editor', async (client, projectId) => {
      await client.query('UPDATE projects SET navigation = $2 WHERE id = $1', [projectId, navigation]);
      await logActivity(client, projectId, currentUser(req).id, 'content', 'reorganizou a navegação da referência');
    }));
  }));

  router.post('/projects/:projectId/pages', route(async (req, res) => {
    const input = parse(schema.page, req.body);
    res.status(201).json(await projectChange(req, 'editor', async (client, projectId) => {
      await client.query(
        'INSERT INTO pages (project_id, title, slug, body, position) VALUES ($1, $2, $3, $4, (SELECT COALESCE(max(position), -1) + 1 FROM pages WHERE project_id = $1))',
        [projectId, input.title, input.slug, input.body]);
      await logActivity(client, projectId, currentUser(req).id, 'content', `criou a página “${input.title}”`);
    }));
  }));

  router.put('/projects/:projectId/pages/:pageId', route(async (req, res) => {
    const input = parse(schema.page, req.body);
    const pageId = idParam(req, 'pageId', 'Página');
    res.json(await projectChange(req, 'editor', async (client, projectId) => {
      const updated = await client.query('UPDATE pages SET title = $3, slug = $4, body = $5 WHERE id = $1 AND project_id = $2', [pageId, projectId, input.title, input.slug, input.body]);
      if (!updated.rowCount) throw notFound('Página');
      await logActivity(client, projectId, currentUser(req).id, 'content', `editou a página “${input.title}”`);
    }));
  }));

  router.post('/projects/:projectId/pages/:pageId/move', route(async (req, res) => {
    const { offset } = parse(z.object({ offset: z.union([z.literal(-1), z.literal(1)]) }).strict(), req.body);
    const pageId = idParam(req, 'pageId', 'Página');
    res.json(await projectChange(req, 'editor', async (client, projectId) => {
      const pages = await many<{ id: string; position: number }>(client, 'SELECT id, position FROM pages WHERE project_id = $1 ORDER BY position', [projectId]);
      const from = pages.findIndex((page) => page.id === pageId);
      if (from < 0) throw notFound('Página');
      const other = pages[from + offset];
      if (!other) return;
      await client.query('UPDATE pages SET position = CASE id WHEN $1::uuid THEN $3::int WHEN $2::uuid THEN $4::int END WHERE id IN ($1, $2)',
        [pageId, other.id, other.position, pages[from]!.position]);
    }));
  }));

  router.delete('/projects/:projectId/pages/:pageId', route(async (req, res) => {
    const pageId = idParam(req, 'pageId', 'Página');
    res.json(await projectChange(req, 'editor', async (client, projectId) => {
      const deleted = await one<{ title: string }>(client, 'DELETE FROM pages WHERE id = $1 AND project_id = $2 RETURNING title', [pageId, projectId]);
      if (!deleted) throw notFound('Página');
      await logActivity(client, projectId, currentUser(req).id, 'content', `excluiu a página “${deleted.title}”`);
    }));
  }));

  /* Members and invitations (project admins). Accounts are shared; access is per project. */

  /**
   * Emails that already have an account get access right away; the others get an invitation link
   * (returned here, to be sent by the admin: the server sends no email). People who already have
   * access or a pending invitation are skipped.
   */
  router.post('/projects/:projectId/invitations', route(async (req, res) => {
    const input = parse(schema.invite, req.body);
    const user = currentUser(req);
    const emails = [...new Set(input.emails)];
    let added = 0;
    let skipped = 0;
    const links: { email: string; url: string }[] = [];
    const project = await projectChange(req, 'admin', async (client, projectId) => {
      for (const email of emails) {
        const account = await one<{ id: string; owner: boolean; setup: boolean; member: boolean }>(client,
          'SELECT id, owner, setup, EXISTS (SELECT 1 FROM members WHERE project_id = $2 AND user_id = users.id) AS member FROM users WHERE email = $1', [email, projectId]);
        if (account) {
          // Owners already see everything; the setup account never joins projects.
          if (account.owner || account.setup || account.member) { skipped++; continue; }
          await client.query('INSERT INTO members (project_id, user_id, role) VALUES ($1, $2, $3)', [projectId, account.id, input.role]);
          added++;
          continue;
        }
        const token = newToken();
        const inserted = await client.query(
          `INSERT INTO invitations (project_id, email, role, token_hash, invited_by, expires_at)
           VALUES ($1, $2, $3, $4, $5, now() + $6 * interval '1 millisecond') ON CONFLICT (project_id, email) DO NOTHING`,
          [projectId, email, input.role, sha256(token), user.id, invitationTtlMs]);
        if (inserted.rowCount) links.push({ email, url: inviteUrl(token) });
        else skipped++;
      }
      if (added || links.length) {
        const list = emails.slice(0, 3).join(', ') + (emails.length > 3 ? ` e mais ${emails.length - 3}` : '');
        await logActivity(client, projectId, user.id, 'access', `deu acesso como ${roleNames[input.role]} para ${list}`);
      }
    });
    res.json({ added, invited: links.length, skipped, links, project });
  }));

  router.patch('/projects/:projectId/members', route(async (req, res) => {
    const input = parse(schema.userIds.extend({ role: schema.role }), req.body);
    res.json(await projectChange(req, 'admin', async (client, projectId) => {
      await client.query('UPDATE members SET role = $3 WHERE project_id = $1 AND user_id = ANY($2)', [projectId, input.userIds, input.role]);
      await logActivity(client, projectId, currentUser(req).id, 'access', `mudou o papel de ${await names(client, input.userIds)}`);
    }));
  }));

  router.post('/projects/:projectId/members/remove', route(async (req, res) => {
    const { userIds } = parse(schema.userIds, req.body);
    const user = currentUser(req);
    res.json(await projectChange(req, 'admin', async (client, projectId) => {
      // After the permission check: only admins get to hear about this rule.
      if (userIds.includes(user.id)) throw new HttpError(400, 'Você não pode remover o próprio acesso.');
      const removed = await names(client, userIds);
      await client.query('DELETE FROM members WHERE project_id = $1 AND user_id = ANY($2)', [projectId, userIds]);
      await logActivity(client, projectId, user.id, 'access', `removeu ${removed} do projeto`);
    }));
  }));

  /** Invitations are addressed by id here; the token only exists in the link. */
  async function invitationProject(client: Queryable, req: Request) {
    const invitationId = idParam(req, 'invitationId', 'Convite');
    const row = await one<{ project_id: string }>(client, 'SELECT project_id FROM invitations WHERE id = $1', [invitationId]);
    if (!row) throw notFound('Convite');
    const access = await projectAccess(client, currentUser(req), row.project_id);
    if (!access) throw notFound('Convite');
    if (!atLeast(access, 'admin')) throw forbidden();
    return invitationId;
  }

  /** New link and new expiry; the old link stops working. */
  router.post('/invitations/:invitationId/resend', route(async (req, res) => {
    const invitationId = await invitationProject(db, req);
    const token = newToken();
    await db.query(`UPDATE invitations SET token_hash = $2, invited_at = now(), expires_at = now() + $3 * interval '1 millisecond' WHERE id = $1`,
      [invitationId, sha256(token), invitationTtlMs]);
    res.json({ url: inviteUrl(token) });
  }));

  router.delete('/invitations/:invitationId', route(async (req, res) => {
    const invitationId = await invitationProject(db, req);
    await db.query('DELETE FROM invitations WHERE id = $1', [invitationId]);
    res.status(204).end();
  }));

  /** The authenticator belongs to the account (every project), so only the owner resets it. */
  router.post('/users/:userId/reset-mfa', route(async (req, res) => {
    const user = currentUser(req);
    requireOwner(user);
    const userId = idParam(req, 'userId', 'Usuário');
    if (userId === user.id) throw new HttpError(400, 'Você não pode redefinir o próprio autenticador por aqui.');
    const updated = await db.query(
      `UPDATE users SET mfa_secret = NULL, mfa_pending_secret = NULL, mfa_last_counter = -1, recovery_hashes = '{}', updated_at = now() WHERE id = $1 AND NOT setup`,
      [userId]);
    if (!updated.rowCount) throw notFound('Usuário');
    // Signed out everywhere; the next login asks for a new authenticator.
    await endOtherSessions(db, userId);
    res.status(204).end();
  }));

  return router;
}
