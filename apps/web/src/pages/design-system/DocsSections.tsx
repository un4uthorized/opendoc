import { useMemo } from 'react';
import {
  CodeBlock, CodeTabs, EndpointHeader, HeadingAnchor, Markdown, ResponsePanel, SchemaViewer, TableOfContents, markdownHeadings, type Schema,
} from '../../design-system';
import { Section, Specimen, type KeyboardRow } from './parts';

const openapiYaml = `openapi: 3.1.0
info:
  title: API de pagamentos
  version: 2.4.0
servers:
  - url: https://api.opendoc.dev/v1
paths:
  /charges/{charge_id}/refunds:
    post:
      summary: Criar reembolso
      operationId: createRefund`;

const requestExamples = [
  { language: 'bash', code: `curl -X POST https://api.opendoc.dev/v1/charges/ch_8f2a/refunds \\\n  -H "Authorization: Bearer $OPENDOC_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{ "amount": 5000, "reason": "requested_by_customer" }'` },
  { language: 'javascript', code: `const refund = await fetch('https://api.opendoc.dev/v1/charges/ch_8f2a/refunds', {\n  method: 'POST',\n  headers: {\n    Authorization: \`Bearer \${process.env.OPENDOC_TOKEN}\`,\n    'Content-Type': 'application/json',\n  },\n  body: JSON.stringify({ amount: 5000, reason: 'requested_by_customer' }),\n}).then((response) => response.json());` },
  { language: 'python', code: `import os, requests\n\nrefund = requests.post(\n    "https://api.opendoc.dev/v1/charges/ch_8f2a/refunds",\n    headers={"Authorization": f"Bearer {os.environ['OPENDOC_TOKEN']}"},\n    json={"amount": 5000, "reason": "requested_by_customer"},\n).json()` },
  { language: 'go', code: `body := strings.NewReader(\`{"amount": 5000, "reason": "requested_by_customer"}\`)\nreq, _ := http.NewRequest("POST", "https://api.opendoc.dev/v1/charges/ch_8f2a/refunds", body)\nreq.Header.Set("Authorization", "Bearer "+os.Getenv("OPENDOC_TOKEN"))\nres, err := http.DefaultClient.Do(req)` },
];

const installExamples = [
  { language: 'bash', label: 'cURL', code: '# Nenhuma instalação: use o cURL do sistema\ncurl --version' },
  { language: 'javascript', syntax: 'bash', code: 'npm install @opendoc/payments' },
  { language: 'python', syntax: 'bash', code: 'pip install opendoc-payments' },
  { language: 'go', syntax: 'bash', code: 'go get github.com/opendoc/payments-go' },
];

const refundSchema: Schema = {
  type: 'object',
  required: ['amount'],
  properties: {
    amount: { type: 'integer', description: 'Valor a reembolsar, em centavos. Para reembolso total, use o valor da cobrança.', minimum: 1, example: 5000 },
    reason: { type: 'string', description: 'Motivo do reembolso, exibido no extrato do cliente.', enum: ['duplicate', 'fraudulent', 'requested_by_customer'], default: 'requested_by_customer' },
    metadata: {
      type: 'object',
      description: 'Pares chave-valor livres para a sua integração.',
      properties: {
        order_id: { type: 'string', description: 'Identificador do pedido no seu sistema.', maxLength: 64, example: 'ped_1029' },
        note: { type: 'string', nullable: true, description: 'Observação interna.' },
      },
    },
    notify_customer: { type: 'boolean', description: 'Envia um e-mail ao cliente quando o reembolso for concluído.', default: true },
    legacy_id: { type: 'string', deprecated: true, description: 'Use metadata.order_id.' },
  },
};

const refundResponseSchema: Schema = {
  type: 'object',
  required: ['id', 'status', 'amount', 'charge'],
  properties: {
    id: { type: 'string', readOnly: true, example: 're_3Kd9' },
    status: { type: 'string', enum: ['pending', 'succeeded', 'failed'] },
    amount: { type: 'integer', example: 5000 },
    created_at: { type: 'string', format: 'date-time' },
    charge: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'ch_8f2a' },
        currency: { type: 'string', enum: ['brl', 'usd', 'eur'] },
        customer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
  },
};

const guide = `## Antes de começar

Para criar reembolsos você precisa de uma chave com o escopo \`refunds:write\`. Gere a chave em **Configurações → Chaves de API** e guarde-a em uma variável de ambiente.

> Reembolsos parciais podem ser feitos até **180 dias** depois da cobrança. Depois disso, use uma transferência manual.

## Criar um reembolso

Envie o valor em centavos. Se o campo \`amount\` for omitido, a cobrança é reembolsada por completo.

\`\`\`bash
curl -X POST https://api.opendoc.dev/v1/charges/ch_8f2a/refunds \\
  -H "Authorization: Bearer $OPENDOC_TOKEN" \\
  -d amount=5000
\`\`\`

### Reembolsos parciais

Você pode fazer vários reembolsos parciais, desde que a soma não passe do valor original.

1. Consulte o saldo reembolsável da cobrança.
2. Crie o reembolso com o valor desejado.
3. Acompanhe o status pelo webhook \`refund.updated\`.

## Status do reembolso

| Status | Significado |
| --- | --- |
| \`pending\` | Em processamento pelo banco |
| \`succeeded\` | Valor devolvido ao cliente |
| \`failed\` | Recusado; veja \`failure_reason\` |

### Erros comuns

- **422**: o valor ultrapassa o saldo reembolsável.
- **404**: a cobrança não existe ou pertence a outra conta.

Dúvidas? Consulte a [referência completa](https://lucide.dev) ou fale com o suporte.`;

const keys = {
  codeTabs: [
    ['Tab', 'Vai para o seletor de linguagem, depois para o botão de copiar e então para o código'],
    ['Enter / Space / ↑ / ↓', 'Com o seletor focado, abre a lista de linguagens'],
    ['← / →', 'Com o código focado, rola linhas longas'],
  ] as KeyboardRow[],
  schema: [['Enter / Space', 'Mostra ou oculta as propriedades de um objeto aninhado']] as KeyboardRow[],
};

export function DocsSections() {
  const tocItems = useMemo(() => markdownHeadings(guide).map((item) => ({ ...item, id: `guia-${item.id}` })), []);
  return (
    <>
      <Section id="doc-codigo" eyebrow="Documentação" title="CodeBlock e Endpoint" description="Os blocos que aparecem em quase toda página da referência. Código com destaque de sintaxe nas cores dos tokens, botão de copiar com confirmação e área de rolagem acessível pelo teclado.">
        <Specimen
          title="CodeBlock"
          description="Com nome de arquivo, números de linha e linhas destacadas. O bloco é uma região nomeada e focável, então linhas longas podem ser roladas pelo teclado."
          layout="stack"
          code={`<CodeBlock code={yaml} language="yaml" filename="openapi.yaml" showLineNumbers highlightLines={[8, 9]} />`}
        >
          <CodeBlock code={openapiYaml} language="yaml" filename="openapi.yaml" showLineNumbers highlightLines={[8, 9]} />
        </Specimen>
        <Specimen
          title="CodeTabs"
          description={<>Um exemplo por linguagem, escolhida num select. Com o mesmo <code>syncKey</code>, todos os blocos da página trocam juntos e a escolha é lembrada. Troque a linguagem em um e veja o outro mudar.</>}
          layout="stack"
          keyboard={keys.codeTabs}
          code={`<CodeTabs syncKey="lang" examples={[\n  { language: 'bash', code: curl },\n  { language: 'javascript', code: js },\n]} />`}
        >
          <CodeTabs syncKey="lang" label="Exemplo de requisição" examples={requestExamples} />
          <CodeTabs syncKey="lang" label="Instalação" examples={installExamples} />
        </Specimen>
        <Specimen
          title="EndpointHeader"
          description="Método em texto e cor (a cor nunca é o único sinal), parâmetros do caminho destacados e botão para copiar a URL completa."
          layout="stack"
          stageClassName="dsp-endpoints"
          code={`<EndpointHeader\n  method="POST"\n  path="/v1/charges/{charge_id}/refunds"\n  baseUrl="https://api.opendoc.dev"\n  title="Criar reembolso"\n/>`}
        >
          <EndpointHeader
            method="POST"
            path="/v1/charges/{charge_id}/refunds"
            baseUrl="https://api.opendoc.dev"
            title="Criar reembolso"
            titleAs="h3"
            description="Devolve todo ou parte do valor de uma cobrança. O reembolso fica pendente até o banco confirmar."
          />
          <EndpointHeader
            method="GET"
            path="/v1/refunds/{refund_id}"
            baseUrl="https://api.opendoc.dev"
            title="Consultar reembolso"
            titleAs="h3"
            description="Retorna o status atual e o histórico de um reembolso."
          />
          <EndpointHeader method="DELETE" path="/v1/refunds/{refund_id}/legacy" baseUrl="https://api.opendoc.dev" title="Cancelar reembolso (v1)" titleAs="h3" description="Substituído por POST /v2/refunds/{refund_id}/cancel." deprecated />
        </Specimen>
      </Section>

      <Section id="doc-referencia" eyebrow="Documentação" title="Schema e respostas" description="O coração da referência: o corpo da requisição como árvore de campos e as respostas por código de status.">
        <Specimen
          title="SchemaViewer"
          description="Nome, tipo, obrigatoriedade, descrição, valores aceitos, padrão e regras. Objetos aninhados abrem com botões reais (aria-expanded), então a árvore é lida como listas aninhadas."
          layout="stack"
          keyboard={keys.schema}
          code={`<SchemaViewer schema={refundSchema} />`}
        >
          <SchemaViewer schema={refundSchema} />
        </Specimen>
        <Specimen
          title="ResponsePanel"
          description="Um select escolhe o código de status, mostrado com ponto de cor e o nome do status por extenso, então cabe qualquer quantidade de respostas. Cada resposta alterna entre o exemplo e o schema."
          layout="stack"
          code={`<ResponsePanel responses={[\n  { status: 201, description: 'Reembolso criado', example, schema },\n  { status: 422, description: 'Valor acima do saldo', example: error },\n]} />`}
        >
          <ResponsePanel
            responses={[
              { status: 201, description: 'Reembolso criado.', example: { id: 're_3Kd9', status: 'pending', amount: 5000, created_at: '2026-11-18T14:02:11Z', charge: { id: 'ch_8f2a', currency: 'brl' } }, schema: refundResponseSchema },
              { status: 400, description: 'Corpo inválido.', example: { error: { code: 'invalid_request', message: 'amount deve ser um inteiro positivo.' } } },
              { status: 404, description: 'Cobrança não encontrada.', example: { error: { code: 'not_found', message: 'Nenhuma cobrança com id ch_8f2a.' } } },
              { status: 422, description: 'Valor acima do saldo reembolsável.', example: { error: { code: 'amount_too_large', message: 'O saldo reembolsável é 3000.' } } },
              { status: 500, description: 'Erro interno. Tente de novo com a mesma chave de idempotência.' },
            ]}
          />
        </Specimen>
      </Section>

      <Section id="doc-leitura" eyebrow="Documentação" title="Prose e sumário" description="Guias escritos em Markdown, com tipografia para leitura longa e um sumário que acompanha a rolagem. O Markdown é renderizado sem HTML bruto, então conteúdo de usuários é seguro.">
        <Specimen
          title="Markdown, Prose e TableOfContents"
          description={<>Títulos ganham ids automaticamente; <code>markdownHeadings()</code> gera o sumário com os mesmos ids. O item lido fica marcado com <code>aria-current="location"</code>.</>}
          layout="stack"
          code={`const items = markdownHeadings(source);\n\n<Markdown source={source} />\n<TableOfContents items={items} />`}
        >
          <div className="dsp-guide">
            <article className="dsp-guide__article" aria-labelledby="dsp-guide-title">
              <HeadingAnchor id="dsp-guide-title" as="h3" className="dsp-guide__title">Reembolsos</HeadingAnchor>
              <Markdown source={guide} idPrefix="guia-" />
            </article>
            <aside className="dsp-guide__toc">
              <TableOfContents items={tocItems} rootMargin="-120px 0px -55% 0px" />
            </aside>
          </div>
        </Specimen>
      </Section>
    </>
  );
}
