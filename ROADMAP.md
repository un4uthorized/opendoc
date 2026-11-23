# Roadmap do client side

O que falta (e o que já foi feito) no lado do cliente do OpenDoc, sem contar CMS, gestão de usuários e autenticação no servidor.

Legenda: `[x]` concluído · `[ ]` pendente.

## 1. Fundação

Precisa existir antes do CMS, que vai alimentar a documentação.

- [ ] **Spec carregada dinamicamente.** Hoje a spec está no código (`apps/web/src/pages/docs/openapi.ts`). Buscar de uma URL ou da API, aceitar YAML e JSON, validar, resolver `$ref` externos e mostrar estados de carregando, spec inválida e spec vazia.
- [ ] **Rotas de verdade.** O app escolhe a página por `pathname` na mão (`apps/web/src/App.tsx`). Usar um roteador com algo como `/docs/:api/:versao/:endpoint`, URL atualizada enquanto se rola a página e links compartilháveis por endpoint.
- [x] **Desempenho.**
  - [x] Páginas carregadas sob demanda (`React.lazy` em `apps/web/src/App.tsx`): a home não baixa a documentação nem o design system.
  - [x] CodeMirror carregado só quando um editor JSON aparece, com um campo de texto provisório enquanto carrega.
  - [x] highlight.js carregado sob demanda: o código aparece primeiro como texto simples e ganha cores quando o motor chega.
  - [x] `sideEffects` no `package.json` para o bundler descartar código sem uso, com os CSS globais importados no `main.tsx` para não serem descartados.
  - [x] Um endpoint por página: só o endpoint aberto é montado (substituiu a montagem sob demanda ao rolar).
  - [x] Build sempre em modo produção (`NODE_ENV=production` no script): o `NODE_ENV` do `.env` fazia o React de desenvolvimento ir para o build.
  - [x] React num arquivo próprio (fica em cache entre deploys) e markdown separado, só nas páginas que mostram guias. Radix e ícones continuam divididos por página, para a home não baixar menus e diálogos da documentação.
  - Resultado: JS inicial de 1.541 kB para 324 kB (de 462 kB para 104 kB com gzip).
  - O Mermaid só é baixado em páginas com diagrama. Um dos arquivos dele passa de 500 kB (o Vite avisa no build), mas nunca entra na carga inicial.
- [x] **Tratamento de erros.**
  - [x] `ErrorBoundary` no design system, com "Tentar de novo", e "Recarregar página" quando um arquivo de código não baixa.
  - [x] Aplicado em volta da página, de cada endpoint, do cliente de teste de cada endpoint, do guia e da navegação.
  - [ ] Registrar os erros num serviço de monitoramento (o `onError` já existe para isso).

## 2. Cobertura do OpenAPI

O que specs reais usam. A spec de exemplo (`apps/web/src/pages/docs/openapi.ts`) usa cada item, contra serviços públicos reais (JSONPlaceholder, DummyJSON e httpbin.org), para dar para testar no playground.

- [x] Composição de schemas no `SchemaViewer`: `allOf` mesclado na ordem, `oneOf` e `anyOf` com seletor de formato, discriminador (os valores dão nome aos formatos) e referências circulares marcadas em vez de repetidas.
- [x] Vários exemplos nomeados por requisição (seletor no corpo do playground) e por resposta (seletor ao lado das abas).
- [x] Outros tipos de corpo: `application/x-www-form-urlencoded`, `multipart/form-data` com envio de arquivo, XML e texto. O tipo é escolhido no centro ou no playground (os dois ficam sincronizados).
- [x] Respostas que não são JSON: imagem mostrada no playground, texto e XML com cores, e arquivo binário para baixar.
- [x] Outras autenticações: chave de API no cabeçalho, na query ou em cookie, HTTP Basic, Bearer, OAuth 2.0 e OpenID Connect, com alternativas por endpoint (seletor "Método") e esquemas combinados.
  - [ ] Login OAuth 2.0 de verdade (janela do provedor com PKCE, credenciais do cliente). Hoje mostra os fluxos, URLs e escopos, e o token é colado.
- [x] Servidores com variáveis (`https://{host}`), com seletor no playground; servidores por operação.
- [x] Seção de Modelos com todos os `components.schemas`, uma página por modelo com exemplo gerado.
- [x] Webhooks (OpenAPI 3.1), com página própria, e callbacks no endpoint que os dispara.
- [x] Extensões `x-`: `x-badges` e `x-beta` (selo no título e na barra lateral), `x-ratelimit` e `x-internal` (esconde o endpoint).
- [x] Endpoints obsoletos (`deprecated`) marcados.

## 3. Playground (cliente de teste)

- [x] Cliente no estilo Postman/Insomnia/Bruno na coluna da direita: barra com método, URL e Enviar; abas Params, Headers, Auth e Body.
- [x] Tabelas de chave e valor com checkbox para ativar, linha nova automática e linhas travadas para os cabeçalhos gerados.
- [x] Editor JSON com CodeMirror: cores, números de linha, dobra de blocos, fechamento automático, indentação e erro marcado na linha.
- [x] Requisições reais para a API da spec (hoje o JSONPlaceholder), com status, tempo, tamanho, corpo e cabeçalhos da resposta.
- [x] Respostas grandes cortadas em 400 linhas, com aviso.
- [x] Atalho ⌘/Ctrl+Enter para enviar.
- [x] Exemplo de código que acompanha o que foi preenchido.
- [x] Chave de API compartilhada entre os endpoints da página, nunca exibida nos exemplos.
- [x] O que foi preenchido em cada endpoint fica salvo entre recargas, só quando difere do exemplo da spec (a chave de API nunca é salva).
- [x] Botão "Preencher com exemplo", que também desfaz as edições.
- [x] Copiar a requisição como cURL e copiar a resposta.
- [x] Falha de conexão explica o bloqueio de CORS e oferece o cURL para testar no terminal.
- [ ] Histórico de requisições.
- [ ] Ambientes e variáveis (`{{token}}`, `{{baseUrl}}`).
- [ ] Resposta em árvore: expandir, recolher e buscar dentro dela.
- [ ] Detalhes de tempo (DNS, conexão, espera, download).
- [x] Baixar a resposta como arquivo.
- [ ] Botão "Abrir no Postman" ou exportar uma coleção.
- [x] Exemplos em 20 linguagens: cURL, HTTPie, PowerShell, JavaScript, Node.js (axios), Python, Go, Java, C#, PHP, Ruby, Kotlin, Swift, Rust, Dart, Elixir, C, C++, Scala e R, com o cliente HTTP padrão de cada uma e a chave lida de variável de ambiente.

## 4. Experiência de documentação

- [x] Layout em três colunas: navegação, conteúdo e cliente de teste.
- [x] Coluna da direita redimensionável, com limite mínimo e largura lembrada.
- [x] Barra lateral que recolhe e expande (botão e ⌘/Ctrl+B), com a escolha lembrada.
- [x] Navegação no estilo Scalar: grupos que abrem e fecham, item atual destacado e método à direita.
  - [x] Guia e Referência da API separados: páginas do guia em lista com ícone de documento, endpoints em pastas com linhas de árvore.
  - [x] Filtro na barra lateral, contagem nos grupos fechados, endpoints obsoletos riscados e nome completo só quando cortado.
- [x] Um endpoint por página, escolhido pelo endereço (`#endpoint`; `#grupo` abre o primeiro do grupo). Voltar e avançar do navegador funcionam, e o foco vai para o conteúdo ao trocar de página.
- [x] No guia, o endereço acompanha a seção lida, sem criar entradas no histórico.
- [x] "Anterior / Próximo" no fim do guia e de cada endpoint.
- [x] Parâmetros do caminho (`{id}`) com dica de tipo e descrição; "Expandir tudo / Recolher tudo" nos schemas.
- [x] Responsivo: a coluna do meio nunca fica abaixo de 480px; uma coluna abaixo de 860px.
- [x] Busca por endpoints, métodos e caminhos (⌘K).
- [x] Abertura com título, passos iniciais, URLs base e download da spec.
- [x] Marca da empresa com fallback: logo completo, depois símbolo com nome, depois o símbolo do OpenDoc com o nome.
- [x] Favicon da empresa no `/docs`; sem símbolo, fica o do OpenDoc.
- [x] Busca com recentes, caminho de cada endpoint e texto completo (descrições, parâmetros, campos do corpo e seções do guia).
- [x] **Blocos de conteúdo no Markdown** (`apps/web/src/design-system/docs/markdown-blocks.ts`), para guias e wiki:
  - [x] Avisos `:::note`, `:::tip`, `:::info`, `:::warning` e `:::danger` (com título opcional), e os alertas do GitHub (`> [!NOTE]`).
  - [x] Passos numerados (`:::steps` com uma lista numerada).
  - [x] Abas (`:::tabs` com `@tab Nome`) e código em várias linguagens (`:::code-group`, uma aba por bloco de código, nome em `[colchetes]`). Abas com o mesmo nome ficam sincronizadas na página e a escolha é lembrada.
  - [x] Cards de link (`:::cards`) e seções que abrem e fecham (`:::details Título`).
  - [x] Diagramas Mermaid (` ```mermaid `), com o tema claro ou escuro da página.
  - [x] Imagem com zoom ao clicar; vídeo (`.mp4`, `.webm`, YouTube e Vimeo) com a mesma sintaxe de imagem.
  - Os nomes em português também funcionam (`nota`, `dica`, `atencao`, `perigo`, `passos`, `abas`, `codigo`, `detalhes`). O guia da spec de exemplo usa todos.
- [ ] Páginas de guia fora da spec (tutoriais, conceitos) com navegação própria.
- [ ] Changelog e troca de versão.
- [ ] Feedback por página ("Isto ajudou?") e link "Sugerir edição".
- [x] **Internacionalização da ferramenta (PT e EN).** `LocaleProvider` e dicionários no design system (`apps/web/src/design-system/i18n.tsx`) e na documentação (`apps/web/src/pages/docs/messages.ts`). O idioma fica no menu do usuário, é lembrado no navegador e atualiza o `<html lang>`. O conteúdo da API (spec, descrições, guias) não é traduzido.
  - [ ] Conteúdo da API em vários idiomas, vindo do CMS (incluindo a abertura e os passos iniciais, hoje escritos no código).
  - [ ] Traduzir a página inicial e o playground do design system (`/design-system`).
  - [ ] Formatar números e datas pelo idioma (`Intl`).
- [ ] Prontidão para IA: `llms.txt`, "Copiar página como Markdown" e um servidor MCP da documentação.
- [ ] SEO: pré-renderização ou SSR, metatags e sitemap. Hoje a página só existe depois que o JavaScript roda.

## 5. Qualidade

- [ ] Testes de componente: `SchemaViewer`, gerador de exemplos (`apps/web/src/pages/docs/samples.ts`) e montagem das operações (`apps/web/src/pages/docs/spec.ts`).
- [ ] Testes e2e com Playwright para o playground e a navegação.
- [ ] Auditoria de acessibilidade automática (axe) nas páginas.
- [x] Celular: o cliente de teste abre numa folha de baixo pelo botão "Testar requisição".
- [x] Contraste AA conferido nos dois temas (rótulos cinza e cores de método).
- [x] Escala de texto pequeno reduzida a três tamanhos (11, 12 e 13px).
