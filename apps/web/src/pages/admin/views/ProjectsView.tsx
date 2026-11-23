import { useState } from 'react';
import { Braces, CalendarClock, FileText, Folder, FolderPlus, GitBranch, Globe, Lock, Plus, SearchX } from 'lucide-react';
import { AvatarGroup, Button, EmptyState, TextField } from '../../../design-system';
import { useAdminState } from '../data/store';
import { specSummary } from '../data/spec';
import { visibilityLabels, type Project } from '../data/types';
import { plural } from '../format';
import { PageHeader } from '../parts';
import { projectPath } from '../router';

function publishedVersion(project: Project) {
  return project.versions.find((version) => version.id === project.defaultVersionId && version.publishedAt)
    ?? project.versions.find((version) => version.publishedAt);
}

const statusLabels = { live: 'No ar', draft: 'Rascunho', empty: 'Sem spec' } as const;
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });

function ProjectCard({ project }: { project: Project }) {
  const { users } = useAdminState();
  const published = publishedVersion(project);
  const summary = published ? specSummary(published.spec) : null;
  const hasDraft = project.versions.some((version) => version.draft !== undefined);
  const status = published ? 'live' : hasDraft ? 'draft' : 'empty';
  const defaultVersion = project.versions.find((version) => version.id === project.defaultVersionId);
  // People with access: the project's members and the installation's admins (who see every project).
  const people = users.filter((user) => user.owner || project.members.some((member) => member.userId === user.id));
  return (
    <li>
      <a href={projectPath(project.slug)} className="admin-project-card" aria-label={`${project.name}, ${statusLabels[status]}`}>
        <span className="admin-project-card__top">
          <span className="admin-project-card__icon" aria-hidden="true"><Folder /></span>
          <span className={`admin-project-card__status admin-project-card__status--${status}`}>{statusLabels[status]}</span>
        </span>

        <span className="admin-project-card__body">
          <span className="admin-project-card__name">{project.name}</span>
          <span className="admin-project-card__description">{project.description || 'Sem descrição'}</span>
        </span>

        <span className="admin-project-card__meta">
          {project.visibility === 'public' ? <Globe aria-hidden="true" /> : <Lock aria-hidden="true" />}
          <span>{visibilityLabels[project.visibility]}</span>
          <span className="admin-project-card__sep" aria-hidden="true" />
          <span className="admin-project-card__mono">/docs/{project.slug}</span>
        </span>

        <span className="admin-project-card__row">
          <span className="admin-project-card__meta" title={`Atualizado em ${shortDate.format(new Date(project.updatedAt))}`}>
            <CalendarClock aria-hidden="true" />
            <span>{shortDate.format(new Date(project.updatedAt))}</span>
          </span>
          {defaultVersion && (
            <span className="admin-project-card__version"><GitBranch aria-hidden="true" />{defaultVersion.name}</span>
          )}
        </span>

        <span className="admin-project-card__footer">
          <span className="admin-project-card__meta">
            <Braces aria-hidden="true" />
            <span>{summary ? plural(summary.endpoints, 'endpoint', 'endpoints') : '0 endpoints'}</span>
          </span>
          <span className="admin-project-card__meta">
            <FileText aria-hidden="true" />
            <span>{plural(project.pages.length, 'página', 'páginas')}</span>
          </span>
          {people.length > 0 && <AvatarGroup people={people.map((user) => ({ name: user.name }))} max={3} size="sm" className="admin-project-card__people" />}
        </span>
      </a>
    </li>
  );
}

/** Last tile of the grid: a dashed card that opens the new project dialog. */
function NewProjectCard({ onCreate }: { onCreate: () => void }) {
  return (
    <li>
      <button type="button" className="admin-project-card admin-project-card--new" onClick={onCreate}>
        <span className="admin-project-card__new-icon" aria-hidden="true"><Plus /></span>
        <span className="admin-project-card__name">Novo projeto</span>
        <span className="admin-project-card__description">Outra API, com spec, páginas e acesso próprios.</span>
      </button>
    </li>
  );
}

export function ProjectsView({ onCreate }: { onCreate: () => void }) {
  const { projects, users, currentUserId } = useAdminState();
  // Only the installation's admins create projects.
  const canCreate = Boolean(users.find((user) => user.id === currentUserId)?.owner);
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const visible = term ? projects.filter((project) => `${project.name} ${project.slug} ${project.description ?? ''}`.toLowerCase().includes(term)) : projects;

  return (
    <div className="admin-page">
      <PageHeader
        title="Projetos"
        description="Cada projeto é uma documentação separada, com spec, páginas e acesso próprios."
        actions={canCreate ? <Button iconStart={<Plus />} onClick={onCreate}>Novo projeto</Button> : undefined}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderPlus />}
          title="Nenhum projeto ainda"
          titleAs="h2"
          description="Crie um projeto e envie a spec OpenAPI para publicar a primeira documentação."
          actions={<Button iconStart={<Plus />} onClick={onCreate}>Criar projeto</Button>}
        />
      ) : (
        <>
          {projects.length > 3 && (
            <TextField label="Buscar projetos" type="search" size="sm" className="admin-search" value={query} onChange={(event) => setQuery(event.target.value)} />
          )}
          {visible.length === 0 ? (
            <EmptyState icon={<SearchX />} titleAs="h2" title="Nenhum projeto encontrado" description={`Nada corresponde a “${query}”.`} actions={<Button variant="outline" size="sm" onClick={() => setQuery('')}>Limpar busca</Button>} />
          ) : (
            <ul role="list" className="admin-project-grid" aria-label="Projetos">
              {visible.map((project) => <ProjectCard key={project.id} project={project} />)}
              {!term && canCreate && <NewProjectCard onCreate={onCreate} />}
            </ul>
          )}
          <p className="ds-sr-only" role="status" aria-live="polite">{term ? plural(visible.length, 'projeto encontrado', 'projetos encontrados') : ''}</p>
        </>
      )}
    </div>
  );
}
