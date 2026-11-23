import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { bootstrap } from '../src/bootstrap.ts';
import { inviteAdmin, projectMember, setupAccount, signedInAdmin, startServer, totp, type Client } from './helpers.ts';

let server: Awaited<ReturnType<typeof startServer>>;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); });

describe('conta de configuração', () => {
  test('entra só com a senha, em sessão curta, e não vê projetos nem conta', async () => {
    const client = server.client();
    const login = await client.post('/api/auth/login', setupAccount);
    assert.deepEqual(login.body, { stage: 'active' });
    const cookie = login.headers.getSetCookie()[0]!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    const maxAge = Number(/Max-Age=(\d+)/i.exec(cookie)?.[1]);
    assert.ok(maxAge <= 12 * 3600, `Max-Age ${maxAge}`);

    const me = await client.get('/api/auth/me');
    assert.equal(me.body.user.setup, true);
    assert.equal(me.body.user.admin, false);
    assert.equal(me.body.user.owner, undefined);

    assert.equal((await client.get('/api/admin/state')).status, 403);
    assert.equal((await client.post('/api/projects', { name: 'X', slug: 'x', visibility: 'public' })).status, 403);
    assert.equal((await client.put('/api/account/password', { currentPassword: setupAccount.password, newPassword: 'nova-senha-de-teste-1' })).status, 403);
    assert.equal((await client.get('/api/admins')).status, 200);
  });

  test('só ela gerencia admins: convida, lista, reenvia e cancela convites', async () => {
    const client = server.client();
    await client.post('/api/auth/login', setupAccount);
    const invite = await client.post('/api/admins/invitations', { emails: ['convidado@example.com'] });
    assert.equal(invite.body.invited, 1);
    assert.match(invite.body.links[0].url, /\/convite\//);
    const again = await client.post('/api/admins/invitations', { emails: ['convidado@example.com'] });
    assert.equal(again.body.skipped, 1);

    const list = await client.get('/api/admins');
    const pending = list.body.invitations.find((item: any) => item.email === 'convidado@example.com');
    assert.ok(pending);
    const resent = await client.post(`/api/admins/invitations/${pending.id}/resend`);
    assert.notEqual(resent.body.url, invite.body.links[0].url);
    // The old link stops working.
    assert.equal((await server.client().get(`/api/invitations/${invite.body.links[0].url.split('/convite/')[1]}`)).status, 404);
    assert.equal((await client.delete(`/api/admins/invitations/${pending.id}`)).status, 204);
  });

  test('trocar ADMIN_EMAIL no .env transfere a conta de configuração, mesmo para um admin existente', async () => {
    const promoted = { email: 'virou@example.com', password: 'virou-senha-de-teste-1' };
    const { client: before } = await signedInAdmin(server, promoted.email, 'senha-antiga-de-teste-1');
    try {
      await bootstrap(server.db, { ...server.config, admin: { ...promoted, name: 'Nova configuração' } });
      // Its old sessions end; it now signs in with the .env password alone and only manages admins.
      assert.equal((await before.get('/api/admin/state')).status, 401);
      const client = server.client();
      assert.deepEqual((await client.post('/api/auth/login', promoted)).body, { stage: 'active' });
      const me = (await client.get('/api/auth/me')).body.user;
      assert.equal(me.setup, true);
      assert.equal(me.mfa, false);
      assert.equal(me.owner, undefined);
      // The previous setup account is no longer one: it would need an authenticator and has no access.
      assert.equal((await server.client().post('/api/auth/login', setupAccount)).body.stage, 'enroll');
    } finally {
      await bootstrap(server.db, server.config);
    }
    assert.deepEqual((await server.client().post('/api/auth/login', setupAccount)).body, { stage: 'active' });
  });

  test('ninguém além dela acessa /api/admins', async () => {
    const { client } = await signedInAdmin(server, 'curioso@example.com', 'curioso-senha-de-teste');
    assert.equal((await client.get('/api/admins')).status, 403);
    assert.equal((await server.client().get('/api/admins')).status, 401);
  });
});

describe('autenticação', () => {
  const admin = { email: 'admin@example.com', password: 'admin-password-123456' };
  let secret = '';
  /** The exact code used at enrollment: replaying it must fail, whatever the clock says. */
  let enrollmentCode = '';
  let recoveryCodes: string[] = [];

  test('admin convidado precisa configurar o autenticador antes de liberar o acesso', async () => {
    const client = await inviteAdmin(server, admin.email, admin.password);
    assert.equal((await client.get('/api/auth/me')).body.stage, 'enroll');
    // Password alone is not enough.
    assert.equal((await client.get('/api/admin/state')).status, 401);

    const setup = await client.post('/api/auth/mfa/setup');
    assert.equal(setup.status, 200);
    assert.match(setup.body.uri, /^otpauth:\/\/totp\//);
    assert.match(setup.body.qrCode, /^data:image\/png;base64,/);

    assert.equal((await client.post('/api/auth/mfa/enable', { code: '000000' })).status, 400);
    enrollmentCode = totp(setup.body.secret);
    const enable = await client.post('/api/auth/mfa/enable', { code: enrollmentCode });
    assert.equal(enable.status, 200);
    assert.equal(enable.body.recoveryCodes.length, 10);
    secret = setup.body.secret;
    recoveryCodes = enable.body.recoveryCodes;

    const me = await client.get('/api/auth/me');
    assert.equal(me.body.stage, 'active');
    assert.equal(me.body.user.owner, true);
    assert.equal(me.body.user.admin, true);
    assert.equal(me.body.user.mfa, true);
    assert.equal((await client.get('/api/admin/state')).status, 200);
  });

  test('senha errada e e-mail inexistente dão a mesma resposta', async () => {
    const client = server.client();
    const wrong = await client.post('/api/auth/login', { email: admin.email, password: 'x'.repeat(20) });
    const missing = await client.post('/api/auth/login', { email: 'ninguem@example.com', password: 'x'.repeat(20) });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, missing.body);
  });

  test('login seguinte pede o código; código reutilizado é recusado; código de recuperação vale uma vez', async () => {
    const client = server.client();
    assert.deepEqual((await client.post('/api/auth/login', admin)).body, { stage: 'mfa' });
    // The code used at enrollment can't be used again.
    assert.equal((await client.post('/api/auth/mfa/verify', { code: enrollmentCode })).status, 401);
    const verified = await client.post('/api/auth/mfa/verify', { code: totp(secret, 1) });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.stage, 'active');

    const other = server.client();
    await other.post('/api/auth/login', admin);
    assert.equal((await other.post('/api/auth/mfa/verify', { code: recoveryCodes[0] })).status, 200);
    const again = server.client();
    await again.post('/api/auth/login', admin);
    assert.equal((await again.post('/api/auth/mfa/verify', { code: recoveryCodes[0] })).status, 401);
  });

  test('o token muda ao concluir o login (sem fixação de sessão)', async () => {
    const client = server.client();
    await client.post('/api/auth/login', admin);
    const pending = client.cookie;
    await client.post('/api/auth/mfa/verify', { code: recoveryCodes[1] });
    assert.notEqual(client.cookie, pending);
    const stale = server.client();
    stale.cookie = pending;
    assert.equal((await stale.get('/api/auth/me')).status, 401);
  });

  test('códigos errados demais encerram a sessão pela metade', async () => {
    const client = server.client();
    await client.post('/api/auth/login', admin);
    for (let i = 0; i < 5; i++) await client.post('/api/auth/mfa/verify', { code: '000000' });
    assert.equal((await client.get('/api/auth/me')).status, 401);
  });

  test('logout invalida a sessão no servidor', async () => {
    const client = server.client();
    await client.post('/api/auth/login', admin);
    await client.post('/api/auth/mfa/verify', { code: recoveryCodes[2] });
    const cookie = client.cookie;
    assert.equal((await client.post('/api/auth/logout')).status, 204);
    const replay = server.client();
    replay.cookie = cookie;
    assert.equal((await replay.get('/api/admin/state')).status, 401);
  });

  test('a conta de configuração redefine o autenticador e tira o admin', async () => {
    const setup = server.client();
    await setup.post('/api/auth/login', setupAccount);
    const listed = (await setup.get('/api/admins')).body.admins.find((item: any) => item.email === admin.email);
    assert.ok(listed);
    assert.equal((await setup.post(`/api/admins/${listed.id}/reset-mfa`)).status, 204);
    assert.equal((await server.client().post('/api/auth/login', admin)).body.stage, 'enroll');

    assert.equal((await setup.delete(`/api/admins/${listed.id}`)).status, 204);
    assert.equal((await setup.get('/api/admins')).body.admins.some((item: any) => item.email === admin.email), false);
  });

  test('requisições de outra origem são recusadas', async () => {
    const client = server.client();
    const response = await client.request('POST', '/api/auth/login', setupAccount, { origin: 'https://evil.example' });
    assert.equal(response.status, 403);
  });
});

describe('projetos, convites e permissões', () => {
  let admin: Awaited<ReturnType<typeof signedInAdmin>>['client'];
  let projectId = '';
  let versionId = '';

  before(async () => {
    admin = (await signedInAdmin(server, 'dono@example.com', 'dono-password-123456')).client;
  });

  test('um admin cria um projeto privado com rascunho', async () => {
    const created = await admin.post('/api/projects', { name: 'Pagamentos', slug: 'pagamentos', visibility: 'private', draft: 'openapi: 3.1.0' });
    assert.equal(created.status, 201);
    projectId = created.body.id;
    versionId = created.body.defaultVersionId;
    assert.equal(created.body.versions[0].draft, 'openapi: 3.1.0');
    assert.equal(created.body.versions[0].spec, '');

    const duplicate = await admin.post('/api/projects', { name: 'Outro', slug: 'pagamentos', visibility: 'public' });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error, 'Já existe um projeto com esse endereço.');
    assert.equal((await admin.post('/api/projects', { name: 'X', slug: 'org', visibility: 'public' })).status, 400);
  });

  test('documentação mostra só o publicado, e a privada some para quem não tem acesso', async () => {
    const anonymous = server.client();
    assert.equal((await anonymous.get('/api/docs/pagamentos')).status, 404);

    const published = await admin.post(`/api/projects/${projectId}/versions/${versionId}/publish`, { spec: 'openapi: 3.1.0\ninfo: {}' });
    assert.equal(published.status, 200);
    await admin.put(`/api/projects/${projectId}/versions/${versionId}/draft`, { draft: 'rascunho secreto' });

    const docs = await admin.get('/api/docs/pagamentos');
    assert.equal(docs.status, 200);
    assert.equal(docs.body.versions[0].spec, 'openapi: 3.1.0\ninfo: {}');
    assert.ok(!JSON.stringify(docs.body).includes('rascunho secreto'));

    // The list shows the private project to its admin only.
    assert.deepEqual((await anonymous.get('/api/docs')).body, []);
    assert.deepEqual((await admin.get('/api/docs')).body.map((item: any) => item.slug), ['pagamentos']);

    await admin.patch(`/api/projects/${projectId}`, { visibility: 'public' });
    assert.equal((await anonymous.get('/api/docs/pagamentos')).status, 200);
    assert.deepEqual((await anonymous.get('/api/docs')).body.map((item: any) => item.slug), ['pagamentos']);
    await admin.patch(`/api/projects/${projectId}`, { visibility: 'private' });
  });

  test('convite cria a conta, exige autenticador e dá só o papel convidado', async () => {
    const invite = await admin.post(`/api/projects/${projectId}/invitations`, { emails: ['leitor@example.com'], role: 'viewer' });
    assert.equal(invite.status, 200);
    assert.equal(invite.body.invited, 1);
    const url: string = invite.body.links[0].url;
    const token = url.split('/convite/')[1]!;

    const guest = server.client();
    const info = await guest.get(`/api/invitations/${token}`);
    assert.equal(info.body.email, 'leitor@example.com');
    assert.equal(info.body.project, 'Pagamentos');

    assert.equal((await guest.post(`/api/invitations/${token}/accept`, { name: 'Leitor', password: 'curta' })).status, 400);
    const accepted = await guest.post(`/api/invitations/${token}/accept`, { name: 'Leitor', password: 'leitor-password-123' });
    assert.equal(accepted.status, 201);
    assert.equal((await guest.get(`/api/invitations/${token}`)).status, 404);
    assert.equal((await guest.get('/api/admin/state')).status, 401);

    const setup = await guest.post('/api/auth/mfa/setup');
    await guest.post('/api/auth/mfa/enable', { code: totp(setup.body.secret) });

    // Viewer: not an admin (starts on the docs, no admin panel), reads private docs and can't edit.
    const me = (await guest.get('/api/auth/me')).body.user;
    assert.equal(me.admin, false);
    assert.equal((await guest.get('/api/docs/pagamentos')).status, 200);
    assert.equal((await guest.get('/api/admin/state')).status, 403);
    assert.equal((await guest.put(`/api/projects/${projectId}/versions/${versionId}/draft`, { draft: 'x' })).status, 403);
    assert.equal((await guest.post('/api/projects', { name: 'Meu', slug: 'meu', visibility: 'public' })).status, 403);

    // Promoted to editor: can edit content, but not settings or people.
    const leitor = me.id;
    await admin.patch(`/api/projects/${projectId}/members`, { userIds: [leitor], role: 'editor' });
    assert.equal((await guest.put(`/api/projects/${projectId}/versions/${versionId}/draft`, { draft: 'x' })).status, 200);
    assert.equal((await guest.post(`/api/projects/${projectId}/pages`, { title: 'Início', slug: 'inicio', body: '# Oi' })).status, 201);
    assert.equal((await guest.patch(`/api/projects/${projectId}`, { visibility: 'public' })).status, 403);
    assert.equal((await guest.post(`/api/projects/${projectId}/invitations`, { emails: ['a@example.com'], role: 'admin' })).status, 403);

    // Editors use the admin panel for content only: drafts visible, people and settings hidden.
    assert.equal((await guest.get('/api/auth/me')).body.user.admin, true);
    const editorState = await guest.get('/api/admin/state');
    assert.equal(editorState.status, 200);
    assert.equal(editorState.body.projects[0].access, 'editor');
    assert.equal(editorState.body.projects[0].versions[0].draft, 'x');
    assert.deepEqual(editorState.body.projects[0].members, []);
    assert.deepEqual(editorState.body.invitations, []);
    assert.equal((await guest.patch(`/api/projects/${projectId}`, { branding: { name: 'X' } })).status, 403);
    assert.equal((await guest.get(`/api/projects/${projectId}/analytics`)).status, 403);
    assert.equal((await guest.get(`/api/projects/${projectId}/activity`)).status, 200);

    // Project admin: starts on the admin and sees only their project, without drafts hidden.
    await admin.patch(`/api/projects/${projectId}/members`, { userIds: [leitor], role: 'admin' });
    assert.equal((await guest.get('/api/auth/me')).body.user.admin, true);
    const state = await guest.get('/api/admin/state');
    assert.equal(state.status, 200);
    assert.deepEqual(state.body.projects.map((project: any) => project.id), [projectId]);

    // Removed: the project disappears for them.
    await admin.post(`/api/projects/${projectId}/members/remove`, { userIds: [leitor] });
    assert.equal((await guest.get(`/api/docs/pagamentos`)).status, 404);
    assert.equal((await guest.put(`/api/projects/${projectId}/versions/${versionId}/draft`, { draft: 'y' })).status, 404);
  });

  test('redefinir o autenticador encerra as sessões da pessoa', async () => {
    const invite = await admin.post(`/api/projects/${projectId}/invitations`, { emails: ['editor@example.com'], role: 'editor' });
    const token = invite.body.links[0].url.split('/convite/')[1];
    const person = server.client();
    await person.post(`/api/invitations/${token}/accept`, { name: 'Editor', password: 'editor-password-123' });
    const setup = await person.post('/api/auth/mfa/setup');
    await person.post('/api/auth/mfa/enable', { code: totp(setup.body.secret) });
    const me = await person.get('/api/auth/me');

    assert.equal((await admin.post(`/api/users/${me.body.user.id}/reset-mfa`)).status, 204);
    assert.equal((await person.get('/api/admin/state')).status, 401);
    const login = await person.post('/api/auth/login', { email: 'editor@example.com', password: 'editor-password-123' });
    assert.equal(login.body.stage, 'enroll');
  });

  test('histórico registra a publicação e permite restaurar como rascunho', async () => {
    const state = await admin.get('/api/admin/state');
    const publish = state.body.activity.find((entry: any) => entry.snapshot);
    assert.ok(publish);
    const restored = await admin.post(`/api/projects/${projectId}/activity/${publish.id}/restore`);
    assert.equal(restored.status, 200);
    assert.equal(restored.body.versions[0].draft, 'openapi: 3.1.0\ninfo: {}');
  });

  test('o histórico vem em páginas, do mais novo ao mais antigo, sem repetir', async () => {
    for (let index = 0; index < 5; index++) await admin.put(`/api/projects/${projectId}/navigation`, { order: [], labels: {}, hidden: [] });
    const all = (await admin.get(`/api/projects/${projectId}/activity?limit=50`)).body.items;
    const seen: string[] = [];
    let next: string | undefined;
    do {
      const page = await admin.get(`/api/projects/${projectId}/activity?limit=3${next ? `&after=${next}` : ''}`);
      assert.equal(page.status, 200);
      assert.ok(page.body.items.length <= 3);
      seen.push(...page.body.items.map((item: any) => item.id));
      next = page.body.next;
    } while (next);
    assert.deepEqual(seen, all.map((item: any) => item.id));
    assert.equal(new Set(seen).size, seen.length);
    assert.ok(all[0].userName);
    assert.equal((await server.client().get(`/api/projects/${projectId}/activity`)).status, 401);
  });

  test('analytics conta visitas, visitantes, páginas, endpoints e buscas sem resultado', async () => {
    const events = `/api/docs/pagamentos/events`;
    // Private docs: only people with access send (and count as) visits.
    assert.equal((await server.client().post(events, { kind: 'view', page: 'introducao' })).status, 404);
    assert.equal((await admin.post(events, { kind: 'view', page: 'x', extra: true })).status, 400);

    for (const page of ['list-posts', 'list-posts', 'get-post']) {
      const path = page === 'get-post' ? '/posts/{id}' : '/posts';
      assert.equal((await admin.post(events, { kind: 'view', page, label: page, method: 'get', path })).status, 204);
    }
    await admin.post(events, { kind: 'view', page: 'pagina-inicio', label: 'Início' });
    await admin.post(events, { kind: 'search', query: 'Webhook', results: 0 });
    await admin.post(events, { kind: 'search', query: 'webhook', results: 0 });
    await admin.post(events, { kind: 'search', query: 'posts', results: 4 });

    const analytics = await admin.get(`/api/projects/${projectId}/analytics?days=7`);
    assert.equal(analytics.status, 200);
    const body = analytics.body;
    assert.equal(body.visits, 4);
    assert.equal(body.visitors, 1);
    assert.equal(body.daily.length, 7);
    assert.equal(body.daily.at(-1).views, 4);
    assert.deepEqual(body.endpoints.map((item: any) => [item.method, item.path, item.views]), [['GET', '/posts', 2], ['GET', '/posts/{id}', 1]]);
    assert.deepEqual(body.pages, [{ page: 'pagina-inicio', title: 'Início', views: 1 }]);
    assert.equal(body.searches, 3);
    assert.equal(body.searchesWithoutResults, 2);
    assert.deepEqual(body.missedSearches, [{ term: 'webhook', count: 2 }]);
    assert.equal((await admin.get(`/api/projects/${projectId}/analytics?days=12`)).status, 400);
  });

  test('"Esta página ajudou?" guarda sim/não e comentários, e o analytics mostra', async () => {
    const feedback = `/api/docs/pagamentos/feedback`;
    assert.equal((await server.client().post(feedback, { page: 'list-posts', helpful: true })).status, 404);
    assert.equal((await admin.post(feedback, { page: 'list-posts', helpful: true, comment: 'x'.repeat(2001) })).status, 400);
    assert.equal((await admin.post(feedback, { page: 'list-posts', label: 'Listar posts', helpful: true })).status, 204);
    assert.equal((await admin.post(feedback, { page: 'pagina-inicio', label: 'Início', helpful: true, comment: 'Bem claro.' })).status, 204);
    assert.equal((await admin.post(feedback, { page: 'list-posts', label: 'Listar posts', helpful: false, comment: '  Faltou um exemplo de paginação.  ' })).status, 204);

    const { feedback: result } = (await admin.get(`/api/projects/${projectId}/analytics?days=7`)).body;
    assert.equal(result.yes, 2);
    assert.equal(result.no, 1);
    assert.deepEqual(result.comments.map((item: any) => [item.title, item.helpful, item.comment]), [
      ['Listar posts', false, 'Faltou um exemplo de paginação.'],
      ['Início', true, 'Bem claro.'],
    ]);
  });

  test('páginas mudam de ordem e versões padrão não podem ser excluídas', async () => {
    await admin.post(`/api/projects/${projectId}/pages`, { title: 'Segunda', slug: 'segunda', body: '' });
    const before = (await admin.get('/api/admin/state')).body.projects[0].pages.map((page: any) => page.slug);
    const second = (await admin.get('/api/admin/state')).body.projects[0].pages[1].id;
    const moved = await admin.post(`/api/projects/${projectId}/pages/${second}/move`, { offset: -1 });
    assert.deepEqual(moved.body.pages.map((page: any) => page.slug), [before[1], before[0]]);

    assert.equal((await admin.delete(`/api/projects/${projectId}/versions/${versionId}`)).status, 409);
    assert.equal((await admin.get('/api/projects/nao-e-uuid')).status, 404);
  });
});

/**
 * The panel hides what each role can't do, but the server decides: every action below is tried by
 * every role under its minimum and must be refused (403 for members, 404 for people outside the
 * project, so they can't even tell it exists).
 */
describe('o servidor valida cada permissão, não só a tela', () => {
  type Role = 'admin' | 'editor' | 'viewer' | 'outsider';
  const rank = { outsider: 0, viewer: 1, editor: 2, admin: 3, owner: 4 } as const;
  const people = {} as Record<Role, Client>;
  let owner: Client;
  let projectId = '';
  let otherProjectId = '';
  let versionId = '';
  let pageId = '';
  let invitationId = '';
  let editorId = '';

  before(async () => {
    owner = (await signedInAdmin(server, 'matriz-dono@example.com', 'matriz-dono-senha-123')).client;
    const project = (await owner.post('/api/projects', { name: 'Matriz', slug: 'matriz', visibility: 'private', draft: 'openapi: 3.1.0' })).body;
    projectId = project.id;
    versionId = project.defaultVersionId;
    otherProjectId = (await owner.post('/api/projects', { name: 'Outro', slug: 'outro', visibility: 'private' })).body.id;
    pageId = (await owner.post(`/api/projects/${projectId}/pages`, { title: 'P', slug: 'p', body: '' })).body.pages[0].id;
    people.admin = await projectMember(server, owner, projectId, 'matriz-admin@example.com', 'admin');
    people.editor = await projectMember(server, owner, projectId, 'matriz-editor@example.com', 'editor');
    people.viewer = await projectMember(server, owner, projectId, 'matriz-leitor@example.com', 'viewer');
    // Outside this project: editor of another one (so the panel is open to them, just not here).
    people.outsider = await projectMember(server, owner, otherProjectId, 'matriz-fora@example.com', 'editor');
    // The editor also reads the other project: it must not show up in their panel.
    await owner.post(`/api/projects/${otherProjectId}/invitations`, { emails: ['matriz-editor@example.com'], role: 'viewer' });
    invitationId = (await owner.post(`/api/projects/${projectId}/invitations`, { emails: ['matriz-pendente@example.com'], role: 'viewer' })).body && (await owner.get('/api/admin/state')).body.invitations.find((item: any) => item.email === 'matriz-pendente@example.com').id;
    editorId = (await people.editor.get('/api/auth/me')).body.user.id;
  });

  const project = (rest = '') => `/api/projects/${projectId}${rest}`;
  const actions: Array<{ name: string; minimum: 'editor' | 'admin' | 'owner'; call: (client: Client) => Promise<{ status: number }>; scoped?: boolean }> = [
    { name: 'renomear o projeto', minimum: 'admin', scoped: true, call: (c) => c.patch(project(), { name: 'Matriz' }) },
    { name: 'mudar a visibilidade', minimum: 'admin', scoped: true, call: (c) => c.patch(project(), { visibility: 'private' }) },
    { name: 'mudar a aparência', minimum: 'admin', scoped: true, call: (c) => c.patch(project(), { branding: { name: 'X' } }) },
    { name: 'excluir o projeto', minimum: 'owner', scoped: true, call: (c) => c.delete(project()) },
    { name: 'convidar pessoas', minimum: 'admin', scoped: true, call: (c) => c.post(project('/invitations'), { emails: ['x@example.com'], role: 'viewer' }) },
    { name: 'mudar papéis', minimum: 'admin', scoped: true, call: (c) => c.patch(project('/members'), { userIds: [editorId], role: 'editor' }) },
    { name: 'remover pessoas', minimum: 'admin', scoped: true, call: (c) => c.post(project('/members/remove'), { userIds: [editorId] }) },
    { name: 'gerar novo link de convite', minimum: 'admin', scoped: true, call: (c) => c.post(`/api/invitations/${invitationId}/resend`) },
    { name: 'revogar convite', minimum: 'admin', scoped: true, call: (c) => c.delete(`/api/invitations/${invitationId}`) },
    { name: 'ver o analytics', minimum: 'admin', scoped: true, call: (c) => c.get(project('/analytics')) },
    { name: 'ver o histórico', minimum: 'editor', scoped: true, call: (c) => c.get(project('/activity')) },
    { name: 'salvar rascunho', minimum: 'editor', scoped: true, call: (c) => c.put(project(`/versions/${versionId}/draft`), { draft: 'openapi: 3.1.0' }) },
    { name: 'publicar', minimum: 'editor', scoped: true, call: (c) => c.post(project(`/versions/${versionId}/publish`), { spec: 'openapi: 3.1.0' }) },
    { name: 'criar versão', minimum: 'editor', scoped: true, call: (c) => c.post(project('/versions'), { name: `v-${Math.random().toString(36).slice(2, 7)}` }) },
    { name: 'escolher a versão padrão', minimum: 'editor', scoped: true, call: (c) => c.patch(project(), { defaultVersionId: versionId }) },
    { name: 'reorganizar a navegação', minimum: 'editor', scoped: true, call: (c) => c.put(project('/navigation'), { order: [], labels: {}, hidden: [] }) },
    { name: 'editar página do wiki', minimum: 'editor', scoped: true, call: (c) => c.put(project(`/pages/${pageId}`), { title: 'P', slug: 'p', body: '' }) },
    { name: 'criar projeto', minimum: 'owner', call: (c) => c.post('/api/projects', { name: 'Novo', slug: `novo-${Math.random().toString(36).slice(2, 7)}`, visibility: 'private' }) },
    { name: 'mudar a organização', minimum: 'owner', call: (c) => c.patch('/api/organization', { name: 'Acme' }) },
    { name: 'redefinir autenticador de alguém', minimum: 'owner', call: (c) => c.post(`/api/users/${editorId}/reset-mfa`) },
    { name: 'gerenciar admins da instalação', minimum: 'owner', call: (c) => c.get('/api/admins') },
  ];

  for (const action of actions) {
    test(`${action.name}: recusado abaixo de ${action.minimum}`, async () => {
      for (const role of ['outsider', 'viewer', 'editor', 'admin'] as const) {
        if (rank[role] >= rank[action.minimum]) continue;
        const { status } = await action.call(people[role]);
        // Outside the project it doesn't exist; inside, it's forbidden. Global actions are forbidden for all.
        const expected = action.scoped && role === 'outsider' ? 404 : 403;
        assert.equal(status, expected, `${role} → ${status}`);
      }
    });
  }

  test('quem tem o papel mínimo consegue (a recusa não é por outro motivo)', async () => {
    assert.equal((await people.editor.put(project(`/versions/${versionId}/draft`), { draft: 'openapi: 3.1.0' })).status, 200);
    assert.equal((await people.editor.get(project('/activity'))).status, 200);
    assert.equal((await people.admin.get(project('/analytics'))).status, 200);
    assert.equal((await people.admin.patch(project(), { name: 'Matriz' })).status, 200);
  });

  test('o painel só recebe os projetos em que a pessoa trabalha', async () => {
    assert.equal((await people.viewer.get('/api/admin/state')).status, 403);
    const editorState = (await people.editor.get('/api/admin/state')).body;
    assert.deepEqual(editorState.projects.map((item: any) => item.id), [projectId]);
    assert.equal(editorState.projects[0].access, 'editor');
  });
});
