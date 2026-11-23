# API (`apps/api`)

API em Express 5 + PostgreSQL. Roda direto com Node 24, que executa o TypeScript sem build (só tipos apagáveis). As migrations são arquivos SQL em [`migrations/`](migrations/) e são aplicadas sempre que a API inicia.

```sh
pnpm --filter @opendoc/api dev       # com --watch, lê o .env da raiz
pnpm --filter @opendoc/api start
pnpm --filter @opendoc/api migrate   # só aplica as migrations
pnpm --filter @opendoc/api test      # testes de integração (PostgreSQL real)
```

## Estrutura

| Pasta | O que tem |
| --- | --- |
| `src/auth/` | login em etapas, MFA e sessões |
| `src/account/` | conta da própria pessoa e aceite de convites |
| `src/admin/` | painel: organização, projetos, versões, páginas, membros e analytics |
| `src/admins/` | admins da instalação, geridos pela conta de configuração |
| `src/docs/` | leitura pública da documentação, eventos de analytics e feedback |
| `src/security/` | hash de senha, TOTP, cifra dos segredos, CSRF e limite de tentativas |
| `test/` | testes de integração com `node:test` |

## Autenticação

As sessões ficam no servidor. O cookie `httpOnly` + `SameSite=Lax` (`__Host-opendoc_session` com HTTPS) guarda um token aleatório, e o banco guarda só o SHA-256 dele. Sair, trocar a senha ou ter o autenticador redefinido apaga as sessões na hora.

O login tem etapas, e o token muda a cada uma:

1. `POST /api/auth/login` com e-mail e senha → etapa `mfa` (ou `enroll`, se ainda não há autenticador).
2. `POST /api/auth/mfa/verify` com o código de 6 dígitos ou um código de recuperação → `active`.
3. Na primeira vez: `POST /api/auth/mfa/setup` (segredo e QR code) e `POST /api/auth/mfa/enable` (primeiro código → `active` + 10 códigos de recuperação).

`GET /api/auth/me` diz a etapa e o usuário; `POST /api/auth/logout` encerra.

- Senhas com scrypt (15 a 128 caracteres); segredos do autenticador cifrados com AES-256-GCM usando `MFA_ENCRYPTION_KEY`.
- Tentativas de login e de código têm limite, com contadores no PostgreSQL (valem para todas as instâncias).
- Requisições que mudam dados só são aceitas da origem do app (`APP_URL` e `ALLOWED_ORIGINS`).

## Papéis

| Papel | O que pode |
| --- | --- |
| Conta de configuração | criada de `ADMIN_EMAIL`/`ADMIN_PASSWORD`; entra só com senha e apenas convida, remove e redefine o MFA dos admins da instalação |
| Admin da instalação (`owner`) | tudo: organização, todos os projetos, redefinir o MFA de qualquer pessoa |
| `admin` do projeto | o que o editor faz, mais pessoas, convites e configurações do projeto |
| `editor` | spec, versões, páginas, navegação e versão padrão |
| `viewer` | lê a documentação, inclusive a privada |

## Rotas

Todas em `/api`, no formato de [`apps/web/src/pages/admin/data/types.ts`](../web/src/pages/admin/data/types.ts).

| Rota | Quem |
| --- | --- |
| `GET /health` | todos |
| `GET /admins`, `POST /admins/invitations`, `POST /admins/invitations/:id/resend`, `DELETE /admins/invitations/:id`, `DELETE /admins/:userId`, `POST /admins/:userId/reset-mfa` | conta de configuração |
| `GET /admin/state` | admins e editores (vê só os próprios projetos) |
| `PATCH /organization`, `POST /projects`, `DELETE /projects/:id`, `POST /users/:id/reset-mfa` | admin da instalação |
| `PATCH /projects/:id` | editor (versão padrão) ou admin (demais campos, inclusive aparência) |
| `POST /projects/:id/versions`, `PUT\|DELETE …/versions/:v/draft`, `POST …/versions/:v/publish`, `PUT …/versions/:v/changelog`, `PATCH\|DELETE …/versions/:v`, `GET …/activity`, `POST …/activity/:a/restore`, `PUT …/navigation`, `POST\|PUT\|DELETE …/pages[/:p]`, `POST …/pages/:p/move` | editor |
| `GET /projects/:id/analytics`, `POST /projects/:id/invitations`, `PATCH …/members`, `POST …/members/remove`, `POST /invitations/:id/resend`, `DELETE /invitations/:id` | admin do projeto |
| `GET /invitations/:token`, `POST /invitations/:token/accept` | quem tem o link do convite |
| `PATCH /account`, `PUT /account/password`, `POST /account/recovery-codes` | a própria pessoa |
| `GET /docs`, `GET /docs/:slug`, `POST /docs/:slug/events`, `POST /docs/:slug/feedback` | todos (projeto público) ou membros (privado); só versões publicadas |

Convites não mandam e-mail: a API devolve o link (`APP_URL/convite/<token>`) para quem convidou repassar.

## Testes

Os testes rodam contra um PostgreSQL de verdade, apontado por `TEST_DATABASE_URL` (padrão `postgresql://test:test@127.0.0.1:55432/opendoc_test`). As tabelas são apagadas a cada execução, então use um banco só para isso:

```sh
podman run -d --rm -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=opendoc_test -p 127.0.0.1:55432:5432 postgres:18-alpine
pnpm --filter @opendoc/api test
```
