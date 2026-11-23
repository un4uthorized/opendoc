# Design system

No estilo do shadcn/ui. O playground está em [`/design-system`](http://localhost:5173/design-system).

- `tokens.css`: primitivas em OKLCH (`--neutral-*`, `--red-*`, `--green-*`, `--amber-*`, `--blue-*`) e tokens semânticos em pares, como no shadcn: `--background`/`--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input` e `--ring`. `--success`, `--warning` e `--info` são extensões. Os raios derivam de `--radius`.
- `base.css`: reset, padrões globais e estilos de texto (`.ds-text-*`), com Geist e Geist Mono.
- `components.css` e `components/`: componentes acessíveis construídos sobre primitivos do [Radix](https://www.radix-ui.com/primitives) (pacote `radix-ui`, sem estilo), como no shadcn/ui.
  - Ícones: `Icon` sobre o [Lucide](https://lucide.dev), com tamanhos `xs`–`xl` (tokens `--icon-*`) e `label` opcional para ícones que comunicam algo sozinhos (Radix AccessibleIcon). Sem `label`, o ícone é decorativo e fica oculto para leitores de tela.
  - Ações: Button, IconButton (com tooltip), Toggle e ToggleGroup.
  - Formulário: TextField, Textarea, Select/SelectField (Radix), NativeSelect, Checkbox (com indeterminado), RadioGroup, Switch e Label.
  - Camadas: Dialog, AlertDialog, Popover, Tooltip e DropdownMenu.
  - Formulário (cont.): Slider, com intervalo e valor formatado anunciado.
  - Camadas (cont.): Sheet (painel lateral sobre o Dialog).
  - Feedback: Toast (`toast()` chamável de qualquer lugar; `<Toaster />` montado em `apps/web/src/main.tsx`), Progress (determinado e indeterminado), Skeleton, Alert, Badge e Spinner.
  - Dados e navegação: Table (com ordenação via `aria-sort`), Pagination, Breadcrumb, Tabs e Accordion.
  - Conteúdo: Card, Avatar, AvatarGroup, Separator, Kbd, EmptyState e Text.

## Organismos

Em `organisms/`, composições maiores feitas com os componentes base:

- **Sidebar** (`SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuButton`, `SidebarFooter`, `SidebarTrigger`, `SidebarInset`): recolhe para ícones com tooltip, vira gaveta no celular e alterna com ⌘/Ctrl+B.
- **Navbar** (`Navbar`, `NavbarSection`, `NavbarSpacer`, `NavbarNav`, `NavbarMobileMenu`, `NavbarSearch`) e **UserMenu**.
- **CommandMenu**: paleta ⌘K no padrão combobox + listbox (`useCommandShortcut` registra o atalho).
- **StatCard** + **Sparkline**: métrica com variação e gráfico com resumo em texto.
- **Item** / **ItemGroup**: linhas de ação e configuração.
- **PromptInput**: compositor de chat (Enter envia, Shift+Enter quebra linha).

## Documentação de API

Em `docs/`, com destaque de sintaxe via [highlight.js](https://highlightjs.org) (só as linguagens usadas) e Markdown via [markdown-it](https://github.com/markdown-it/markdown-it) com HTML desligado, seguro para conteúdo de usuários:

- **CodeBlock** e **CodeTabs**: código com cópia, números e linhas destacadas; linguagem escolhida num select e sincronizada por `syncKey`.
- **EndpointHeader**, **MethodBadge** e **EndpointPath**: método, caminho com parâmetros destacados e cópia da URL.
- **SchemaViewer**: árvore de campos de um JSON Schema/OpenAPI; **ResponsePanel**: respostas por código de status, escolhido num select.
- **Markdown**, **Prose**, **TableOfContents** (com `markdownHeadings()`) e **HeadingAnchor**.

## Formulários e admin

- **InputOTP** (um único campo real com `autocomplete="one-time-code"`), **PasswordField** (mostrar/ocultar e requisitos), **ErrorSummary** e **FileDropzone**.
- **Combobox** (simples ou múltiplo), **DataTable** (busca, ordenação, seleção, ações em massa e por linha, paginação) e **MarkdownEditor** (barra de formatação, atalhos e pré-visualização).

## Acessibilidade

Os primitivos do Radix entregam papéis e estados ARIA, foco preso em diálogos, foco itinerante com setas em grupos, Esc para fechar camadas e devolução do foco ao gatilho. Por cima disso, o design system garante:

- rótulo visível em todo campo, com dica e erro ligados por `aria-describedby` e `aria-invalid`;
- `aria-label` obrigatório no tipo de `IconButton`, sem anunciar o tooltip duas vezes;
- anel de foco visível em `:focus-visible` e animações desligadas com `prefers-reduced-motion`.

Dialog, Sheet, AlertDialog e CommandMenu devolvem o foco a quem os abriu mesmo sem `Trigger` (atalhos ou `open` controlado). O playground documenta o teclado de cada componente. `TooltipProvider` precisa envolver a aplicação e `<Toaster />` precisa estar montado uma vez (os dois já estão em `apps/web/src/main.tsx`).

As variantes seguem os nomes do shadcn: Button tem `default`, `secondary`, `outline`, `ghost`, `destructive` e `link`; Badge e Alert têm `default`, `destructive` e, como extensão, `success`, `warning` e `info`.

Tema: segue o sistema por padrão; `<html data-theme="light|dark">` força um tema. Os tokens usam `light-dark()`, então cada cor é definida uma vez para os dois temas.

```tsx
import { Button, Card, CardContent, CardHeader, TextField } from './design-system';

<Card>
  <CardHeader title="Entrar" description="Use seu e-mail de trabalho." />
  <CardContent>
    <TextField label="E-mail" type="email" />
  </CardContent>
</Card>
<Button variant="outline">Cancelar</Button>
```
