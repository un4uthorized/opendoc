import { Fragment, memo, useMemo, type ReactNode } from 'react';
import { stringify } from 'yaml';
import {
  Badge, CodeBlock, EndpointHeader, Markdown, ResponsePanel, SchemaViewer, type ApiResponse, type HttpMethod, type Schema,
} from '../../../design-system';

/* Live preview of everything in the spec being edited, with the design-system pieces the
   documentation uses: info, servers, authentication, endpoints (parameters, bodies with examples,
   responses with headers, callbacks), webhooks, every component, and x- extensions. */

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;
const locations = [['path', 'Parâmetros de caminho'], ['query', 'Parâmetros de consulta'], ['header', 'Cabeçalhos'], ['cookie', 'Cookies']] as const;
type Location = (typeof locations)[number][0];

const isObject = (value: unknown): value is Json => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const toYaml = (value: unknown) => stringify(value, { lineWidth: 0 }).trimEnd();
const exampleCode = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));
const extensions = (object: Json) => Object.fromEntries(Object.entries(object).filter(([key]) => key.startsWith('x-')));

/** Follows local $refs; a $ref back to one being expanded is marked circular instead of looping. */
function resolver(doc: Json) {
  const resolve = (value: unknown, seen: string[] = []): any => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (Array.isArray(value)) return value.map((item) => resolve(item, seen));
    if (!isObject(value)) return value;
    if (typeof value.$ref === 'string') {
      const { $ref: ref, ...siblings } = value as { $ref: string } & Json;
      const name = ref.split('/').pop()!;
      if (seen.includes(ref)) return { 'x-circular': name, title: name };
      const target = ref.startsWith('#/') ? ref.slice(2).split('/').reduce<Json | undefined>((node, key) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], doc) : undefined;
      if (target === undefined) return { title: name, description: `Referência não encontrada: ${ref}` };
      const resolved = resolve(target, [...seen, ref]);
      const named = ref.startsWith('#/components/schemas/') && isObject(resolved) && !resolved.title ? { title: name } : {};
      return { ...named, ...resolved, ...resolve(siblings, seen) };
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolve(child, seen)]));
  };
  return resolve;
}

interface Example { name: string; summary?: string; description?: string; value: unknown }
interface Media { contentType: string; schema?: Schema; examples: Example[] }
interface Parameter { name: string; required: boolean; deprecated: boolean; description?: string; schema: Schema; examples: Example[] }
interface Response { status: string; description?: string; media: Media[]; headers: Parameter[]; links: string[] }
interface PreviewOperation {
  key: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  operationId?: string;
  deprecated: boolean;
  security?: Json[];
  servers: Json[];
  externalDocs?: Json;
  parameters: Record<Location, Parameter[]>;
  body?: { description?: string; required: boolean; media: Media[] };
  responses: Response[];
  callbacks: Array<{ name: string; operations: PreviewOperation[] }>;
  extensions: Json;
}

function examplesOf(raw: Json): Example[] {
  if (raw.example !== undefined) return [{ name: 'Exemplo', value: raw.example }];
  return Object.entries((raw.examples ?? {}) as Json).map(([name, example]) => (
    isObject(example) && ('value' in example || 'externalValue' in example)
      ? { name, summary: example.summary, description: example.description, value: example.value ?? example.externalValue }
      : { name, value: example }
  ));
}

const mediaOf = (content: unknown): Media[] => Object.entries(isObject(content) ? content : {}).map(([contentType, media]) => ({
  contentType, schema: (media as Json)?.schema, examples: isObject(media) ? examplesOf(media) : [],
}));

const parameterOf = (name: string, raw: Json): Parameter => ({
  name, required: Boolean(raw.required), deprecated: Boolean(raw.deprecated), description: raw.description,
  schema: (raw.schema ?? (isObject(raw.content) ? (Object.values(raw.content)[0] as Json)?.schema : undefined) ?? {}) as Schema,
  examples: examplesOf(raw),
});

function operationsOf(item: Json, path: string, keyPrefix: string, pathServers: Json[]): PreviewOperation[] {
  return methods.flatMap((method) => {
    const operation = item[method] as Json | undefined;
    if (!isObject(operation)) return [];
    const parameters: PreviewOperation['parameters'] = { path: [], query: [], header: [], cookie: [] };
    for (const parameter of [...(Array.isArray(item.parameters) ? item.parameters : []), ...(Array.isArray(operation.parameters) ? operation.parameters : [])] as Json[]) {
      const list = parameters[parameter?.in as Location];
      if (!list || !parameter.name) continue;
      const entry = parameterOf(String(parameter.name), parameter);
      const existing = list.findIndex((other) => other.name === entry.name);
      if (existing >= 0) list[existing] = entry; else list.push(entry);
    }
    const upper = method.toUpperCase() as HttpMethod;
    return [{
      key: `${keyPrefix}${upper} ${path}`,
      method: upper,
      path,
      summary: operation.summary ?? item.summary,
      description: operation.description ?? item.description,
      operationId: operation.operationId,
      deprecated: Boolean(operation.deprecated),
      security: Array.isArray(operation.security) ? operation.security : undefined,
      servers: Array.isArray(operation.servers) ? operation.servers : pathServers,
      externalDocs: operation.externalDocs,
      parameters,
      body: isObject(operation.requestBody)
        ? { description: operation.requestBody.description, required: Boolean(operation.requestBody.required), media: mediaOf(operation.requestBody.content) }
        : undefined,
      responses: Object.entries(isObject(operation.responses) ? operation.responses : {}).map(([status, response]) => ({
        status,
        description: (response as Json)?.description,
        media: mediaOf((response as Json)?.content),
        headers: Object.entries(((response as Json)?.headers ?? {}) as Json).map(([name, header]) => parameterOf(name, header)),
        links: Object.keys(((response as Json)?.links ?? {}) as Json),
      })),
      callbacks: Object.entries(isObject(operation.callbacks) ? operation.callbacks : {}).map(([name, callback]) => ({
        name,
        operations: Object.entries(isObject(callback) ? callback : {}).flatMap(([expression, callbackItem]) => (
          isObject(callbackItem) ? operationsOf(callbackItem, expression, `callback:${name}:`, []) : []
        )),
      })),
      extensions: extensions(operation),
    }];
  });
}

const known = new Set(['openapi', 'info', 'jsonSchemaDialect', 'servers', 'paths', 'webhooks', 'components', 'security', 'tags', 'externalDocs']);
const componentTitles: Record<string, string> = {
  responses: 'Respostas', parameters: 'Parâmetros', examples: 'Exemplos', requestBodies: 'Corpos de requisição',
  headers: 'Cabeçalhos', links: 'Links', callbacks: 'Callbacks', pathItems: 'Path items',
};

function build(doc: Json) {
  const resolve = resolver(doc);
  const servers = (Array.isArray(doc.servers) ? doc.servers : []) as Json[];
  const groups = new Map<string, PreviewOperation[]>();
  for (const [path, rawItem] of Object.entries(isObject(doc.paths) ? doc.paths : {})) {
    const item = resolve(rawItem) as Json;
    if (!isObject(item)) continue;
    for (const operation of operationsOf(item, path, 'endpoint:', Array.isArray(item.servers) ? item.servers : [])) {
      const tags = (item[operation.method.toLowerCase()] as Json).tags;
      const tag = Array.isArray(tags) && tags[0] ? String(tags[0]) : 'Sem grupo';
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag)!.push(operation);
    }
  }
  const webhooks = Object.entries(isObject(doc.webhooks) ? doc.webhooks : {}).flatMap(([name, item]) => {
    const resolved = resolve(item) as Json;
    return isObject(resolved) ? operationsOf(resolved, name, 'webhook:', []) : [];
  });
  const tagInfo = new Map(((Array.isArray(doc.tags) ? doc.tags : []) as Json[]).map((tag) => [String(tag.name), tag]));
  // Tags in the order the spec lists them (even without endpoints), then the rest as they appear.
  const order = [...tagInfo.keys(), ...groups.keys()].filter((tag, index, all) => all.indexOf(tag) === index);
  const components = (isObject(doc.components) ? doc.components : {}) as Json;
  const models = Object.keys(isObject(components.schemas) ? components.schemas : {}).map((name) => ({ name, schema: resolve({ $ref: `#/components/schemas/${name}` }) as Schema }));
  const otherComponents = Object.entries(components)
    .filter(([section, entries]) => section !== 'schemas' && section !== 'securitySchemes' && isObject(entries) && Object.keys(entries).length > 0)
    .map(([section, entries]) => ({ section, entries: Object.entries(entries as Json) }));
  return {
    servers,
    serverUrl: typeof servers[0]?.url === 'string' ? (servers[0].url as string).replace(/\/$/, '') : '',
    securitySchemes: Object.entries((isObject(components.securitySchemes) ? components.securitySchemes : {}) as Json),
    security: Array.isArray(doc.security) ? (doc.security as Json[]) : [],
    tags: order.map((name) => ({ name, info: tagInfo.get(name), operations: groups.get(name) ?? [] })),
    webhooks,
    models,
    otherComponents,
    unknown: Object.fromEntries(Object.entries(doc).filter(([key]) => !known.has(key))),
  };
}

/* ── Pieces ─────────────────────────────────────────────────────────── */

const parametersSchema = (list: Parameter[]): Schema => ({
  type: 'object',
  required: list.filter((parameter) => parameter.required).map((parameter) => parameter.name),
  properties: Object.fromEntries(list.map((parameter) => [parameter.name, {
    ...parameter.schema,
    description: parameter.description ?? parameter.schema.description,
    ...(parameter.deprecated ? { deprecated: true } : {}),
    ...(parameter.examples[0] && parameter.schema.example === undefined ? { example: parameter.examples[0].value } : {}),
  }])),
});

function Block({ title, meta, children }: { title: ReactNode; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="api-preview__block">
      <h4 className="api-preview__block-title">{title}{meta && <span className="api-preview__meta">{meta}</span>}</h4>
      {children}
    </div>
  );
}

function Examples({ examples, contentType }: { examples: Example[]; contentType?: string }) {
  const language = contentType && /xml/.test(contentType) ? 'xml' : 'json';
  return examples.map((example) => (
    <Fragment key={example.name}>
      {(example.summary || example.description) && <p className="api-preview__note">{[example.summary, example.description].filter(Boolean).join(' — ')}</p>}
      <CodeBlock code={exampleCode(example.value)} language={typeof example.value === 'string' ? undefined : language} filename={examples.length > 1 || example.name !== 'Exemplo' ? example.name : contentType} />
    </Fragment>
  ));
}

function MediaBlocks({ media, title }: { media: Media[]; title: string }) {
  return media.map((item) => (
    <Block key={item.contentType} title={title} meta={item.contentType}>
      {item.schema ? <SchemaViewer schema={item.schema} /> : <p className="admin-muted">Sem schema.</p>}
      <Examples examples={item.examples} contentType={item.contentType} />
    </Block>
  ));
}

function Requirements({ security }: { security: Json[] }) {
  if (security.length === 0) return <p className="api-preview__note">Sem autenticação.</p>;
  return (
    <ul className="api-preview__list">
      {security.map((requirement, index) => (
        <li key={index}>
          {Object.keys(requirement).length === 0 ? 'Sem autenticação (opcional)' : Object.entries(requirement).map(([name, scopes]) => (
            <span key={name}><code>{name}</code>{Array.isArray(scopes) && scopes.length > 0 && <span className="api-preview__meta"> {scopes.join(', ')}</span>} </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

function Servers({ servers }: { servers: Json[] }) {
  return (
    <ul className="api-preview__list">
      {servers.map((server, index) => (
        <li key={index}>
          <code>{String(server.url ?? '')}</code>{server.description && <span className="api-preview__note"> — {String(server.description)}</span>}
          {isObject(server.variables) && (
            <ul className="api-preview__list">
              {Object.entries(server.variables).map(([name, variable]) => (
                <li key={name}>
                  <code>{`{${name}}`}</code> padrão <code>{String((variable as Json).default ?? '')}</code>
                  {Array.isArray((variable as Json).enum) && <span className="api-preview__meta"> ({((variable as Json).enum as unknown[]).join(', ')})</span>}
                  {(variable as Json).description && <span className="api-preview__note"> — {String((variable as Json).description)}</span>}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function Extensions({ value }: { value: Json }) {
  if (Object.keys(value).length === 0) return null;
  return <Block title="Extensões"><CodeBlock code={toYaml(value)} language="yaml" bare /></Block>;
}

const numeric = (status: string) => /^\d{3}$/.test(status);

const Operation = memo(function Operation({ operation, server }: { operation: PreviewOperation; server: string }) {
  // Non-numeric codes (default, 2XX) get placeholder numbers so the select can tell them apart;
  // their real code goes in front of the description.
  const responses: ApiResponse[] = operation.responses.map((response, index) => ({
    status: numeric(response.status) ? Number(response.status) : 900 + index,
    description: numeric(response.status) ? response.description : `(${response.status}) ${response.description ?? ''}`,
    contentType: response.media[0]?.contentType,
    schema: response.media[0]?.schema,
    example: response.media[0]?.examples[0]?.value,
    examples: (response.media[0]?.examples.length ?? 0) > 1 ? response.media[0]!.examples : undefined,
  }));
  return (
    <section className="api-preview__operation" data-preview-key={operation.key}>
      <EndpointHeader method={operation.method} path={operation.path} baseUrl={server} showBaseUrl={false} title={operation.summary || `${operation.method} ${operation.path}`} deprecated={operation.deprecated} titleAs="h3" />
      {operation.operationId && <p className="api-preview__meta">operationId: {operation.operationId}</p>}
      {operation.description && <Markdown className="api-preview__description" source={operation.description} />}
      {operation.externalDocs?.url && <p className="api-preview__note"><a href={String(operation.externalDocs.url)} target="_blank" rel="noreferrer">{String(operation.externalDocs.description ?? operation.externalDocs.url)}</a></p>}
      {operation.servers.length > 0 && <Block title="Servidores"><Servers servers={operation.servers} /></Block>}
      {operation.security && <Block title="Autenticação"><Requirements security={operation.security} /></Block>}
      {locations.map(([location, title]) => operation.parameters[location].length > 0 && (
        <Block key={location} title={title}><SchemaViewer schema={parametersSchema(operation.parameters[location])} /></Block>
      ))}
      {operation.body && (
        <>
          {operation.body.description && <p className="api-preview__note">{operation.body.description}</p>}
          <MediaBlocks media={operation.body.media} title={`Corpo da requisição${operation.body.required ? '' : ' (opcional)'}`} />
        </>
      )}
      {responses.length > 0 && <div className="api-preview__block"><ResponsePanel responses={responses} label="Respostas" /></div>}
      {operation.responses.map((response) => (
        <Fragment key={response.status}>
          {response.headers.length > 0 && <Block title={`Cabeçalhos da resposta ${response.status}`}><SchemaViewer schema={parametersSchema(response.headers)} /></Block>}
          {response.media.length > 1 && <MediaBlocks media={response.media.slice(1)} title={`Resposta ${response.status}`} />}
          {response.links.length > 0 && <Block title={`Links da resposta ${response.status}`}><p className="api-preview__note">{response.links.join(', ')}</p></Block>}
        </Fragment>
      ))}
      {operation.callbacks.map((callback) => (
        <Block key={callback.name} title="Callback" meta={callback.name}>
          {callback.operations.map((child) => <Operation key={child.key} operation={child} server="" />)}
        </Block>
      ))}
      <Extensions value={operation.extensions} />
    </section>
  );
});

/* ── Preview ────────────────────────────────────────────────────────── */

/** Renders the last spec that parsed; `stale` says the editor currently has syntax errors. */
export function SpecPreview({ value, stale }: { value: unknown; stale: boolean }) {
  const doc = (isObject(value) ? value : {}) as Json;
  const data = useMemo(() => build(doc), [doc]);
  const info = (isObject(doc.info) ? doc.info : {}) as Json;

  const empty = data.tags.every((tag) => tag.operations.length === 0) && data.webhooks.length === 0 && data.models.length === 0;
  const infoExtras = [
    info.termsOfService && <a key="terms" href={String(info.termsOfService)} target="_blank" rel="noreferrer">Termos de uso</a>,
    isObject(info.contact) && <span key="contact">Contato: {[info.contact.name, info.contact.email, info.contact.url].filter(Boolean).join(' · ')}</span>,
    isObject(info.license) && <span key="license">Licença: {String(info.license.name ?? '')}{info.license.identifier ? ` (${info.license.identifier})` : ''}</span>,
    isObject(doc.externalDocs) && doc.externalDocs.url && <a key="docs" href={String(doc.externalDocs.url)} target="_blank" rel="noreferrer">{String(doc.externalDocs.description ?? doc.externalDocs.url)}</a>,
  ].filter(Boolean);

  return (
    <section className="api-preview" aria-label="Pré-visualização da spec">
      <p className="api-preview__label">Pré-visualização{stale && <span className="api-preview__stale"> · última versão válida</span>}</p>
      <header className="api-preview__info" data-preview-key="info">
        <h2 className="api-preview__title">
          {info.title || 'Sem título'}
          {info.version && <Badge variant="secondary">{String(info.version)}</Badge>}
          {doc.openapi && <Badge variant="outline">OpenAPI {String(doc.openapi)}</Badge>}
        </h2>
        {info.summary && <p className="api-preview__summary">{String(info.summary)}</p>}
        {info.description && <Markdown className="api-preview__description" source={String(info.description)} />}
        {infoExtras.length > 0 && <p className="api-preview__note api-preview__extras">{infoExtras}</p>}
        <Extensions value={extensions(info)} />
      </header>

      {data.servers.length > 0 && (
        <div className="api-preview__tag">
          <h2 className="api-preview__tag-title">Servidores</h2>
          <Servers servers={data.servers} />
        </div>
      )}

      {(data.securitySchemes.length > 0 || data.security.length > 0) && (
        <div className="api-preview__tag">
          <h2 className="api-preview__tag-title">Autenticação</h2>
          {data.securitySchemes.map(([name, scheme]) => (
            <section key={name} className="api-preview__model">
              <h3 className="api-preview__model-title">{name} <span className="api-preview__meta">{[scheme.type, scheme.scheme, scheme.bearerFormat, scheme.in && `${scheme.in}: ${scheme.name}`].filter(Boolean).join(' · ')}</span></h3>
              {scheme.description && <Markdown className="api-preview__description" source={String(scheme.description)} />}
              {(isObject(scheme.flows) || scheme.openIdConnectUrl) && <CodeBlock code={toYaml(scheme.flows ?? { openIdConnectUrl: scheme.openIdConnectUrl })} language="yaml" bare />}
            </section>
          ))}
          {data.security.length > 0 && <Block title="Exigida em toda a API"><Requirements security={data.security} /></Block>}
        </div>
      )}

      {empty && <p className="admin-muted">Adicione endpoints em <code>paths</code> para vê-los aqui.</p>}
      {data.tags.map((tag) => (
        <div key={tag.name} className="api-preview__tag">
          <h2 className="api-preview__tag-title">{tag.name}</h2>
          {tag.info?.description && <Markdown className="api-preview__description" source={String(tag.info.description)} />}
          {tag.operations.length === 0 && <p className="admin-muted">Nenhum endpoint neste grupo.</p>}
          {tag.operations.map((operation) => <Operation key={operation.key} operation={operation} server={data.serverUrl} />)}
        </div>
      ))}

      {data.webhooks.length > 0 && (
        <div className="api-preview__tag">
          <h2 className="api-preview__tag-title">Webhooks</h2>
          {data.webhooks.map((operation) => <Operation key={operation.key} operation={operation} server="" />)}
        </div>
      )}

      {data.models.length > 0 && (
        <div className="api-preview__tag">
          <h2 className="api-preview__tag-title">Modelos</h2>
          {data.models.map((model) => (
            <section key={model.name} className="api-preview__model" data-preview-key={`model:${model.name}`}>
              <h3 className="api-preview__model-title">{model.name}</h3>
              {model.schema.description && <p className="admin-muted">{model.schema.description}</p>}
              <SchemaViewer schema={model.schema} />
            </section>
          ))}
        </div>
      )}

      {data.otherComponents.map(({ section, entries }) => (
        <div key={section} className="api-preview__tag">
          <h2 className="api-preview__tag-title">{componentTitles[section] ?? section} <span className="api-preview__meta">components.{section}</span></h2>
          {entries.map(([name, entry]) => (
            <section key={name} className="api-preview__model">
              <h3 className="api-preview__model-title">{name}</h3>
              <CodeBlock code={toYaml(entry)} language="yaml" bare />
            </section>
          ))}
        </div>
      ))}

      {Object.keys(data.unknown).length > 0 && (
        <div className="api-preview__tag">
          <h2 className="api-preview__tag-title">Outros campos</h2>
          <CodeBlock code={toYaml(data.unknown)} language="yaml" bare />
        </div>
      )}
    </section>
  );
}
