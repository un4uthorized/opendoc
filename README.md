# OpenDoc

Plataforma para publicar documentação de APIs a partir de specs OpenAPI, hospedada por você.

A equipe escreve a spec e os guias num painel administrativo, publica versões e decide quem pode ler. Quem consome a API recebe um portal com a referência, os guias, um cliente para testar cada endpoint e exemplos de código prontos.

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Primeiro acesso](#primeiro-acesso)
- [Desenvolvimento](#desenvolvimento)
- [Testes](#testes)
- [Produção](#produção)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Segurança](#segurança)
- [Roadmap](#roadmap)
- [Contribuindo](#contribuindo)

## Visão geral

O OpenDoc tem duas partes, servidas no mesmo endereço:

- **Portal de documentação (`/docs`)**: o que os leitores veem. Cada projeto tem endereço próprio (`/docs/:projeto`), pode ser público ou privado e mostra só versões publicadas.
- **Painel administrativo (`/admin`)**: onde a equipe edita specs e guias, publica versões, gerencia pessoas e acompanha o uso.

```
Navegador ──► /docs, /admin, /convite/:token   (front em React)
          └─► /api/*                          (API em Express) ──► PostgreSQL
```

Em desenvolvimento, o Vite serve o front e repassa `/api` para a API. Em produção, uma única imagem Docker entrega os dois.

## Funcionalidades

**Portal de documentação**
- Referência gerada da spec OpenAPI 3.x: schemas com `allOf`/`oneOf`/`anyOf`, vários tipos de corpo, webhooks, callbacks e extensões `x-`.
- Cliente de teste em cada endpoint, com parâmetros, cabeçalhos, autenticação e corpo editáveis, e a resposta real.
- Exemplos de código em 20 linguagens, que acompanham o que foi preenchido no cliente.
- Guias em Markdown com destaques, passos, abas, cards e diagramas Mermaid.
- Busca com ⌘K, várias versões por projeto, marca própria e tema claro ou escuro.
- "Esta página ajudou?" no fim de cada página.

**Painel administrativo**
- Projetos com versões, rascunho e publicação, changelog e versão padrão.
- Editor de spec em YAML ou JSON com pré-visualização, e importação por arquivo ou URL.
- Páginas de guia, ordem e rótulos da navegação, e aparência por projeto ou da organização.
- Histórico de alterações, com restauração de specs publicadas antes.
- Analytics: visitas, visitantes únicos, endpoints e páginas mais lidos, buscas sem resultado e feedback dos leitores.
- Pessoas por projeto com papéis `admin`, `editor` e `viewer`, e convites por link.

**Contas e acesso**
- Autenticador (TOTP) obrigatório, com códigos de recuperação.
- Sessões no servidor, limite de tentativas e proteção contra CSRF.

## Stack

| Parte | Tecnologias |
| --- | --- |
| Front (`apps/web`) | React 19, TypeScript, Vite, Radix, CodeMirror, markdown-it, highlight.js, Mermaid |
| API (`apps/api`) | Node 24, Express 5, Zod, `pg`, Helmet, otpauth |
| Banco | PostgreSQL 18 |
| Monorepo | pnpm workspaces |
| Contêineres | Podman ou Docker |

## Requisitos

- [Node.js](https://nodejs.org) 24 ou mais novo.
- [pnpm](https://pnpm.io) 11 (`corepack enable` instala a versão fixada no `package.json`).
- PostgreSQL 18. O jeito mais simples é o [Podman](https://podman.io) com `podman compose`; o Docker também funciona.

## Instalação

```sh
git clone <url-do-repositório> opendoc
cd opendoc
corepack enable
pnpm install
cp .env.example .env
```

Preencha o `.env` (veja [Configuração](#configuração)). No mínimo:

```sh
openssl rand -base64 32   # cole em MFA_ENCRYPTION_KEY
```

Depois defina `ADMIN_PASSWORD`, `POSTGRES_PASSWORD` e a mesma senha em `DATABASE_URL`.

Suba o banco e o projeto:

```sh
pnpm db:up   # PostgreSQL em 127.0.0.1:5432 (compose.yaml)
pnpm dev     # API em :4173 e front em :5173
```

Abra <http://localhost:5173>.

## Configuração

Toda a configuração vem de variáveis de ambiente, lidas do `.env` da raiz. A API se recusa a iniciar com uma configuração inválida ou insegura.

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `DATABASE_URL` | sim | | Conexão com o PostgreSQL. Codifique a senha se tiver caracteres especiais. |
| `MFA_ENCRYPTION_KEY` | sim | | 32 bytes em Base64 (`openssl rand -base64 32`). Cifra os segredos do autenticador: guarde junto com o backup do banco, porque sem ela ninguém consegue entrar. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | no primeiro start | | Conta de configuração, que convida os admins. Senha de 15 a 128 caracteres. |
| `ADMIN_NAME` | não | `Administrador` | Nome da conta de configuração. |
| `APP_URL` | não | `http://localhost:5173` | Endereço público do app. Monta os links de convite e é a origem aceita em alterações. |
| `ALLOWED_ORIGINS` | não | | Outras origens aceitas, separadas por vírgula. |
| `HOST`, `PORT` | não | `127.0.0.1`, `4173` | Onde a API escuta. |
| `NODE_ENV` | não | | `production` liga cookies `Secure` com prefixo `__Host-`. |
| `COOKIE_SECURE` | não | igual a produção | Força cookies `Secure`. `false` não é aceito em produção. |
| `TRUST_PROXY` | não | `false` | `true` só atrás de um proxy reverso confiável (IP real e HTTPS vêm do proxy). |
| `WEB_DIR` | não | | Pasta do front compilado que a API serve. Já vem definida na imagem Docker. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | para `pnpm db:up` | | Banco local criado pelo `compose.yaml`. |

## Primeiro acesso

1. Entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD`. É a **conta de configuração**: entra só com senha e serve apenas para gerenciar os admins, em `/admins`.
2. Convide os admins da instalação. O OpenDoc não envia e-mail: copie o link do convite e mande para a pessoa.
3. Cada admin abre o link, cria a senha e configura o autenticador. A partir daí, cria projetos e convida editores e leitores em `/admin`.

## Desenvolvimento

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | API (com `--watch`) e front juntos |
| `pnpm dev:api` / `pnpm dev:web` | só um dos dois |
| `pnpm check` | checagem de tipos nos dois apps |
| `pnpm build` | checa os tipos e gera `apps/web/dist/` |
| `pnpm test` | testes de integração da API |
| `pnpm db:up` | sobe o PostgreSQL local |
| `pnpm --filter @opendoc/api migrate` | aplica as migrations (a API também aplica ao iniciar) |

- O Vite repassa `/api` para `http://127.0.0.1:4173`, então o cookie de sessão é do mesmo site e não há CORS. Para outra API, use `API_URL`.
- O catálogo de componentes fica em <http://localhost:5173/design-system>.
- Mudanças no banco entram como uma nova migration SQL numerada em `apps/api/migrations/`.

## Testes

Os testes de integração da API rodam contra um PostgreSQL de verdade, separado do de desenvolvimento, porque as tabelas são apagadas a cada execução:

```sh
podman run -d --rm -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=opendoc_test -p 127.0.0.1:55432:5432 postgres:18-alpine
pnpm test
```

Para usar outro banco, defina `TEST_DATABASE_URL`.

## Produção

O `Dockerfile` gera uma imagem só, com a API e o front compilado no mesmo endereço. A API responde em `/api` e entrega o front nas demais rotas. O PostgreSQL roda à parte, e as migrations são aplicadas quando o container inicia.

```sh
podman build --format docker -t opendoc .
podman run --env-file .env -p 4173:4173 opendoc
```

- No `.env` de produção, `DATABASE_URL` aponta para o PostgreSQL acessível pelo container, e `APP_URL` é o endereço público.
- A imagem roda com `NODE_ENV=production`, então os cookies saem com `Secure`. Coloque HTTPS na frente com um proxy reverso e use `TRUST_PROXY=true`. Sem proxy, mantenha `TRUST_PROXY=false`, senão o IP do cliente pode ser forjado.
- `--format docker` mantém o `HEALTHCHECK` (`GET /api/health`). No formato OCI, padrão do Podman, ele é ignorado.
- Faça backup do banco **e** da `MFA_ENCRYPTION_KEY`. Um sem o outro não restaura os acessos.

## Estrutura do projeto

```
.
├── apps/
│   ├── api/                  API em Express + PostgreSQL
│   │   ├── migrations/       SQL aplicado no start
│   │   ├── src/              rotas, sessões e segurança
│   │   └── test/             testes de integração
│   └── web/                  front em React + Vite
│       └── src/
│           ├── design-system/   componentes, tokens e blocos de documentação
│           └── pages/           docs, admin, admins, login, convite
├── compose.yaml              PostgreSQL de desenvolvimento
├── Dockerfile                imagem de produção
├── .env.example              modelo de configuração
└── ROADMAP.md                o que falta no front
```

Documentação de cada parte:

- [API](apps/api/README.md): autenticação, papéis e rotas.
- [Design system](apps/web/src/design-system/README.md): tokens, componentes e acessibilidade.

## Segurança

- Senhas com scrypt; tokens de sessão e de convite guardados só como hash.
- Autenticador obrigatório para todos, exceto a conta de configuração, que só gerencia admins. Proteja `ADMIN_PASSWORD` como uma credencial de administrador.
- Cookies `httpOnly`, `SameSite=Lax` e `__Host-` em HTTPS; alterações aceitas só da origem do app.
- CSP restrita em `/api` e nas páginas servidas pela imagem.
- Markdown renderizado sem HTML e diagramas Mermaid em modo `strict`.

Encontrou uma vulnerabilidade? Avise os mantenedores em particular antes de abrir uma issue pública.

## Roadmap

O que já foi feito e o que falta no front está em [ROADMAP.md](ROADMAP.md).

## Contribuindo

1. Crie uma branch a partir da `main`.
2. Rode `pnpm check` e `pnpm test` antes de abrir o PR.
3. Commits seguem o [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em português: `feat(docs): …`, `fix(api): …`.
