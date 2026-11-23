/**
 * OpenAPI documents in YAML or JSON: parsing with source positions, validation against the parts
 * of the OpenAPI 3 spec that matter for docs, and an outline (endpoints and models) that points
 * back into the text. JSON is parsed by the YAML parser too (it's valid YAML), so positions work
 * the same for both formats.
 */
import { isMap, isScalar, LineCounter, parseDocument, stringify, type Document, type Node } from 'yaml';

export type SpecFormat = 'json' | 'yaml';
export type Severity = 'error' | 'warning';

export interface Issue {
  severity: Severity;
  message: string;
  /** Character offsets in the text, for underlining in the editor. */
  from: number;
  to: number;
  /** 1-based line, for messages. */
  line: number;
}

export interface OutlineEndpoint { method: string; path: string; summary?: string; tag: string; deprecated: boolean; offset: number }
export interface OutlineModel { name: string; offset: number }

export interface ParsedSpec {
  format: SpecFormat;
  /** Plain JS value, or null when the text doesn't parse. */
  value: Record<string, any> | null;
  issues: Issue[];
  endpoints: OutlineEndpoint[];
  models: OutlineModel[];
}

export const httpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

export const detectFormat = (text: string): SpecFormat => (/^\s*[{[]/.test(text) ? 'json' : 'yaml');

/* Known keys per object, to flag typos like "sumary" (only where the spec is closed; x- is always allowed). */
const knownKeys: Record<string, string[]> = {
  root: ['openapi', 'info', 'jsonSchemaDialect', 'servers', 'paths', 'webhooks', 'components', 'security', 'tags', 'externalDocs'],
  info: ['title', 'summary', 'description', 'termsOfService', 'contact', 'license', 'version'],
  pathItem: ['$ref', 'summary', 'description', ...httpMethods, 'servers', 'parameters'],
  operation: ['tags', 'summary', 'description', 'externalDocs', 'operationId', 'parameters', 'requestBody', 'responses', 'callbacks', 'deprecated', 'security', 'servers'],
  parameter: ['name', 'in', 'description', 'required', 'deprecated', 'allowEmptyValue', 'style', 'explode', 'allowReserved', 'schema', 'example', 'examples', 'content', '$ref'],
  response: ['description', 'headers', 'content', 'links', '$ref'],
  requestBody: ['description', 'content', 'required', '$ref'],
  components: ['schemas', 'responses', 'parameters', 'examples', 'requestBodies', 'headers', 'securitySchemes', 'links', 'callbacks', 'pathItems'],
};
const parameterLocations = ['query', 'header', 'path', 'cookie'];
const refSections = ['schemas', 'responses', 'parameters', 'examples', 'requestBodies', 'headers', 'securitySchemes', 'links', 'callbacks', 'pathItems'];

export function parseSpec(text: string): ParsedSpec {
  const format = detectFormat(text);
  const issues: Issue[] = [];
  const endpoints: OutlineEndpoint[] = [];
  const models: OutlineModel[] = [];
  if (!text.trim()) return { format, value: null, issues, endpoints, models };

  const lineCounter = new LineCounter();
  let doc: Document;
  try {
    doc = parseDocument(text, { lineCounter, uniqueKeys: true, prettyErrors: false });
  } catch (error) {
    issues.push({ severity: 'error', message: error instanceof Error ? error.message : String(error), from: 0, to: 0, line: 1 });
    return { format, value: null, issues, endpoints, models };
  }

  const lineOf = (offset: number) => lineCounter.linePos(offset).line;
  const add = (severity: Severity, message: string, range: [number, number] | undefined) => {
    const [from, to] = range ?? [0, 0];
    issues.push({ severity, message, from, to: Math.max(to, from), line: lineOf(from) });
  };

  for (const error of doc.errors) add('error', syntaxMessage(error.code, error.message), [error.pos[0], error.pos[1]]);
  if (doc.errors.length) return { format, value: null, issues, endpoints, models };

  const value = doc.toJS({ maxAliasCount: 50 }) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    add('error', 'A spec precisa ser um objeto (chave: valor) no nível de cima.', [0, text.length]);
    return { format, value: null, issues, endpoints, models };
  }
  const spec = value as Record<string, any>;

  /** Range of the node at a path; falls back to the closest existing parent. */
  const rangeAt = (path: Array<string | number>): [number, number] => {
    for (let depth = path.length; depth >= 0; depth--) {
      const node = doc.getIn(path.slice(0, depth), true) as Node | undefined;
      if (node?.range) return [node.range[0], node.range[1]];
    }
    return [0, 0];
  };
  /** Range of a key (e.g. to underline "sumary" itself, not its whole value). */
  const keyRange = (path: Array<string | number>, key: string): [number, number] => {
    const parent = path.length ? doc.getIn(path, true) : doc.contents;
    if (isMap(parent)) {
      const pair = parent.items.find((item) => isScalar(item.key) && item.key.value === key);
      const keyNode = pair?.key as Node | undefined;
      if (keyNode?.range) return [keyNode.range[0], keyNode.range[1]];
    }
    return rangeAt([...path, key]);
  };
  const checkKeys = (object: unknown, kind: keyof typeof knownKeys, path: Array<string | number>) => {
    if (!object || typeof object !== 'object' || Array.isArray(object)) return;
    for (const key of Object.keys(object)) {
      if (key.startsWith('x-') || knownKeys[kind]!.includes(key)) continue;
      const suggestion = closest(key, knownKeys[kind]!);
      add('warning', `Campo desconhecido “${key}”${suggestion ? `. Você quis dizer “${suggestion}”?` : '.'}`, keyRange(path, key));
    }
  };

  /* Top level */
  if (typeof spec.openapi !== 'string') {
    add('error', typeof spec.swagger === 'string' ? 'Swagger 2.0 não é aceito: converta para OpenAPI 3.' : 'Falta o campo “openapi” (ex.: 3.1.0).', [0, 0]);
  } else if (!/^3\.[01]\.\d+$/.test(spec.openapi)) {
    add('error', `OpenAPI “${spec.openapi}” não é aceito: use 3.0.x ou 3.1.x.`, rangeAt(['openapi']));
  }
  checkKeys(spec, 'root', []);
  if (!spec.info || typeof spec.info !== 'object') add('error', 'Falta o objeto “info” com “title” e “version”.', [0, 0]);
  else {
    checkKeys(spec.info, 'info', ['info']);
    if (typeof spec.info.title !== 'string' || !spec.info.title.trim()) add('error', 'Falta “info.title”: o nome da API.', rangeAt(['info']));
    if (spec.info.version === undefined) add('error', 'Falta “info.version”: a versão da API.', rangeAt(['info']));
  }
  if (spec.components) checkKeys(spec.components, 'components', ['components']);
  if (!spec.paths && !spec.webhooks && !spec.components) add('warning', 'A spec não tem “paths”: a referência ficará vazia.', [0, 0]);

  /* Servers: a variable's default must be one of its enum values, and every {name} in the URL needs a variable */
  const checkServers = (servers: unknown, path: Array<string | number>) => {
    if (!Array.isArray(servers)) return;
    servers.forEach((server, index) => {
      if (!server || typeof server !== 'object' || typeof server.url !== 'string') return;
      const variables = (server.variables ?? {}) as Record<string, { default?: unknown; enum?: unknown }>;
      for (const [name, variable] of Object.entries(variables)) {
        if (Array.isArray(variable?.enum) && variable.default !== undefined && !variable.enum.includes(variable.default)) {
          add('warning', `O padrão “${String(variable.default)}” da variável “${name}” não está entre as opções do enum.`, rangeAt([...path, index, 'variables', name, 'default']));
        }
      }
      for (const [, name] of server.url.matchAll(/\{([^}]+)\}/g)) {
        if (!(name! in variables)) add('error', `A URL do servidor usa “{${name}}”, mas não há uma variável “${name}” em “variables”.`, rangeAt([...path, index, 'url']));
      }
    });
  };
  checkServers(spec.servers, ['servers']);
  if (spec.paths && typeof spec.paths === 'object') {
    for (const [route, item] of Object.entries(spec.paths as Record<string, any>)) {
      if (!item || typeof item !== 'object') continue;
      checkServers(item.servers, ['paths', route, 'servers']);
      for (const method of httpMethods) checkServers(item[method]?.servers, ['paths', route, method, 'servers']);
    }
  }

  /* $refs: local ones must point to something that exists */
  const walkRefs = (node: unknown, path: Array<string | number>) => {
    if (Array.isArray(node)) node.forEach((item, index) => walkRefs(item, [...path, index]));
    else if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        if (key === '$ref' && typeof child === 'string') {
          if (child.startsWith('#/')) {
            const target = child.slice(2).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
            let current: any = spec;
            for (const part of target) current = current?.[part];
            if (current === undefined) add('error', `A referência “${child}” não existe na spec.`, rangeAt([...path, key]));
            else if (target[0] === 'components' && !refSections.includes(target[1] ?? '')) add('warning', `“${child}” aponta para uma seção desconhecida de components.`, rangeAt([...path, key]));
          }
        } else walkRefs(child, [...path, key]);
      }
    }
  };
  walkRefs(spec, []);

  /* Paths and operations */
  const operationIds = new Map<string, string>();
  const pathMap = spec.paths && typeof spec.paths === 'object' ? spec.paths as Record<string, any> : {};
  for (const [path, item] of Object.entries(pathMap)) {
    if (!path.startsWith('/')) add('error', `O caminho “${path}” precisa começar com “/”.`, keyRange(['paths'], path));
    if (!item || typeof item !== 'object') continue;
    checkKeys(item, 'pathItem', ['paths', path]);
    const pathLevel: any[] = Array.isArray(item.parameters) ? item.parameters : [];
    const templateParams = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]!);

    for (const method of httpMethods) {
      const operation = item[method];
      if (!operation || typeof operation !== 'object') continue;
      const opPath = ['paths', path, method];
      checkKeys(operation, 'operation', opPath);
      const [opFrom] = keyRange(['paths', path], method);
      endpoints.push({
        method: method.toUpperCase(), path, summary: typeof operation.summary === 'string' ? operation.summary : undefined,
        tag: Array.isArray(operation.tags) && typeof operation.tags[0] === 'string' ? operation.tags[0] : 'Outros',
        deprecated: Boolean(operation.deprecated), offset: opFrom,
      });

      if (!operation.responses || typeof operation.responses !== 'object' || !Object.keys(operation.responses).length) {
        add('error', `${method.toUpperCase()} ${path} não tem “responses”: declare pelo menos uma resposta.`, keyRange(['paths', path], method));
      } else {
        for (const [code, response] of Object.entries(operation.responses as Record<string, any>)) {
          if (!/^([1-5]\d\d|[1-5]XX|default)$/.test(code)) add('error', `Código de status inválido “${code}”: use 200, 4XX ou default.`, keyRange([...opPath, 'responses'], code));
          if (response && typeof response === 'object' && !response.$ref) {
            checkKeys(response, 'response', [...opPath, 'responses', code]);
            if (typeof response.description !== 'string') add('error', `A resposta ${code} precisa de “description”.`, keyRange([...opPath, 'responses'], code));
          }
        }
      }
      if (operation.requestBody && typeof operation.requestBody === 'object' && !operation.requestBody.$ref) {
        checkKeys(operation.requestBody, 'requestBody', [...opPath, 'requestBody']);
        if (!operation.requestBody.content) add('error', '“requestBody” precisa de “content” (ex.: application/json).', rangeAt([...opPath, 'requestBody']));
      }
      if (typeof operation.operationId === 'string') {
        const previous = operationIds.get(operation.operationId);
        if (previous) add('error', `“operationId” repetido: “${operation.operationId}” já é usado em ${previous}.`, rangeAt([...opPath, 'operationId']));
        else operationIds.set(operation.operationId, `${method.toUpperCase()} ${path}`);
      }

      const opParams: any[] = Array.isArray(operation.parameters) ? operation.parameters : [];
      opParams.forEach((param, index) => {
        if (!param || typeof param !== 'object' || param.$ref) return;
        const paramPath = [...opPath, 'parameters', index];
        checkKeys(param, 'parameter', paramPath);
        if (typeof param.name !== 'string' || !param.name) add('error', 'Parâmetro sem “name”.', rangeAt(paramPath));
        if (!parameterLocations.includes(param.in)) add('error', `“in” precisa ser ${parameterLocations.join(', ')}.`, rangeAt([...paramPath, 'in']));
        if (param.in === 'path' && param.required !== true) add('error', `O parâmetro de caminho “${param.name}” precisa de “required: true”.`, rangeAt(paramPath));
        if (param.in === 'path' && !templateParams.includes(param.name)) add('warning', `“${param.name}” é parâmetro de caminho, mas não aparece em ${path}.`, rangeAt(paramPath));
        if (!param.schema && !param.content) add('warning', `O parâmetro “${param.name}” não tem “schema”.`, rangeAt(paramPath));
      });
      const declared = new Set([...pathLevel, ...opParams].filter((param) => param && typeof param === 'object').map((param) => {
        if (param.$ref) return refName(param.$ref, spec);
        return param.in === 'path' ? param.name : undefined;
      }));
      for (const name of templateParams) {
        if (!declared.has(name)) add('error', `{${name}} está no caminho de ${method.toUpperCase()} ${path} mas não foi declarado em “parameters”.`, keyRange(['paths', path], method));
      }
    }
  }

  const schemas = spec.components?.schemas && typeof spec.components.schemas === 'object' ? spec.components.schemas as Record<string, unknown> : {};
  for (const name of Object.keys(schemas)) models.push({ name, offset: keyRange(['components', 'schemas'], name)[0] });

  issues.sort((a, b) => (a.severity === b.severity ? a.from - b.from : a.severity === 'error' ? -1 : 1));
  return { format, value: spec, issues, endpoints, models };
}

/** Name of a path parameter behind a $ref (so `{id}` counts as declared). */
function refName(ref: string, spec: Record<string, any>) {
  if (!ref.startsWith('#/')) return undefined;
  let current: any = spec;
  for (const part of ref.slice(2).split('/')) current = current?.[part];
  return current?.in === 'path' ? current.name : undefined;
}

const syntaxMessages: Record<string, string> = {
  DUPLICATE_KEY: 'chave repetida no mesmo objeto.',
  BAD_INDENT: 'indentação incorreta.',
  TAB_AS_INDENT: 'use espaços, não Tab, para indentar.',
  MULTILINE_IMPLICIT_KEY: 'linha sem “chave: valor” (falta “:” ou a indentação está errada).',
  BLOCK_AS_IMPLICIT_KEY: 'bloco usado como chave: confira a indentação e os “:”.',
  MISSING_CHAR: 'falta um caractere (ex.: aspas, “]” ou “}”).',
  UNEXPECTED_TOKEN: 'caractere inesperado.',
  BAD_SCALAR_START: 'valor começa com um caractere que precisa de aspas.',
  BLOCK_IN_FLOW: 'bloco dentro de { } ou [ ].',
  MISSING_ANCHOR: 'âncora (&) não encontrada.',
};

function syntaxMessage(code: string, message: string) {
  return `Erro de sintaxe: ${syntaxMessages[code] ?? (message.split('\n')[0] ?? message)}`;
}

/** Closest known key within a small edit distance, for "did you mean". */
function closest(word: string, options: string[]) {
  let best: string | undefined;
  let bestDistance = 3;
  for (const option of options) {
    const distance = levenshtein(word.toLowerCase(), option.toLowerCase());
    if (distance < bestDistance) { best = option; bestDistance = distance; }
  }
  return best;
}

function levenshtein(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

/** Re-serializes a spec in the other format (for "Converter para YAML/JSON"). */
/** Specs are kept in YAML: JSON that parses becomes YAML; anything else is returned as is. */
export function toYaml(text: string) {
  if (detectFormat(text) !== 'json') return text;
  try { return convert(text, 'yaml'); } catch { return text; }
}

export function convert(text: string, to: SpecFormat) {
  const doc = parseDocument(text);
  if (doc.errors.length) throw new Error('Corrija os erros de sintaxe antes de converter.');
  return to === 'json' ? `${JSON.stringify(doc.toJS(), null, 2)}\n` : stringify(doc.toJS(), { lineWidth: 0 });
}
