# OpenDoc

Monorepo com pnpm workspaces:

- `apps/web`: front-end em React + TypeScript com Vite (home, `/docs`, `/admin` e `/design-system`).
- `apps/api`: API em Express 5 + PostgreSQL, com sessão em cookie `httpOnly` e autenticador (TOTP) obrigatório.

```sh
cp .env.example .env   # preencha senhas, DATABASE_URL e MFA_ENCRYPTION_KEY
pnpm install
pnpm db:up             # PostgreSQL no Podman (compose.yaml)
pnpm dev               # API em :4173 e web em :5173 (o Vite repassa /api para a API)
```

- `pnpm build`: checa tipos dos dois apps e gera `apps/web/dist/`.
- `pnpm test`: testes de integração da API contra um PostgreSQL real (`TEST_DATABASE_URL`, padrão `127.0.0.1:55432`; veja `apps/api/test/helpers.ts`).
- `pnpm --filter @opendoc/api migrate`: aplica as migrations (a API também aplica ao iniciar).

## API (`apps/api`)

Roda direto com Node 24 (TypeScript sem build, só tipos apagáveis). Migrations em SQL em `apps/api/migrations/`.

**Autenticação.** Sessões no servidor: o cookie `httpOnly` + `SameSite=Lax` (`__Host-opendoc_session` com HTTPS) guarda um token aleatório, e o banco guarda só o SHA-256 dele. Sair, trocar a senha ou ter o autenticador redefinido apaga as sessões na hora. O login tem etapas, e o token muda a cada uma:

1. `POST /api/auth/login` com e-mail e senha → etapa `mfa` (ou `enroll`, se ainda não há autenticador).
2. `POST /api/auth/mfa/verify` com o código de 6 dígitos ou um código de recuperação → `active`.
3. Na primeira vez: `POST /api/auth/mfa/setup` (segredo e QR code) e `POST /api/auth/mfa/enable` (primeiro código → `active` + 10 códigos de recuperação).

`GET /api/auth/me` diz a etapa e o usuário; `POST /api/auth/logout` encerra. Tentativas de login e de código têm limite (contadores no PostgreSQL). Requisições que mudam dados só são aceitas da origem do app (`APP_URL`).

**Permissões.** O responsável (`owner`, criado de `ADMIN_EMAIL`/`ADMIN_PASSWORD`) faz tudo. Nos projetos: `viewer` lê a documentação, `editor` mexe em spec, versões, páginas, navegação e aparência, `admin` também cuida de pessoas e configurações.

**Rotas** (todas em `/api`, no formato de `apps/web/src/pages/admin/data/types.ts`):

| Rota | Quem |
| --- | --- |
| `GET /admin/state` | qualquer pessoa conectada (vê só os próprios projetos) |
| `PATCH /organization`, `POST /projects`, `DELETE /projects/:id`, `POST /users/:id/reset-mfa` | responsável |
| `PATCH /projects/:id` | editor (aparência, versão padrão) ou admin (demais campos) |
| `POST /projects/:id/versions`, `PUT\|DELETE …/versions/:v/draft`, `POST …/versions/:v/publish`, `PUT …/versions/:v/changelog`, `PATCH\|DELETE …/versions/:v`, `POST …/activity/:a/restore`, `PUT …/navigation`, `POST\|PUT\|DELETE …/pages[/:p]`, `POST …/pages/:p/move` | editor |
| `POST /projects/:id/invitations`, `PATCH …/members`, `POST …/members/remove`, `POST /invitations/:id/resend`, `DELETE /invitations/:id` | admin do projeto |
| `GET /invitations/:token`, `POST /invitations/:token/accept` | quem tem o link do convite |
| `PATCH /account`, `PUT /account/password`, `POST /account/recovery-codes` | a própria pessoa |
| `GET /docs/:slug` | todos (projeto público) ou membros (privado); só versões publicadas |

Convites não mandam e-mail: a API devolve o link (`APP_URL/convite/<token>`) para quem convidou repassar.

## Design system

No estilo do shadcn/ui. Fica em `apps/web/src/design-system/`, e o playground está em [`/design-system`](http://localhost:5173/design-system).

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

### Organismos

Em `apps/web/src/design-system/organisms/`, composições maiores feitas com os componentes base:

- **Sidebar** (`SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuButton`, `SidebarFooter`, `SidebarTrigger`, `SidebarInset`): recolhe para ícones com tooltip, vira gaveta no celular e alterna com ⌘/Ctrl+B.
- **Navbar** (`Navbar`, `NavbarSection`, `NavbarSpacer`, `NavbarNav`, `NavbarMobileMenu`, `NavbarSearch`) e **UserMenu**.
- **CommandMenu**: paleta ⌘K no padrão combobox + listbox (`useCommandShortcut` registra o atalho).
- **StatCard** + **Sparkline**: métrica com variação e gráfico com resumo em texto.
- **Item** / **ItemGroup**: linhas de ação e configuração.
- **PromptInput**: compositor de chat (Enter envia, Shift+Enter quebra linha).

### Documentação de API

Em `apps/web/src/design-system/docs/`, com destaque de sintaxe via [highlight.js](https://highlightjs.org) (só as linguagens usadas) e Markdown via [markdown-it](https://github.com/markdown-it/markdown-it) com HTML desligado, seguro para conteúdo de usuários:

- **CodeBlock** e **CodeTabs**: código com cópia, números e linhas destacadas; linguagem escolhida num select e sincronizada por `syncKey`.
- **EndpointHeader**, **MethodBadge** e **EndpointPath**: método, caminho com parâmetros destacados e cópia da URL.
- **SchemaViewer**: árvore de campos de um JSON Schema/OpenAPI; **ResponsePanel**: respostas por código de status, escolhido num select.
- **Markdown**, **Prose**, **TableOfContents** (com `markdownHeadings()`) e **HeadingAnchor**.

### Formulários e admin

- **InputOTP** (um único campo real com `autocomplete="one-time-code"`), **PasswordField** (mostrar/ocultar e requisitos), **ErrorSummary** e **FileDropzone**.
- **Combobox** (simples ou múltiplo), **DataTable** (busca, ordenação, seleção, ações em massa e por linha, paginação) e **MarkdownEditor** (barra de formatação, atalhos e pré-visualização).

### Acessibilidade

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
