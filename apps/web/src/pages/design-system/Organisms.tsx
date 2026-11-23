import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowUp, Bell, BookOpen, Box, Braces, ChevronsUpDown, Command as CommandIcon, Copy, Download, Gauge, Globe, History, House, KeyRound, LayoutGrid,
  LifeBuoy, LogOut, MessageSquare, Palette, Paperclip, Plug, Settings, Sparkles, SquareMousePointer, TriangleAlert, Type, User, Users, Wallet, Webhook,
} from 'lucide-react';
import {
  Avatar, Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardContent, CardHeader, CommandMenu,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, IconButton, Item, ItemGroup,
  Kbd, KbdGroup, Navbar, NavbarMobileMenu, NavbarNav, NavbarSearch, NavbarSection, NavbarSpacer, PromptInput, Separator, Sidebar, SidebarContent,
  SidebarFooter, SidebarGroup, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  Sparkline, StatCard, Switch, UserMenu, toast, useCommandShortcut, type CommandGroup,
} from '../../design-system';
import { Section, Specimen, useCopy, type KeyboardRow } from './parts';

const keys = {
  shell: [
    ['⌘+B / Ctrl+B', 'Recolhe ou expande a barra lateral (no celular, abre a gaveta)'],
    ['⌘+K / Ctrl+K', 'Abre a busca de comandos'],
    ['Tab', 'Percorre barra lateral, cabeçalho e conteúdo, nessa ordem'],
  ] as KeyboardRow[],
  command: [
    ['⌘+K / Ctrl+K', 'Abre a busca de qualquer lugar da página'],
    ['↑ / ↓', 'Move entre os resultados, sem sair do campo'],
    ['Home / End', 'Vai para o primeiro ou o último resultado'],
    ['Enter', 'Executa o resultado ativo'],
    ['Esc', 'Fecha e devolve o foco para onde estava'],
  ] as KeyboardRow[],
  prompt: [['Enter', 'Envia a mensagem'], ['Shift+Enter', 'Quebra a linha']] as KeyboardRow[],
};

/* ── App shell demo ─────────────────────────────────────────────────── */

const navGroups = [
  {
    label: 'Documentação',
    items: [
      { id: 'overview', label: 'Visão geral', icon: <House /> },
      { id: 'reference', label: 'Referência da API', icon: <Braces /> },
      { id: 'guides', label: 'Guias', icon: <BookOpen /> },
      { id: 'changelog', label: 'Changelog', icon: <History />, badge: 3 },
    ],
  },
  {
    label: 'Gerenciar',
    items: [
      { id: 'readers', label: 'Leitores', icon: <Users />, badge: 12 },
      { id: 'integrations', label: 'Integrações', icon: <Plug /> },
      { id: 'webhooks', label: 'Webhooks', icon: <Webhook /> },
      { id: 'settings', label: 'Configurações', icon: <Settings /> },
    ],
  },
];
const allNavItems = navGroups.flatMap((group) => group.items);

function AppShellDemo({ onOpenCommand }: { onOpenCommand: () => void }) {
  const [active, setActive] = useState('overview');
  const page = allNavItems.find((item) => item.id === active)!;
  return (
    <div className="dsp-app-frame">
      <SidebarProvider>
        <Sidebar label="Barra lateral do exemplo">
          <SidebarHeader>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="ds-sidebar__button--tall" icon={<span className="dsp-ws-mark">O</span>} trailing={<ChevronsUpDown />}>
                  <span className="dsp-ws-text"><strong>OpenDoc</strong><small>Plano Pro</small></span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="dsp-menu-wide">
                <DropdownMenuLabel>Espaços de trabalho</DropdownMenuLabel>
                <DropdownMenuItem><span className="dsp-ws-mark dsp-ws-mark--sm">O</span>OpenDoc</DropdownMenuItem>
                <DropdownMenuItem><span className="dsp-ws-mark dsp-ws-mark--sm">A</span>Acme Pagamentos</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Box />Criar espaço</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarHeader>
          <SidebarContent label="Navegação do exemplo">
            {navGroups.map((group) => (
              <SidebarGroup key={group.label} label={group.label}>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton icon={item.icon} active={active === item.id} badge={item.badge} onClick={() => setActive(item.id)}>{item.label}</SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton icon={<LifeBuoy />}>Ajuda e suporte</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton className="ds-sidebar__button--tall" icon={<Avatar name="Ana Souza" size="sm" />} trailing={<ChevronsUpDown />}>
                      <span className="dsp-ws-text"><strong>Ana Souza</strong><small>ana@empresa.com</small></span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="top" className="dsp-menu-wide">
                    <DropdownMenuItem><User />Perfil</DropdownMenuItem>
                    <DropdownMenuItem><Settings />Preferências</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive"><LogOut />Sair</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <Navbar>
            <NavbarSection>
              <SidebarTrigger />
              <Separator orientation="vertical" className="dsp-navbar-separator" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="dsp-hide-sm">{navGroups.find((group) => group.items.includes(page))?.label}</BreadcrumbItem>
                  <BreadcrumbSeparator className="dsp-hide-sm" />
                  <BreadcrumbItem><BreadcrumbPage>{page.label}</BreadcrumbPage></BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </NavbarSection>
            <NavbarSpacer />
            <NavbarSection>
              <NavbarSearch onOpen={onOpenCommand} />
              <IconButton icon={<Bell />} aria-label="Notificações" />
            </NavbarSection>
          </Navbar>
          <div className="dsp-app-content" role="region" aria-label={`Conteúdo: ${page.label}`}>
            <div className="dsp-app-heading">
              <h3>{page.label}</h3>
              <Button size="sm" iconStart={<Download />}>Exportar</Button>
            </div>
            <div className="dsp-stat-grid">
              <StatCard icon={<Users />} label="Visitantes" value="18,4 mil" delta={{ value: '+10%', trend: 'up' }} description="vs. mês anterior" chart={<Sparkline data={[9, 11, 10, 13, 12, 15, 14, 18]} label="Visitantes cresceram de 9 mil para 18,4 mil nas últimas 8 semanas" />} />
              <StatCard icon={<Gauge />} label="Latência p95" value="182 ms" delta={{ value: '−12%', trend: 'down', good: true }} description="mais rápido" chart={<Sparkline variant="line" data={[240, 230, 236, 210, 205, 198, 190, 182]} label="Latência caiu de 240 ms para 182 ms" />} />
              <StatCard icon={<TriangleAlert />} label="Erros 5xx" value="0,04%" delta={{ value: '+0,01 pp', trend: 'up', good: false }} description="dentro do SLA" chart={<Sparkline variant="bar" data={[2, 3, 2, 4, 3, 2, 3, 4]} label="Taxa de erros oscilou entre 0,02% e 0,04%" />} />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

const topLinks = [
  { label: 'Guias', href: '#app-shell', active: true },
  { label: 'Referência', href: '#app-shell' },
  { label: 'Changelog', href: '#app-shell' },
  { label: 'Status', href: '#app-shell' },
];

function TopNavbarDemo({ onOpenCommand }: { onOpenCommand: () => void }) {
  return (
    <div className="dsp-top-frame">
      <Navbar>
        <NavbarSection>
          <NavbarMobileMenu links={topLinks} title="Acme Docs" footer={<Button fullWidth>Entrar</Button>} />
          <span className="dsp-docs-brand">Acme <span>Docs</span></span>
        </NavbarSection>
        <NavbarNav links={topLinks} label="Seções da documentação" />
        <NavbarSpacer />
        <NavbarSection>
          <NavbarSearch onOpen={onOpenCommand} placeholder="Buscar na documentação…" />
          <Button size="sm" className="dsp-hide-sm">Entrar</Button>
          <UserMenu name="Ana Souza" email="ana@empresa.com">
            <DropdownMenuItem><User />Perfil</DropdownMenuItem>
            <DropdownMenuItem><Settings />Preferências</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive"><LogOut />Sair</DropdownMenuItem>
          </UserMenu>
        </NavbarSection>
      </Navbar>
    </div>
  );
}

/* ── Blocks ─────────────────────────────────────────────────────────── */

type Message = { id: number; role: 'user' | 'assistant'; text: string };

function AssistantDemo() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', text: 'Olá! Pergunte qualquer coisa sobre a API de pagamentos.' },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [messages, loading]);

  const send = (text: string) => {
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text }]);
    setDraft('');
    setLoading(true);
    timer.current = window.setTimeout(() => {
      setMessages((current) => [...current, { id: Date.now() + 1, role: 'assistant', text: 'Use POST /v1/refunds com o id da cobrança. Para reembolso parcial, envie amount em centavos.' }]);
      setLoading(false);
    }, 1100);
  };

  return (
    <Card className="dsp-assistant">
      <CardHeader title="Assistente da documentação" description="Respostas com base na referência publicada." actions={<IconButton icon={<MessageSquare />} aria-label="Nova conversa" size="sm" onClick={() => setMessages(messages.slice(0, 1))} />} />
      <CardContent className="dsp-assistant__body">
        <div ref={logRef} className="dsp-assistant__log" role="log" aria-label="Conversa" aria-live="polite">
          {messages.map((message) => (
            <p key={message.id} className={`dsp-bubble dsp-bubble--${message.role}`}>
              <span className="ds-sr-only">{message.role === 'user' ? 'Você: ' : 'Assistente: '}</span>
              {message.text}
            </p>
          ))}
          {loading && <p className="dsp-bubble dsp-bubble--assistant dsp-bubble--typing" aria-label="Assistente digitando"><span /><span /><span /></p>}
        </div>
        <PromptInput
          value={draft}
          onValueChange={setDraft}
          onSubmit={send}
          loading={loading}
          label="Pergunta para o assistente"
          placeholder="Como faço um reembolso parcial?"
          startActions={<IconButton icon={<Paperclip />} aria-label="Anexar arquivo" size="sm" onClick={() => toast({ title: 'Anexos chegam em breve' })} />}
        />
      </CardContent>
    </Card>
  );
}

/* ── Sections ───────────────────────────────────────────────────────── */

export function OrganismSections() {
  const copy = useCopy();
  const [commandOpen, setCommandOpen] = useState(false);
  const openCommand = useCallback(() => setCommandOpen(true), []);
  useCommandShortcut(openCommand);

  const go = (id: string) => () => { window.location.hash = id; };
  const groups: CommandGroup[] = [
    {
      heading: 'Fundamentos',
      items: [
        { id: 'cores', label: 'Cores', icon: <Palette />, keywords: 'tokens paleta', onSelect: go('cores') },
        { id: 'tipografia', label: 'Tipografia', icon: <Type />, keywords: 'fonte texto', onSelect: go('tipografia') },
        { id: 'icones', label: 'Ícones', icon: <Sparkles />, keywords: 'lucide', onSelect: go('icones') },
      ],
    },
    {
      heading: 'Componentes',
      items: [
        { id: 'botoes', label: 'Button e Toggle', icon: <SquareMousePointer />, onSelect: go('botoes') },
        { id: 'campos', label: 'Input e Select', icon: <Type />, keywords: 'formulario campo slider', onSelect: go('campos') },
        { id: 'overlays', label: 'Dialog e Menu', icon: <LayoutGrid />, keywords: 'modal sheet popover tooltip', onSelect: go('overlays') },
        { id: 'dados', label: 'Table e Pagination', icon: <LayoutGrid />, keywords: 'tabela breadcrumb', onSelect: go('dados') },
      ],
    },
    {
      heading: 'Organismos',
      items: [
        { id: 'app-shell', label: 'Sidebar e Navbar', icon: <LayoutGrid />, keywords: 'app shell layout', onSelect: go('app-shell') },
        { id: 'blocos', label: 'StatCard, Item e PromptInput', icon: <LayoutGrid />, keywords: 'chat metricas', onSelect: go('blocos') },
      ],
    },
    {
      heading: 'Documentação e admin',
      items: [
        { id: 'doc-codigo', label: 'CodeBlock e Endpoint', icon: <Braces />, keywords: 'codigo sintaxe curl metodo', onSelect: go('doc-codigo') },
        { id: 'doc-referencia', label: 'Schema e respostas', icon: <Braces />, keywords: 'json schema status', onSelect: go('doc-referencia') },
        { id: 'doc-leitura', label: 'Prose e sumário', icon: <BookOpen />, keywords: 'markdown guia toc', onSelect: go('doc-leitura') },
        { id: 'formularios', label: 'OTP, senha e upload', icon: <KeyRound />, keywords: 'mfa codigo arquivo formulario', onSelect: go('formularios') },
        { id: 'admin', label: 'DataTable e editor', icon: <Users />, keywords: 'tabela usuarios combobox markdown', onSelect: go('admin') },
      ],
    },
    {
      heading: 'Ações',
      items: [
        { id: 'copy-import', label: 'Copiar import do design system', icon: <Copy />, shortcut: '⌘+C', onSelect: () => copy("import { Button } from './design-system';") },
        { id: 'toast', label: 'Mostrar uma notificação', icon: <Bell />, onSelect: () => toast({ title: 'Olá do command menu', variant: 'success' }) },
        { id: 'top', label: 'Voltar ao topo', icon: <ArrowUp />, onSelect: () => window.scrollTo({ top: 0 }) },
      ],
    },
  ];

  return (
    <>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} groups={groups} label="Buscar no design system" />

      <Section id="app-shell" eyebrow="Organismos" title="Sidebar e Navbar" description="Estrutura de uma aplicação: barra lateral recolhível e cabeçalho com trilha, busca e ações. No celular, a barra lateral vira uma gaveta. Experimente ⌘B e ⌘K.">
        <Specimen
          title="App shell"
          description={<>Barra lateral (<code>&lt;aside&gt;</code> com <code>&lt;nav&gt;</code> e grupos rotulados), recolhida mostra só os ícones com tooltip. O botão de alternar expõe <code>aria-expanded</code> e o item ativo tem <code>aria-current="page"</code>.</>}
          layout="stack"
          keyboard={keys.shell}
          code={`<SidebarProvider>\n  <Sidebar>\n    <SidebarHeader>…</SidebarHeader>\n    <SidebarContent>\n      <SidebarGroup label="Documentação">\n        <SidebarMenu>\n          <SidebarMenuItem>\n            <SidebarMenuButton icon={<House />} active>Visão geral</SidebarMenuButton>\n          </SidebarMenuItem>\n        </SidebarMenu>\n      </SidebarGroup>\n    </SidebarContent>\n  </Sidebar>\n  <SidebarInset>\n    <Navbar>\n      <SidebarTrigger />\n      <NavbarSpacer />\n      <NavbarSearch onOpen={openCommand} />\n    </Navbar>\n  </SidebarInset>\n</SidebarProvider>`}
          stageClassName="dsp-stage-flush"
        >
          <AppShellDemo onOpenCommand={openCommand} />
        </Specimen>
        <Specimen
          title="Navbar com links"
          description="Variante para sites de documentação: links no topo e, em telas pequenas, um menu em gaveta com os mesmos links. O avatar abre o menu da conta."
          layout="stack"
          code={`<Navbar sticky>\n  <NavbarMobileMenu links={links} />\n  <NavbarNav links={links} />\n  <NavbarSpacer />\n  <NavbarSearch onOpen={openCommand} />\n  <UserMenu name="Ana Souza" email="ana@empresa.com">…</UserMenu>\n</Navbar>`}
          stageClassName="dsp-stage-flush"
        >
          <TopNavbarDemo onOpenCommand={openCommand} />
        </Specimen>
      </Section>

      <Section id="command" eyebrow="Organismos" title="Command menu" description="Busca de comandos e páginas, no padrão combobox do WAI-ARIA: o foco fica no campo enquanto as setas destacam o resultado ativo, e a quantidade de resultados é anunciada.">
        <Specimen
          title="CommandMenu"
          description="Navega de verdade pelas seções desta página. Busque por “modal”, “paleta” ou “tabela”."
          keyboard={keys.command}
          code={`const [open, setOpen] = useState(false);\nuseCommandShortcut(() => setOpen(true));\n\n<CommandMenu\n  open={open}\n  onOpenChange={setOpen}\n  groups={[{ heading: 'Páginas', items: [{ id: 'cores', label: 'Cores', onSelect: () => … }] }]}\n/>`}
        >
          <Button variant="outline" iconStart={<CommandIcon />} onClick={openCommand}>Abrir command menu</Button>
          <span className="dsp-muted dsp-inline-hint">ou pressione <KbdGroup><Kbd label="Command">⌘</Kbd><Kbd>K</Kbd></KbdGroup></span>
        </Specimen>
      </Section>

      <Section id="blocos" eyebrow="Organismos" title="StatCard, Item e PromptInput" description="Blocos prontos para telas de produto: métricas com tendência, listas de ações e configurações, e um compositor de chat.">
        <Specimen
          title="StatCard"
          description={<>O gráfico é uma imagem com resumo em texto (<code>role="img"</code>) e nunca carrega a informação sozinho. A variação é anunciada como “aumento de” ou “queda de”, e a cor indica se a mudança é boa: menos latência é bom.</>}
          layout="grid"
          stageClassName="dsp-stat-stage"
          code={`<StatCard\n  icon={<Users />}\n  label="Visitantes"\n  value="418,2 mil"\n  delta={{ value: '+10%', trend: 'up' }}\n  chart={<Sparkline data={data} label="Visitantes subiram 10% no mês" />}\n/>`}
        >
          <StatCard icon={<Users />} label="Visitantes" value="418,2 mil" delta={{ value: '+10%', trend: 'up' }} description="nos últimos 30 dias" action={<Button variant="link" size="sm">Ver analytics</Button>} chart={<Sparkline data={[22, 28, 25, 31, 24, 30, 33, 41]} label="Visitantes subiram de 22 mil para 41 mil por semana" />} />
          <StatCard icon={<Activity />} label="Requisições à API" value="2,1 mi" delta={{ value: '+4%', trend: 'up' }} description="por semana" chart={<Sparkline variant="bar" data={[14, 18, 16, 21, 19, 23]} label="Requisições semanais entre 1,4 e 2,3 milhões, maior na semana atual" />} />
          <StatCard icon={<Wallet />} label="Saldo disponível" value="R$ 1.211,29" delta={{ value: '0%', trend: 'flat' }} description="Próximo repasse em 15 de dezembro" />
        </Specimen>

        <Specimen
          title="Item"
          description="Linhas de ação e de configuração. A linha inteira é o alvo do clique; com um controle no fim (Switch), a linha não é clicável, porque um controle não pode ficar dentro de outro."
          layout="stack"
          code={`<ItemGroup>\n  <Item icon={<KeyRound />} title="Chaves de API" description="…" href="/settings/keys" />\n  <Item icon={<Globe />} title="Explorer público" trailing={<Switch aria-label="Explorer público" />} />\n</ItemGroup>`}
        >
          <ItemGroup className="dsp-items">
            <Item icon={<KeyRound />} title="Chaves de API" description="Crie, revogue e defina escopos das chaves de acesso." href="#blocos" />
            <Item icon={<Globe />} title="Domínio personalizado" description="docs.suaempresa.com com HTTPS automático." href="#blocos" />
            <Item icon={<Download />} title="Exportar documentação" description="Baixe a referência em OpenAPI ou PDF." onClick={() => toast({ title: 'Exportação iniciada', description: 'Você receberá o arquivo por e-mail.' })} />
            <Item icon={<Users />} title="API Explorer público" description="Permite que visitantes sem conta testem as requisições." trailing={<Switch aria-label="API Explorer público" defaultChecked />} />
          </ItemGroup>
        </Specimen>

        <Specimen
          title="PromptInput"
          description={<>Compositor de chat que cresce com o texto. As mensagens ficam numa região <code>role="log"</code>, então novas respostas são anunciadas sem roubar o foco.</>}
          layout="stack"
          keyboard={keys.prompt}
          code={`<PromptInput\n  value={draft}\n  onValueChange={setDraft}\n  onSubmit={send}\n  loading={loading}\n  label="Pergunta para o assistente"\n/>`}
        >
          <AssistantDemo />
        </Specimen>
      </Section>
    </>
  );
}
