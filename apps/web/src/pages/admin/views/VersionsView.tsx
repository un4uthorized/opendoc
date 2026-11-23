import { useEffect, useState } from 'react';
import { Archive, Braces, NotebookPen, Plus, Star, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Badge, Button, DataTable, DropdownMenuItem, DropdownMenuSeparator, MarkdownEditor, Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader,
  SheetTitle, type DataTableColumn,
} from '../../../design-system';
import { adminApi } from '../data/store';
import { specSummary } from '../data/spec';
import type { Project, ProjectVersion } from '../data/types';
import { formatDate, timeAgo } from '../format';
import { PageHeader, useAction } from '../parts';
import { navigate, projectPath } from '../router';
import { NewVersionDialog } from './SpecView';

function ChangelogSheet({ project, version, onClose }: { project: Project; version: ProjectVersion | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const { pending, run } = useAction();
  useEffect(() => { if (version) setText(version.changelog ?? ''); }, [version]);
  return (
    <Sheet open={version !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="admin-page-sheet">
        <form
          className="admin-page-sheet__form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (version && await run(() => adminApi.saveChangelog(project.id, version.id, text), 'Changelog salvo')) onClose();
          }}
        >
          <SheetHeader>
            <SheetTitle>Changelog da {version?.name}</SheetTitle>
            <SheetDescription>Aparece na página de novidades da documentação. Use títulos como “Novidades”, “Mudanças” e “Correções”.</SheetDescription>
          </SheetHeader>
          <SheetBody className="admin-form">
            <MarkdownEditor label="Notas da versão" value={text} onChange={setText} rows={18} placeholder={'## Novidades\n\n- …'} />
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={pending}>Salvar changelog</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function VersionsView({ project }: { project: Project }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProjectVersion | null>(null);
  const [deleting, setDeleting] = useState<ProjectVersion | null>(null);
  const { run } = useAction();
  const specLink = (version: ProjectVersion) => `${projectPath(project.slug, 'spec')}?versao=${version.id}`;

  const columns: DataTableColumn<ProjectVersion>[] = [
    {
      id: 'name', header: 'Versão', sortValue: (version) => version.name, cell: (version) => (
        <span className="admin-version-cell">
          <a href={specLink(version)} className="admin-version-cell__name">{version.name}</a>
          <span className="admin-inline-badges">
            {version.id === project.defaultVersionId && <Badge variant="info">Padrão</Badge>}
            {version.draft !== undefined && <Badge variant="warning">Rascunho</Badge>}
            {version.deprecated && <Badge variant="outline">Obsoleta</Badge>}
          </span>
        </span>
      ),
    },
    {
      id: 'published', header: 'Publicada', sortValue: (version) => version.publishedAt ?? '', cell: (version) => (version.publishedAt
        ? <span title={formatDate(version.publishedAt)}>{timeAgo(version.publishedAt)}</span>
        : <span className="admin-muted">Nunca</span>),
    },
    { id: 'endpoints', header: 'Endpoints', align: 'right', hideOnMobile: true, sortValue: (version) => specSummary(version.spec)?.endpoints ?? -1, cell: (version) => specSummary(version.spec)?.endpoints ?? <span className="admin-muted">—</span> },
    { id: 'changelog', header: 'Changelog', hideOnMobile: true, cell: (version) => (version.changelog ? <Badge variant="success" dot>Escrito</Badge> : <span className="admin-muted">Vazio</span>) },
  ];

  return (
    <div className="admin-page">
      <PageHeader
        title="Versões"
        description="Cada versão tem a própria spec e changelog. A versão padrão abre primeiro na documentação; as obsoletas continuam acessíveis com um aviso."
        actions={<Button iconStart={<Plus />} onClick={() => setCreating(true)}>Nova versão</Button>}
      />

      <DataTable
        label={`Versões de ${project.name}`}
        data={project.versions}
        columns={columns}
        getRowId={(version) => version.id}
        getRowLabel={(version) => version.name}
        rowActions={(version) => (
          <>
            <DropdownMenuItem onSelect={() => navigate(specLink(version))}><Braces />Editar spec</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditing(version)}><NotebookPen />Editar changelog</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={version.id === project.defaultVersionId} onSelect={() => run(() => adminApi.updateProject(project.id, { defaultVersionId: version.id }), `${version.name} agora é a versão padrão`)}>
              <Star />Definir como padrão
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run(() => adminApi.setVersionDeprecated(project.id, version.id, !version.deprecated), version.deprecated ? 'Versão reativada' : 'Versão marcada como obsoleta')}>
              <Archive />{version.deprecated ? 'Desmarcar obsoleta' : 'Marcar como obsoleta'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={version.id === project.defaultVersionId} onSelect={() => setDeleting(version)}><Trash2 />Excluir versão</DropdownMenuItem>
          </>
        )}
      />

      <NewVersionDialog project={project} open={creating} onOpenChange={setCreating} onCreated={(id) => navigate(`${projectPath(project.slug, 'spec')}?versao=${id}`)} />
      <ChangelogSheet project={project} version={editing} onClose={() => setEditing(null)} />
      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a versão {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>A spec, o rascunho e o changelog desta versão serão apagados e ela sai da documentação. Isso não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleting && run(() => adminApi.deleteVersion(project.id, deleting.id), `Versão ${deleting.name} excluída`)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
