import { useDeferredValue, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, AtSign, Ban, Bell, BellOff, Book, BookOpen, Bookmark, Braces, Bug, Building2, Calendar, Check,
  ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, CircleAlert, CircleCheck, CircleHelp, CircleX, Clock, Code, Copy, Cpu, Database,
  Download, Ellipsis, EllipsisVertical, ExternalLink, Eye, EyeOff, File, FileCode, FileJson, FileText, Filter, Folder, FolderOpen, GitBranch, Globe, Heart,
  House, Image, Inbox, Info, Key, KeyRound, LayoutGrid, Link, List, LoaderCircle, Lock, LockOpen, LogIn, LogOut, Mail, Menu, MessageSquare, Minus, Monitor,
  Moon, PanelLeft, Paperclip, Pause, Pencil, Phone, Play, Plug, Plus, Redo2, RefreshCw, RotateCcw, Save, Search, Send, Server, Settings, Settings2,
  Share2, ShieldCheck, SlidersHorizontal, Smartphone, Star, Sun, Tag, Terminal, ThumbsUp, Trash2, TriangleAlert, Undo2, Upload, User, UserMinus,
  UserPlus, Users, Webhook, X, Zap, type LucideIcon,
} from 'lucide-react';
import {
  Alert, Badge, Button, Icon, IconButton, TextField, ToggleGroup, ToggleGroupItem, iconSizes, type IconSize,
} from '../../design-system';
import { Section, Specimen, useCopy } from './parts';

type IconEntry = { name: string; icon: LucideIcon; keywords: string };

const catalog: Array<{ category: string; icons: IconEntry[] }> = [
  {
    category: 'Ações',
    icons: [
      { name: 'Plus', icon: Plus, keywords: 'adicionar novo criar mais' },
      { name: 'Minus', icon: Minus, keywords: 'remover menos subtrair' },
      { name: 'Pencil', icon: Pencil, keywords: 'editar lapis alterar' },
      { name: 'Trash2', icon: Trash2, keywords: 'excluir apagar lixeira deletar' },
      { name: 'Copy', icon: Copy, keywords: 'copiar duplicar' },
      { name: 'Check', icon: Check, keywords: 'confirmar ok marcado concluido' },
      { name: 'X', icon: X, keywords: 'fechar cancelar remover' },
      { name: 'Save', icon: Save, keywords: 'salvar gravar' },
      { name: 'Download', icon: Download, keywords: 'baixar exportar' },
      { name: 'Upload', icon: Upload, keywords: 'enviar importar subir' },
      { name: 'Share2', icon: Share2, keywords: 'compartilhar' },
      { name: 'RefreshCw', icon: RefreshCw, keywords: 'atualizar recarregar sincronizar' },
      { name: 'RotateCcw', icon: RotateCcw, keywords: 'restaurar redefinir voltar' },
      { name: 'Undo2', icon: Undo2, keywords: 'desfazer' },
      { name: 'Redo2', icon: Redo2, keywords: 'refazer' },
      { name: 'Search', icon: Search, keywords: 'buscar pesquisar procurar lupa' },
      { name: 'Filter', icon: Filter, keywords: 'filtrar funil' },
      { name: 'SlidersHorizontal', icon: SlidersHorizontal, keywords: 'ajustes filtros preferencias' },
      { name: 'Settings', icon: Settings, keywords: 'configuracoes engrenagem opcoes' },
      { name: 'Settings2', icon: Settings2, keywords: 'ajustes configuracoes controles' },
      { name: 'Ellipsis', icon: Ellipsis, keywords: 'mais opcoes menu reticencias' },
      { name: 'EllipsisVertical', icon: EllipsisVertical, keywords: 'mais opcoes menu vertical' },
      { name: 'ExternalLink', icon: ExternalLink, keywords: 'abrir nova aba link externo' },
      { name: 'Link', icon: Link, keywords: 'link url corrente' },
      { name: 'Eye', icon: Eye, keywords: 'ver mostrar visivel olho' },
      { name: 'EyeOff', icon: EyeOff, keywords: 'ocultar esconder senha' },
      { name: 'Lock', icon: Lock, keywords: 'bloqueado privado cadeado' },
      { name: 'LockOpen', icon: LockOpen, keywords: 'desbloqueado publico aberto' },
      { name: 'LogIn', icon: LogIn, keywords: 'entrar login acessar' },
      { name: 'LogOut', icon: LogOut, keywords: 'sair logout' },
    ],
  },
  {
    category: 'Navegação',
    icons: [
      { name: 'ChevronDown', icon: ChevronDown, keywords: 'abrir expandir seta baixo' },
      { name: 'ChevronUp', icon: ChevronUp, keywords: 'recolher seta cima' },
      { name: 'ChevronLeft', icon: ChevronLeft, keywords: 'anterior voltar seta esquerda' },
      { name: 'ChevronRight', icon: ChevronRight, keywords: 'proximo avancar seta direita submenu' },
      { name: 'ChevronsUpDown', icon: ChevronsUpDown, keywords: 'ordenar select seletor' },
      { name: 'ArrowLeft', icon: ArrowLeft, keywords: 'voltar seta esquerda' },
      { name: 'ArrowRight', icon: ArrowRight, keywords: 'continuar avancar seta direita' },
      { name: 'ArrowUp', icon: ArrowUp, keywords: 'subir crescente seta cima' },
      { name: 'ArrowDown', icon: ArrowDown, keywords: 'descer decrescente seta baixo' },
      { name: 'ArrowUpRight', icon: ArrowUpRight, keywords: 'abrir externo seta diagonal' },
      { name: 'Menu', icon: Menu, keywords: 'menu hamburguer navegacao' },
      { name: 'House', icon: House, keywords: 'inicio casa home' },
      { name: 'PanelLeft', icon: PanelLeft, keywords: 'barra lateral sidebar painel' },
      { name: 'LayoutGrid', icon: LayoutGrid, keywords: 'grade grid visualizacao' },
      { name: 'List', icon: List, keywords: 'lista visualizacao' },
    ],
  },
  {
    category: 'Status e feedback',
    icons: [
      { name: 'CircleCheck', icon: CircleCheck, keywords: 'sucesso concluido ok' },
      { name: 'CircleAlert', icon: CircleAlert, keywords: 'erro alerta atencao' },
      { name: 'TriangleAlert', icon: TriangleAlert, keywords: 'aviso atencao cuidado warning' },
      { name: 'Info', icon: Info, keywords: 'informacao detalhe' },
      { name: 'CircleHelp', icon: CircleHelp, keywords: 'ajuda duvida pergunta' },
      { name: 'CircleX', icon: CircleX, keywords: 'falha erro cancelado' },
      { name: 'Ban', icon: Ban, keywords: 'proibido bloqueado desativado' },
      { name: 'LoaderCircle', icon: LoaderCircle, keywords: 'carregando spinner aguarde' },
      { name: 'Clock', icon: Clock, keywords: 'tempo horario pendente relogio' },
      { name: 'Bell', icon: Bell, keywords: 'notificacao sino aviso' },
      { name: 'BellOff', icon: BellOff, keywords: 'silenciar notificacao desligada' },
      { name: 'Star', icon: Star, keywords: 'favorito estrela destaque' },
      { name: 'Heart', icon: Heart, keywords: 'curtir favorito coracao' },
      { name: 'ThumbsUp', icon: ThumbsUp, keywords: 'aprovar gostei joinha' },
    ],
  },
  {
    category: 'Pessoas e comunicação',
    icons: [
      { name: 'User', icon: User, keywords: 'usuario pessoa perfil conta' },
      { name: 'Users', icon: Users, keywords: 'usuarios equipe grupo pessoas' },
      { name: 'UserPlus', icon: UserPlus, keywords: 'convidar adicionar pessoa' },
      { name: 'UserMinus', icon: UserMinus, keywords: 'remover pessoa' },
      { name: 'Mail', icon: Mail, keywords: 'email correio mensagem' },
      { name: 'MessageSquare', icon: MessageSquare, keywords: 'comentario mensagem chat' },
      { name: 'Send', icon: Send, keywords: 'enviar mandar' },
      { name: 'AtSign', icon: AtSign, keywords: 'arroba mencao email' },
      { name: 'Phone', icon: Phone, keywords: 'telefone ligar' },
      { name: 'Building2', icon: Building2, keywords: 'empresa organizacao predio' },
    ],
  },
  {
    category: 'Arquivos e conteúdo',
    icons: [
      { name: 'File', icon: File, keywords: 'arquivo documento' },
      { name: 'FileText', icon: FileText, keywords: 'arquivo texto pagina documento' },
      { name: 'FileCode', icon: FileCode, keywords: 'arquivo codigo' },
      { name: 'FileJson', icon: FileJson, keywords: 'json especificacao openapi' },
      { name: 'Folder', icon: Folder, keywords: 'pasta diretorio grupo' },
      { name: 'FolderOpen', icon: FolderOpen, keywords: 'pasta aberta' },
      { name: 'Image', icon: Image, keywords: 'imagem foto' },
      { name: 'Paperclip', icon: Paperclip, keywords: 'anexo clipe' },
      { name: 'Book', icon: Book, keywords: 'livro documentacao guia' },
      { name: 'BookOpen', icon: BookOpen, keywords: 'documentacao leitura guia' },
      { name: 'Bookmark', icon: Bookmark, keywords: 'salvar marcador' },
      { name: 'Tag', icon: Tag, keywords: 'etiqueta versao rotulo' },
      { name: 'Calendar', icon: Calendar, keywords: 'data agenda calendario' },
      { name: 'Inbox', icon: Inbox, keywords: 'caixa entrada vazio' },
    ],
  },
  {
    category: 'API e desenvolvimento',
    icons: [
      { name: 'Code', icon: Code, keywords: 'codigo desenvolvimento' },
      { name: 'Braces', icon: Braces, keywords: 'json chaves objeto schema' },
      { name: 'Terminal', icon: Terminal, keywords: 'terminal cli console comando' },
      { name: 'Database', icon: Database, keywords: 'banco dados' },
      { name: 'Server', icon: Server, keywords: 'servidor ambiente' },
      { name: 'Globe', icon: Globe, keywords: 'web publico internet idioma' },
      { name: 'Webhook', icon: Webhook, keywords: 'webhook evento integracao' },
      { name: 'Key', icon: Key, keywords: 'chave api token' },
      { name: 'KeyRound', icon: KeyRound, keywords: 'chave senha autenticacao' },
      { name: 'ShieldCheck', icon: ShieldCheck, keywords: 'seguranca protegido verificado' },
      { name: 'GitBranch', icon: GitBranch, keywords: 'branch versao git' },
      { name: 'Bug', icon: Bug, keywords: 'bug erro defeito' },
      { name: 'Zap', icon: Zap, keywords: 'rapido evento gatilho raio' },
      { name: 'Cpu', icon: Cpu, keywords: 'processamento cpu' },
      { name: 'Plug', icon: Plug, keywords: 'integracao conectar plugin' },
    ],
  },
  {
    category: 'Tema e mídia',
    icons: [
      { name: 'Sun', icon: Sun, keywords: 'claro tema sol' },
      { name: 'Moon', icon: Moon, keywords: 'escuro tema lua' },
      { name: 'Monitor', icon: Monitor, keywords: 'sistema tela desktop' },
      { name: 'Smartphone', icon: Smartphone, keywords: 'celular mobile' },
      { name: 'Play', icon: Play, keywords: 'executar iniciar tocar' },
      { name: 'Pause', icon: Pause, keywords: 'pausar parar' },
    ],
  },
];
const totalIcons = catalog.reduce((sum, group) => sum + group.icons.length, 0);

/** Lowercase without accents, so "configuração" matches "configuracao". */
function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Light Portuguese stemming so singular and plural meet: configurações → configuracao, ajustes → ajuste. */
function stem(word: string) {
  return word
    .replace(/(oes|aes)$/, 'ao')
    .replace(/ais$/, 'al')
    .replace(/eis$/, 'el')
    .replace(/(?<=\w{3})s$/, '');
}

function words(text: string) {
  return normalize(text).split(/[\s-]+/).filter(Boolean).map(stem);
}

const sizeOptions: IconSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const strokeOptions = ['1.5', '2', '2.5'];

function IconGallery() {
  const copy = useCopy();
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<IconSize>('lg');
  const [stroke, setStroke] = useState('2');
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const terms = words(deferredQuery);
    return catalog
      .map((group) => ({
        ...group,
        icons: group.icons.filter((entry) => {
          const haystack = words(`${entry.name} ${entry.keywords} ${group.category}`);
          // Every typed term must start or appear inside some keyword (partial typing works).
          return terms.every((term) => haystack.some((word) => word.includes(term)));
        }),
      }))
      .filter((group) => group.icons.length > 0);
  }, [deferredQuery]);
  const count = results.reduce((sum, group) => sum + group.icons.length, 0);

  return (
    <div className="dsp-specimen">
      <div className="dsp-specimen__head">
        <h3 className="dsp-specimen__title">Galeria</h3>
        <p className="dsp-specimen__description">Ícones recomendados para o OpenDoc. Busque em português ou pelo nome do Lucide; clique para copiar o código.</p>
      </div>
      <div className="dsp-icons__toolbar">
        <TextField
          label="Buscar ícones"
          type="search"
          size="sm"
          placeholder="Ex.: excluir, seta, chave…"
          prefix={<Search aria-hidden="true" />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="dsp-icons__search"
        />
        <div className="dsp-icons__control">
          <span className="ds-label" id="dsp-icon-size">Tamanho</span>
          <ToggleGroup type="single" aria-labelledby="dsp-icon-size" value={size} onValueChange={(value) => { if (value) setSize(value as IconSize); }}>
            {sizeOptions.map((option) => <ToggleGroupItem key={option} value={option} size="sm" aria-label={`${option}, ${iconSizes[option]} pixels`}>{option}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <div className="dsp-icons__control">
          <span className="ds-label" id="dsp-icon-stroke">Traço</span>
          <ToggleGroup type="single" aria-labelledby="dsp-icon-stroke" value={stroke} onValueChange={(value) => { if (value) setStroke(value); }}>
            {strokeOptions.map((option) => <ToggleGroupItem key={option} value={option} size="sm">{option}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </div>
      <p className="dsp-icons__count" role="status" aria-live="polite">
        {count === totalIcons ? `${totalIcons} ícones` : `${count} de ${totalIcons} ícones`}
      </p>
      <div className="dsp-icons__results">
        {results.map((group) => (
          <section key={group.category} className="dsp-icons__group" aria-labelledby={`dsp-icons-${normalize(group.category).replace(/\s+/g, '-')}`}>
            <h4 className="dsp-icons__category" id={`dsp-icons-${normalize(group.category).replace(/\s+/g, '-')}`}>
              {group.category} <span>{group.icons.length}</span>
            </h4>
            <ul className="dsp-icons__grid" role="list">
              {group.icons.map((entry) => (
                <li key={entry.name}>
                  <button type="button" className="dsp-icons__item" onClick={() => copy(`<Icon icon={${entry.name}} />`)} aria-label={`Copiar ${entry.name}`}>
                    <Icon icon={entry.icon} size={size} strokeWidth={Number(stroke)} />
                    <span className="dsp-icons__name">{entry.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {count === 0 && (
          <div className="dsp-icons__empty">
            <Icon icon={Search} size="xl" />
            <p>Nenhum ícone para “{query}”.</p>
            <p className="dsp-icons__empty-hint">Tente outro termo ou procure no catálogo completo do <a href="https://lucide.dev/icons" target="_blank" rel="noreferrer">Lucide<Icon icon={ExternalLink} size="xs" label="(abre em nova aba)" /></a>.</p>
            <Button variant="outline" size="sm" onClick={() => setQuery('')}>Limpar busca</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function IconsSection() {
  return (
    <Section
      id="icones"
      eyebrow="Fundamentos"
      title="Ícones"
      description={<>Usamos o <a href="https://lucide.dev" target="_blank" rel="noreferrer">Lucide<Icon icon={ExternalLink} size="xs" label="(abre em nova aba)" /></a>: traço de 2px numa grade de 24px, combinando com a Geist. O componente <code>&lt;Icon&gt;</code> aplica os tamanhos do design system e cuida da acessibilidade.</>}
    >
      <IconGallery />

      <Specimen
        title="Tamanhos"
        description={<>Escolha pelo texto ao lado: <code>sm</code> com texto de 12–14px, <code>md</code> (padrão) em botões, campos e menus, <code>lg</code> e <code>xl</code> em títulos e estados vazios.</>}
        code={`<Icon icon={Search} size="lg" />`}
        stageClassName="dsp-icon-sizes"
      >
        {sizeOptions.map((size) => (
          <figure key={size} className="dsp-icon-size">
            <span className="dsp-icon-size__box"><Icon icon={Webhook} size={size} /></span>
            <figcaption><code>{size}</code> · {iconSizes[size]}px</figcaption>
          </figure>
        ))}
      </Specimen>

      <Specimen
        title="Em contexto"
        description="A cor vem de currentColor, então o ícone acompanha o texto, o estado e o tema sem configuração."
        layout="stack"
        code={`<Button iconStart={<Download />}>Baixar</Button>\n<TextField label="Buscar" prefix={<Search />} />\n<span className="ds-color-destructive"><Icon icon={CircleAlert} /> Falhou</span>`}
      >
        <div className="dsp-row">
          <Button iconStart={<Download />}>Baixar especificação</Button>
          <Button variant="outline" iconEnd={<ArrowRight />}>Próximo endpoint</Button>
          <IconButton variant="outline" icon={<Copy />} aria-label="Copiar URL" />
          <Badge variant="success"><CircleCheck aria-hidden="true" />Publicado</Badge>
          <Badge variant="outline"><Tag aria-hidden="true" />v2.4</Badge>
        </div>
        <div className="dsp-icon-context">
          <TextField label="Buscar endpoint" size="sm" placeholder="GET /projects…" prefix={<Search aria-hidden="true" />} />
          <ul className="dsp-icon-status" role="list">
            <li className="ds-color-default"><Icon icon={CircleCheck} className="dsp-ok" /> 48 endpoints documentados</li>
            <li className="ds-color-muted"><Icon icon={Clock} /> Última publicação há 3 horas</li>
            <li className="ds-color-destructive"><Icon icon={CircleAlert} /> 2 schemas com referência circular</li>
          </ul>
        </div>
      </Specimen>

      <Specimen
        title="Acessibilidade"
        description="A regra é: se o ícone está ao lado de texto, ele é decorativo e fica oculto; se ele sozinho comunica algo, precisa de um nome."
        layout="grid"
        code={`// Decorativo: ao lado de texto visível\n<Button iconStart={<Download />}>Baixar</Button>\n\n// Informativo: o ícone sozinho tem significado\n<Icon icon={CircleCheck} label="Publicado" />\n\n// Botão só de ícone: o nome vai no botão\n<IconButton icon={<Trash2 />} aria-label="Excluir" />`}
        stageClassName="dsp-icon-rules"
      >
        <div className="dsp-icon-rule">
          <p className="dsp-icon-rule__title"><Badge variant="secondary">Decorativo</Badge></p>
          <div className="dsp-icon-rule__demo"><Button variant="outline" iconStart={<Download />}>Baixar</Button></div>
          <p className="dsp-icon-rule__text">Sem <code>label</code>: o svg recebe <code>aria-hidden</code> e o leitor de tela lê só “Baixar”.</p>
        </div>
        <div className="dsp-icon-rule">
          <p className="dsp-icon-rule__title"><Badge variant="secondary">Informativo</Badge></p>
          <div className="dsp-icon-rule__demo">
            <span className="dsp-icon-table">
              <span>Pagamentos</span><Icon icon={CircleCheck} label="Publicado" className="dsp-ok" />
              <span>Webhooks</span><Icon icon={Clock} label="Pendente" className="ds-color-muted" />
            </span>
          </div>
          <p className="dsp-icon-rule__text">Com <code>label</code>: o Radix AccessibleIcon esconde o svg e anuncia o texto. Lê-se “Pagamentos, Publicado”.</p>
        </div>
        <div className="dsp-icon-rule">
          <p className="dsp-icon-rule__title"><Badge variant="secondary">Só ícone</Badge></p>
          <div className="dsp-icon-rule__demo"><IconButton variant="outline" icon={<Trash2 />} aria-label="Excluir" /></div>
          <p className="dsp-icon-rule__text">O nome fica no botão (<code>aria-label</code>, obrigatório no tipo) e aparece no tooltip.</p>
        </div>
      </Specimen>

      <Alert title="Não use ícone como único sinal de estado" icon={<Icon icon={Info} />}>
        Cor e forma sozinhas não chegam a todo mundo. Combine o ícone com texto visível ou com <code>label</code>, e prefira ícones do mesmo status (CircleCheck, TriangleAlert, CircleAlert, Info) usados no Alert e no Badge.
      </Alert>
    </Section>
  );
}
