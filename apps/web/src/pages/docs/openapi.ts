/**
 * OpenAPI 3.1 description of JSONPlaceholder (https://jsonplaceholder.typicode.com), a free fake
 * REST API: no authentication, CORS enabled, and writes (POST/PUT/PATCH/DELETE) are simulated, so
 * the docs playground can call it for real. The docs page is rendered entirely from this object.
 *
 * It also exercises every OpenAPI feature the docs support, against real public services:
 * server variables (JSONPlaceholder or DummyJSON), allOf / oneOf / anyOf with a
 * discriminator, a circular reference (_embed / _expand), named examples, form bodies, callbacks,
 * webhooks, x- extensions, and, on httpbin.org (operation-level server), every auth scheme,
 * multipart upload, XML, and image / text / binary responses.
 */
const post = {
  userId: 1,
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
  body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam',
};
const user = {
  id: 1,
  name: 'Leanne Graham',
  username: 'Bret',
  email: 'Sincere@april.biz',
  address: { street: 'Kulas Light', suite: 'Apt. 556', city: 'Gwenborough', zipcode: '92998-3874', geo: { lat: '-37.3159', lng: '81.1496' } },
  phone: '1-770-736-8031 x56442',
  website: 'hildegard.org',
  company: { name: 'Romaguera-Crona', catchPhrase: 'Multi-layered client-server neural-net', bs: 'harness real-time e-markets' },
};
const comment = { postId: 1, id: 1, name: 'id labore ex et quam laborum', email: 'Eliseo@gardner.biz', body: 'laudantium enim quasi est quidem magnam voluptate ipsam eos' };
const todo = { userId: 1, id: 1, title: 'delectus aut autem', completed: false };

const postId = { $ref: '#/components/parameters/PostId' };
const notFound = { $ref: '#/components/responses/NotFound' };
const json = (schema: unknown, example: unknown) => ({ 'application/json': { schema, example } });
const httpbin = [{ url: 'https://httpbin.org', description: 'httpbin' }];
const echo = { description: 'O httpbin devolve o que recebeu.', content: json({ $ref: '#/components/schemas/Echo' }, { args: {}, headers: { Host: 'httpbin.org' }, url: 'https://httpbin.org/anything' }) };

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'JSONPlaceholder',
    version: '1.0',
    summary: 'API REST falsa e gratuita para testes e protótipos: posts, comentários, usuários e tarefas.',
    description: `O JSONPlaceholder segue o padrão REST: cada recurso tem uma URL própria e as respostas são JSON. Não é preciso chave nem cadastro, e a API aceita chamadas direto do navegador.

## Primeiros passos

:::steps
1. Escolha um recurso

   São seis: \`/posts\`, \`/comments\`, \`/albums\`, \`/photos\`, \`/todos\` e \`/users\`. Os exemplos abaixo usam posts.

2. Faça a primeira requisição

   :::code-group
   \`\`\`bash [cURL]
   curl https://jsonplaceholder.typicode.com/posts/1
   \`\`\`
   \`\`\`javascript [JavaScript]
   const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
   const post = await response.json();
   \`\`\`
   \`\`\`python [Python]
   import requests

   post = requests.get("https://jsonplaceholder.typicode.com/posts/1").json()
   \`\`\`
   :::

3. Leia a resposta

   O corpo é o post em JSON, com \`id\`, \`userId\`, \`title\` e \`body\`. Os recursos se relacionam por id, e rotas aninhadas como \`/posts/1/comments\` trazem os filhos de um recurso.
:::

:::warning Escritas simuladas
\`POST\`, \`PUT\`, \`PATCH\` e \`DELETE\` respondem como se tivessem funcionado, mas nada é salvo: buscar o recurso de novo devolve o dado original.
:::

Para continuar:

:::cards
- [Listar posts](#list-posts) Os 100 posts, com filtro por usuário.
- [Criar post](#create-post) Corpo em JSON ou formulário, com callback.
- [Enviar arquivo](#upload-file) Upload com multipart, testado no httpbin.
- [Usuários](#list-users) Os 10 autores, com endereço e empresa.
:::

## Como funciona

Cada chamada é uma ida e volta HTTP: o seu código pede um recurso e a API responde com JSON. Clique na imagem para ampliar.

![Ciclo de uma requisição: o app envia GET /posts/1 e o JSONPlaceholder responde 200 com o post em JSON](/guia/ciclo-da-requisicao.svg)

O mesmo fluxo, quando o post tem comentários:

\`\`\`mermaid
sequenceDiagram
    participant App as Seu app
    participant API as JSONPlaceholder
    App->>API: GET /posts/1
    API-->>App: 200 · post
    App->>API: GET /posts/1/comments
    API-->>App: 200 · lista de comentários
\`\`\`

Em vídeo:

![Animação do ciclo de uma requisição](/guia/ciclo-da-requisicao.mp4)

## Filtros

Listagens aceitam qualquer campo do recurso como filtro na query string:

:::tabs
@tab Por usuário
\`/posts?userId=1\` devolve só os posts do usuário 1.

\`\`\`bash
curl "https://jsonplaceholder.typicode.com/posts?userId=1"
\`\`\`
@tab Por status
\`/todos?completed=false\` devolve só as tarefas pendentes.

\`\`\`bash
curl "https://jsonplaceholder.typicode.com/todos?completed=false"
\`\`\`
@tab Combinados
Filtros se somam: \`/todos?userId=1&completed=true\` traz as tarefas concluídas do usuário 1.
:::

| Recurso | Total | Relacionado a |
| --- | --- | --- |
| \`/posts\` | 100 | \`userId\` |
| \`/comments\` | 500 | \`postId\` |
| \`/users\` | 10 | |
| \`/todos\` | 200 | \`userId\` |

> [!TIP]
> Use \`_limit\` para paginar: \`/posts?_limit=10\` devolve só os 10 primeiros.

## Rodar localmente

O JSONPlaceholder é feito com o json-server, que dá para rodar na sua máquina com os seus próprios dados:

:::code-group
\`\`\`bash [npm]
npx json-server db.json
\`\`\`
\`\`\`bash [pnpm]
pnpm dlx json-server db.json
\`\`\`
\`\`\`bash [yarn]
yarn dlx json-server db.json
\`\`\`
\`\`\`bash [bun]
bunx json-server db.json
\`\`\`
:::

:::note
Localmente as escritas são de verdade: o json-server grava as mudanças no \`db.json\`.
:::

## Erros

Um recurso que não existe devolve \`404\` com um objeto vazio (\`{}\`) no corpo.

:::danger Não use em produção
A API é pública e os dados são falsos. Ela serve para testes, protótipos e tutoriais, não para guardar dados de verdade.
:::

:::details Por que o post que criei não aparece na listagem?
Porque as escritas são simuladas: a resposta do \`POST\` traz o post com \`id\` 101, mas nada é gravado.
:::

:::details O que fazer quando a requisição falha no navegador?
Confira a conexão e o endereço. Se o servidor de destino não liberar CORS, copie o cURL do cliente e teste no terminal.
:::`,
  },
  servers: [
    {
      url: 'https://{host}',
      description: 'Produção',
      variables: {
        host: {
          default: 'jsonplaceholder.typicode.com',
          enum: ['jsonplaceholder.typicode.com', 'dummyjson.com'],
          description: 'O JSONPlaceholder, ou o DummyJSON, outra API de teste com os mesmos recursos (leituras iguais; os campos variam um pouco).',
        },
      },
    },
  ],
  tags: [
    { name: 'Posts', description: 'Publicações dos usuários. É o único recurso com todas as operações de escrita documentadas aqui.' },
    { name: 'Comentários', description: 'Comentários feitos em cada post.' },
    { name: 'Usuários', description: 'Os 10 usuários de exemplo, com endereço e empresa.' },
    { name: 'Tarefas', description: 'Listas de tarefas dos usuários.' },
    { name: 'Testes de HTTP', description: 'Autenticação, upload e respostas que não são JSON, no [httpbin.org](https://httpbin.org): ele aceita qualquer credencial e devolve o que recebeu.' },
  ],
  paths: {
    '/posts': {
      get: {
        tags: ['Posts'],
        operationId: 'listPosts',
        summary: 'Listar posts',
        description: 'Lista os posts. Filtre pelo autor com `userId`.',
        parameters: [{ name: 'userId', in: 'query', description: 'Só os posts deste usuário.', schema: { type: 'integer', example: 1 } }],
        responses: {
          200: { description: 'Os posts.', content: json({ type: 'array', items: { $ref: '#/components/schemas/Post' } }, [post, { ...post, id: 2, title: 'qui est esse' }]) },
        },
      },
      post: {
        tags: ['Posts'],
        operationId: 'createPost',
        summary: 'Criar post',
        description: 'Cria um post. A resposta traz o post com o `id` 101, mas nada é salvo de verdade.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PostInput' },
              examples: {
                curto: { summary: 'Post curto', value: { title: 'Meu primeiro post', body: 'Escrito pela documentação.', userId: 1 } },
                longo: { summary: 'Post com várias linhas', value: { title: 'Notas da semana', body: 'Primeira linha.\nSegunda linha.\nTerceira linha.', userId: 2 } },
              },
            },
            'application/x-www-form-urlencoded': { schema: { $ref: '#/components/schemas/PostInput' } },
          },
        },
        responses: {
          201: { description: 'Post criado (simulado).', content: json({ $ref: '#/components/schemas/Post' }, { id: 101, title: 'Meu primeiro post', body: 'Escrito pela documentação.', userId: 1 }) },
        },
        callbacks: {
          postPublicado: {
            '{$request.body#/callbackUrl}': {
              post: {
                summary: 'Post publicado',
                description: 'Chamado na `callbackUrl` enviada quando o post fica público. Exemplo de documentação: o JSONPlaceholder não chama de volta.',
                requestBody: { content: json({ $ref: '#/components/schemas/PostCreated' }, { type: 'post.created', post: { ...post, id: 101 } }) },
                responses: { 204: { description: 'Recebido. Responda rápido; o corpo é ignorado.' } },
              },
            },
          },
        },
      },
    },
    '/posts/{id}': {
      get: {
        tags: ['Posts'],
        operationId: 'getPost',
        summary: 'Consultar post',
        description: 'Retorna um post pelo id (de 1 a 100). Com `_embed=comments`, traz também os comentários.',
        parameters: [postId, { name: '_embed', in: 'query', description: 'Inclui um recurso filho.', schema: { type: 'string', enum: ['comments'] } }],
        responses: {
          200: {
            description: 'O post.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Post' },
                examples: {
                  simples: { summary: 'Só o post', value: post },
                  comComentarios: { summary: 'Com _embed=comments', value: { ...post, comments: [comment] } },
                },
              },
            },
          },
          404: notFound,
        },
      },
      put: {
        tags: ['Posts'],
        operationId: 'replacePost',
        summary: 'Substituir post',
        description: 'Substitui o post inteiro. Campos omitidos deixam de existir na resposta.',
        parameters: [postId],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PostInput' } } } },
        responses: { 200: { description: 'Post substituído (simulado).', content: json({ $ref: '#/components/schemas/Post' }, { id: 1, title: 'Título novo', body: 'Corpo novo.', userId: 1 }) } },
      },
      patch: {
        tags: ['Posts'],
        operationId: 'updatePost',
        summary: 'Atualizar post',
        description: 'Altera só os campos enviados e mantém o resto.',
        parameters: [postId],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string', example: 'Só o título muda' }, body: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Post atualizado (simulado).', content: json({ $ref: '#/components/schemas/Post' }, { ...post, title: 'Só o título muda' }) } },
      },
      delete: {
        tags: ['Posts'],
        operationId: 'deletePost',
        summary: 'Remover post',
        description: 'Remove o post. A resposta é um objeto vazio; nada é removido de verdade.',
        parameters: [postId],
        responses: { 200: { description: 'Post removido (simulado).', content: json({ type: 'object' }, {}) } },
      },
    },
    '/posts/{id}/comments': {
      get: {
        tags: ['Comentários'],
        operationId: 'listPostComments',
        summary: 'Listar comentários de um post',
        description: 'Retorna os comentários do post. Equivale a `/comments?postId={id}`.',
        parameters: [postId],
        responses: { 200: { description: 'Os comentários.', content: json({ type: 'array', items: { $ref: '#/components/schemas/Comment' } }, [comment]) } },
      },
    },
    '/comments': {
      get: {
        tags: ['Comentários'],
        operationId: 'listComments',
        summary: 'Listar comentários',
        description: 'Lista os comentários. Filtre pelo post com `postId` ou pelo autor com `email`.',
        'x-ratelimit': '100 requisições por minuto',
        parameters: [
          { name: '_expand', in: 'query', description: 'Inclui o recurso pai.', schema: { type: 'string', enum: ['post'] } },
          { name: 'postId', in: 'query', description: 'Só os comentários deste post.', schema: { type: 'integer', example: 1 } },
          { name: 'email', in: 'query', description: 'Só os comentários deste e-mail.', schema: { type: 'string', format: 'email' } },
        ],
        responses: { 200: { description: 'Os comentários.', content: json({ type: 'array', items: { $ref: '#/components/schemas/Comment' } }, [comment]) } },
      },
    },
    '/users': {
      get: {
        tags: ['Usuários'],
        operationId: 'listUsers',
        summary: 'Listar usuários',
        description: 'Lista os 10 usuários.',
        parameters: [{ name: 'username', in: 'query', description: 'Filtra pelo nome de usuário exato.', schema: { type: 'string' } }],
        responses: { 200: { description: 'Os usuários.', content: json({ type: 'array', items: { $ref: '#/components/schemas/User' } }, [user]) } },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Usuários'],
        operationId: 'getUser',
        summary: 'Consultar usuário',
        description: 'Retorna um usuário pelo id (de 1 a 10), com endereço e empresa.',
        parameters: [{ name: 'id', in: 'path', required: true, description: 'Id do usuário.', schema: { type: 'integer', minimum: 1, maximum: 10, example: 1 } }],
        responses: { 200: { description: 'O usuário.', content: json({ $ref: '#/components/schemas/User' }, user) }, 404: notFound },
      },
    },
    '/todos': {
      get: {
        tags: ['Tarefas'],
        operationId: 'listTodos',
        summary: 'Listar tarefas',
        description: 'Lista as tarefas. Filtre pelo dono com `userId` e pelo status com `completed`.',
        parameters: [
          { name: 'userId', in: 'query', description: 'Só as tarefas deste usuário.', schema: { type: 'integer', example: 1 } },
          { name: 'completed', in: 'query', description: 'true para concluídas, false para pendentes.', schema: { type: 'boolean' } },
        ],
        responses: { 200: { description: 'As tarefas.', content: json({ type: 'array', items: { $ref: '#/components/schemas/Todo' } }, [todo, { ...todo, id: 2, title: 'quis ut nam facilis et officia qui' }]) } },
      },
    },
    '/bearer': {
      get: {
        tags: ['Testes de HTTP'],
        operationId: 'checkBearer',
        summary: 'Token Bearer',
        description: 'Aceita qualquer token no cabeçalho `Authorization: Bearer …` e devolve qual chegou.',
        servers: httpbin,
        security: [{ bearerAuth: [] }, { oauth: ['posts:read'] }],
        'x-badges': [{ name: 'Beta' }],
        responses: {
          200: { description: 'Token aceito.', content: json({ type: 'object', properties: { authenticated: { type: 'boolean' }, token: { type: 'string' } } }, { authenticated: true, token: 'meu-token' }) },
          401: { description: 'Sem token.' },
        },
      },
    },
    '/basic-auth/{user}/{passwd}': {
      get: {
        tags: ['Testes de HTTP'],
        operationId: 'checkBasic',
        summary: 'Usuário e senha',
        description: 'Autenticação HTTP Basic: aceita só o usuário e a senha que estão no caminho.',
        servers: httpbin,
        security: [{ basicAuth: [] }],
        parameters: [
          { name: 'user', in: 'path', required: true, description: 'Usuário esperado.', schema: { type: 'string', example: 'ana' } },
          { name: 'passwd', in: 'path', required: true, description: 'Senha esperada.', schema: { type: 'string', example: 'segredo' } },
        ],
        responses: {
          200: { description: 'Credenciais corretas.', content: json({ type: 'object', properties: { authenticated: { type: 'boolean' }, user: { type: 'string' } } }, { authenticated: true, user: 'ana' }) },
          401: { description: 'Credenciais erradas.' },
        },
      },
    },
    '/anything': {
      get: {
        tags: ['Testes de HTTP'],
        operationId: 'apiKeyEcho',
        summary: 'Chave de API',
        description: 'Aceita a chave no cabeçalho `X-API-Key` ou na query `api_key`, e devolve a requisição para você ver onde ela chegou.',
        servers: httpbin,
        security: [{ apiKeyHeader: [] }, { apiKeyQuery: [] }],
        responses: { 200: echo },
      },
      post: {
        tags: ['Testes de HTTP'],
        operationId: 'uploadFile',
        summary: 'Enviar arquivo',
        description: 'Upload com `multipart/form-data`. Também aceita XML. O httpbin devolve os campos e o arquivo recebidos.',
        servers: httpbin,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['arquivo'],
                properties: {
                  titulo: { type: 'string', description: 'Nome para o arquivo.', example: 'Relatório' },
                  arquivo: { type: 'string', format: 'binary', description: 'O arquivo.' },
                },
              },
            },
            'application/xml': {
              schema: { type: 'string' },
              examples: {
                nota: { summary: 'Uma nota', value: '<nota>\n  <titulo>Relatório</titulo>\n  <texto>Enviado em XML.</texto>\n</nota>' },
              },
            },
          },
        },
        responses: { 200: echo },
      },
    },
    '/image/png': {
      get: {
        tags: ['Testes de HTTP'],
        operationId: 'getImage',
        summary: 'Imagem',
        description: 'Responde com uma imagem PNG.',
        servers: httpbin,
        responses: { 200: { description: 'A imagem.', content: { 'image/png': { schema: { type: 'string', format: 'binary' } } } } },
      },
    },
    '/robots.txt': {
      get: {
        tags: ['Testes de HTTP'],
        operationId: 'getText',
        summary: 'Texto',
        description: 'Responde com texto simples.',
        servers: httpbin,
        responses: { 200: { description: 'O texto.', content: { 'text/plain': { schema: { type: 'string' }, example: 'User-agent: *\nDisallow: /deny\n' } } } },
      },
    },
    '/xml': {
      get: {
        tags: ['Testes de HTTP'],
        operationId: 'getXml',
        summary: 'XML',
        description: 'Responde com um documento XML.',
        servers: httpbin,
        responses: { 200: { description: 'O documento.', content: { 'application/xml': { schema: { type: 'string' }, example: '<?xml version="1.0"?>\n<slideshow title="Sample Slide Show">…</slideshow>' } } } },
      },
    },
    '/bytes/{n}': {
      get: {
        tags: ['Testes de HTTP'],
        operationId: 'downloadBytes',
        summary: 'Baixar arquivo',
        description: 'Responde com `n` bytes aleatórios, como um arquivo para baixar.',
        servers: httpbin,
        parameters: [{ name: 'n', in: 'path', required: true, description: 'Tamanho em bytes (até 100 kB).', schema: { type: 'integer', minimum: 1, maximum: 102400, example: 1024 } }],
        responses: { 200: { description: 'O arquivo.', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } } },
      },
    },
  },
  webhooks: {
    eventoDePost: {
      post: {
        summary: 'Evento de post',
        description: 'Enviado para a URL cadastrada no painel quando um post é criado ou removido. O campo `type` diz qual evento chegou. Exemplo de documentação: o JSONPlaceholder não envia webhooks.',
        'x-badges': [{ name: 'Beta' }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PostEvent' },
              examples: {
                criado: { summary: 'post.created', value: { type: 'post.created', post } },
                removido: { summary: 'post.deleted', value: { type: 'post.deleted', postId: 1 } },
              },
            },
          },
        },
        responses: { 200: { description: 'Recebido. Qualquer resposta 2xx confirma a entrega; outras são reenviadas.' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'token', description: 'Token no cabeçalho Authorization.' },
      basicAuth: { type: 'http', scheme: 'basic', description: 'Usuário e senha (HTTP Basic).' },
      apiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'Chave no cabeçalho X-API-Key.' },
      apiKeyQuery: { type: 'apiKey', in: 'query', name: 'api_key', description: 'Chave no parâmetro api_key da URL.' },
      oauth: {
        type: 'oauth2',
        description: 'OAuth 2.0. Exemplo de documentação: as URLs abaixo são fictícias, então cole um token qualquer.',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://auth.exemplo.dev/authorize',
            tokenUrl: 'https://auth.exemplo.dev/token',
            scopes: { 'posts:read': 'Ler posts', 'posts:write': 'Criar e editar posts' },
          },
          clientCredentials: {
            tokenUrl: 'https://auth.exemplo.dev/token',
            scopes: { 'posts:read': 'Ler posts' },
          },
        },
      },
    },
    parameters: {
      PostId: { name: 'id', in: 'path', required: true, description: 'Id do post.', schema: { type: 'integer', minimum: 1, maximum: 100, example: 1 } },
    },
    responses: {
      NotFound: { description: 'O recurso não existe.', content: json({ type: 'object' }, {}) },
    },
    schemas: {
      Post: {
        description: 'Um post: os campos de PostInput mais o id.',
        allOf: [
          { $ref: '#/components/schemas/PostInput' },
          {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'integer', readOnly: true, example: 1 },
              comments: { type: 'array', description: 'Só com `_embed=comments`.', items: { $ref: '#/components/schemas/Comment' } },
            },
          },
        ],
      },
      PostInput: {
        type: 'object',
        required: ['title', 'body', 'userId'],
        properties: {
          title: { type: 'string', description: 'Título do post.', example: 'Meu primeiro post' },
          body: { type: 'string', description: 'Texto do post.', example: 'Escrito pela documentação.' },
          userId: { type: 'integer', description: 'Autor do post (de 1 a 10).', minimum: 1, maximum: 10, example: 1 },
          callbackUrl: { type: 'string', format: 'uri', description: 'Onde avisar quando o post for publicado (veja Callbacks).' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          postId: { type: 'integer', description: 'Post comentado.' },
          name: { type: 'string', description: 'Título do comentário.' },
          email: { type: 'string', format: 'email', description: 'E-mail de quem comentou.' },
          body: { type: 'string' },
          post: { $ref: '#/components/schemas/Post', description: 'Só com `_expand=post`.' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              suite: { type: 'string' },
              city: { type: 'string' },
              zipcode: { type: 'string' },
              geo: { type: 'object', properties: { lat: { type: 'string' }, lng: { type: 'string' } } },
            },
          },
          phone: { type: 'string' },
          website: { type: 'string' },
          company: { type: 'object', properties: { name: { type: 'string' }, catchPhrase: { type: 'string' }, bs: { type: 'string' } } },
        },
      },
      Todo: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          userId: { type: 'integer', description: 'Dono da tarefa.' },
          title: { type: 'string' },
          completed: { type: 'boolean' },
        },
      },
      PostEvent: {
        description: 'Evento de post. O campo `type` diz qual dos formatos chegou.',
        oneOf: [{ $ref: '#/components/schemas/PostCreated' }, { $ref: '#/components/schemas/PostDeleted' }],
        discriminator: { propertyName: 'type', mapping: { 'post.created': '#/components/schemas/PostCreated', 'post.deleted': '#/components/schemas/PostDeleted' } },
      },
      PostCreated: {
        type: 'object',
        required: ['type', 'post'],
        properties: {
          type: { type: 'string', enum: ['post.created'] },
          post: { $ref: '#/components/schemas/Post' },
        },
      },
      PostDeleted: {
        type: 'object',
        required: ['type', 'postId'],
        properties: {
          type: { type: 'string', enum: ['post.deleted'] },
          postId: { type: 'integer', description: 'Id do post removido.' },
        },
      },
      ResourceRef: {
        description: 'Identifica um recurso pelo id numérico, pela URL, ou pelos dois.',
        anyOf: [
          { title: 'Por id', type: 'object', required: ['id'], properties: { id: { type: 'integer', example: 1 } } },
          { title: 'Por URL', type: 'object', required: ['url'], properties: { url: { type: 'string', format: 'uri', example: 'https://jsonplaceholder.typicode.com/posts/1' } } },
        ],
      },
      Echo: {
        type: 'object',
        description: 'A requisição como o httpbin a recebeu.',
        properties: {
          args: { type: 'object', description: 'Parâmetros da query.' },
          headers: { type: 'object', description: 'Cabeçalhos recebidos.' },
          form: { type: 'object', description: 'Campos de formulário.' },
          files: { type: 'object', description: 'Arquivos enviados.' },
          data: { type: 'string', description: 'Corpo bruto (XML, texto).' },
          url: { type: 'string', format: 'uri' },
        },
      },
    },
  },
};
