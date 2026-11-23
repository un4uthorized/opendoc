import { ArrowRight, Braces, ChevronRight, CircleCheck, CircleDashed, Eye, FileText, GitBranch, Globe, Lock, Rocket, Star, Users } from 'lucide-react';
import {
  buttonClassName, Card, CardContent, CardHeader, CopyButton, Item, ItemGroup, Progress, Sparkline, StatCard, cx,
} from '../../../design-system';
import { useAdminState } from '../data/store';
import { useAnalytics } from '../data/analytics';
import { canManage } from '../permissions';
import { specSummary } from '../data/spec';
import { visibilityLabels, type Project } from '../data/types';
import { formatDate, plural, timeAgo } from '../format';
import { PageHeader } from '../parts';
import { RecentActivity } from './RecentActivity';
import { projectPath } from '../router';

const versionStates = { live: 'No ar', draft: 'Rascunho', empty: 'Vazia', deprecated: 'Obsoleta' } as const;

/** Small "Ver" link in a stat card's corner. */
function CardLink({ href, label }: { href: string; label: string }) {
  return <a href={href} className="admin-card-link" aria-label={label}>Ver<ArrowRight aria-hidden="true" /></a>;
}

export function OverviewView({ project }: { project: Project }) {
  const { users } = useAdminState();
  const manage = canManage(project);
  // Analytics is for admins: editors don't load it (the API would refuse).
  const visits = useAnalytics(project.id, '30', undefined, manage);
  const owners = users.filter((user) => user.owner).length;
  const current = project.versions.find((version) => version.id === project.defaultVersionId);
  const live = current?.publishedAt ? current : project.versions.find((version) => version.publishedAt);
  const summary = live ? specSummary(live.spec) : null;
  const drafts = project.versions.filter((version) => version.draft !== undefined);

  const docsUrl = `${window.location.origin}/docs/${project.slug}`;
  const editors = project.members.filter((member) => member.role !== 'viewer').length;
  const specLink = (versionId: string) => `${projectPath(project.slug, 'spec')}?versao=${versionId}`;

  const steps = [
    { done: project.versions.some((version) => Boolean(specSummary(version.draft ?? version.spec)?.endpoints)), title: 'Importar a spec OpenAPI', description: 'Arquivo YAML ou JSON, URL ou texto colado.', href: projectPath(project.slug, 'spec') },
    { done: project.pages.length > 0, title: 'Escrever a wiki', description: 'Introdução, autenticação, primeiros passos em Markdown.', href: projectPath(project.slug, 'pages') },
    ...(manage ? [{ done: Boolean(project.branding), title: 'Ajustar a aparência', description: 'Nome, logo e cor da documentação.', href: projectPath(project.slug, 'appearance') }] : []),
    { done: Boolean(live), title: 'Publicar', description: 'A documentação fica visível para quem tem acesso.', href: projectPath(project.slug, 'spec') },
  ];
  const doneSteps = steps.filter((step) => step.done).length;

  const activityCard = (
    <Card>
      <CardHeader title="Atividade recente" actions={manage ? <a href={projectPath(project.slug, 'history')} className="admin-card-link">Ver histórico<ArrowRight aria-hidden="true" /></a> : undefined} />
      <CardContent>
        <RecentActivity project={project} />
      </CardContent>
    </Card>
  );
  const stepsCard = (
    <Card>
      <CardHeader title="Primeiros passos" />
      <CardContent className="admin-steps">
        <Progress label={`${doneSteps} de ${steps.length} concluídos`} value={doneSteps} max={steps.length} />
        <ItemGroup>
          {steps.map((step) => (
            <Item
              key={step.title}
              href={step.href}
              icon={step.done ? <CircleCheck className="admin-step--done" /> : <CircleDashed />}
              title={<>{step.title}<span className="ds-sr-only">{step.done ? ' (concluído)' : ' (pendente)'}</span></>}
              description={step.done ? undefined : step.description}
            />
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
  const versionsCard = (
    <Card>
      <CardHeader
        title={<span className="admin-card-title">Versões <span className="admin-count">{project.versions.length}</span></span>}
        actions={<a href={projectPath(project.slug, 'versions')} className="admin-card-link">Gerenciar<ArrowRight aria-hidden="true" /></a>}
      />
      <CardContent>
        <ul role="list" className="admin-versions">
          {project.versions.map((version) => {
            const isDefault = version.id === project.defaultVersionId;
            const state = version.deprecated ? 'deprecated' : version.publishedAt ? 'live' : version.draft !== undefined ? 'draft' : 'empty';
            const counted = specSummary(version.publishedAt ? version.spec : version.draft ?? '');
            const meta = [
              version.publishedAt ? `Publicada ${timeAgo(version.publishedAt)}` : 'Nunca publicada',
              counted && plural(counted.endpoints, 'endpoint', 'endpoints'),
              version.publishedAt && version.draft !== undefined && 'rascunho pendente',
            ].filter(Boolean).join(' · ');
            return (
              <li key={version.id}>
                <a href={specLink(version.id)} className="admin-versions__row">
                  <span className="admin-versions__icon" aria-hidden="true"><GitBranch /></span>
                  <span className="admin-versions__text">
                    <span className="admin-versions__name">
                      {version.name}
                      {isDefault && <span className="admin-versions__default"><Star aria-hidden="true" />Padrão</span>}
                    </span>
                    <span className="admin-versions__meta" title={`Atualizada em ${formatDate(version.updatedAt)}`}>{meta}</span>
                  </span>
                  <span className={`admin-pill admin-pill--${state}`}>{versionStates[state]}</span>
                  <ChevronRight className="admin-versions__chevron" aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
  const showSteps = doneSteps < steps.length;

  return (
    <div className="admin-page">
      <PageHeader
        title={project.name}
        description={project.description ?? 'Visão geral do projeto.'}
      />

      {/* Where the docs live and whether there's something waiting to go out. */}
      <Card className="admin-live">
        <div className="admin-live__main">
          <span className={cx('admin-live__dot', live ? 'is-live' : 'is-off')} aria-hidden="true" />
          <div className="admin-live__text">
            <p className="admin-live__title">{live ? 'No ar' : 'Ainda não publicado'}</p>
            <p className="admin-live__meta">
              {project.visibility === 'public' ? <Globe aria-hidden="true" /> : <Lock aria-hidden="true" />}
              {visibilityLabels[project.visibility]}
              {live && <> · {live.name} publicada <span title={formatDate(live.publishedAt)}>{timeAgo(live.publishedAt)}</span></>}
            </p>
          </div>
          <span className="admin-live__url">
            <a href={docsUrl} target="_blank" rel="noreferrer"><code>{docsUrl.replace(/^https?:\/\//, '')}</code></a>
            <CopyButton value={docsUrl} label="Copiar endereço da documentação" />
          </span>
        </div>
        {drafts.length > 0 && (
          <div className="admin-live__pending">
            <span>
              {drafts.length === 1
                ? <>A <strong>{drafts[0]!.name}</strong> tem um rascunho salvo {timeAgo(drafts[0]!.updatedAt)} que ainda não está no ar.</>
                : <>{drafts.length} versões têm rascunhos que ainda não estão no ar: {drafts.map((version) => version.name).join(', ')}.</>}
            </span>
            <a href={specLink(drafts[0]!.id)} className={buttonClassName({ variant: 'outline', size: 'sm' })}><Rocket aria-hidden="true" />Revisar e publicar</a>
          </div>
        )}
      </Card>

      <div className={manage ? 'admin-stat-grid admin-stat-grid--four' : 'admin-stat-grid'}>
        {manage && (
          <StatCard
            icon={<Eye />}
            label="Visitas · 30 dias"
            value={(visits.data?.visits ?? 0).toLocaleString('pt-BR')}
            description={visits.data ? (visits.data.visitors ? plural(visits.data.visitors, 'visitante único', 'visitantes únicos') : 'nenhuma ainda') : visits.error ? 'não foi possível carregar' : 'carregando…'}
            action={<CardLink href={projectPath(project.slug, 'analytics')} label="Ver analytics" />}
            chart={visits.data?.visits ? <Sparkline data={visits.data.daily.map((item) => item.views)} label="Visitas por dia nos últimos 30 dias" /> : undefined}
          />
        )}
        <StatCard
          icon={<Braces />}
          label="Endpoints"
          value={summary?.endpoints ?? '—'}
          description={summary ? `${plural(summary.schemas, 'modelo', 'modelos')} · ${live!.name}` : 'nenhuma versão no ar'}
          action={<CardLink href={projectPath(project.slug, 'spec')} label="Ver spec" />}
        />
        <StatCard
          icon={<FileText />}
          label="Páginas da wiki"
          value={project.pages.length}
          description={project.pages.length ? `primeira: ${project.pages[0]!.title}` : 'nenhuma ainda'}
          action={<CardLink href={projectPath(project.slug, 'pages')} label="Ver páginas" />}
        />
        <StatCard
          icon={<Users />}
          label="Pessoas"
          value={project.members.length + owners}
          description={plural(editors + owners, 'pode editar', 'podem editar')}
          action={manage ? <CardLink href={projectPath(project.slug, 'users')} label="Ver usuários" /> : undefined}
        />
      </div>

      {/* Activity and versions on the left; onboarding on the right while it isn't done. */}
      <div className="admin-columns admin-columns--wide-left">
        {showSteps ? <div className="admin-stack">{activityCard}{versionsCard}</div> : activityCard}
        {showSteps ? stepsCard : versionsCard}
      </div>
    </div>
  );
}
