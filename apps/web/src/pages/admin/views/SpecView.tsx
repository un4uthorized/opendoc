import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ChevronDown, CircleCheck, CircleX, Download, GitBranch, Link2, Plus, Rocket, Settings2, TriangleAlert, Undo2, Upload } from 'lucide-react';
import {
  Alert, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FileDropzone, IconButton,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
  NativeSelect, TextField, Textarea, cx,
} from '../../../design-system';
import { adminApi } from '../data/store';
import { checkSpec, emptySpec, parsed } from '../data/spec';
import { toYaml } from '../data/openapi';
import { CodeEditor, type CodeEditorApi } from '../spec-editor/CodeEditor';
import { openApiCompletion } from '../spec-editor/completion';
import '../spec-editor/api-editor.css';
import type { Project, ProjectVersion } from '../data/types';
import { formatDate, plural, timeAgo } from '../format';
import { PageHeader, useAction } from '../parts';
import { ResizeHandle, clamp, useStoredNumber } from '../resize';
import { SpecPreview } from '../spec-editor/SpecPreview';

/** Neither the editor nor the preview gets narrower than this. */
const minPane = 320;
import { projectPath } from '../router';

export function NewVersionDialog({ project, open, onOpenChange, onCreated }: { project: Project; open: boolean; onOpenChange: (open: boolean) => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { pending, run } = useAction();
  useEffect(() => {
    if (open) { setName(''); setCopyFrom(project.defaultVersionId); setSubmitted(false); }
  }, [open, project.defaultVersionId]);
  const error = submitted && !name.trim() ? 'Informe o nome da versão.' : undefined;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!name.trim()) return;
    const id = await run(() => adminApi.createVersion(project.id, name.trim(), copyFrom || undefined), `Versão ${name.trim()} criada`);
    if (id) { onOpenChange(false); onCreated(id); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-dialog">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Nova versão</DialogTitle>
            <DialogDescription>A versão começa como rascunho e só aparece na documentação depois de publicada.</DialogDescription>
          </DialogHeader>
          <div className="admin-form">
            <TextField label="Nome" placeholder="v2" value={name} onChange={(event) => setName(event.target.value)} error={error} required autoFocus />
            <NativeSelect label="Copiar spec de" value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)}>
              <option value="">Nenhuma (spec vazia)</option>
              {project.versions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={pending}>Criar versão</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Import ────────────────────────────────────────────────────────── */

/** File, URL or pasted text. Calls `onLoad` with the raw text (YAML or JSON); nothing is saved yet. */
function ImportPanel({ projectName, onLoad, compact }: { projectName: string; onLoad: (text: string, source: string) => void; compact?: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState('');
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string>();
  const importing = useAction();

  const onFiles = async (next: File[]) => {
    setFiles(next);
    const file = next[0];
    if (!file) return;
    setError(undefined);
    onLoad(await file.text(), file.name);
    setFiles([]);
  };
  const fromUrl = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^https?:\/\/\S+$/.test(url.trim())) { setError('Informe uma URL http(s).'); return; }
    setError(undefined);
    const content = await importing.run(async () => {
      const response = await fetch(url.trim());
      if (!response.ok) throw new Error(`A URL respondeu ${response.status}.`);
      return response.text();
    });
    if (content !== undefined) onLoad(content, url.trim());
  };

  return (
    <div className={compact ? 'api-import api-import--compact' : 'api-import'}>
      <FileDropzone
        label="Arquivo OpenAPI"
        accept=".yaml,.yml,.json,application/json,application/yaml,text/yaml"
        maxSize={5 * 1024 * 1024}
        files={files}
        onFilesChange={onFiles}
        hint="openapi.yaml (ou .json, convertido para YAML), até 5 MB. OpenAPI 3.0 ou 3.1."
      />
      <div className="api-import__alternatives">
        <form className="admin-inline-form" onSubmit={fromUrl} noValidate>
          <TextField label="Ou importe de uma URL" type="url" placeholder="https://api.exemplo.com/openapi.yaml" value={url} onChange={(event) => setUrl(event.target.value)} prefix={<Link2 />} />
          <Button type="submit" variant="outline" loading={importing.pending}>Importar</Button>
        </form>
        <div className="api-import__paste">
          <Textarea label="Ou cole o conteúdo" className="api-import__textarea" rows={compact ? 4 : 5} placeholder={'openapi: 3.1.0\ninfo:\n  title: Minha API'} value={pasted} onChange={(event) => setPasted(event.target.value)} />
          <Button variant="outline" disabled={!pasted.trim()} onClick={() => { onLoad(pasted, 'texto colado'); setPasted(''); }}>Usar este conteúdo</Button>
        </div>
        {!compact && <Button variant="link" className="api-import__blank" onClick={() => onLoad(emptySpec(projectName), 'spec vazia')}>Ou comece com uma spec vazia</Button>}
      </div>
      {error && <Alert variant="destructive" title="Não foi possível importar">{error}</Alert>}
      <p className="admin-muted">A URL precisa permitir CORS. Com o servidor, a importação passará por ele.</p>
    </div>
  );
}

/* ── Editor ────────────────────────────────────────────────────────── */

/** Editor for one version: keyed by version id, so switching versions resets local edits. */
function VersionEditor({ project, version }: { project: Project; version: ProjectVersion }) {
  const saved = version.draft ?? version.spec;
  const [text, setText] = useState(saved);
  const [notice, setNotice] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const problemsId = useId();
  const editor = useRef<CodeEditorApi | null>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useStoredNumber('opendoc.admin.api.split', 0.5, (value) => clamp(value, 0.2, 0.8));
  const [resizing, setResizing] = useState(false);
  const moveSplit = (x: number) => {
    const width = workspace.current?.clientWidth ?? 0;
    if (width > 2 * minPane) setSplit(clamp(x / width, minPane / width, 1 - minPane / width));
  };
  const { pending, run } = useAction();

  // A save elsewhere (e.g. publish) changes what is stored: follow it when there are no local edits.
  const [base, setBase] = useState(saved);
  useEffect(() => {
    if (saved !== base) { if (text === base) setText(saved); setBase(saved); }
  }, [saved, base, text]);

  const result = parsed(text);
  const deferredText = useDeferredValue(text);
  const lastValid = useRef<unknown>(undefined);
  const deferredValue = parsed(deferredText).value;
  if (deferredValue) lastValid.current = deferredValue;
  const previewValue = lastValid.current;
  const check = useMemo(() => checkSpec(text), [text]);
  const errors = result.issues.filter((issue) => issue.severity === 'error');
  const warnings = result.issues.filter((issue) => issue.severity === 'warning');
  const dirty = text !== saved;
  const publishable = check.status === 'valid' && (dirty || version.draft !== undefined || !version.publishedAt);
  const refs = useMemo(() => {
    const components = result.value?.components ?? {};
    return ['schemas', 'responses', 'parameters', 'requestBodies', 'headers', 'examples', 'securitySchemes']
      .flatMap((section) => Object.keys(components[section] ?? {}).map((name) => `#/components/${section}/${name}`));
  }, [result.value]);
  // The completion source reads the latest refs through a ref, so the editor isn't rebuilt.
  const latest = useRef(refs);
  latest.current = refs;
  const completion = useMemo(() => openApiCompletion(() => 'yaml', () => latest.current), []);

  const load = (raw: string, source: string) => {
    // The editor works in YAML only: imported JSON is converted.
    const content = toYaml(raw);
    const converted = content !== raw ? ' (convertido de JSON para YAML)' : '';
    setText(content);
    setImporting(false);
    const loaded = checkSpec(content);
    setNotice(loaded.status === 'invalid'
      ? `Importado de ${source}${converted}, com ${loaded.errors} ${loaded.errors === 1 ? 'erro' : 'erros'}: veja a lista abaixo do editor.`
      : `Importado de ${source}${converted}. Revise e salve o rascunho.`);
  };
  const save = () => { if (dirty) void run(() => adminApi.saveDraft(project.id, version.id, text), 'Rascunho salvo'); };
  const download = () => {
    const blob = new Blob([text], { type: 'application/yaml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${project.slug}-${version.name}.yaml`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!text.trim()) {
    return (
      <section className="api-empty" aria-label="Importar spec">
        <h2 className="api-empty__title">Importe a spec OpenAPI da versão {version.name}</h2>
        <p className="admin-muted">A spec é editada em YAML, com validação e autocompletar do OpenAPI. Arquivos JSON são convertidos para YAML ao importar.</p>
        <ImportPanel projectName={project.name} onLoad={load} />
      </section>
    );
  }

  return (
    <>
      {notice && <Alert variant="info" title="Spec carregada" onDismiss={() => setNotice(undefined)}>{notice}</Alert>}

      <div ref={workspace} className={cx('api-workspace', resizing && 'is-resizing')} style={{ '--api-split': split } as CSSProperties}>
        <div className="api-editor">
          <ResizeHandle
            container={workspace}
            className="api-resize"
            label="Divisão entre editor e pré-visualização"
            value={split * 100}
            min={0}
            max={100}
            valueText={`Editor com ${Math.round(split * 100)}% do espaço`}
            position={() => (workspace.current?.clientWidth ?? 0) * split}
            onMove={moveSplit}
            onReset={() => setSplit(0.5)}
            onDragChange={setResizing}
          />
          <div className="api-editor__toolbar">
            <Badge variant="secondary">YAML</Badge>
            <span className="api-editor__hint">Ctrl+Espaço sugere campos do OpenAPI · Ctrl/⌘+S salva</span>
            <span className="api-editor__actions">
              <Button variant="ghost" size="sm" iconStart={<Upload />} onClick={() => setImporting(true)}>Importar</Button>
              <IconButton icon={<Download />} aria-label="Baixar a spec (YAML)" variant="ghost" size="sm" onClick={download} />
            </span>
          </div>
          <CodeEditor
            value={text}
            onChange={setText}
            language="yaml"
            label={`Spec OpenAPI da versão ${version.name}`}
            describedBy={problemsId}
            lint={(current) => parsed(current).issues}
            completion={completion}
            onSave={save}
            onReady={(api) => { editor.current = api; }}
            className="api-editor__code"
          />
          <div id={problemsId} className="api-problems" aria-live="polite">
            {result.issues.length === 0 ? (
              <p className="api-problems__ok">
                <CircleCheck aria-hidden="true" />
                {check.status === 'valid' && <span><strong>{check.summary.title}</strong> {check.summary.version && `${check.summary.version} · `}OpenAPI {check.summary.openapi} · {plural(check.summary.endpoints, 'endpoint', 'endpoints')} · {plural(check.summary.schemas, 'modelo', 'modelos')}</span>}
              </p>
            ) : (
              <>
                <p className="api-problems__summary">
                  {errors.length > 0 && <span className="api-problems__count is-error"><CircleX aria-hidden="true" />{plural(errors.length, 'erro', 'erros')}</span>}
                  {warnings.length > 0 && <span className="api-problems__count is-warning"><TriangleAlert aria-hidden="true" />{plural(warnings.length, 'aviso', 'avisos')}</span>}
                  {errors.length > 0 && <span className="admin-muted">Corrija os erros para publicar.</span>}
                </p>
                <ul className="api-problems__list">
                  {result.issues.slice(0, 50).map((issue, index) => (
                    <li key={index}>
                      <button type="button" className={`api-problems__item is-${issue.severity}`} onClick={() => editor.current?.goTo(issue.from)}>
                        {issue.severity === 'error' ? <CircleX aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
                        <span className="api-problems__line">Linha {issue.line}</span>
                        <span>{issue.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        <SpecPreview value={previewValue} stale={!result.value} />
        <div className="admin-action-bar api-actions" role="group" aria-label="Ações da spec">
          <p className="admin-action-bar__status" aria-live="polite">
            {dirty ? 'Alterações não salvas' : version.draft !== undefined ? `Rascunho salvo ${timeAgo(version.updatedAt)}` : version.publishedAt ? `Publicada em ${formatDate(version.publishedAt)}` : 'Nada publicado ainda'}
          </p>
          {(dirty || version.draft !== undefined) && (
            <Button variant="ghost" iconStart={<Undo2 />} disabled={pending} onClick={async () => {
              if (version.draft !== undefined) await run(() => adminApi.discardDraft(project.id, version.id), 'Rascunho descartado');
              setText(version.spec);
              setNotice(undefined);
            }}>
              Descartar alterações
            </Button>
          )}
          <Button variant="outline" disabled={!dirty} loading={pending} onClick={save}>Salvar rascunho</Button>
          <Button iconStart={<Rocket />} disabled={!publishable || pending} onClick={() => setConfirmPublish(true)}>Publicar</Button>
        </div>
      </div>


      <Dialog open={importing} onOpenChange={setImporting}>
        <DialogContent className="admin-dialog admin-dialog--wide">
          <DialogHeader>
            <DialogTitle>Importar outra spec</DialogTitle>
            <DialogDescription>O conteúdo substitui o do editor da versão {version.name}. Nada é salvo até você salvar o rascunho; dá para voltar com “Descartar alterações”.</DialogDescription>
          </DialogHeader>
          <ImportPanel projectName={project.name} onLoad={load} compact />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar {version.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {project.visibility === 'public' ? 'Qualquer pessoa com o link' : 'Quem tem acesso ao projeto'} passa a ver esta versão da spec na documentação.
              {warnings.length > 0 && ` Há ${plural(warnings.length, 'aviso', 'avisos')} na spec; eles não impedem a publicação.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(() => adminApi.publish(project.id, version.id, text), `${version.name} publicada`)}>Publicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function SpecView({ project }: { project: Project }) {
  // ?versao=<id> opens a specific version (links from Versões).
  const [versionId, setVersionId] = useState(() => new URLSearchParams(window.location.search).get('versao') ?? project.defaultVersionId);
  const [creating, setCreating] = useState(false);
  const version = project.versions.find((item) => item.id === versionId) ?? project.versions.find((item) => item.id === project.defaultVersionId) ?? project.versions[0];

  return (
    <div className="admin-page admin-page--full">
      <PageHeader
        title="API"
        description="A spec OpenAPI em YAML gera a referência da API. Importe, edite com validação e publique quando estiver pronta."
        actions={(
          <>
            {version && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" iconStart={<GitBranch />} iconEnd={<ChevronDown />} className="api-version-trigger" aria-label={`Versão ${version.name}. Trocar ou criar versão`}>
                    {version.name}
                    {version.id === project.defaultVersionId && <span className="api-version-trigger__meta">padrão</span>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="api-version-menu">
                  <DropdownMenuLabel>Versões</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={version.id} onValueChange={setVersionId}>
                    {project.versions.map((item) => (
                      <DropdownMenuRadioItem key={item.id} value={item.id}>
                        <span className="api-version-menu__name">{item.name}</span>
                        <span className="api-version-menu__meta">
                          {[item.id === project.defaultVersionId && 'padrão', item.deprecated && 'obsoleta', item.draft !== undefined && 'rascunho', !item.publishedAt && 'não publicada'].filter(Boolean).join(' · ')}
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setCreating(true)}><Plus />Nova versão…</DropdownMenuItem>
                  <DropdownMenuItem asChild><a href={projectPath(project.slug, 'versions')}><Settings2 />Gerenciar versões</a></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      />
      {version && <VersionEditor key={version.id} project={project} version={version} />}
      <NewVersionDialog project={project} open={creating} onOpenChange={setCreating} onCreated={setVersionId} />
    </div>
  );
}
