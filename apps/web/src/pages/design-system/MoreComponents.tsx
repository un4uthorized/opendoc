import { useEffect, useMemo, useRef, useState } from 'react';
import { FileJson, FolderSearch, RefreshCw, Upload } from 'lucide-react';
import {
  Badge, Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardContent, CardHeader,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, Kbd, KbdGroup, Pagination, Progress, Skeleton, Switch,
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow, TextField, toast, type SortDirection,
} from '../../design-system';
import { Section, Specimen, type KeyboardRow } from './parts';

const keys = {
  toast: [
    ['F8', 'Leva o foco para a região de notificações'],
    ['Tab', 'Navega pela ação e pelo botão de fechar'],
    ['Esc', 'Fecha a notificação focada'],
  ] as KeyboardRow[],
  tableSort: [['Enter / Space', 'No cabeçalho, alterna a ordenação da coluna']] as KeyboardRow[],
  pagination: [['Tab', 'Percorre anterior, páginas e próxima'], ['Enter / Space', 'Vai para a página']] as KeyboardRow[],
};

/* ── Toast, Progress, Skeleton ─────────────────────────────────────── */

function ImportProgress() {
  const [progress, setProgress] = useState<number | null>(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(timer.current), []);

  function start() {
    setRunning(true);
    setProgress(null);
    // Unknown duration first (indeterminate), then real progress.
    window.setTimeout(() => {
      setProgress(0);
      timer.current = window.setInterval(() => {
        setProgress((current) => {
          const next = Math.min(100, (current ?? 0) + 7 + Math.round(Math.random() * 8));
          if (next >= 100) {
            window.clearInterval(timer.current);
            setRunning(false);
            toast({ title: 'Especificação importada', description: '48 endpoints em 6 grupos.', variant: 'success' });
          }
          return next;
        });
      }, 280);
    }, 1200);
  }

  return (
    <div className="dsp-progress-demo">
      <Progress label={progress === null ? 'Lendo arquivo…' : 'Importando openapi.yaml'} value={progress} showValue />
      <Progress label="Uso do plano: 7.200 de 10.000 requisições" value={72} />
      <Progress label="Sincronizando" hideLabel value={null} />
      <div><Button variant="outline" size="sm" iconStart={<Upload />} onClick={start} disabled={running}>{running ? 'Importando…' : progress === 100 ? 'Importar de novo' : 'Simular importação'}</Button></div>
    </div>
  );
}

function SkeletonDemo() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="dsp-skeleton-demo">
      <Switch label="Carregando" checked={loading} onCheckedChange={setLoading} />
      <Card aria-busy={loading} className="dsp-skeleton-demo__card">
        {loading ? (
          <>
            <p className="ds-sr-only" role="status">Carregando projeto…</p>
            <div className="dsp-skeleton-demo__header">
              <Skeleton className="dsp-sk-avatar" />
              <div className="dsp-skeleton-demo__lines">
                <Skeleton className="dsp-sk-line dsp-sk-line--title" />
                <Skeleton className="dsp-sk-line dsp-sk-line--short" />
              </div>
            </div>
            <div className="dsp-skeleton-demo__body">
              <Skeleton className="dsp-sk-line" />
              <Skeleton className="dsp-sk-line" />
              <Skeleton className="dsp-sk-line dsp-sk-line--medium" />
            </div>
          </>
        ) : (
          <>
            <CardHeader title="API de pagamentos" description="v2.4 · atualizada há 3 horas" actions={<Badge variant="success" dot>Publicada</Badge>} />
            <CardContent className="dsp-muted">Cobranças, reembolsos e webhooks para integrar pagamentos ao seu produto. 48 endpoints documentados em 6 grupos.</CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

export function ProgressSection() {
  return (
    <Section id="progresso" eyebrow="Componentes" title="Toast, Progress e Skeleton" description="Comunicam o que está acontecendo agora: uma confirmação passageira, uma tarefa em andamento ou um conteúdo que ainda está carregando.">
      <Specimen
        title="Toast"
        description={<>Notificação passageira, chamada de qualquer lugar com <code>toast()</code>. Fica numa região alcançável com F8, pausa ao passar o mouse ou focar, e o destructive é anunciado com prioridade. Nunca use para algo que exige resposta: para isso, use AlertDialog.</>}
        keyboard={keys.toast}
        code={`toast({ title: 'Projeto salvo', variant: 'success' });\ntoast({\n  title: 'Leitor removido',\n  action: { label: 'Desfazer', altText: 'Desfazer remoção', onClick: undo },\n});`}
      >
        <Button variant="outline" onClick={() => toast({ title: 'Projeto salvo', description: 'As alterações já estão na documentação.', variant: 'success' })}>Sucesso</Button>
        <Button variant="outline" onClick={() => toast({ title: 'Leitor removido', description: 'Carla Dias não tem mais acesso.', action: { label: 'Desfazer', altText: 'Para desfazer, convide Carla Dias novamente em Equipe.', onClick: () => toast({ title: 'Acesso restaurado', variant: 'success' }) } })}>Com ação</Button>
        <Button variant="outline" onClick={() => toast({ title: 'Não foi possível publicar', description: 'O servidor recusou a especificação (422).', variant: 'destructive' })}>Erro</Button>
        <Button variant="ghost" onClick={() => toast({ title: 'Nova versão disponível', description: 'Recarregue para ver as mudanças.' })}>Neutro</Button>
      </Specimen>

      <Specimen title="Progress" description={<><code>role="progressbar"</code> com nome e porcentagem anunciados. Sem valor (<code>value=&#123;null&#125;</code>), vira indeterminado, para tarefas de duração desconhecida.</>} layout="stack" code={`<Progress label="Importando openapi.yaml" value={64} showValue />\n<Progress label="Sincronizando" hideLabel value={null} />`}>
        <ImportProgress />
      </Specimen>

      <Specimen title="Skeleton" description={<>Reserva o espaço do conteúdo para evitar saltos no layout. O esqueleto é oculto para leitores de tela: a área recebe <code>aria-busy</code> e um aviso “Carregando…” invisível.</>} layout="stack" code={`<Card aria-busy={loading}>\n  <p className="ds-sr-only" role="status">Carregando projeto…</p>\n  <Skeleton style={{ height: 16, width: '60%' }} />\n</Card>`}>
        <SkeletonDemo />
      </Specimen>
    </Section>
  );
}

/* ── Table, Pagination, Breadcrumb, Kbd, EmptyState ─────────────────── */

type Endpoint = { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; latency: number; status: 'Estável' | 'Beta' | 'Obsoleto' };
const resources = ['projects', 'charges', 'refunds', 'customers', 'webhooks', 'invoices', 'payouts', 'disputes'];
const methods: Endpoint['method'][] = ['GET', 'POST', 'PATCH', 'DELETE'];
const endpoints: Endpoint[] = resources.flatMap((resource, r) => methods.map((method, m) => ({
  method,
  path: m === 0 || m === 1 ? `/v1/${resource}` : `/v1/${resource}/{id}`,
  latency: 40 + ((r * 37 + m * 53) % 260),
  status: (r + m) % 7 === 0 ? 'Obsoleto' : (r + m) % 5 === 0 ? 'Beta' : 'Estável',
})));
const methodVariant = { GET: 'info', POST: 'success', PATCH: 'warning', DELETE: 'destructive' } as const;
const statusVariant = { Estável: 'outline', Beta: 'secondary', Obsoleto: 'destructive' } as const;
type SortKey = 'path' | 'latency';
const pageSize = 6;

function EndpointsTable() {
  const [sort, setSort] = useState<{ key: SortKey; direction: Exclude<SortDirection, 'none'> }>({ key: 'path', direction: 'ascending' });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const filtered = endpoints.filter((endpoint) => `${endpoint.method} ${endpoint.path}`.toLowerCase().includes(query.trim().toLowerCase()));
    return filtered.sort((a, b) => {
      const order = sort.key === 'latency' ? a.latency - b.latency : a.path.localeCompare(b.path) || methods.indexOf(a.method) - methods.indexOf(b.method);
      return sort.direction === 'ascending' ? order : -order;
    });
  }, [sort, query]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);

  const toggle = (key: SortKey) => {
    setSort((previous) => ({ key, direction: previous.key === key && previous.direction === 'ascending' ? 'descending' : 'ascending' }));
    setPage(1);
  };
  const sortOf = (key: SortKey): SortDirection => (sort.key === key ? sort.direction : 'none');

  return (
    <div className="dsp-table-demo">
      <TextField label="Filtrar endpoints" type="search" size="sm" placeholder="Ex.: refunds, DELETE…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="dsp-table-demo__filter" />
      {rows.length === 0 ? (
        <EmptyState
          icon={<FolderSearch />}
          title="Nenhum endpoint encontrado"
          description={<>Nada corresponde a “{query}”. Confira a grafia ou importe uma especificação mais recente.</>}
          actions={<><Button variant="outline" size="sm" onClick={() => setQuery('')}>Limpar filtro</Button><Button size="sm" iconStart={<FileJson />}>Importar OpenAPI</Button></>}
          titleAs="h4"
        />
      ) : (
        <>
          <Table label="Endpoints da API de pagamentos">
            <TableCaption>{rows.length} endpoints · página {current} de {pageCount}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Método</TableHead>
                <TableHead sort={sortOf('path')} onSort={() => toggle('path')}>Caminho</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right" sort={sortOf('latency')} onSort={() => toggle('latency')}>Latência p95</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((endpoint) => (
                <TableRow key={`${endpoint.method} ${endpoint.path}`}>
                  <TableCell><Badge variant={methodVariant[endpoint.method]} className="dsp-method">{endpoint.method}</Badge></TableCell>
                  <TableCell><code className="dsp-path">{endpoint.path}</code></TableCell>
                  <TableCell><Badge variant={statusVariant[endpoint.status]}>{endpoint.status}</Badge></TableCell>
                  <TableCell align="right" className="dsp-number">{endpoint.latency} ms</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={current} pageCount={pageCount} onPageChange={setPage} aria-label="Paginação dos endpoints" className="dsp-table-demo__pagination" />
        </>
      )}
    </div>
  );
}

export function DataSection() {
  return (
    <Section id="dados" eyebrow="Componentes" title="Table, Pagination e Breadcrumb" description="Para listas de dados e para situar a pessoa na hierarquia. Tabelas usam HTML semântico (caption, th com scope e aria-sort), que leitores de tela já sabem navegar.">
      <Specimen
        title="Table e Pagination"
        description={<>Clique nos cabeçalhos “Caminho” e “Latência” para ordenar: o <code>th</code> recebe <code>aria-sort</code>. A tabela rola na horizontal em telas estreitas e, com <code>label</code>, a área de rolagem recebe foco pelo teclado. Filtre por algo inexistente para ver o EmptyState.</>}
        layout="stack"
        keyboard={[...keys.tableSort, ...keys.pagination]}
        code={`<Table label="Endpoints">\n  <TableCaption>48 endpoints</TableCaption>\n  <TableHeader>\n    <TableRow>\n      <TableHead sort={sort} onSort={toggle}>Caminho</TableHead>\n    </TableRow>\n  </TableHeader>\n  <TableBody>…</TableBody>\n</Table>\n<Pagination page={page} pageCount={8} onPageChange={setPage} />`}
      >
        <EndpointsTable />
      </Specimen>

      <Specimen title="Breadcrumb" description={<>Lista ordenada dentro de <code>&lt;nav aria-label&gt;</code>. A página atual não é link e recebe <code>aria-current="page"</code>; os separadores ficam ocultos. Níveis do meio podem ser recolhidos num menu.</>} layout="stack" code={`<Breadcrumb>\n  <BreadcrumbList>\n    <BreadcrumbItem><BreadcrumbLink href="/docs">Documentação</BreadcrumbLink></BreadcrumbItem>\n    <BreadcrumbSeparator />\n    <BreadcrumbItem><BreadcrumbPage>Reembolsos</BreadcrumbPage></BreadcrumbItem>\n  </BreadcrumbList>\n</Breadcrumb>`}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="#dados">Documentação</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink href="#dados">API de pagamentos</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Reembolsos</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Breadcrumb aria-label="Trilha de navegação recolhida">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="#dados">Documentação</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger className="dsp-crumb-menu" aria-label="Mostrar níveis ocultos"><BreadcrumbEllipsis /></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem>API de pagamentos</DropdownMenuItem>
                  <DropdownMenuItem>Referência</DropdownMenuItem>
                  <DropdownMenuItem>Reembolsos</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Criar reembolso</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Specimen>

      <Specimen title="Kbd" description={<>Teclas e atalhos. Símbolos como ⌘ e ⇧ são mal lidos por leitores de tela: passe <code>label</code> com o nome da tecla.</>} layout="stack" code={`<KbdGroup>\n  <Kbd label="Command">⌘</Kbd>\n  <Kbd>K</Kbd>\n</KbdGroup>`}>
        <ul className="dsp-shortcuts" role="list">
          <li><span>Buscar na documentação</span><KbdGroup><Kbd label="Command">⌘</Kbd><Kbd>K</Kbd></KbdGroup></li>
          <li><span>Copiar exemplo de requisição</span><KbdGroup><Kbd label="Command">⌘</Kbd><Kbd label="Shift">⇧</Kbd><Kbd>C</Kbd></KbdGroup></li>
          <li><span>Próximo endpoint</span><Kbd>J</Kbd></li>
          <li><span>Ir para notificações</span><Kbd>F8</Kbd></li>
          <li><span>Fechar painel</span><Kbd>Esc</Kbd></li>
        </ul>
      </Specimen>

      <Specimen title="EmptyState" description="Explica por que não há nada e oferece o próximo passo. Use o nível de título que encaixa na página (titleAs)." code={`<EmptyState\n  icon={<FileJson />}\n  title="Nenhuma especificação"\n  description="Importe um arquivo OpenAPI para gerar a documentação."\n  actions={<Button>Importar OpenAPI</Button>}\n/>`}>
        <EmptyState
          className="dsp-empty-demo"
          icon={<FileJson />}
          title="Nenhuma especificação ainda"
          description="Importe um arquivo OpenAPI 3.0 ou 3.1 (JSON ou YAML) para gerar a referência e o API Explorer."
          actions={<><Button iconStart={<Upload />}>Importar OpenAPI</Button><Button variant="outline" iconStart={<RefreshCw />}>Usar exemplo</Button></>}
          titleAs="h4"
        />
      </Specimen>
    </Section>
  );
}
