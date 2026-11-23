import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Ellipsis, FilePlus, FileUp, Plus, Trash2, Undo2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, IconButton, Markdown,
  TextField, cx,
} from '../../../design-system';
import { adminApi } from '../data/store';
import type { DocPage, Project } from '../data/types';
import { slugify, slugPattern } from '../format';
import { PageHeader, useAction } from '../parts';
import { CodeEditor, type CodeEditorApi } from '../spec-editor/CodeEditor';
import '../spec-editor/api-editor.css';
import { useColumnLayout } from '../resize';

/* Snippets for the docs' Markdown blocks, inserted at the cursor. */
const snippets: Array<{ label: string; text: string }> = [
  { label: 'Aviso (dica)', text: ':::tip Título opcional\nTexto do aviso.\n:::\n' },
  { label: 'Aviso (atenção)', text: ':::warning\nCuidado com…\n:::\n' },
  { label: 'Passos', text: ':::steps\n1. Primeiro passo\n2. Segundo passo\n:::\n' },
  { label: 'Abas', text: ':::tabs\n@tab Node.js\nConteúdo da aba.\n\n@tab Python\nConteúdo da aba.\n:::\n' },
  { label: 'Código em abas', text: ':::code-group\n```bash [npm]\nnpm install\n```\n\n```bash [pnpm]\npnpm add\n```\n:::\n' },
  { label: 'Bloco de código', text: '```bash\ncurl https://api.exemplo.com\n```\n' },
  { label: 'Seção recolhível', text: ':::details Ver mais\nConteúdo escondido.\n:::\n' },
  { label: 'Tabela', text: '| Campo | Descrição |\n| --- | --- |\n| id | Identificador |\n' },
  { label: 'Imagem ou vídeo', text: '![Descrição da imagem](https://)\n' },
  { label: 'Diagrama (Mermaid)', text: '```mermaid\nflowchart LR\n  A[Cliente] --> B[API]\n```\n' },
];

/** Title from the first "# Heading", else from the file name. */
function titleFrom(markdown: string, fileName: string) {
  const heading = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim();
  return heading || fileName.replace(/\.(md|markdown|mdx)$/i, '').replace(/[-_]+/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

function uniqueSlug(base: string, taken: string[]) {
  const root = slugify(base) || 'pagina';
  let slug = root;
  for (let index = 2; taken.includes(slug); index++) slug = `${root}-${index}`;
  return slug;
}

/** Editor for one page; keyed by page id, so switching pages starts from what's saved. */
function PageEditor({ project, page, onDirtyChange, saveRef }: { project: Project; page: DocPage; onDirtyChange: (dirty: boolean) => void; saveRef: React.MutableRefObject<(() => Promise<boolean>) | null> }) {
  const [draft, setDraft] = useState({ title: page.title, slug: page.slug, body: page.body });
  const editor = useRef<CodeEditorApi | null>(null);
  const { pending, run } = useAction();
  const dirty = draft.title !== page.title || draft.slug !== page.slug || draft.body !== page.body;
  const titleError = !draft.title.trim() ? 'Informe o título.' : undefined;
  const slugError = !slugPattern.test(draft.slug) ? 'Use letras minúsculas, números e hífens.' : project.pages.some((item) => item.slug === draft.slug && item.id !== page.id) ? 'Já existe uma página com esse endereço.' : undefined;

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  const save = async () => {
    if (!dirty) return true;
    if (titleError || slugError) return false;
    return Boolean(await run(() => adminApi.savePage(project.id, { id: page.id, ...draft, title: draft.title.trim() }), 'Página salva'));
  };
  saveRef.current = save;

  return (
    <>
      <div className="wiki-editor">
        <div className="wiki-editor__fields">
          <TextField label="Título" size="sm" value={draft.title} error={titleError} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <TextField label="Endereço" size="sm" prefix="/" value={draft.slug} error={slugError} onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase() })} />
        </div>
        <div className="wiki-editor__toolbar">
          <span className="api-editor__hint">Markdown · Ctrl/⌘+S salva</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" iconStart={<Plus />}>Inserir</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Blocos da documentação</DropdownMenuLabel>
              {snippets.map((snippet) => <DropdownMenuItem key={snippet.label} onSelect={() => requestAnimationFrame(() => editor.current?.insert(snippet.text))}>{snippet.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CodeEditor
          value={draft.body}
          onChange={(body) => setDraft((previous) => ({ ...previous, body }))}
          language="markdown"
          label={`Conteúdo de ${draft.title || 'página sem título'} em Markdown`}
          onSave={() => void save()}
          onReady={(api) => { editor.current = api; }}
          className="wiki-editor__code"
        />
      </div>

      <section className="wiki-preview" aria-label="Pré-visualização">
        <p className="wiki-preview__label">Pré-visualização</p>
        <div className="wiki-preview__page">
          {draft.body.trim() ? <Markdown source={draft.body} /> : <p className="admin-muted">A página está vazia.</p>}
        </div>
      </section>

      <div className="admin-action-bar wiki-actions" role="group" aria-label="Ações da página">
        <p className="admin-action-bar__status" aria-live="polite">{dirty ? 'Alterações não salvas' : 'Tudo salvo'}</p>
        <Button variant="ghost" iconStart={<Undo2 />} disabled={!dirty || pending} onClick={() => setDraft({ title: page.title, slug: page.slug, body: page.body })}>Descartar</Button>
        <Button disabled={!dirty || Boolean(titleError || slugError)} loading={pending} onClick={() => void save()}>Salvar</Button>
      </div>
    </>
  );
}

export function PagesView({ project }: { project: Project }) {
  const pages = project.pages;
  const [selectedId, setSelectedId] = useState<string | null>(() => pages[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DocPage | null>(null);
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const wiki = useRef<HTMLDivElement>(null);
  const columns = useColumnLayout(wiki, {
    key: 'opendoc.admin.wiki',
    list: { default: 220, min: 160, max: 420, label: 'Largura da lista de páginas' },
    splitLabel: 'Divisão entre editor e pré-visualização',
    splitName: 'Editor',
    actionsSelector: '.wiki-actions',
  });
  const { run } = useAction();
  const selected = pages.find((page) => page.id === selectedId) ?? pages[0] ?? null;
  const onDirtyChange = useMemo(() => (value: boolean) => setDirty(value), []);

  // Keep a valid selection when pages are added or removed.
  useEffect(() => { if (!selected && pages[0]) setSelectedId(pages[0].id); }, [selected, pages]);

  const select = (id: string) => {
    if (id === selected?.id) return;
    if (dirty) setPendingSwitch(id); else setSelectedId(id);
  };

  const create = async (title: string, body: string, slugBase = title, taken = project.pages.map((page) => page.slug)) => {
    const slug = uniqueSlug(slugBase, taken);
    taken.push(slug);
    const next = await run(() => adminApi.savePage(project.id, { title, slug, body }));
    return next ? next.pages[next.pages.length - 1] : undefined;
  };
  const newPage = async () => {
    if (dirty && !(await saveRef.current?.())) return;
    const page = await create('Nova página', '# Nova página\n\n');
    if (page) setSelectedId(page.id);
  };
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let last: DocPage | undefined;
    // Shared across the batch, so two files with the same name get different addresses.
    const taken = project.pages.map((page) => page.slug);
    for (const file of Array.from(files)) {
      const body = await file.text();
      last = await create(titleFrom(body, file.name), body, file.name.replace(/\.(md|markdown|mdx)$/i, ''), taken);
    }
    if (last) setSelectedId(last.id);
  };

  const move = (page: DocPage, offset: -1 | 1, index: number) => run(() => adminApi.movePage(project.id, page.id, offset), `“${page.title}” movida para a posição ${index + offset + 1}`);

  return (
    <div className="admin-page admin-page--full">
      <PageHeader
        title="Wiki"
        description="Guias em Markdown que aparecem antes da referência da API, na ordem da lista."
        actions={(
          <>
            <Button variant="outline" size="sm" iconStart={<FileUp />} onClick={() => fileInput.current?.click()}>Importar .md</Button>
            <Button size="sm" iconStart={<Plus />} onClick={() => void newPage()}>Nova página</Button>
            <input ref={fileInput} type="file" accept=".md,.markdown,.mdx,text/markdown" multiple hidden onChange={(event) => { void importFiles(event.target.files); event.target.value = ''; }} />
          </>
        )}
      />

      {pages.length === 0 || !selected ? (
        <EmptyState
          icon={<FilePlus />}
          titleAs="h2"
          title="Nenhuma página ainda"
          description="Escreva em Markdown ou importe arquivos .md que você já tem."
          actions={(
            <>
              <Button iconStart={<Plus />} onClick={() => void newPage()}>Nova página</Button>
              <Button variant="outline" iconStart={<FileUp />} onClick={() => fileInput.current?.click()}>Importar .md</Button>
            </>
          )}
        />
      ) : (
        <div ref={wiki} className={cx('wiki', columns.dragging && 'is-resizing')} style={columns.style}>
          <nav className="wiki-list" aria-labelledby="wiki-list-heading">
            <p className="wiki-list__heading" id="wiki-list-heading">Páginas <span className="wiki-list__count">{pages.length}</span></p>
            <ol>
              {pages.map((page, index) => (
                <li key={page.id} className={cx('wiki-list__item', page.id === selected.id && 'is-active')}>
                  <button type="button" className="wiki-list__button" aria-current={page.id === selected.id ? 'page' : undefined} onClick={() => select(page.id)}>
                    <span className="wiki-list__order" aria-hidden="true">{index + 1}</span>
                    <span className="wiki-list__title">{page.title}</span>
                    {page.id === selected.id && dirty && <span className="wiki-list__dirty"><span className="ds-sr-only">(alterações não salvas)</span></span>}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton icon={<Ellipsis />} aria-label={`Ações para ${page.title}`} variant="ghost" size="sm" tooltip={false} className="wiki-list__menu" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={index === 0} onSelect={() => move(page, -1, index)}><ArrowUp />Mover para cima</DropdownMenuItem>
                      <DropdownMenuItem disabled={index === pages.length - 1} onSelect={() => move(page, 1, index)}><ArrowDown />Mover para baixo</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(page)}><Trash2 />Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ol>
          </nav>
          {columns.handles}
          <PageEditor key={selected.id} project={project} page={selected} onDirtyChange={onDirtyChange} saveRef={saveRef} />
        </div>
      )}

      <AlertDialog open={pendingSwitch !== null} onOpenChange={(open) => { if (!open) setPendingSwitch(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar as alterações em “{selected?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>Você editou esta página e ainda não salvou.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <Button variant="outline" onClick={() => { setDirty(false); setSelectedId(pendingSwitch); setPendingSwitch(null); }}>Descartar</Button>
            <AlertDialogAction onClick={async () => { const target = pendingSwitch; if (await saveRef.current?.()) setSelectedId(target); setPendingSwitch(null); }}>Salvar e abrir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>A página sai da documentação e links para ela deixam de funcionar. Isso não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleting && run(() => adminApi.deletePage(project.id, deleting.id), 'Página excluída')}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
