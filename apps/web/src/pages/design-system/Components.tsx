import { useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowRight, ArrowUpRight, Bold, ChevronDown, ChevronRight, Copy, CreditCard, Ellipsis, GitBranch, Italic,
  LogOut, Mail, PanelBottom, PanelLeft, Pencil, Plus, Search, Settings, Settings2, SlidersHorizontal, Terminal, Trash2, Underline, User, UserPlus,
} from 'lucide-react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
  Alert, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
  Avatar, AvatarGroup, Badge, Button, Card, CardContent, CardFooter, CardHeader, Checkbox,
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
  IconButton, NativeSelect, Sheet, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger, Slider, Popover, PopoverContent, PopoverTrigger, RadioGroup, RadioGroupItem,
  SelectField, SelectGroup, SelectItem, SelectLabel, SelectSeparator, Separator, Spinner, Switch,
  Tabs, TabsContent, TabsList, TabsTrigger, Textarea, TextField, Toggle, ToggleGroup, ToggleGroupItem, Tooltip,
  type BadgeVariant, type ButtonSize, type ButtonVariant,
} from '../../design-system';
import { Section, Specimen, type KeyboardRow } from './parts';

const variants: ButtonVariant[] = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'];
const sizes: ButtonSize[] = ['sm', 'default', 'lg'];
const badgeVariants: Array<{ variant: BadgeVariant; label: string }> = [
  { variant: 'default', label: 'Default' },
  { variant: 'secondary', label: 'Secondary' },
  { variant: 'outline', label: 'Outline' },
  { variant: 'destructive', label: 'Destructive' },
];
const statusBadges: Array<{ variant: BadgeVariant; label: string }> = [
  { variant: 'success', label: 'Publicado' },
  { variant: 'warning', label: 'Pendente' },
  { variant: 'info', label: 'Beta' },
];

const keys = {
  button: [['Enter / Space', 'Ativa o botão']] as KeyboardRow[],
  toggleGroup: [
    ['Tab', 'Entra no grupo pelo item ativo e depois sai dele'],
    ['← / →', 'Move o foco entre os itens'],
    ['Enter / Space', 'Ativa ou desativa o item focado'],
  ] as KeyboardRow[],
  checkbox: [['Space', 'Marca ou desmarca']] as KeyboardRow[],
  radio: [
    ['Tab', 'Entra no grupo pela opção marcada'],
    ['↑ / ↓ / ← / →', 'Move para a opção vizinha e a marca'],
  ] as KeyboardRow[],
  switch: [['Space / Enter', 'Liga ou desliga']] as KeyboardRow[],
  select: [
    ['Enter / Space / ↓', 'Abre a lista com foco na opção selecionada'],
    ['↑ / ↓', 'Move entre as opções'],
    ['A–Z', 'Pula para a opção que começa com a letra'],
    ['Enter', 'Seleciona e fecha'],
    ['Esc', 'Fecha sem mudar e devolve o foco'],
  ] as KeyboardRow[],
  slider: [
    ['← / ↓', 'Diminui um passo'],
    ['→ / ↑', 'Aumenta um passo'],
    ['Page Down / Page Up', 'Muda 10 passos'],
    ['Home / End', 'Vai para o mínimo ou o máximo'],
  ] as KeyboardRow[],
  dialog: [
    ['Tab / Shift+Tab', 'Circula o foco só dentro do diálogo'],
    ['Esc', 'Fecha e devolve o foco ao botão que abriu'],
  ] as KeyboardRow[],
  alertDialog: [
    ['Tab / Shift+Tab', 'Circula entre Cancelar e a ação'],
    ['Esc', 'Cancela e devolve o foco'],
  ] as KeyboardRow[],
  popover: [
    ['Enter / Space', 'Abre e move o foco para dentro'],
    ['Tab', 'Navega pelo conteúdo'],
    ['Esc', 'Fecha e devolve o foco ao gatilho'],
  ] as KeyboardRow[],
  tooltip: [
    ['Tab', 'Abre ao focar o gatilho, sem atraso'],
    ['Esc', 'Fecha a dica'],
  ] as KeyboardRow[],
  menu: [
    ['Enter / Space / ↓', 'Abre o menu no primeiro item'],
    ['↑ / ↓', 'Move entre os itens'],
    ['A–Z', 'Pula para o item que começa com a letra'],
    ['→ / ←', 'Abre ou fecha um submenu'],
    ['Enter / Space', 'Ativa o item'],
    ['Esc', 'Fecha e devolve o foco ao gatilho'],
  ] as KeyboardRow[],
  tabs: [
    ['Tab', 'Entra na lista pela aba ativa; de novo, vai para o painel'],
    ['← / →', 'Move para a aba vizinha e a ativa'],
    ['Home / End', 'Vai para a primeira ou a última aba'],
  ] as KeyboardRow[],
  accordion: [
    ['Enter / Space', 'Abre ou fecha a seção focada'],
    ['↑ / ↓', 'Move entre os títulos'],
    ['Home / End', 'Vai para o primeiro ou o último título'],
  ] as KeyboardRow[],
};

/* ── Button ─────────────────────────────────────────────────────────── */

function ButtonPlayground() {
  const [variant, setVariant] = useState<ButtonVariant>('default');
  const [size, setSize] = useState<ButtonSize>('default');
  const [label, setLabel] = useState('Criar projeto');
  const [withIcon, setWithIcon] = useState(true);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const attributes = [
    variant !== 'default' && `variant="${variant}"`,
    size !== 'default' && `size="${size}"`,
    withIcon && 'iconStart={<Plus />}',
    loading && 'loading',
    disabled && 'disabled',
  ].filter(Boolean);
  const code = `<Button${attributes.length ? ` ${attributes.join(' ')}` : ''}>${label}</Button>`;

  return (
    <div className="dsp-specimen">
      <div className="dsp-specimen__head">
        <h3 className="dsp-specimen__title">Playground</h3>
        <p className="dsp-specimen__description">Combine as propriedades e copie o código gerado.</p>
      </div>
      <div className="dsp-playground">
        <div className="dsp-playground__stage">
          <Button variant={variant} size={size} loading={loading} disabled={disabled} iconStart={withIcon ? <Plus /> : undefined}>{label || 'Botão'}</Button>
        </div>
        <div className="dsp-playground__controls">
          <SelectField label="Variante" size="sm" value={variant} onValueChange={(value) => setVariant(value as ButtonVariant)}>
            {variants.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectField>
          <SelectField label="Tamanho" size="sm" value={size} onValueChange={(value) => setSize(value as ButtonSize)}>
            {sizes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectField>
          <TextField label="Texto" size="sm" value={label} maxLength={32} onChange={(event) => setLabel(event.target.value)} />
          <div className="dsp-playground__toggles">
            <Switch label="Ícone" checked={withIcon} onCheckedChange={setWithIcon} />
            <Switch label="Carregando" checked={loading} onCheckedChange={setLoading} />
            <Switch label="Desabilitado" checked={disabled} onCheckedChange={setDisabled} />
          </div>
        </div>
      </div>
      <pre className="dsp-code"><code>{code}</code></pre>
    </div>
  );
}

export function ButtonsSection() {
  return (
    <Section id="botoes" eyebrow="Componentes" title="Button e Toggle" description="Botões disparam ações; toggles guardam um estado ligado/desligado. Botão carregando fica com aria-busy e desabilitado para evitar envio duplo.">
      <ButtonPlayground />
      <Specimen title="Variantes" keyboard={keys.button} code={`<Button>Default</Button>\n<Button variant="outline">Outline</Button>\n<Button variant="destructive">Destructive</Button>`}>
        {variants.map((variant) => <Button key={variant} variant={variant}>{variant.charAt(0).toUpperCase() + variant.slice(1)}</Button>)}
      </Specimen>
      <Specimen title="Com ícone e estados" description="sm 32px · default 36px · lg 40px.">
        <Button size="sm" variant="outline" iconStart={<GitBranch />}>Nova branch</Button>
        <Button iconStart={<Mail />}>Entrar com e-mail</Button>
        <Button size="lg" variant="secondary" iconEnd={<ArrowRight />}>Continuar</Button>
        <Button loading>Aguarde</Button>
        <Button variant="outline" disabled>Indisponível</Button>
      </Specimen>
      <Specimen title="Botões de ícone" description={<><code>aria-label</code> é obrigatório. Ele vira o tooltip, que abre no hover e no foco, e não é anunciado duas vezes.</>} code={`<IconButton variant="outline" icon={<ChevronRight />} aria-label="Próximo" />`}>
        <IconButton variant="outline" icon={<ChevronRight />} aria-label="Próximo" />
        <IconButton variant="secondary" icon={<Settings />} aria-label="Configurações" />
        <IconButton icon={<Ellipsis />} aria-label="Mais opções" />
        <IconButton variant="default" icon={<Plus />} aria-label="Adicionar" />
        <IconButton variant="destructive" icon={<Trash2 />} aria-label="Excluir" />
        <IconButton variant="outline" size="lg" icon={<Copy />} aria-label="Copiar" />
      </Specimen>
      <Specimen title="Toggle e ToggleGroup" description={<>Toggle usa <code>aria-pressed</code>. No grupo, <code>type="single"</code> vira um radiogroup e <code>type="multiple"</code> mantém botões pressionáveis; o foco circula com as setas.</>} keyboard={keys.toggleGroup} code={`<ToggleGroup type="multiple" aria-label="Formatação">\n  <ToggleGroupItem value="bold" aria-label="Negrito"><Bold /></ToggleGroupItem>\n  …\n</ToggleGroup>`}>
        <Toggle variant="outline" aria-label="Negrito"><Bold aria-hidden="true" /></Toggle>
        <ToggleGroup type="multiple" aria-label="Formatação" defaultValue={['bold']}>
          <ToggleGroupItem value="bold" aria-label="Negrito"><Bold aria-hidden="true" /></ToggleGroupItem>
          <ToggleGroupItem value="italic" aria-label="Itálico"><Italic aria-hidden="true" /></ToggleGroupItem>
          <ToggleGroupItem value="underline" aria-label="Sublinhado"><Underline aria-hidden="true" /></ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="single" aria-label="Alinhamento" defaultValue="left">
          <ToggleGroupItem value="left" aria-label="Alinhar à esquerda"><AlignLeft aria-hidden="true" /></ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Centralizar"><AlignCenter aria-hidden="true" /></ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Alinhar à direita"><AlignRight aria-hidden="true" /></ToggleGroupItem>
        </ToggleGroup>
      </Specimen>
    </Section>
  );
}

/* ── Fields ─────────────────────────────────────────────────────────── */

export function FieldsSection() {
  const [email, setEmail] = useState('ana@exemplo');
  const [format, setFormat] = useState('');
  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Informe um e-mail válido, como nome@empresa.com.' : undefined;
  return (
    <Section id="campos" eyebrow="Componentes" title="Input e Select" description="Todo campo tem rótulo visível ligado por htmlFor. Dica e erro entram por aria-describedby e o erro marca aria-invalid; o erro substitui a dica enquanto existir.">
      <Specimen title="Input" layout="grid" code={`<TextField label="Nome do projeto" placeholder="Minha API" hint="Aparece no título da documentação." />`}>
        <TextField label="Nome do projeto" placeholder="Minha API" hint="Aparece no título da documentação." />
        <TextField label="E-mail" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={emailError} hint="Validado enquanto você digita." />
        <TextField label="Buscar" type="search" placeholder="Endpoints, páginas…" prefix={<Search aria-hidden="true" />} suffix={<kbd className="dsp-kbd" aria-hidden="true">⌘K</kbd>} />
        <TextField label="Identificador" value="proj_8f2a91" disabled readOnly />
      </Specimen>
      <Specimen
        title="Select"
        description={<>Lista estilizada com <code>role="listbox"</code>, grupos rotulados e busca por letra. Um select nativo oculto mantém envio de formulário e preenchimento automático.</>}
        layout="grid"
        keyboard={keys.select}
        code={`<SelectField label="Ambiente" placeholder="Selecione" defaultValue="staging">\n  <SelectItem value="production">Produção</SelectItem>\n  <SelectItem value="staging">Homologação</SelectItem>\n</SelectField>`}
      >
        <SelectField label="Ambiente" defaultValue="staging" hint="Define a URL base do API Explorer.">
          <SelectItem value="production">Produção</SelectItem>
          <SelectItem value="staging">Homologação</SelectItem>
          <SelectItem value="local">Local</SelectItem>
          <SelectItem value="legacy" disabled>Legado (desativado)</SelectItem>
        </SelectField>
        <SelectField label="Fuso horário" placeholder="Selecione um fuso">
          <SelectGroup>
            <SelectLabel>América do Sul</SelectLabel>
            <SelectItem value="sao-paulo">São Paulo (GMT−3)</SelectItem>
            <SelectItem value="buenos-aires">Buenos Aires (GMT−3)</SelectItem>
            <SelectItem value="bogota">Bogotá (GMT−5)</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Europa</SelectLabel>
            <SelectItem value="lisbon">Lisboa (GMT+0)</SelectItem>
            <SelectItem value="berlin">Berlim (GMT+1)</SelectItem>
          </SelectGroup>
        </SelectField>
        <SelectField label="Formato" placeholder="Selecione…" required value={format} onValueChange={setFormat} error={format ? undefined : 'Escolha um formato para continuar.'}>
          <SelectItem value="json">JSON</SelectItem>
          <SelectItem value="yaml">YAML</SelectItem>
        </SelectField>
        <NativeSelect label="Select nativo" defaultValue="pt" hint="Melhor no celular e para listas longas e simples.">
          <option value="pt">Português</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </NativeSelect>
      </Specimen>
      <Specimen
        title="Slider"
        description={<>Cada alça tem <code>role="slider"</code>, nome e valor anunciado já formatado (<code>aria-valuetext</code>). Com dois valores vira um intervalo.</>}
        layout="grid"
        keyboard={keys.slider}
        code={`<Slider label="Timeout" defaultValue={[30]} max={120} formatValue={(v) => \`\${v} s\`} />\n<Slider label="Latência" thumbLabels={['mínima', 'máxima']} defaultValue={[80, 240]} />`}
      >
        <Slider label="Timeout da requisição" defaultValue={[30]} min={5} max={120} step={5} formatValue={(value) => `${value} s`} />
        <Slider label="Faixa de latência" thumbLabels={['mínima', 'máxima']} defaultValue={[80, 240]} min={0} max={500} step={10} formatValue={(value) => `${value} ms`} />
        <Slider label="Volume de logs" defaultValue={[40]} disabled formatValue={(value) => `${value}%`} />
      </Specimen>
      <Specimen title="Textarea" layout="stack">
        <Textarea label="Descrição" placeholder="Explique o que esta API faz…" hint="Markdown é suportado." />
      </Specimen>
    </Section>
  );
}

/* ── Selection ──────────────────────────────────────────────────────── */

const notificationOptions = [
  { id: 'publish', label: 'Especificação publicada' },
  { id: 'invite', label: 'Convite aceito' },
  { id: 'failure', label: 'Falha na importação' },
];

function SelectAllCheckboxes() {
  const [selected, setSelected] = useState<string[]>(['publish']);
  const all = selected.length === notificationOptions.length;
  const none = selected.length === 0;
  return (
    <div className="dsp-checklist" role="group" aria-labelledby="dsp-notify-title">
      <Checkbox
        id="dsp-notify-all"
        label={<span id="dsp-notify-title">Todas as notificações</span>}
        checked={all ? true : none ? false : 'indeterminate'}
        onCheckedChange={(value) => setSelected(value === true ? notificationOptions.map((option) => option.id) : [])}
      />
      <div className="dsp-checklist__items">
        {notificationOptions.map((option) => (
          <Checkbox
            key={option.id}
            label={option.label}
            checked={selected.includes(option.id)}
            onCheckedChange={(value) => setSelected((current) => value === true ? [...current, option.id] : current.filter((id) => id !== option.id))}
          />
        ))}
      </div>
    </div>
  );
}

export function SelectionSection() {
  return (
    <Section id="selecao" eyebrow="Componentes" title="Checkbox, Radio e Switch" description="Checkbox para escolhas em formulários, RadioGroup para uma opção entre poucas e Switch para configurações que valem na hora. O rótulo inteiro é clicável.">
      <Specimen title="Checkbox" description={<>O estado <code>indeterminate</code> vira <code>aria-checked="mixed"</code>, como no “selecionar todos”.</>} layout="stack" keyboard={keys.checkbox} code={`<Checkbox label="Todas" checked={all ? true : none ? false : 'indeterminate'} onCheckedChange={…} />`}>
        <SelectAllCheckboxes />
        <Separator />
        <Checkbox label="Aceitar termos e condições" description="Você concorda com os termos de uso e a política de privacidade." />
        <Checkbox label="Opção indisponível" disabled />
      </Specimen>
      <Specimen title="RadioGroup" description={<>Nomeie o grupo com <code>aria-labelledby</code> ou <code>aria-label</code>. A Tab entra só na opção marcada; as setas trocam a escolha.</>} layout="stack" keyboard={keys.radio} code={`<RadioGroup aria-labelledby="visibility" defaultValue="private">\n  <RadioGroupItem value="private" label="Privada" />\n</RadioGroup>`}>
        <p id="dsp-visibility" className="dsp-group-title">Visibilidade</p>
        <RadioGroup aria-labelledby="dsp-visibility" defaultValue="private">
          <RadioGroupItem value="private" label="Privada" description="Somente pessoas convidadas." />
          <RadioGroupItem value="team" label="Equipe" description="Todos da organização." />
          <RadioGroupItem value="public" label="Pública" description="Qualquer pessoa com o link." disabled />
        </RadioGroup>
      </Specimen>
      <Specimen title="Switch" layout="stack" keyboard={keys.switch} code={`<Switch label="Modo de manutenção" description="Bloqueia o acesso de leitores." />`}>
        <div className="dsp-setting">
          <div>
            <p className="dsp-setting__title" id="dsp-explorer-label">API Explorer</p>
            <p className="dsp-setting__description" id="dsp-explorer-description">Permite enviar requisições pela documentação.</p>
          </div>
          <Switch aria-labelledby="dsp-explorer-label" aria-describedby="dsp-explorer-description" defaultChecked />
        </div>
        <Switch label="Modo de manutenção" description="Bloqueia o acesso de leitores." />
        <Switch label="Indisponível" disabled />
      </Specimen>
    </Section>
  );
}

/* ── Overlays ───────────────────────────────────────────────────────── */

function EditProjectDialog() {
  const [name, setName] = useState('API de pagamentos');
  const [saved, setSaved] = useState('');
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline" iconStart={<Pencil />}>Editar projeto</Button></DialogTrigger>
      <DialogContent>
        <form className="dsp-dialog-form" onSubmit={(event) => { event.preventDefault(); setSaved(name); }}>
          <DialogHeader>
            <DialogTitle>Editar projeto</DialogTitle>
            <DialogDescription>Altere o nome e a descrição exibidos na documentação.</DialogDescription>
          </DialogHeader>
          <TextField label="Nome" value={name} onChange={(event) => setName(event.target.value)} required />
          <Textarea label="Descrição" defaultValue="Cobranças, reembolsos e webhooks." rows={3} />
          {saved && <p className="dsp-saved" role="status">Salvo: {saved}</p>}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit">Salvar alterações</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const sideLabels = { right: 'Filtros', left: 'Navegação', bottom: 'Detalhes' } as const;

function FiltersSheet({ side }: { side: keyof typeof sideLabels }) {
  return (
    <Sheet>
      <SheetTrigger asChild><Button variant="outline" iconStart={side === 'right' ? <SlidersHorizontal /> : side === 'left' ? <PanelLeft /> : <PanelBottom />}>{sideLabels[side]}</Button></SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>{side === 'right' ? 'Filtrar endpoints' : side === 'left' ? 'API de pagamentos' : 'POST /v1/refunds'}</SheetTitle>
          <SheetDescription>{side === 'right' ? 'Refine a lista da referência.' : side === 'left' ? 'Navegue pelos grupos da referência.' : 'Cria um reembolso total ou parcial de uma cobrança.'}</SheetDescription>
        </SheetHeader>
        <SheetBody className="dsp-sheet-body">
          {side === 'right' && (
            <>
              <SelectField label="Método" placeholder="Todos">
                {['GET', 'POST', 'PATCH', 'DELETE'].map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}
              </SelectField>
              <Checkbox label="Mostrar obsoletos" />
              <Checkbox label="Somente com exemplos" defaultChecked />
            </>
          )}
          {side === 'left' && (
            <nav aria-label="Grupos da API" className="dsp-sheet-nav">
              {['Cobranças', 'Reembolsos', 'Clientes', 'Webhooks', 'Faturas'].map((group, index) => <a key={group} href="#overlays" aria-current={index === 1 ? 'page' : undefined}>{group}</a>)}
            </nav>
          )}
          {side === 'bottom' && <p className="dsp-muted">Requer o escopo <code>refunds:write</code>. Reembolsos parciais podem ser feitos até 180 dias após a cobrança.</p>}
        </SheetBody>
        {side === 'right' && (
          <SheetFooter>
            <Button>Aplicar filtros</Button>
            <SheetClose asChild><Button variant="outline">Cancelar</Button></SheetClose>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AccountMenu() {
  const [showStatus, setShowStatus] = useState(true);
  const [showActivity, setShowActivity] = useState(false);
  const [position, setPosition] = useState('bottom');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" iconEnd={<Ellipsis />}>Minha conta</Button></DropdownMenuTrigger>
      <DropdownMenuContent className="dsp-menu-wide" align="start">
        <DropdownMenuLabel>Ana Souza</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem><User aria-hidden="true" />Perfil<DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem><CreditCard aria-hidden="true" />Faturamento<DropdownMenuShortcut>⌘B</DropdownMenuShortcut></DropdownMenuItem>
          <DropdownMenuItem><Settings aria-hidden="true" />Configurações<DropdownMenuShortcut>⌘,</DropdownMenuShortcut></DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><UserPlus aria-hidden="true" />Convidar pessoas</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem><Mail aria-hidden="true" />Por e-mail</DropdownMenuItem>
            <DropdownMenuItem><Copy aria-hidden="true" />Copiar link</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuLabel inset>Painel</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={showStatus} onCheckedChange={setShowStatus}>Barra de status</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={showActivity} onCheckedChange={setShowActivity}>Atividade recente</DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel inset>Posição</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={position} onValueChange={setPosition}>
          <DropdownMenuRadioItem value="top">Topo</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="bottom">Base</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>API (em breve)</DropdownMenuItem>
        <DropdownMenuItem variant="destructive"><LogOut aria-hidden="true" />Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OverlaysSection() {
  const [deleted, setDeleted] = useState(false);
  return (
    <Section id="overlays" eyebrow="Componentes" title="Dialog, Popover, Tooltip e Menu" description="Camadas sobre a página. Todas são renderizadas num portal, devolvem o foco ao gatilho ao fechar e fecham com Esc. O gatilho recebe aria-expanded e aria-controls.">
      <Specimen
        title="Dialog"
        description={<>Modal: <code>role="dialog"</code>, nomeado pelo título e descrito pela descrição. O foco fica preso dentro, o resto da página fica oculto para leitores de tela (<code>aria-hidden</code>) e a rolagem trava.</>}
        keyboard={keys.dialog}
        code={`<Dialog>\n  <DialogTrigger asChild><Button>Editar</Button></DialogTrigger>\n  <DialogContent>\n    <DialogHeader>\n      <DialogTitle>Editar projeto</DialogTitle>\n      <DialogDescription>…</DialogDescription>\n    </DialogHeader>\n  </DialogContent>\n</Dialog>`}
      >
        <EditProjectDialog />
      </Specimen>
      <Specimen
        title="AlertDialog"
        description={<>Confirmação que interrompe: <code>role="alertdialog"</code>. Clicar fora não fecha, e o foco começa em Cancelar, a escolha segura.</>}
        keyboard={keys.alertDialog}
        code={`<AlertDialog>\n  <AlertDialogTrigger asChild><Button variant="destructive">Excluir</Button></AlertDialogTrigger>\n  <AlertDialogContent>…\n    <AlertDialogCancel>Cancelar</AlertDialogCancel>\n    <AlertDialogAction variant="destructive">Excluir</AlertDialogAction>\n  </AlertDialogContent>\n</AlertDialog>`}
      >
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" iconStart={<Trash2 />}>Excluir projeto</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir “API de pagamentos”?</AlertDialogTitle>
              <AlertDialogDescription>Isso remove a especificação, as páginas e os convites. Não dá para desfazer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => setDeleted(true)}>Excluir projeto</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {deleted && <span className="dsp-saved" role="status">Excluído (só na demonstração). <Button variant="link" size="sm" onClick={() => setDeleted(false)}>Desfazer</Button></span>}
      </Specimen>
      <Specimen
        title="Sheet"
        description="Painel que entra pela borda, com a mesma semântica do Dialog. Bom para filtros, detalhes de um item e formulários secundários."
        keyboard={keys.dialog}
        code={`<Sheet>\n  <SheetTrigger asChild><Button variant="outline">Filtros</Button></SheetTrigger>\n  <SheetContent side="right">\n    <SheetHeader>\n      <SheetTitle>Filtros</SheetTitle>\n      <SheetDescription>…</SheetDescription>\n    </SheetHeader>\n  </SheetContent>\n</Sheet>`}
      >
        <FiltersSheet side="right" />
        <FiltersSheet side="left" />
        <FiltersSheet side="bottom" />
      </Specimen>
      <Specimen title="Popover" description="Painel não modal para conteúdo interativo. O foco entra no conteúdo ao abrir; clicar fora fecha." keyboard={keys.popover} code={`<Popover>\n  <PopoverTrigger asChild><Button variant="outline">Ajustes</Button></PopoverTrigger>\n  <PopoverContent>…</PopoverContent>\n</Popover>`}>
        <Popover>
          <PopoverTrigger asChild><Button variant="outline" iconStart={<Settings2 />}>Ajustes da requisição</Button></PopoverTrigger>
          <PopoverContent aria-labelledby="dsp-popover-title">
            <div className="dsp-popover">
              <div>
                <p id="dsp-popover-title" className="dsp-popover__title">Requisição</p>
                <p className="dsp-popover__description">Valores usados pelo API Explorer.</p>
              </div>
              <TextField label="Timeout (ms)" size="sm" type="number" defaultValue={5000} />
              <TextField label="Tentativas" size="sm" type="number" defaultValue={3} />
            </div>
          </PopoverContent>
        </Popover>
      </Specimen>
      <Specimen title="Tooltip" description="Texto curto e complementar, nunca essencial nem interativo. Abre no hover e no foco do teclado; vira a descrição (aria-describedby) do gatilho." keyboard={keys.tooltip} code={`<Tooltip content="Copia a URL do endpoint">\n  <Button variant="outline">Copiar URL</Button>\n</Tooltip>`}>
        <Tooltip content="Copia a URL do endpoint para a área de transferência"><Button variant="outline" iconStart={<Copy />}>Copiar URL</Button></Tooltip>
        <Tooltip content="Disponível no plano Pro" side="right"><Button variant="secondary">Exportar PDF</Button></Tooltip>
        <Tooltip content="Você será notificado sobre falhas" side="bottom"><span className="dsp-help" tabIndex={0}>O que é isto?</span></Tooltip>
      </Specimen>
      <Specimen title="DropdownMenu" description={<>Menu de ações (<code>role="menu"</code>) com grupos, atalhos, submenu, itens de checkbox e radio. Para escolher um valor em formulário, use Select.</>} keyboard={keys.menu}>
        <AccountMenu />
      </Specimen>
    </Section>
  );
}

/* ── Navigation ─────────────────────────────────────────────────────── */

const faq = [
  { value: 'auth', question: 'Como autenticar as requisições?', answer: 'Envie o token no cabeçalho Authorization: Bearer <token>. Tokens são criados em Configurações → Acesso.' },
  { value: 'limits', question: 'Existe limite de requisições?', answer: 'Sim: 600 requisições por minuto por token. Respostas 429 trazem o cabeçalho Retry-After.' },
  { value: 'versions', question: 'Como funciona o versionamento?', answer: 'A versão vai no caminho (/v1, /v2). Versões antigas recebem correções por 12 meses após uma nova versão.' },
];

export function NavigationSection() {
  return (
    <Section id="navegacao" eyebrow="Componentes" title="Tabs e Accordion" description="Organizam conteúdo em partes. As abas ligam cada aba ao seu painel (aria-controls / aria-labelledby); o accordion põe cada gatilho dentro de um título, mantendo a hierarquia da página.">
      <Specimen title="Tabs" layout="stack" keyboard={keys.tabs} code={`<Tabs defaultValue="curl">\n  <TabsList aria-label="Exemplo de requisição">\n    <TabsTrigger value="curl">cURL</TabsTrigger>\n  </TabsList>\n  <TabsContent value="curl">…</TabsContent>\n</Tabs>`}>
        <Tabs defaultValue="curl">
          <TabsList aria-label="Exemplo de requisição">
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="js">JavaScript</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
          </TabsList>
          <TabsContent value="curl"><pre className="dsp-snippet">{'curl https://api.opendoc.dev/v1/projects \\\n  -H "Authorization: Bearer $TOKEN"'}</pre></TabsContent>
          <TabsContent value="js"><pre className="dsp-snippet">{"const res = await fetch('https://api.opendoc.dev/v1/projects', {\n  headers: { Authorization: `Bearer ${token}` },\n});"}</pre></TabsContent>
          <TabsContent value="python"><pre className="dsp-snippet">{'requests.get(\n    "https://api.opendoc.dev/v1/projects",\n    headers={"Authorization": f"Bearer {token}"},\n)'}</pre></TabsContent>
        </Tabs>
        <Tabs defaultValue="overview">
          <TabsList variant="line" aria-label="Seções do endpoint">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="params">Parâmetros</TabsTrigger>
            <TabsTrigger value="responses">Respostas</TabsTrigger>
            <TabsTrigger value="changelog" disabled>Changelog</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="dsp-tab-panel">Lista os projetos que o token pode acessar, do mais recente para o mais antigo.</TabsContent>
          <TabsContent value="params" className="dsp-tab-panel"><code>limit</code> (1–100) e <code>cursor</code> para paginação.</TabsContent>
          <TabsContent value="responses" className="dsp-tab-panel"><Badge variant="success">200</Badge> lista de projetos · <Badge variant="destructive">401</Badge> token inválido</TabsContent>
        </Tabs>
      </Specimen>
      <Specimen title="Accordion" layout="stack" keyboard={keys.accordion} code={`<Accordion type="single" collapsible>\n  <AccordionItem value="auth">\n    <AccordionTrigger>Como autenticar?</AccordionTrigger>\n    <AccordionContent>…</AccordionContent>\n  </AccordionItem>\n</Accordion>`}>
        <Accordion type="single" collapsible defaultValue="auth" className="dsp-accordion">
          {faq.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger headingLevel={4}>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Specimen>
    </Section>
  );
}

/* ── Feedback ───────────────────────────────────────────────────────── */

export function FeedbackSection() {
  const [dismissed, setDismissed] = useState(false);
  return (
    <Section id="feedback" eyebrow="Componentes" title="Alert, Badge e Spinner" description={<>Alertas usam <code>role="status"</code> (anúncio educado) por padrão e <code>role="alert"</code> no destructive. Crie alertas dinâmicos já montados na página para que leitores de tela os anunciem.</>}>
      <Specimen title="Alert" layout="stack" code={`<Alert title="Atenção!" icon={<Terminal />}>\n  Você pode adicionar componentes pela CLI.\n</Alert>\n<Alert variant="destructive" title="Erro">\n  Sua sessão expirou. Entre novamente.\n</Alert>`}>
        <Alert title="Nova versão disponível" icon={<Terminal />}>A importação de OpenAPI 3.1 agora valida webhooks.</Alert>
        <Alert variant="destructive" role="status" title="Não foi possível importar">O arquivo tem uma referência circular em <code>#/components/schemas/User</code>.</Alert>
        <Alert variant="success" title="Especificação publicada">Os leitores já veem a nova versão.</Alert>
        <Alert variant="warning" title="Convite expira em 2 dias">Reenvie o link se a pessoa ainda não aceitou.</Alert>
        {dismissed
          ? <div><Button variant="ghost" size="sm" onClick={() => setDismissed(false)}>Mostrar alerta dispensável</Button></div>
          : <Alert variant="info" onDismiss={() => setDismissed(true)}>Alerta só com corpo e botão de fechar.</Alert>}
      </Specimen>
      <Specimen title="Badge" layout="stack" code={`<Badge>Default</Badge>\n<Badge variant="outline">Outline</Badge>\n<Badge variant="success" dot>Publicado</Badge>`}>
        <div className="dsp-row">
          {badgeVariants.map((item) => <Badge key={item.variant} variant={item.variant}>{item.label}</Badge>)}
        </div>
        <div className="dsp-row">
          {statusBadges.map((item) => <Badge key={item.variant} variant={item.variant} dot>{item.label}</Badge>)}
          <Badge variant="outline"><ArrowUpRight aria-hidden="true" />Com ícone</Badge>
          <Badge variant="secondary" className="dsp-count" aria-label="8 itens não lidos">8</Badge>
        </div>
      </Specimen>
      <Specimen title="Spinner" description="Com role=&quot;status&quot; e rótulo por padrão; passe label=&quot;&quot; quando for decorativo (o texto ao lado já informa).">
        <Spinner size="sm" />
        <Spinner />
        <Spinner size="lg" />
        <Badge variant="secondary"><Spinner size="sm" label="" />Sincronizando</Badge>
        <Button variant="outline" size="sm" loading>Processando</Button>
      </Specimen>
    </Section>
  );
}

/* ── Content ──────────────────────────────────────────────────────── */

const roles = ['Leitor', 'Editor', 'Administrador'];
const team = [
  { name: 'Ana Souza', email: 'ana@empresa.com', role: 'Administrador' },
  { name: 'Bruno Lima', email: 'bruno@empresa.com', role: 'Editor' },
  { name: 'Carla Dias', email: 'carla@empresa.com', role: 'Leitor' },
];
const members = [
  { name: 'Ana Souza' }, { name: 'Bruno Lima' }, { name: 'Carla Dias' }, { name: 'Diego Alves' }, { name: 'Elisa Rocha' },
];

function TeamCard() {
  const [assigned, setAssigned] = useState<Record<string, string>>(() => Object.fromEntries(team.map((person) => [person.name, person.role])));
  return (
    <Card>
      <CardHeader title="Equipe" description="Convide pessoas e defina o que cada uma pode fazer." />
      <CardContent>
        <ul className="dsp-team" role="list">
          {team.map((person) => (
            <li key={person.name} className="dsp-team__row">
              <Avatar name={person.name} />
              <div className="dsp-team__who">
                <p className="dsp-team__name">{person.name}</p>
                <p className="dsp-team__email">{person.email}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" iconEnd={<ChevronDown />} aria-label={`Papel de ${person.name}: ${assigned[person.name]}`}>
                    {assigned[person.name]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Papel</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={assigned[person.name]} onValueChange={(role) => setAssigned((current) => ({ ...current, [person.name]: role }))}>
                    {roles.map((role) => <DropdownMenuRadioItem key={role} value={role}>{role}</DropdownMenuRadioItem>)}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button variant="outline" fullWidth iconStart={<UserPlus />}>Convidar pessoa</Button>
      </CardFooter>
    </Card>
  );
}

function NotificationsCard() {
  return (
    <Card>
      <CardHeader title="Notificações" description="3 não lidas" actions={<IconButton icon={<Settings2 />} aria-label="Preferências de notificação" size="sm" />} />
      <CardContent>
        <ul className="dsp-notifications" role="list">
          {[['Especificação publicada', 'v2.4 já está visível para os leitores.', 'Há 1 hora'], ['Novo leitor convidado', 'Carla Dias aceitou o convite.', 'Há 3 horas'], ['Importação falhou', 'Referência circular em User.', 'Ontem']].map(([title, body, time]) => (
            <li key={title}>
              <span className="dsp-notifications__dot" aria-hidden="true" />
              <div>
                <p className="dsp-notifications__title">{title}</p>
                <p className="dsp-notifications__body">{body}</p>
              </div>
              <time className="dsp-notifications__time">{time}</time>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ContentSection() {
  return (
    <Section id="conteudo" eyebrow="Componentes" title="Card, Avatar e Separator" description="Cards agrupam conteúdo e ações relacionadas. Avatares mostram a foto só depois que ela carrega e caem para as iniciais; são nomeados para leitores de tela.">
      <Specimen title="Card" layout="stack" stageClassName="dsp-cards" code={`<Card>\n  <CardHeader title="Entrar na sua conta" description="…" actions={<Button variant="link">Criar conta</Button>} />\n  <CardContent>…</CardContent>\n  <CardFooter>\n    <Button fullWidth>Entrar</Button>\n  </CardFooter>\n</Card>`}>
        <div className="dsp-cards__grid">
          <Card>
            <CardHeader title="Entrar na sua conta" description="Use seu e-mail de trabalho para continuar." actions={<Button variant="link" size="sm">Criar conta</Button>} />
            <CardContent className="dsp-card-form">
              <TextField label="E-mail" type="email" autoComplete="email" placeholder="nome@empresa.com" />
              <TextField label="Senha" type="password" autoComplete="current-password" />
              <Checkbox label="Manter conectado" />
            </CardContent>
            <CardFooter className="dsp-card-footer-stack">
              <Button fullWidth>Entrar</Button>
              <Button variant="outline" fullWidth>Entrar com SSO</Button>
            </CardFooter>
          </Card>
          <div className="dsp-cards__column">
            <TeamCard />
            <NotificationsCard />
          </div>
        </div>
      </Specimen>

      <Specimen title="Avatar" description="Sem foto, mostra as iniciais. O grupo resume quem está ali e agrupa o excedente num contador." layout="stack" code={`<Avatar name="Ana Souza" src="/ana.jpg" size="lg" />\n<AvatarGroup people={members} max={4} total={12} />`}>
        <div className="dsp-avatars">
          <div className="dsp-avatars__block">
            <p className="dsp-avatars__label">Tamanhos</p>
            <div className="dsp-avatars__sizes">
              {([['sm', '24'], ['md', '32'], ['lg', '40'], ['xl', '56']] as const).map(([size, px]) => (
                <figure key={size} className="dsp-avatars__size">
                  <Avatar name="Ana Souza" size={size} />
                  <figcaption><code>{size}</code> · {px}px</figcaption>
                </figure>
              ))}
            </div>
          </div>
          <Separator orientation="vertical" className="dsp-avatars__divider" />
          <div className="dsp-avatars__block">
            <p className="dsp-avatars__label">AvatarGroup</p>
            <div className="dsp-avatars__groups">
              <AvatarGroup people={members} max={4} total={12} size="lg" />
              <AvatarGroup people={members} max={3} total={12} />
              <AvatarGroup people={members} max={5} size="sm" />
            </div>
          </div>
        </div>
      </Specimen>

      <Specimen title="Separator" description="Decorativo por padrão (oculto para leitores de tela). Use decorative={false} quando ele separa conteúdos de fato." code={`<Separator />\n<Separator orientation="vertical" />`}>
        <div className="dsp-separator-demo">
          <div>
            <p className="dsp-separator-demo__title">OpenDoc Design System</p>
            <p className="dsp-separator-demo__description">Componentes acessíveis sobre Radix.</p>
          </div>
          <Separator className="dsp-separator-demo__h" />
          <div className="dsp-separator-demo__links">
            <a href="#cores">Tokens</a>
            <Separator orientation="vertical" />
            <a href="#botoes">Componentes</a>
            <Separator orientation="vertical" />
            <a href="#acessibilidade">Acessibilidade</a>
          </div>
        </div>
      </Specimen>
    </Section>
  );
}
