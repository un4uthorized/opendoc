import type { ApiResponse, HttpMethod, Schema } from '../../design-system';
import { docsSource } from './source';
import { buildSamples, type Sample, type SampleAuth, type SampleBody } from './samples';

/* Turns the OpenAPI document into what the page renders: resolved schemas (cycles marked, not
   expanded), operations grouped by tag with their servers, security, bodies, responses and
   callbacks, plus webhooks, models, generated examples and request snippets. */

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * The published spec (see source.ts), with the parts the page always reads filled in, so a spec
 * without a summary, description, tags or paths still renders.
 */
const source = docsSource();
const raw = source.spec as Json;
const doc: Json = {
  ...raw,
  info: { title: source.name, version: '', summary: '', description: '', ...(raw.info ?? {}) },
  paths: raw.paths ?? {},
};

const slug = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Follows local $refs (#/components/...), recursively. Keys next to a $ref (OpenAPI 3.1) override
 * the target's. Named schemas get their name as `title` (variant labels use it), and a $ref back
 * to a schema that is already being expanded becomes `{ 'x-circular': name }` instead of looping.
 */
function resolve<T = Json>(value: unknown, seen: string[] = []): T {
  if (Array.isArray(value)) return value.map((item) => resolve(item, seen)) as T;
  if (!value || typeof value !== 'object') return value as T;
  const object = value as Json;
  if (typeof object.$ref === 'string') {
    const ref = object.$ref as string;
    const { $ref: _ref, ...siblings } = object;
    const name = ref.split('/').pop()!;
    if (seen.includes(ref)) return { 'x-circular': name, title: name, ...resolve(siblings, seen) } as T;
    const target = ref.replace(/^#\//, '').split('/').reduce<Json | undefined>((node, key) => node?.[key], doc);
    const resolved = resolve<Json>(target, [...seen, ref]);
    const named = ref.startsWith('#/components/schemas/') && !resolved.title ? { title: name } : {};
    return { ...named, ...resolved, ...resolve(siblings, seen) } as T;
  }
  return Object.fromEntries(Object.entries(object).map(([key, child]) => [key, resolve(child, seen)])) as T;
}

/** allOf merged into one object schema (properties and required lists combined). */
export function mergeAllOf(schema: Schema): Schema {
  if (!schema.allOf) return schema;
  const { allOf, ...rest } = schema;
  return allOf.map(mergeAllOf).reduce<Schema>((merged, part) => ({
    ...part,
    ...merged,
    type: merged.type ?? part.type,
    // Earlier parts first (allOf: [Base, Extra] lists Base's fields, then Extra's).
    properties: { ...merged.properties, ...part.properties },
    required: [...new Set([...(merged.required ?? []), ...(part.required ?? [])])],
  }), { ...rest, properties: { ...rest.properties }, required: rest.required ?? [] });
}

/** Example value for a schema: its own example, else one built from its type. */
export function exampleFor(input: Schema | undefined, depth = 0): unknown {
  if (!input || input['x-circular']) return undefined;
  const schema = mergeAllOf(input);
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return schema.enum[0];
  const variant = schema.oneOf?.[0] ?? schema.anyOf?.[0];
  if (variant) return exampleFor(variant, depth);
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === 'object' || schema.properties) {
    if (depth > 4) return {};
    const required = new Set(schema.required ?? []);
    // Show required fields plus any optional field that documents an example.
    const entries = Object.entries(schema.properties ?? {})
      .filter(([name, child]) => required.has(name) || child.example !== undefined || (depth === 0 && child.properties))
      .filter(([, child]) => !child.readOnly && !child['x-circular'])
      .map(([name, child]) => [name, exampleFor(child, depth + 1)]);
    return Object.fromEntries(entries);
  }
  if (type === 'array') return [exampleFor(schema.items, depth + 1)];
  if (type === 'integer' || type === 'number') return schema.minimum ?? 0;
  if (type === 'boolean') return true;
  if (schema.format === 'binary') return '';
  if (schema.format === 'date-time') return '2026-11-18T12:00:00Z';
  if (schema.format === 'uri') return 'https://exemplo.com';
  return 'string';
}

/* ── Servers ───────────────────────────────────────────────────────── */

export interface ServerVariable { default: string; enum?: string[]; description?: string }
export interface ServerInfo { url: string; description: string; variables: Record<string, ServerVariable> }

const toServer = (raw: Json): ServerInfo => ({ url: raw.url, description: raw.description ?? raw.url, variables: raw.variables ?? {} });

/** A server URL with its {variables} filled in (chosen value, else the default), without a trailing slash. */
export function serverUrl(server: ServerInfo, values: Record<string, string> = {}) {
  return server.url.replace(/\{([^}]+)\}/g, (_, name: string) => values[name] ?? server.variables[name]?.default ?? name).replace(/\/$/, '');
}

/** The spec's servers: where the examples and the test client point. */
export const servers: ServerInfo[] = ((doc.servers ?? [{ url: '/' }]) as Json[]).map(toServer);
export const baseUrl = serverUrl(servers[0]!);

/* ── Security ──────────────────────────────────────────────────────── */

export interface OAuthFlow { authorizationUrl?: string; tokenUrl?: string; refreshUrl?: string; scopes: Record<string, string> }
export type SecurityScheme = { key: string; description?: string; env: string } & (
  | { type: 'http'; scheme: string; bearerFormat?: string }
  | { type: 'apiKey'; in: 'header' | 'query' | 'cookie'; name: string }
  | { type: 'oauth2'; flows: Record<string, OAuthFlow> }
  | { type: 'openIdConnect'; openIdConnectUrl: string }
);
/** One way to authenticate: every scheme in it applies at once. An operation lists the alternatives. */
export type SecurityRequirement = Array<{ scheme: SecurityScheme; scopes: string[] }>;

const envPrefix = (doc.info.title as string).normalize('NFD').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();

export const securitySchemes: Record<string, SecurityScheme> = Object.fromEntries(
  Object.entries((doc.components?.securitySchemes ?? {}) as Json).map(([key, raw]) => {
    const suffix = raw.type === 'apiKey' ? 'API_KEY' : raw.type === 'http' && raw.scheme === 'basic' ? 'BASIC_AUTH' : 'TOKEN';
    // Several schemes of the same kind get distinct variables (…_API_KEY, …_API_KEY_2).
    return [key, { ...raw, key, env: `${envPrefix}_${suffix}` } as SecurityScheme];
  }),
);
{
  const used = new Map<string, number>();
  for (const scheme of Object.values(securitySchemes)) {
    const count = (used.get(scheme.env) ?? 0) + 1;
    used.set(scheme.env, count);
    if (count > 1) scheme.env = `${scheme.env}_${count}`;
  }
}

const toRequirements = (raw: Json[] | undefined): SecurityRequirement[] =>
  (raw ?? []).map((entry) => Object.entries(entry).flatMap(([key, scopes]) => (securitySchemes[key] ? [{ scheme: securitySchemes[key]!, scopes: scopes as string[] }] : [])))
    .filter((requirement) => requirement.length > 0);

const globalSecurity = toRequirements(doc.security);

/** How a scheme shows up in code samples: header (with prefix) or query parameter, read from an env var. */
export function sampleAuthFor(scheme: SecurityScheme | undefined): SampleAuth | undefined {
  if (!scheme) return undefined;
  if (scheme.type === 'apiKey') {
    if (scheme.in === 'query') return { query: scheme.name, env: scheme.env };
    if (scheme.in === 'cookie') return { header: 'Cookie', prefix: `${scheme.name}=`, env: scheme.env };
    return { header: scheme.name, prefix: '', env: scheme.env };
  }
  if (scheme.type === 'http' && scheme.scheme === 'basic') return { header: 'Authorization', prefix: 'Basic ', env: scheme.env };
  return { header: 'Authorization', prefix: 'Bearer ', env: scheme.env };
}

/* ── Bodies and responses ──────────────────────────────────────────── */

export type BodyKind = 'json' | 'form' | 'multipart' | 'text';
export const bodyKind = (contentType: string): BodyKind =>
  /json/.test(contentType) ? 'json' : /x-www-form-urlencoded/.test(contentType) ? 'form' : /^multipart\//.test(contentType) ? 'multipart' : 'text';

export interface NamedExample { name: string; summary?: string; value: unknown }
export interface MediaType { contentType: string; kind: BodyKind; schema?: Schema; examples: NamedExample[] }
export interface RequestBody { required: boolean; media: MediaType[] }

function toExamples(media: Json, kind: BodyKind | 'response'): NamedExample[] {
  if (media.examples) return Object.entries(media.examples as Json).map(([name, example]) => ({ name, summary: example.summary, value: example.value }));
  if (media.example !== undefined) return [{ name: 'example', value: media.example }];
  if (media.schema && (kind === 'json' || kind === 'form' || kind === 'multipart' || (kind === 'response' && media.schema.type !== 'string'))) {
    const value = exampleFor(media.schema);
    return value === undefined ? [] : [{ name: 'example', value }];
  }
  return [];
}

function toBody(raw: Json | undefined): RequestBody | undefined {
  if (!raw?.content) return undefined;
  return {
    required: Boolean(raw.required),
    media: Object.entries(raw.content as Json).map(([contentType, media]) => {
      const kind = bodyKind(contentType);
      return { contentType, kind, schema: media.schema, examples: toExamples(media, kind) };
    }),
  };
}

function toResponses(raw: Json | undefined): ApiResponse[] {
  return Object.entries(raw ?? {}).map(([status, response]) => {
    const [contentType, media] = Object.entries((response as Json).content ?? {})[0] ?? [];
    const examples = media ? toExamples(media as Json, 'response') : [];
    return {
      status: Number(status),
      description: (response as Json).description,
      contentType,
      schema: (media as Json | undefined)?.schema,
      example: examples[0]?.value,
      examples: examples.length > 1 ? examples : undefined,
    };
  });
}

/** Text a body example becomes in an editor or a sample: formatted JSON, form pairs or plain text. */
export function exampleText(media: MediaType, example = media.examples[0]): string {
  const value = example?.value;
  if (value === undefined) return '';
  if (media.kind === 'json') return JSON.stringify(value, null, 2);
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

/** A sample body for code snippets (the first example of the first media type). */
export function sampleBodyFor(media: MediaType | undefined, example = media?.examples[0]): SampleBody | undefined {
  if (!media) return undefined;
  if (media.kind === 'form' || media.kind === 'multipart') {
    const value = (example?.value ?? {}) as Json;
    const properties = mergeAllOf(media.schema ?? {}).properties ?? {};
    const fields = Object.keys({ ...properties, ...value }).map((name) => ({ name, value: value[name] === undefined ? '' : String(value[name]), file: properties[name]?.format === 'binary' }));
    return media.kind === 'form'
      ? { kind: 'form', contentType: media.contentType, fields: fields.filter((field) => !field.file && field.value !== '').map(({ name, value: text }) => [name, text] as [string, string]) }
      : { kind: 'multipart', contentType: media.contentType, fields };
  }
  const text = exampleText(media, example);
  return text ? { kind: media.kind === 'json' ? 'json' : 'text', contentType: media.contentType, text } : undefined;
}

/* ── Operations ────────────────────────────────────────────────────── */

export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema: Schema;
}

export interface Callback {
  name: string;
  /** Runtime expression for the URL, e.g. {$request.body#/callbackUrl}. */
  expression: string;
  method: HttpMethod;
  summary?: string;
  description?: string;
  body?: RequestBody;
  responses: ApiResponse[];
}

export interface Operation {
  id: string;
  method: HttpMethod;
  /** Path as written in the spec (servers supply the base URL). */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  deprecated: boolean;
  /** x-badges (and x-beta), shown next to the title and in the sidebar. */
  badges: string[];
  /** x-ratelimit, as text. */
  rateLimit?: string;
  servers: ServerInfo[];
  /** Ways to authenticate (any one of them); empty for public endpoints. */
  security: SecurityRequirement[];
  parameters: Record<'path' | 'query' | 'header', Parameter[]>;
  body?: RequestBody;
  responses: ApiResponse[];
  callbacks: Callback[];
  samples: Sample[];
}

export interface Tag {
  name: string;
  id: string;
  description?: string;
  operations: Operation[];
}

/** A parameter list as an object schema, so SchemaViewer can show it. */
export function parametersSchema(parameters: Parameter[]): Schema {
  return {
    type: 'object',
    required: parameters.filter((parameter) => parameter.required).map((parameter) => parameter.name),
    properties: Object.fromEntries(parameters.map((parameter) => [parameter.name, { ...parameter.schema, description: parameter.description ?? parameter.schema.description }])),
  };
}

function badgesOf(raw: Json): string[] {
  const badges = Array.isArray(raw['x-badges']) ? (raw['x-badges'] as Array<string | { name: string }>).map((badge) => (typeof badge === 'string' ? badge : badge.name)) : [];
  if (raw['x-beta'] === true && !badges.includes('Beta')) badges.push('Beta');
  return badges;
}

function rateLimitOf(raw: Json): string | undefined {
  const limit = raw['x-ratelimit'] ?? raw['x-rate-limit'];
  if (!limit) return undefined;
  if (typeof limit === 'string') return limit;
  return [limit.limit, limit.period ?? limit.window].filter(Boolean).join(' / ');
}

function samplesFor(method: HttpMethod, path: string, server: ServerInfo, parameters: Operation['parameters'], security: SecurityRequirement[], body: RequestBody | undefined) {
  const filled = path.replace(/\{([^}]+)\}/g, (_, name: string) => String(exampleFor(parameters.path.find((p) => p.name === name)?.schema) ?? name));
  return buildSamples({ method, url: `${serverUrl(server)}${filled}`, headers: [], auth: sampleAuthFor(security[0]?.[0]?.scheme), body: sampleBodyFor(body?.media[0]) });
}

const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

function toCallbacks(raw: Json | undefined): Callback[] {
  return Object.entries(raw ?? {}).flatMap(([name, expressions]) => Object.entries(expressions as Json).flatMap(([expression, item]) =>
    methods.filter((method) => (item as Json)[method]).map((method) => {
      const operation = (item as Json)[method] as Json;
      return { name, expression, method: method.toUpperCase() as HttpMethod, summary: operation.summary, description: operation.description, body: toBody(operation.requestBody), responses: toResponses(operation.responses) };
    })));
}

function buildOperations(): Operation[] {
  const operations: Operation[] = [];
  for (const [path, item] of Object.entries(doc.paths as Json)) {
    const pathItem = resolve<Json>(item);
    for (const method of methods) {
      const raw = pathItem[method] as Json | undefined;
      if (!raw || raw['x-internal'] === true) continue;
      const parameters: Operation['parameters'] = { path: [], query: [], header: [] };
      for (const parameter of [...(pathItem.parameters ?? []), ...(raw.parameters ?? [])] as Parameter[]) {
        if (parameter.in !== 'cookie') parameters[parameter.in].push(parameter);
      }
      const upper = method.toUpperCase() as HttpMethod;
      const operationServers = ((raw.servers ?? pathItem.servers) as Json[] | undefined)?.map(toServer) ?? servers;
      const security = raw.security ? toRequirements(raw.security) : globalSecurity;
      const body = toBody(raw.requestBody);
      operations.push({
        id: slug(raw.operationId ?? `${method}-${path}`),
        method: upper,
        path,
        tag: raw.tags?.[0] ?? 'Outros',
        summary: raw.summary ?? `${upper} ${path}`,
        description: raw.description,
        deprecated: Boolean(raw.deprecated),
        badges: badgesOf(raw),
        rateLimit: rateLimitOf(raw),
        servers: operationServers,
        security,
        parameters,
        body,
        responses: toResponses(raw.responses),
        callbacks: toCallbacks(raw.callbacks),
        samples: samplesFor(upper, path, operationServers[0]!, parameters, security, body),
      });
    }
  }
  return operations;
}

export const operations = buildOperations();

const tagList = (doc.tags ?? []) as Array<{ name: string; description?: string }>;
// Tags used by operations but not declared at the top still get a group.
for (const operation of operations) if (!tagList.some((tag) => tag.name === operation.tag)) tagList.push({ name: operation.tag });

export const tags: Tag[] = tagList.map((tag) => ({
  ...tag,
  id: slug(tag.name),
  operations: operations.filter((operation) => operation.tag === tag.name),
})).filter((tag) => tag.operations.length > 0);

/* ── Webhooks and models ───────────────────────────────────────────── */

export interface Webhook {
  id: string;
  name: string;
  method: HttpMethod;
  summary: string;
  description?: string;
  badges: string[];
  body?: RequestBody;
  responses: ApiResponse[];
}

export const webhooks: Webhook[] = Object.entries((doc.webhooks ?? {}) as Json).flatMap(([name, item]) => {
  const pathItem = resolve<Json>(item);
  return methods.filter((method) => pathItem[method]).map((method) => {
    const raw = pathItem[method] as Json;
    return {
      id: `webhook-${slug(name)}`,
      name,
      method: method.toUpperCase() as HttpMethod,
      summary: raw.summary ?? name,
      description: raw.description,
      badges: badgesOf(raw),
      body: toBody(raw.requestBody),
      responses: toResponses(raw.responses),
    };
  });
});

export interface Model { id: string; name: string; schema: Schema; example: unknown }

export const models: Model[] = Object.keys((doc.components?.schemas ?? {}) as Json).map((name) => {
  const schema = resolve<Schema>({ $ref: `#/components/schemas/${name}` });
  return { id: `model-${slug(name)}`, name, schema, example: exampleFor(schema) };
});

export const info = doc.info as { title: string; version: string; summary: string; description: string };
