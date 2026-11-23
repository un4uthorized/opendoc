/**
 * Autocomplete for OpenAPI documents, in YAML or JSON: works out where the cursor is in the
 * document (e.g. paths → /posts → get → parameters → item) and suggests the keys the OpenAPI spec
 * allows there, plus values for fields with a fixed set (in, type, format…) and local $refs.
 */
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
/** Node type taken from CodeMirror itself, so it matches whichever @lezer/common copy it resolves. */
type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>;

const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

/* Keys per object, with a short Portuguese hint. "object" keys open a nested block. */
type KeyInfo = [key: string, detail: string, object?: boolean];
const keys: Record<string, KeyInfo[]> = {
  root: [['openapi', 'versão do OpenAPI'], ['info', 'nome, versão e descrição', true], ['servers', 'URLs base', true], ['paths', 'endpoints', true], ['components', 'modelos e partes reutilizáveis', true], ['tags', 'grupos da navegação', true], ['security', 'autenticação padrão', true], ['webhooks', 'eventos enviados pela API', true], ['externalDocs', 'link externo', true]],
  info: [['title', 'nome da API'], ['version', 'versão da API'], ['summary', 'resumo curto'], ['description', 'texto em Markdown'], ['termsOfService', 'URL dos termos'], ['contact', 'contato', true], ['license', 'licença', true]],
  contact: [['name', 'nome'], ['url', 'site'], ['email', 'e-mail']],
  license: [['name', 'nome da licença'], ['identifier', 'SPDX'], ['url', 'URL']],
  server: [['url', 'URL base'], ['description', 'ex.: Produção'], ['variables', 'partes variáveis da URL', true]],
  tag: [['name', 'nome do grupo'], ['description', 'descrição'], ['externalDocs', 'link externo', true]],
  pathItem: [...methods.map((method): KeyInfo => [method, `operação ${method.toUpperCase()}`, true]), ['summary', 'resumo do caminho'], ['description', 'descrição'], ['parameters', 'parâmetros de todas as operações', true], ['servers', 'servidores só deste caminho', true]],
  operation: [['summary', 'título na navegação'], ['description', 'texto em Markdown'], ['operationId', 'ID único'], ['tags', 'grupo na navegação', true], ['parameters', 'path, query, header, cookie', true], ['requestBody', 'corpo da requisição', true], ['responses', 'respostas por status', true], ['deprecated', 'marca como obsoleto'], ['security', 'autenticação', true], ['callbacks', 'chamadas de volta', true], ['servers', 'servidores', true], ['externalDocs', 'link externo', true]],
  parameter: [['name', 'nome do parâmetro'], ['in', 'path, query, header ou cookie'], ['required', 'obrigatório'], ['description', 'descrição'], ['schema', 'tipo do valor', true], ['example', 'exemplo'], ['deprecated', 'obsoleto'], ['style', 'serialização'], ['explode', 'serialização de listas'], ['$ref', 'referência a components.parameters']],
  requestBody: [['description', 'descrição'], ['required', 'obrigatório'], ['content', 'por tipo de mídia', true], ['$ref', 'referência a components.requestBodies']],
  response: [['description', 'obrigatório'], ['content', 'corpo por tipo de mídia', true], ['headers', 'cabeçalhos da resposta', true], ['links', 'links', true], ['$ref', 'referência a components.responses']],
  mediaType: [['schema', 'formato do corpo', true], ['example', 'exemplo'], ['examples', 'exemplos nomeados', true], ['encoding', 'codificação', true]],
  components: [['schemas', 'modelos', true], ['responses', 'respostas reutilizáveis', true], ['parameters', 'parâmetros reutilizáveis', true], ['requestBodies', 'corpos reutilizáveis', true], ['headers', 'cabeçalhos', true], ['securitySchemes', 'autenticação', true], ['examples', 'exemplos', true], ['links', 'links', true], ['callbacks', 'callbacks', true]],
  schema: [['type', 'string, integer, object…'], ['properties', 'campos do objeto', true], ['required', 'campos obrigatórios', true], ['items', 'tipo dos itens da lista', true], ['description', 'descrição'], ['format', 'date-time, email, uuid…'], ['enum', 'valores permitidos', true], ['example', 'exemplo'], ['default', 'valor padrão'], ['nullable', 'aceita null (3.0)'], ['$ref', 'referência a um modelo'], ['allOf', 'combina modelos', true], ['oneOf', 'um dos formatos', true], ['anyOf', 'qualquer dos formatos', true], ['additionalProperties', 'campos extras'], ['minimum', 'mínimo'], ['maximum', 'máximo'], ['minLength', 'tamanho mínimo'], ['maxLength', 'tamanho máximo'], ['pattern', 'regex'], ['readOnly', 'só leitura'], ['writeOnly', 'só escrita'], ['deprecated', 'obsoleto']],
  securityScheme: [['type', 'apiKey, http, oauth2, openIdConnect'], ['description', 'descrição'], ['name', 'nome do cabeçalho/query'], ['in', 'header, query ou cookie'], ['scheme', 'bearer, basic…'], ['bearerFormat', 'ex.: JWT'], ['flows', 'fluxos OAuth 2.0', true], ['openIdConnectUrl', 'URL de descoberta']],
};

const statusCodes: Array<[string, string]> = [['200', 'OK'], ['201', 'Criado'], ['204', 'Sem conteúdo'], ['400', 'Requisição inválida'], ['401', 'Sem autenticação'], ['403', 'Sem permissão'], ['404', 'Não encontrado'], ['409', 'Conflito'], ['422', 'Dados inválidos'], ['429', 'Muitas requisições'], ['500', 'Erro interno'], ['default', 'Qualquer outro']];
const mediaTypes = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain', 'application/xml', 'application/octet-stream'];
const values: Record<string, string[]> = {
  in: ['path', 'query', 'header', 'cookie'],
  type: ['string', 'integer', 'number', 'boolean', 'object', 'array', 'null'],
  format: ['date-time', 'date', 'email', 'uri', 'uuid', 'int32', 'int64', 'float', 'double', 'byte', 'binary', 'password'],
  required: ['true', 'false'], deprecated: ['true', 'false'], nullable: ['true', 'false'], explode: ['true', 'false'], readOnly: ['true', 'false'], writeOnly: ['true', 'false'],
  openapi: ['3.1.0', '3.0.3'],
  style: ['form', 'simple', 'label', 'matrix', 'spaceDelimited', 'pipeDelimited', 'deepObject'],
};

type Context = { kind: 'keys'; list: KeyInfo[] } | { kind: 'codes' } | { kind: 'media' } | null;

/** Which object the path points to. "#" stands for an array item. */
function contextFor(path: string[]): Context {
  const last = path[path.length - 1];
  const parent = path[path.length - 2];
  const n = path.length;
  if (n === 0) return { kind: 'keys', list: keys.root! };
  if (path[0] === 'info') return n === 1 ? { kind: 'keys', list: keys.info! } : last === 'contact' ? { kind: 'keys', list: keys.contact! } : last === 'license' ? { kind: 'keys', list: keys.license! } : null;
  if (last === '#' && parent === 'servers') return { kind: 'keys', list: keys.server! };
  if (n === 2 && path[0] === 'tags' && last === '#') return { kind: 'keys', list: keys.tag! };
  if (n === 1 && last === 'components') return { kind: 'keys', list: keys.components! };
  if (n === 3 && path[0] === 'components' && path[1] === 'securitySchemes') return { kind: 'keys', list: keys.securityScheme! };
  if (path[0] === 'paths' && n === 2) return { kind: 'keys', list: keys.pathItem! };
  if (path[0] === 'paths' && n === 3 && methods.includes(last!)) return { kind: 'keys', list: keys.operation! };
  if (last === '#' && parent === 'parameters') return { kind: 'keys', list: keys.parameter! };
  if (n === 3 && path[0] === 'components' && path[1] === 'parameters') return { kind: 'keys', list: keys.parameter! };
  if (last === 'requestBody' || (n === 3 && path[0] === 'components' && path[1] === 'requestBodies')) return { kind: 'keys', list: keys.requestBody! };
  if (last === 'responses' && path[0] !== 'components') return { kind: 'codes' };
  if (parent === 'responses' || (n === 3 && path[0] === 'components' && path[1] === 'responses')) return { kind: 'keys', list: keys.response! };
  if (last === 'content') return { kind: 'media' };
  if (parent === 'content') return { kind: 'keys', list: keys.mediaType! };
  // Schemas: a "schema" key, a model, a property, list items or a composition branch.
  if (last === 'schema' || last === 'items' || last === 'additionalProperties' || parent === 'properties'
    || (n === 3 && path[0] === 'components' && path[1] === 'schemas')
    || (last === '#' && ['allOf', 'oneOf', 'anyOf'].includes(parent!))) return { kind: 'keys', list: keys.schema! };
  return null;
}

/* ── Where is the cursor? ───────────────────────────────────────────── */

interface Position { path: string[]; at: 'key' | 'value'; key?: string; from: number; quoted?: boolean }

const indentOf = (text: string) => text.length - text.trimStart().length;
const unquote = (text: string) => text.trim().replace(/^["']|["']$/g, '');

/** YAML: walk up the lines; each line indented less than the current block is a parent key or list item. */
function yamlPosition(state: EditorState, pos: number): Position | null {
  const line = state.doc.lineAt(pos);
  const before = line.text.slice(0, pos - line.from);
  if (/^\s*#/.test(before)) return null;
  const valueMatch = /^(\s*)(-\s+)?([^\s:#'"][^:#]*|"[^"]*"|'[^']*'):\s+(\S*)$/.exec(before);
  const keyMatch = /^(\s*)(-\s+)?([\w$./{}-]*)$/.exec(before);
  if (!valueMatch && !keyMatch) return null;

  const path: string[] = [];
  let limit = indentOf(before) + (keyMatch?.[2] ?? valueMatch?.[2] ?? '').length;
  // A "- " on the current line means we're inside a list item.
  const startsItem = Boolean((keyMatch ?? valueMatch)?.[2]);
  for (let number = line.number - 1; number >= 1 && limit > 0; number--) {
    const text = state.doc.line(number).text;
    if (!text.trim() || /^\s*#/.test(text)) continue;
    const indent = indentOf(text);
    if (indent >= limit) {
      // A list item at a deeper indent of an earlier sibling doesn't matter; but "- key:" at our level means we're in that item.
      continue;
    }
    const item = /^(\s*)-\s+(.*)$/.exec(text);
    if (item) {
      path.unshift('#');
      limit = indent;
      continue;
    }
    const key = /^\s*([^:#]+?):(\s|$)/.exec(text);
    if (key) { path.unshift(unquote(key[1]!)); limit = indent; }
  }
  if (startsItem) path.push('#');
  // "- key: value" lines inside a list put the remaining keys of that item at indent + 2.
  if (valueMatch) return { path, at: 'value', key: unquote(valueMatch[3]!), from: pos - valueMatch[4]!.length };
  return { path, at: 'key', from: pos - keyMatch![3]!.length };
}

/** JSON: use the syntax tree (Property / PropertyName / Array nodes). */
function jsonPosition(state: EditorState, pos: number): Position | null {
  const node = syntaxTree(state).resolveInner(pos, -1);
  const word = /"?[\w$./{}-]*$/.exec(state.doc.sliceString(Math.max(0, pos - 80), pos))?.[0] ?? '';
  const nameOf = (property: SyntaxNode) => {
    const name = property.getChild('PropertyName');
    return name ? unquote(state.doc.sliceString(name.from, name.to)) : '';
  };
  let at: Position['at'] = 'key';
  let key: string | undefined;
  // Start from the object that will hold the key (or the value being typed).
  let start: SyntaxNode | null = node;
  if (node.name === 'PropertyName') start = node.parent?.parent ?? null;
  else if (node.parent?.name === 'Property' && node.name !== 'Object' && node.name !== 'Array') {
    at = 'value';
    key = nameOf(node.parent);
    start = node.parent.parent;
  }
  const path: string[] = [];
  for (let current = start; current; current = current.parent) {
    if (current.name === 'Property') path.unshift(nameOf(current));
    else if (current.name === 'Array') path.unshift('#');
  }
  return { path, at, key, from: pos - word.length, quoted: word.startsWith('"') };
}

/* ── Completion source ──────────────────────────────────────────────── */

/** `refs()` returns the local $ref targets of the last parse (e.g. "#/components/schemas/Post"). */
export function openApiCompletion(format: () => 'yaml' | 'json', refs: () => string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const isJson = format() === 'json';
    const position = isJson ? jsonPosition(context.state, context.pos) : yamlPosition(context.state, context.pos);
    if (!position) return null;
    const { path, at, from } = position;
    const word = context.state.doc.sliceString(from, context.pos);
    if (!context.explicit && word.replace(/["']/g, '').length === 0 && at === 'key' && !isJson) {
      // In YAML, only open on typing (or Ctrl+Space) to keep Enter for new lines.
      const lineText = context.state.doc.lineAt(context.pos).text;
      if (lineText.trim() === '') return null;
    }
    const indent = ' '.repeat(indentOf(context.state.doc.lineAt(context.pos).text) + 2);

    if (at === 'value') {
      const key = position.key ?? '';
      let options: Completion[] = [];
      if (key === '$ref') options = refs().map((ref) => ({ label: ref, type: 'variable', apply: isJson ? `"${ref}"` : `'${ref}'` }));
      else if (values[key]) options = values[key]!.map((value) => ({ label: value, type: 'enum', apply: isJson && !['true', 'false'].includes(value) ? `"${value}"` : value }));
      if (!options.length) return null;
      return { from, options, validFor: /^["']?[\w#/.-]*$/ };
    }

    const where = contextFor(path);
    if (!where) return null;
    const keyLabel = (key: string, detail: string, object?: boolean): Completion => ({
      label: key,
      detail,
      type: 'property',
      apply: isJson ? `"${key}": ${object ? '{}' : ''}` : object ? `${key}:\n${indent}` : `${key}: `,
    });
    let options: Completion[];
    if (where.kind === 'codes') options = statusCodes.map(([code, detail]) => keyLabel(code === 'default' ? code : isJson ? code : `'${code}'`, detail, true));
    else if (where.kind === 'media') options = mediaTypes.map((type) => keyLabel(type, 'tipo de mídia', true));
    else options = where.list.map(([key, detail, object]) => keyLabel(key, detail, object));
    return { from, options, validFor: /^["']?[\w$/.-]*$/ };
  };
}
