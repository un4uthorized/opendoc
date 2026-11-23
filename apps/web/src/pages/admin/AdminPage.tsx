import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Braces, ChartLine, Check, ChevronsUpDown, ExternalLink, FileText, FolderKanban, GitBranch, History, LayoutDashboard, Lock, LogOut, Palette,
  Plus, Settings, ShieldCheck, Users,
} from 'lucide-react';
import {
  Avatar, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, ErrorBoundary, Navbar, NavbarSection, NavbarSpacer, Separator,
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarTrigger, Spinner, ThemeToggle,
} from '../../design-system';
import { OpenDocLogo } from '../../brand/OpenDocLogo';
import { authApi, type SessionUser } from '../../auth/api';
import { useSession } from '../../auth/useSession';
import { useAdminSnapshot, useAdminState } from './data/store';
import { visibilityLabels, type Project } from './data/types';
import { NewProjectDialog } from './NewProjectDialog';
import { canSee } from './permissions';
import { SetupWizard } from './setup/SetupWizard';
import { ProjectMark } from './parts';
import { adminPaths, navigate, parseAdminPath, projectPath, useAdminLinks, usePathname, type ProjectSection } from './router';
import { ProjectsView } from './views/ProjectsView';
import { OverviewView } from './views/OverviewView';
import { SpecView } from './views/SpecView';
import { PagesView } from './views/PagesView';
import { AppearanceView, OrgBrandingView } from './views/BrandingViews';
import { ProjectSettingsView } from './views/ProjectSettingsView';
import { UsersView } from './views/UsersView';
import { VersionsView } from './views/VersionsView';
import { AnalyticsView } from './views/AnalyticsView';
import { HistoryView } from './views/HistoryView';
import './admin.css';

const lastProjectKey = 'opendoc.admin.lastProject';
function readLastProject() {
  try { return localStorage.getItem(lastProjectKey); } catch { return null; }
}
function saveLastProject(slug: string) {
  try { localStorage.setItem(lastProjectKey, slug); } catch { /* private mode */ }
}

const projectNav: Array<{ section: ProjectSection; label: string; icon: React.ReactNode }> = [
  { section: 'overview', label: 'Visão geral', icon: <LayoutDashboard /> },
  { section: 'spec', label: 'API', icon: <Braces /> },
  { section: 'versions', label: 'Versões', icon: <GitBranch /> },
  { section: 'pages', label: 'Wiki', icon: <FileText /> },
  { section: 'analytics', label: 'Analytics', icon: <ChartLine /> },
  { section: 'appearance', label: 'Aparência', icon: <Palette /> },
  { section: 'users', label: 'Usuários', icon: <Users /> },
  { section: 'history', label: 'Histórico', icon: <History /> },
  { section: 'settings', label: 'Configurações', icon: <Settings /> },
];

/** Sidebar: the day-to-day work on top, everything else under Configurações. */
const navGroups: Array<{ label?: string; sections: ProjectSection[] }> = [
  { sections: ['overview', 'spec', 'pages', 'analytics'] },
  { sections: ['users', 'settings'] },
];

/** Sections shown as tabs inside Configurações (and highlighted as "Configurações" in the sidebar). */
const settingsTabs: Array<{ section: ProjectSection; label: string }> = [
  { section: 'settings', label: 'Geral' },
  { section: 'appearance', label: 'Aparência' },
  { section: 'history', label: 'Histórico' },
];
const sidebarSection = (section: ProjectSection): ProjectSection => (settingsTabs.some((tab) => tab.section === section) ? 'settings' : section === 'versions' ? 'spec' : section);

function SettingsTabs({ project, active }: { project: Project; active: ProjectSection }) {
  return (
    <nav className="admin-settings-tabs" aria-label="Configurações do projeto">
      {settingsTabs.map((tab) => (
        <a key={tab.section} href={projectPath(project.slug, tab.section)} className="admin-settings-tabs__tab" aria-current={tab.section === active ? 'page' : undefined}>{tab.label}</a>
      ))}
    </nav>
  );
}

/** "Pública · v1 publicada", "Privada · não publicado". */
function projectStatus(project: Project) {
  const published = project.versions.find((version) => version.id === project.defaultVersionId && version.publishedAt)
    ?? project.versions.find((version) => version.publishedAt);
  return `${visibilityLabels[project.visibility]} · ${published ? `${published.name} publicada` : 'não publicado'}`;
}

function ProjectSwitcher({ projects, current, onCreate }: { projects: Project[]; current?: Project; onCreate?: () => void }) {
  const state = useAdminState();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="ds-sidebar__button--tall"
          icon={current ? <ProjectMark name={current.name} branding={current.branding ?? state.organization.branding} /> : <OpenDocLogo size={28} decorative />}
          trailing={<ChevronsUpDown />}
          aria-label={current ? `Projeto: ${current.name}. Trocar de projeto` : 'Trocar de projeto'}
        >
          <span className="admin-switcher__text">
            <strong>{current?.name ?? state.organization.name}</strong>
            <small>{current ? projectStatus(current) : 'Nenhum projeto'}</small>
          </span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="admin-switcher__menu">
        <DropdownMenuLabel>Projetos</DropdownMenuLabel>
        {projects.map((project) => (
          <DropdownMenuItem key={project.id} onSelect={() => navigate(projectPath(project.slug))}>
            <ProjectMark name={project.name} branding={project.branding ?? state.organization.branding} size="sm" />
            <span className="admin-switcher__item-text">
              <span className="admin-switcher__item-name">{project.name}</span>
              <span className="admin-switcher__item-status">{projectStatus(project)}</span>
            </span>
            {project.id === current?.id && <Check className="admin-switcher__check" aria-label="atual" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(adminPaths.projects)}><FolderKanban />Todos os projetos</DropdownMenuItem>
        {onCreate && <DropdownMenuItem onSelect={onCreate}><Plus />Novo projeto</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Waits for the session and the first load of the admin's data. The setup account only manages
 * admins, on its own page.
 */
export function AdminPage() {
  const session = useSession({ required: true });
  const me = session?.user;
  const snapshot = useAdminSnapshot();
  // Only admins get the panel: the setup account manages admins on its own page; everyone else reads the docs.
  const allowed = Boolean(me?.admin && !me.setup);
  useEffect(() => {
    if (me?.setup) window.location.replace('/admins');
    else if (me && !me.admin) window.location.replace('/docs');
  }, [me]);

  if (snapshot.status === 'error' && allowed) {
    return (
      <main className="app-loading">
        <EmptyState icon={<FolderKanban />} titleAs="h1" title="Não foi possível carregar o admin" description={snapshot.message}
          actions={<Button variant="outline" onClick={() => window.location.reload()}>Tentar de novo</Button>} />
      </main>
    );
  }
  if (!me || !allowed || snapshot.status !== 'ready') {
    return <div className="app-loading" role="status"><Spinner /><span className="ds-sr-only">Carregando…</span></div>;
  }
  // First run: an admin of the installation with no projects yet sets things up step by step.
  if (me.owner && snapshot.state.projects.length === 0) return <SetupWizard />;
  return <AdminShell me={me} />;
}

function AdminShell({ me }: { me: SessionUser }) {
  useAdminLinks();
  const state = useAdminState();
  const pathname = usePathname();
  const route = parseAdminPath(pathname);
  const project = route.name === 'project' ? state.projects.find((item) => item.slug === route.slug) : undefined;
  // The sidebar always shows one project's menu: the one in the URL, else the last one opened.
  const lastSlug = readLastProject();
  const current = project ?? state.projects.find((item) => item.slug === lastSlug) ?? state.projects[0];
  useEffect(() => { if (project) saveLastProject(project.slug); }, [project]);
  const [creating, setCreating] = useState(false);

  // Move focus to the new page's title on navigation (not on first load), so screen readers announce it.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    document.querySelector<HTMLElement>('[data-page-title]')?.focus();
  }, [pathname]);

  const sectionLabel = route.name === 'project' ? projectNav.find((item) => item.section === route.section)!.label : undefined;
  const pageLabel = route.name === 'org-branding' ? 'Marca' : route.name === 'projects' ? 'Projetos' : sectionLabel ?? 'Página não encontrada';

  useEffect(() => {
    document.title = `${project ? `${pageLabel} · ${project.name}` : pageLabel} · Admin · OpenDoc`;
  }, [pageLabel, project]);

  let content: React.ReactNode;
  if (route.name === 'projects') content = <ProjectsView onCreate={() => setCreating(true)} />;
  else if (route.name === 'org-branding' && me.owner) content = <OrgBrandingView />;
  else if (route.name === 'project' && project && !canSee(project, route.section)) {
    content = (
      <EmptyState
        className="admin-not-found"
        icon={<Lock />}
        titleAs="h1"
        title="Só para admins do projeto"
        description="Como editor, você cuida da API, das versões e do wiki. Pessoas, aparência e configurações ficam com os admins."
        actions={<Button variant="outline" onClick={() => navigate(projectPath(project.slug))}>Ir para a visão geral</Button>}
      />
    );
  } else if (route.name === 'project' && project) {
    const views: Record<ProjectSection, React.ReactNode> = {
      overview: <OverviewView project={project} />,
      spec: <SpecView project={project} />,
      versions: <VersionsView project={project} />,
      analytics: <AnalyticsView project={project} />,
      history: <HistoryView project={project} />,
      pages: <PagesView project={project} />,
      appearance: <AppearanceView project={project} />,
      users: <UsersView project={project} />,
      settings: <ProjectSettingsView project={project} />,
    };
    // Keyed by project: switching projects on the same section starts from fresh state.
    const inSettings = settingsTabs.some((tab) => tab.section === route.section);
    content = (
      <Fragment key={project.id}>
        {inSettings && <SettingsTabs project={project} active={route.section} />}
        {views[route.section]}
      </Fragment>
    );
  } else {
    content = (
      <EmptyState
        className="admin-not-found"
        icon={<FolderKanban />}
        titleAs="h1"
        title={route.name === 'project' ? 'Projeto não encontrado' : 'Página não encontrada'}
        description={route.name === 'project' ? `Não há projeto com o endereço “${route.slug}”. Ele pode ter sido renomeado ou excluído.` : 'Confira o endereço ou volte para a lista de projetos.'}
        actions={<Button variant="outline" onClick={() => navigate(adminPaths.projects)}>Ver projetos</Button>}
      />
    );
  }

  const signOut = async () => {
    await authApi.logout().catch(() => {});
    window.location.replace('/');
  };
  return (
    <SidebarProvider className="admin">
      <Sidebar label="Menu do admin">
        <SidebarHeader className="admin-sidebar-header">
          <ProjectSwitcher projects={state.projects} current={current} onCreate={me.owner ? () => setCreating(true) : undefined} />
        </SidebarHeader>
        <SidebarContent label="Navegação do projeto">
          {current && navGroups.map((group) => {
            // Editors get the content screens only.
            const sections = group.sections.filter((section) => canSee(current, section));
            if (!sections.length) return null;
            const menu = (
              <SidebarMenu>
                {sections.map((section) => {
                  const item = projectNav.find((entry) => entry.section === section)!;
                  const hasDraft = section === 'spec' && current.versions.some((version) => version.draft !== undefined);
                  const pendingInvites = section === 'users' ? state.invitations.filter((invite) => invite.projectId === current.id).length : 0;
                  return (
                    <SidebarMenuItem key={section}>
                      <SidebarMenuButton
                        href={projectPath(current.slug, section)}
                        icon={item.icon}
                        active={route.name === 'project' && project?.id === current.id && sidebarSection(route.section) === section}
                        badge={pendingInvites ? <span aria-hidden="true">{pendingInvites}</span> : hasDraft ? <span aria-hidden="true">Rascunho</span> : undefined}
                        title={hasDraft ? 'Há um rascunho não publicado' : undefined}
                      >
                        {item.label}
                        {hasDraft && <span className="ds-sr-only">, rascunho não publicado</span>}
                        {pendingInvites > 0 && <span className="ds-sr-only">, {pendingInvites === 1 ? '1 convite pendente' : `${pendingInvites} convites pendentes`}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            );
            return group.label
              ? <SidebarGroup key={group.label} label={group.label}>{menu}</SidebarGroup>
              : <div key={group.sections.join('-')}>{menu}</div>;
          })}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="ds-sidebar__button--tall" icon={<Avatar name={me.name} size="sm" />} trailing={<ChevronsUpDown />} aria-label={`Conta de ${me.name}`}>
                    <span className="admin-switcher__text"><strong>{me.name}</strong><small>{me.email}</small></span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="admin-switcher__menu">
                  <DropdownMenuLabel className="admin-account-label"><span>{me.name}</span><small>{me.email}</small></DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled><ShieldCheck />Segurança da conta</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => { void signOut(); }}><LogOut />Sair</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <Navbar sticky>
          <NavbarSection>
            <SidebarTrigger />
            <Separator orientation="vertical" className="admin-navbar-separator" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="admin-hide-sm"><BreadcrumbLink href={adminPaths.projects}>{state.organization.name}</BreadcrumbLink></BreadcrumbItem>
                <BreadcrumbSeparator className="admin-hide-sm" />
                {project && (
                  <>
                    <BreadcrumbItem className="admin-hide-sm"><BreadcrumbLink href={projectPath(project.slug)}>{project.name}</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator className="admin-hide-sm" />
                  </>
                )}
                {route.name === 'project' && project && route.section !== 'settings' && settingsTabs.some((tab) => tab.section === route.section) && (
                  <>
                    <BreadcrumbItem className="admin-hide-sm"><BreadcrumbLink href={projectPath(project.slug, 'settings')}>Configurações</BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator className="admin-hide-sm" />
                  </>
                )}
                <BreadcrumbItem><BreadcrumbPage>{pageLabel}</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </NavbarSection>
          <NavbarSpacer />
          <NavbarSection>
            {project && (
              <Button variant="outline" size="sm" iconEnd={<ExternalLink />} onClick={() => window.open(current ? `/docs/${current.slug}` : '/docs', '_blank', 'noopener')} className="admin-hide-sm">
                Abrir documentação
              </Button>
            )}
            <ThemeToggle />
          </NavbarSection>
        </Navbar>
        <main className="admin-main" id="admin-main">
          <ErrorBoundary label="esta página" resetKeys={[pathname]}>
            {content}
          </ErrorBoundary>
        </main>
      </SidebarInset>

      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </SidebarProvider>
  );
}
