import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Download, Lock, Paperclip, Play, Trash2, WandSparkles } from 'lucide-react';
import {
  Alert, Button, Checkbox, CodeBlock, CodeTabs, CopyButton, JsonEditor, IconButton, Kbd, KbdGroup, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
  Tabs, TabsContent, TabsList, TabsTrigger, cx,
} from '../../design-system';
import { buildSamples, type SampleBody } from './samples';
import {
  exampleFor, exampleText, mergeAllOf, sampleAuthFor, sampleBodyFor, serverUrl,
  type MediaType, type Operation, type Parameter, type SecurityRequirement, type SecurityScheme, type ServerInfo,
} from './spec';
import { useDocsMessages, type DocsMessages } from './messages';

/* API client in the right column, modeled on Postman/Insomnia/Bruno: a request bar
   (method, URL, Send), key-value tables for params and headers, an auth tab for any of the
   operation's security schemes, a body editor with every body type Postman and Bruno offer (none,
   form-data with files, x-www-form-urlencoded, raw JSON/XML/text/HTML/JavaScript/SPARQL, a binary
   file and GraphQL; the types the spec declares come first, with its schema and examples) and a response pane that shows text, images or a download for binary bodies.
   Credentials, the chosen server and its variables are shared by every endpoint on the page. */

const statusText: Record<number, string> = {
  200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 402: 'Payment Required', 403: 'Forbidden',
  404: 'Not Found', 409: 'Conflict', 422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error',
};
const tone = (status: number) => (status < 300 ? 'success' : status < 400 ? 'info' : status < 500 ? 'warning' : 'danger');
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const formatBytes = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);
const MASK = '••••••••';

/* ── Shared connection (credentials, server choice and variables) ── */

type Credentials = Record<string, string>;
interface Connection {
  credentials: Record<string, Credentials>;
  setCredential: (scheme: string, field: string, value: string) => void;
  serverChoice: Record<string, string>;
  chooseServer: (setKey: string, url: string) => void;
  serverValues: Record<string, Record<string, string>>;
  setServerValue: (url: string, name: string, value: string) => void;
}
const ConnectionContext = createContext<Connection | null>(null);

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Connection['credentials']>({});
  const [serverChoice, setServerChoice] = useState<Connection['serverChoice']>({});
  const [serverValues, setServerValues] = useState<Connection['serverValues']>({});
  const setCredential = useCallback((scheme: string, field: string, value: string) => setCredentials((all) => ({ ...all, [scheme]: { ...all[scheme], [field]: value } })), []);
  const chooseServer = useCallback((setKey: string, url: string) => setServerChoice((all) => ({ ...all, [setKey]: url })), []);
  const setServerValue = useCallback((url: string, name: string, value: string) => setServerValues((all) => ({ ...all, [url]: { ...all[url], [name]: value } })), []);
  const value = useMemo(() => ({ credentials, setCredential, serverChoice, chooseServer, serverValues, setServerValue }), [credentials, setCredential, serverChoice, chooseServer, serverValues, setServerValue]);
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

function useConnection() {
  const context = useContext(ConnectionContext);
  if (!context) throw new Error('Playground must be inside PlaygroundProvider');
  return context;
}

/* ── Auth ──────────────────────────────────────────────────────────── */

const utf8Base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
const isFilled = (scheme: SecurityScheme, credentials: Credentials = {}) =>
  scheme.type === 'http' && scheme.scheme === 'basic' ? Boolean(credentials.username) : Boolean(credentials.value);

/** Headers and query parameters a requirement adds to the request (real values, or masked for display). */
function applyAuth(requirement: SecurityRequirement | undefined, all: Connection['credentials'], masked: boolean) {
  const headers: Array<[string, string]> = [];
  const query: Array<[string, string]> = [];
  for (const { scheme } of requirement ?? []) {
    const credentials = all[scheme.key] ?? {};
    if (!isFilled(scheme, credentials)) continue;
    if (scheme.type === 'apiKey') {
      const value = masked ? MASK : credentials.value!;
      if (scheme.in === 'header') headers.push([scheme.name, value]);
      if (scheme.in === 'query') query.push([scheme.name, value]);
      // Cookies can't be set from fetch(); the Auth tab says so.
    } else if (scheme.type === 'http' && scheme.scheme === 'basic') {
      headers.push(['Authorization', `Basic ${masked ? MASK : utf8Base64(`${credentials.username}:${credentials.password ?? ''}`)}`]);
    } else {
      headers.push(['Authorization', `Bearer ${masked ? MASK : credentials.value!}`]);
    }
  }
  return { headers, query };
}

export function schemeLabel(scheme: SecurityScheme, t: DocsMessages) {
  if (scheme.type === 'apiKey') return t.apiKeyIn(scheme.in);
  if (scheme.type === 'http') return scheme.scheme === 'basic' ? t.basicAuth : t.bearerToken;
  if (scheme.type === 'oauth2') return 'OAuth 2.0';
  return 'OpenID Connect';
}

/* ── Body types (Postman / Bruno) ─────────────────────────────────── */

export type PlayKind = 'none' | 'json' | 'form' | 'multipart' | 'text' | 'binary' | 'graphql';
type BodyGroup = 'api' | 'none' | 'form' | 'raw' | 'other';
export interface BodyOption {
  /** Stable id, also what is saved: the built-in type's key, or `api:<content type>`. */
  key: string;
  label: string;
  contentType: string;
  kind: PlayKind;
  group: BodyGroup;
  /** Declared by the spec: its schema and examples. */
  media?: MediaType;
}

const baseType = (contentType: string) => contentType.split(';')[0]!.trim().toLowerCase();
const isBinaryType = (contentType: string) => /^(image|audio|video|font)\/|octet-stream|^application\/(pdf|zip|gzip)/.test(baseType(contentType));

function builtInBodies(t: DocsMessages): BodyOption[] {
  const raw = (key: string, label: string, contentType: string, kind: PlayKind = 'text'): BodyOption => ({ key, label, contentType, kind, group: 'raw' });
  return [
    { key: 'none', label: t.bodyNone, contentType: '', kind: 'none', group: 'none' },
    { key: 'multipart', label: 'Form data', contentType: 'multipart/form-data', kind: 'multipart', group: 'form' },
    { key: 'form', label: 'x-www-form-urlencoded', contentType: 'application/x-www-form-urlencoded', kind: 'form', group: 'form' },
    raw('json', 'JSON', 'application/json', 'json'),
    raw('xml', 'XML', 'application/xml'),
    raw('text', 'Text', 'text/plain'),
    raw('html', 'HTML', 'text/html'),
    raw('javascript', 'JavaScript', 'application/javascript'),
    raw('sparql', 'SPARQL', 'application/sparql-query'),
    { key: 'binary', label: t.bodyBinary, contentType: 'application/octet-stream', kind: 'binary', group: 'other' },
    { key: 'graphql', label: 'GraphQL', contentType: 'application/json', kind: 'graphql', group: 'other' },
  ];
}

/** The spec's content types first (in its order), then every other built-in type. */
function bodyOptions(media: MediaType[], t: DocsMessages): BodyOption[] {
  const builtIns = builtInBodies(t);
  const declared = media.map((item): BodyOption => {
    const kind: PlayKind = isBinaryType(item.contentType) ? 'binary' : item.kind;
    const match = builtIns.find((option) => option.kind === kind && baseType(option.contentType) === baseType(item.contentType));
    return { key: match?.key ?? `api:${item.contentType}`, label: match?.label ?? item.contentType, contentType: item.contentType, kind, group: 'api', media: item };
  });
  return [...declared, ...builtIns.filter((option) => !declared.some((item) => item.key === option.key))];
}

/* ── Key-value table (Postman style) ──────────────────────────────── */

interface Row {
  id: number;
  key: string;
  value: string;
  enabled: boolean;
  /** Defined by the spec: the key can't be renamed or the row removed. */
  locked?: boolean;
  required?: boolean;
  description?: string;
  /** For params: where it goes. */
  location?: 'path' | 'query';
  /** Multipart file field: the chosen file (not persisted). */
  file?: boolean;
  blob?: File;
}

let rowId = 0;
const newRow = (patch: Partial<Row> = {}): Row => ({ id: ++rowId, key: '', value: '', enabled: true, ...patch });

function fromParameter(parameter: Parameter): Row {
  const example = parameter.schema.example ?? (parameter.in === 'path' ? exampleFor(parameter.schema) : undefined);
  return newRow({
    key: parameter.name,
    value: example === undefined ? '' : String(example),
    locked: true,
    required: parameter.required,
    description: parameter.description,
    location: parameter.in === 'path' ? 'path' : 'query',
    // Optional spec params start unchecked, like an empty slot to fill in.
    enabled: parameter.required || example !== undefined,
  });
}

/** Every spec parameter filled with its example and turned on ("Fill with example"). */
function exampleRow(parameter: Parameter): Row {
  const example = parameter.schema.example ?? exampleFor(parameter.schema);
  return { ...fromParameter(parameter), value: example === undefined || example === null ? '' : String(example), enabled: true };
}

/** Form / multipart fields from the schema (locked, with the example's values) for a body example. */
function formRows(media: MediaType, exampleIndex: number): Row[] {
  const sample = sampleBodyFor(media, media.examples[exampleIndex]);
  const schema = mergeAllOf(media.schema ?? {});
  const required = new Set(schema.required ?? []);
  const fields = sample?.kind === 'multipart' ? sample.fields : sample?.kind === 'form' ? sample.fields.map(([name, value]) => ({ name, value, file: false })) : [];
  const names = [...new Set([...Object.keys(schema.properties ?? {}), ...fields.map((field) => field.name)])];
  return names.map((name) => {
    const field = fields.find((item) => item.name === name);
    const property = schema.properties?.[name];
    return newRow({
      key: name,
      value: field?.value ?? '',
      locked: Boolean(property),
      required: required.has(name),
      description: property?.description,
      file: property?.format === 'binary',
      enabled: required.has(name) || Boolean(field?.value),
    });
  });
}

/* What was typed in each endpoint's client survives reloads (never credentials or files). */
type SavedRow = Pick<Row, 'key' | 'value' | 'enabled'>;
interface Saved { params: SavedRow[]; headers: SavedRow[]; body: string; contentType?: string; fields?: SavedRow[]; query?: string; variables?: string }
const storageKey = (operation: Operation) => `opendoc-docs:request:${operation.id}`;
const pick = (rows: Row[]) => rows.map(({ key, value, enabled }) => ({ key, value, enabled }));

function readSaved(operation: Operation): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(operation));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch { return null; }
}

/** Spec rows keep their definition and take the saved value; rows the reader added come back after them. */
function restore(base: Row[], saved: SavedRow[] | undefined): Row[] {
  if (!saved) return base;
  const restored = base.map((row) => {
    const match = saved.find((item) => item.key === row.key);
    return match ? { ...row, value: match.value, enabled: row.required || match.enabled } : row;
  });
  const extra = saved.filter((item) => item.key && !base.some((row) => row.key === item.key)).map((item) => newRow({ ...item, location: 'query' }));
  return [...restored, ...extra];
}

function KeyValueTable({ label, rows, onChange, readOnly = [], addLabel, allowFiles = false }: {
  label: string;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  /** Computed rows shown first (e.g. Authorization), not editable. */
  readOnly?: Array<{ key: string; value: string; note: string }>;
  addLabel: string;
  /** form-data: rows the reader added can switch between text and file (Postman's Text / File). */
  allowFiles?: boolean;
}) {
  const t = useDocsMessages();
  const update = (id: number, patch: Partial<Row>) => onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  // Typing in the blank last row turns it into a real row (and a new blank one appears);
  // the caret moves to the same cell of the new row so typing continues uninterrupted.
  const focusNext = useRef<{ id: number; field: 'key' | 'value' } | null>(null);
  const fromDraft = (field: 'key' | 'value', text: string) => {
    const row = newRow({ [field]: text, location: 'query' });
    focusNext.current = { id: row.id, field };
    onChange([...rows, row]);
  };
  const focusRef = (id: number, field: 'key' | 'value') => (element: HTMLInputElement | null) => {
    if (!element || focusNext.current?.id !== id || focusNext.current.field !== field) return;
    focusNext.current = null;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  };
  return (
    <table className="rd-kv" aria-label={label}>
      <thead>
        <tr>
          <th scope="col" className="rd-kv__check"><span className="ds-sr-only">{t.enabled}</span></th>
          <th scope="col">{t.key}</th>
          <th scope="col">{t.value}</th>
          <th scope="col" className="rd-kv__actions"><span className="ds-sr-only">{t.actions}</span></th>
        </tr>
      </thead>
      <tbody>
        {readOnly.map((row) => (
          <tr key={row.key} className="is-readonly">
            <td className="rd-kv__check"><Lock className="rd-kv__lock" aria-hidden="true" /></td>
            <td><span className="rd-kv__text">{row.key}</span></td>
            <td><span className="rd-kv__text rd-kv__text--muted" title={row.note}>{row.value}</span></td>
            <td className="rd-kv__actions"><span className="ds-sr-only">{row.note}</span></td>
          </tr>
        ))}
        {rows.map((row) => (
          <tr key={row.id} className={cx(!row.enabled && 'is-disabled')}>
            <td className="rd-kv__check">
              <Checkbox
                checked={row.enabled}
                disabled={row.required}
                onCheckedChange={(checked) => update(row.id, { enabled: checked === true })}
                aria-label={t.sendRow(row.key || t.row)}
              />
            </td>
            <td>
              {row.locked ? (
                <span className="rd-kv__text" title={row.description}>
                  {row.key}
                  {row.required && <span className="rd-kv__required" aria-label={t.requiredMark}>*</span>}
                  {row.location === 'path' && <span className="rd-kv__tag">path</span>}
                  {row.file && <span className="rd-kv__tag">file</span>}
                </span>
              ) : (
                <span className="rd-kv__key">
                  <input ref={focusRef(row.id, 'key')} className="rd-kv__input" value={row.key} onChange={(event) => update(row.id, { key: event.target.value })} placeholder={t.key} aria-label={t.key} spellCheck={false} autoComplete="off" />
                  {allowFiles && (
                    <button
                      type="button"
                      className="rd-kv__as-file"
                      aria-pressed={Boolean(row.file)}
                      aria-label={t.sendAsFile(row.key || t.row)}
                      title={t.sendAsFile(row.key || t.row)}
                      onClick={() => update(row.id, { file: !row.file, value: '', blob: undefined })}
                    >
                      <Paperclip aria-hidden="true" />
                    </button>
                  )}
                </span>
              )}
            </td>
            <td>
              {row.file ? (
                <input
                  type="file"
                  className="rd-kv__file"
                  onChange={(event) => { const blob = event.target.files?.[0]; update(row.id, { blob, value: blob?.name ?? '', enabled: row.enabled || Boolean(blob) }); }}
                  aria-label={t.chooseFile(row.key)}
                />
              ) : (
                <input
                  ref={focusRef(row.id, 'value')}
                  className="rd-kv__input"
                  value={row.value}
                  onChange={(event) => update(row.id, { value: event.target.value, enabled: row.enabled || Boolean(event.target.value) })}
                  placeholder={row.description ?? t.value}
                  aria-label={t.valueOf(row.key || t.row)}
                  spellCheck={false}
                  autoComplete="off"
                />
              )}
            </td>
            <td className="rd-kv__actions">
              {!row.locked && <IconButton icon={<Trash2 />} size="sm" aria-label={t.removeRow(row.key || t.row)} tooltip={false} onClick={() => onChange(rows.filter((item) => item.id !== row.id))} />}
            </td>
          </tr>
        ))}
        <tr className="is-draft">
          <td className="rd-kv__check" />
          <td><input className="rd-kv__input" value="" onChange={(event) => fromDraft('key', event.target.value)} placeholder={addLabel} aria-label={addLabel} spellCheck={false} autoComplete="off" /></td>
          <td><input className="rd-kv__input" value="" onChange={(event) => fromDraft('value', event.target.value)} placeholder={t.value} aria-label={t.draftValue(addLabel)} spellCheck={false} autoComplete="off" /></td>
          <td className="rd-kv__actions" />
        </tr>
      </tbody>
    </table>
  );
}

const MAX_LINES = 400;

/** Response body, cut to the first lines when it is very long (highlighting thousands of lines is slow). */
function ResponseBody({ text, contentType }: { text: string; contentType: string }) {
  const t = useDocsMessages();
  const lines = text.split('\n');
  const cut = lines.length > MAX_LINES;
  const shown = cut ? lines.slice(0, MAX_LINES).join('\n') : text;
  const language = /json/.test(contentType) || /^\s*[[{]/.test(text) ? 'json' : /xml|html/.test(contentType) ? 'xml' : undefined;
  return (
    <>
      <CodeBlock code={shown} language={language} bare className="rd-pm__output" />
      {cut && <p className="rd-pm__truncated">{t.truncated(MAX_LINES, lines.length)}</p>}
    </>
  );
}

/* ── Playground ───────────────────────────────────────────────────── */

interface Result {
  status: number;
  ms: number;
  size: number;
  headers: Array<[string, string]>;
  server: string;
  contentType: string;
  /** text: shown in the code view; image: shown inline; binary: offered as a download. */
  kind: 'text' | 'image' | 'binary' | 'empty';
  text?: string;
  /** Object URL of the body (images and downloads). */
  objectUrl?: string;
  fileName: string;
}

const isTextual = (contentType: string) => !contentType || /json|text\/|xml|javascript|html|csv|x-www-form-urlencoded/.test(contentType);
const fileNameFor = (url: string, contentType: string) => {
  const last = new URL(url).pathname.split('/').filter(Boolean).pop() ?? 'resposta';
  if (/\.\w+$/.test(last)) return last;
  const extension = contentType.split(';')[0]!.split('/')[1]?.replace(/^x-/, '').replace('octet-stream', 'bin').replace('plain', 'txt') ?? 'bin';
  return `${last}.${extension}`;
};

/** All request state for one endpoint: shared by the client (right) and the live code example (center). */
export function usePlayground(operation: Operation) {
  const t = useDocsMessages();
  const { credentials, serverChoice, chooseServer, serverValues, setServerValue } = useConnection();
  const formId = useId();

  // Server: the operation's own servers (or the API's), the chosen one and its variables.
  const serverKey = operation.servers.map((item) => item.url).join('|');
  const server: ServerInfo = operation.servers.find((item) => item.url === serverChoice[serverKey]) ?? operation.servers[0]!;
  const variables = serverValues[server.url] ?? {};
  const base = serverUrl(server, variables);

  // Auth: one of the operation's alternatives, preferring one whose credentials are filled in.
  const filledIndex = operation.security.findIndex((requirement) => requirement.every(({ scheme }) => isFilled(scheme, credentials[scheme.key])));
  const [authChoice, setAuthIndex] = useState<number>();
  const authIndex = authChoice ?? Math.max(0, filledIndex);
  const requirement = operation.security[authIndex];

  // Body: the type (the spec's content types, then every Postman/Bruno type), its example, and the
  // editor state. Each family keeps its own state, so switching types never loses what was typed:
  // raw types share one text, form types share the rows, GraphQL has its query and variables.
  const media = operation.body?.media ?? [];
  const options = useMemo(() => bodyOptions(media, t), [media, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const saved = useMemo(() => readSaved(operation), [operation]);
  const [mediaIndex, setMediaIndex] = useState(() => Math.max(0, options.findIndex((item) => item.key === saved?.contentType)));
  const current: BodyOption | undefined = operation.body ? options[mediaIndex] : undefined;
  const kind: PlayKind = current?.kind ?? 'none';
  const [exampleIndex, setExampleIndex] = useState(0);
  const [params, setParams] = useState<Row[]>(() => restore([...operation.parameters.path, ...operation.parameters.query].map(fromParameter), saved?.params));
  const [headerRows, setHeaderRows] = useState<Row[]>(() => restore(operation.parameters.header.map(fromParameter), saved?.headers));
  const sameType = saved?.contentType === current?.key;
  const [body, setBody] = useState(() => (saved && sameType ? saved.body : current?.media ? exampleText(current.media) : ''));
  const [fields, setFields] = useState<Row[]>(() => {
    const base = current?.media && (kind === 'form' || kind === 'multipart') ? formRows(current.media, 0) : [];
    return restore(base, sameType ? saved?.fields : undefined);
  });
  const [graphqlQuery, setGraphqlQuery] = useState(() => saved?.query ?? '');
  const [graphqlVariables, setGraphqlVariables] = useState(() => saved?.variables ?? '');
  /** Binary body: the chosen file (not persisted). */
  const [file, setFile] = useState<File>();

  const loadExample = (nextIndex: number, nextExample: number) => {
    const target = options[nextIndex];
    setMediaIndex(nextIndex);
    setExampleIndex(nextExample);
    setBodyError(false);
    if (!target) return;
    // urlencoded can't carry files: file rows from form-data become plain text rows.
    if (target.kind === 'form') setFields((rows) => rows.map((row) => (row.file ? { ...row, file: false, blob: undefined } : row)));
    // A built-in type keeps what was typed; a spec type loads its example (as before).
    if (!target.media) return;
    if (target.kind === 'form' || target.kind === 'multipart') setFields(formRows(target.media, nextExample));
    else if (target.kind === 'json' || target.kind === 'text') setBody(exampleText(target.media, target.media.examples[nextExample]));
  };

  // Saved only when it differs from the spec's defaults, so a new example in the spec still shows up.
  const defaults = useMemo(() => JSON.stringify({
    params: pick([...operation.parameters.path, ...operation.parameters.query].map(fromParameter)),
    headers: pick(operation.parameters.header.map(fromParameter)),
    body: media[0] ? exampleText(media[0]) : '',
    contentType: operation.body ? options[0]?.key : undefined,
    fields: media[0] && (media[0].kind === 'form' || media[0].kind === 'multipart') ? pick(formRows(media[0], 0)) : [],
    query: '',
    variables: '',
  }), [operation]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const snapshot = JSON.stringify({ params: pick(params), headers: pick(headerRows), body, contentType: current?.key, fields: pick(fields.filter((row) => !row.file)), query: graphqlQuery, variables: graphqlVariables });
    try {
      if (snapshot === defaults) localStorage.removeItem(storageKey(operation));
      else localStorage.setItem(storageKey(operation), snapshot);
    } catch { /* storage unavailable */ }
  }, [operation, defaults, params, headerRows, body, current?.key, fields, graphqlQuery, graphqlVariables]);

  const [bodyError, setBodyError] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result>();
  /** Server that couldn't be reached; the message is built at render time, in the current language. */
  const [failure, setFailure] = useState<string>();
  // Object URLs of images/downloads are released when replaced or when the endpoint unmounts.
  useEffect(() => () => { if (result?.objectUrl) URL.revokeObjectURL(result.objectUrl); }, [result]);

  const pathValues = Object.fromEntries(params.filter((row) => row.location === 'path').map((row) => [row.key, row.value]));
  const path = operation.path.replace(/\{([^}]+)\}/g, (_, name: string) => (pathValues[name] ? encodeURIComponent(pathValues[name]!) : `{${name}}`));
  const queryPairs: Array<[string, string]> = params.filter((row) => row.location !== 'path' && row.enabled && row.key.trim()).map((row) => [row.key.trim(), row.value]);
  const realAuth = applyAuth(requirement, credentials, false);
  const shownAuth = applyAuth(requirement, credentials, true);
  const queryOf = (pairs: Array<[string, string]>, masked: Array<[string, string]> = []) => {
    // Masked credentials are appended as is, so the bar shows •••• rather than its percent-encoding.
    const text = [new URLSearchParams(pairs).toString(), ...masked.map(([key, value]) => `${encodeURIComponent(key)}=${value}`)].filter(Boolean).join('&');
    return text ? `?${text}` : '';
  };
  const query = queryOf(queryPairs, shownAuth.query);
  const url = `${base}${path}${query}`;
  const realUrl = `${base}${path}${queryOf([...queryPairs, ...realAuth.query])}`;

  const formFields = fields.filter((row) => row.enabled && row.key.trim());
  const hasBody = kind === 'form' || kind === 'multipart' ? formFields.length > 0
    : kind === 'binary' ? Boolean(file)
      : kind === 'graphql' ? Boolean(graphqlQuery.trim())
        : kind === 'none' ? false : Boolean(body.trim());
  // A binary body declared by the spec (image/png…) keeps its type; the generic one takes the file's.
  const bodyContentType = kind === 'binary' && !current?.media ? file?.type || current!.contentType : current?.contentType ?? '';
  const graphqlBody = () => {
    const parsed = graphqlVariables.trim() ? JSON.parse(graphqlVariables) as unknown : undefined;
    return { query: graphqlQuery, ...(parsed === undefined ? {} : { variables: parsed }) };
  };
  const sentHeaders: Array<[string, string]> = headerRows.filter((row) => row.enabled && row.key.trim()).map((row) => [row.key.trim(), row.value]);
  const unset = requirement?.filter(({ scheme }) => !isFilled(scheme, credentials[scheme.key])) ?? [];
  const autoHeaders = [
    ...shownAuth.headers.map(([key, value]) => ({ key, value, note: t.setByAuth })),
    ...unset.filter(({ scheme }) => !(scheme.type === 'apiKey' && scheme.in !== 'header')).map(({ scheme }) => ({ key: scheme.type === 'apiKey' ? scheme.name : 'Authorization', value: t.credentialUnset, note: t.setByAuth })),
    ...(hasBody && kind !== 'multipart' ? [{ key: 'Content-Type', value: bodyContentType, note: t.setByBody }] : []),
  ];

  let graphqlText: string | undefined;
  try { graphqlText = kind === 'graphql' ? pretty(graphqlBody()) : undefined; } catch { graphqlText = pretty({ query: graphqlQuery }); }
  // The binary sample is shown even before a file is picked (with a placeholder name), like multipart's.
  const sampleBody: SampleBody | undefined = !current ? undefined
    : kind === 'binary' ? { kind: 'file', contentType: bodyContentType, fileName: file?.name ?? 'arquivo.bin' }
      : !hasBody ? undefined
        : kind === 'form' ? { kind: 'form', contentType: current.contentType, fields: formFields.map((row) => [row.key.trim(), row.value]) }
          : kind === 'multipart' ? { kind: 'multipart', contentType: current.contentType, fields: formFields.map((row) => ({ name: row.key.trim(), value: row.value, file: row.file })) }
            : kind === 'graphql' ? { kind: 'json', contentType: current.contentType, text: graphqlText! }
              : { kind: kind === 'json' ? 'json' : 'text', contentType: current.contentType, text: body.trim() };
  const sampleAuth = sampleAuthFor(requirement?.[0]?.scheme);
  const samples = useMemo(
    () => buildSamples({ method: operation.method, url: `${base}${path}${queryOf(queryPairs)}`, headers: sentHeaders, auth: sampleAuth, body: sampleBody }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operation.method, base, path, JSON.stringify(queryPairs), JSON.stringify(sentHeaders), JSON.stringify(sampleAuth), JSON.stringify(sampleBody)],
  );
  const activeParams = queryPairs.length + params.filter((row) => row.location === 'path').length;
  const activeHeaders = autoHeaders.length + sentHeaders.length;

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (pending) return;
    setFailure(undefined);
    let payload: BodyInit | undefined;
    if (hasBody && current) {
      if (kind === 'json') {
        try { payload = JSON.stringify(JSON.parse(body)); } catch { setBodyError(true); return; }
      } else if (kind === 'graphql') {
        try { payload = JSON.stringify(graphqlBody()); } catch { setBodyError(true); return; }
      } else if (kind === 'binary') {
        payload = file;
      } else if (kind === 'form') {
        payload = new URLSearchParams(formFields.map((row) => [row.key.trim(), row.value]));
      } else if (kind === 'multipart') {
        const form = new FormData();
        for (const row of formFields) {
          if (row.file) { if (row.blob) form.append(row.key.trim(), row.blob, row.blob.name); } else form.append(row.key.trim(), row.value);
        }
        payload = form;
      } else {
        payload = body;
      }
    }
    setBodyError(false);
    setPending(true);
    const started = performance.now();
    try {
      const headers = new Headers([...sentHeaders, ...realAuth.headers]);
      // FormData sets its own Content-Type with the boundary.
      if (payload !== undefined && kind !== 'multipart' && !headers.has('Content-Type')) headers.set('Content-Type', bodyContentType);
      const response = await fetch(realUrl, { method: operation.method, headers, body: payload });
      const contentType = response.headers.get('content-type') ?? '';
      const common = { status: response.status, ms: 0, headers: [...response.headers.entries()], server: server.description, contentType, fileName: fileNameFor(realUrl, contentType) };
      if (isTextual(contentType)) {
        const text = await response.text();
        let shown = text;
        try { if (/json/.test(contentType) || /^\s*[[{]/.test(text)) shown = pretty(JSON.parse(text)); } catch { /* not JSON: show as is */ }
        setResult({ ...common, ms: Math.round(performance.now() - started), size: new Blob([text]).size, kind: text ? 'text' : 'empty', text: text ? shown : undefined });
      } else {
        const blob = await response.blob();
        setResult({ ...common, ms: Math.round(performance.now() - started), size: blob.size, kind: blob.size === 0 ? 'empty' : /^image\//.test(contentType) ? 'image' : 'binary', objectUrl: URL.createObjectURL(blob) });
      }
    } catch {
      setResult(undefined);
      setFailure(server.description);
    } finally {
      setPending(false);
    }
  };

  // ⌘/Ctrl+Enter sends from anywhere in the client, like Postman and Insomnia.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void send();
    }
  };

  /** Every field with its example from the spec (also a way back from edits). */
  const fillExample = () => {
    setParams([...operation.parameters.path, ...operation.parameters.query].map(exampleRow));
    setHeaderRows(operation.parameters.header.map(exampleRow));
    loadExample(mediaIndex, exampleIndex);
    setResult(undefined);
    setFailure(undefined);
  };

  const formatBody = () => {
    try { setBody(pretty(JSON.parse(body))); setBodyError(false); } catch { setBodyError(true); }
  };

  return {
    operation, formId, server, serverKey, variables, base, chooseServer, setServerValue,
    authIndex, setAuthIndex, requirement,
    options, mediaIndex, current, kind, exampleIndex, loadExample, body, setBody, fields, setFields, bodyError, setBodyError,
    graphqlQuery, setGraphqlQuery, graphqlVariables, setGraphqlVariables, file, setFile,
    params, setParams, headerRows, setHeaderRows,
    pending, result, setResult, failure, setFailure, path, query, url, autoHeaders, samples, activeParams, activeHeaders, send, onKeyDown, formatBody, fillExample,
  };
}

export type PlaygroundState = ReturnType<typeof usePlayground>;

/** Live code example for the current request. */
export function PlaygroundCode({ play }: { play: PlaygroundState }) {
  const t = useDocsMessages();
  return <CodeTabs syncKey="docs-lang" label={t.requestExample(play.operation.summary)} examples={play.samples} />;
}

/** Credentials for each scheme of the chosen alternative; shared by the whole page, kept only in this tab. */
function AuthPanel({ play }: { play: PlaygroundState }) {
  const t = useDocsMessages();
  const { credentials, setCredential } = useConnection();
  const { operation, formId, authIndex, setAuthIndex, requirement } = play;
  return (
    <div className="rd-pm__auth-panel">
      {operation.security.length > 1 && (
        <div className="rd-pm__auth">
          <span className="rd-pm__auth-label" aria-hidden="true">{t.authMethod}</span>
          <Select value={String(authIndex)} onValueChange={(value) => setAuthIndex(Number(value))}>
            <SelectTrigger size="sm" aria-label={t.authMethod} className="rd-pm__auth-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {operation.security.map((alternative, index) => (
                <SelectItem key={index} value={String(index)}>{alternative.map(({ scheme }) => schemeLabel(scheme, t)).join(' + ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {requirement?.map(({ scheme, scopes }) => {
        const values = credentials[scheme.key] ?? {};
        const id = `${formId}-${scheme.key}`;
        const field = (name: string, label: string, secret: boolean, placeholder?: string) => (
          <>
            <label className="rd-pm__auth-label" htmlFor={`${id}-${name}`}>{label}</label>
            <input
              id={`${id}-${name}`}
              className="rd-pm__auth-input"
              type={secret ? 'password' : 'text'}
              value={values[name] ?? ''}
              onChange={(event) => setCredential(scheme.key, name, event.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
            />
          </>
        );
        return (
          <fieldset key={scheme.key} className="rd-pm__auth-scheme">
            <legend className="rd-pm__auth-type">{schemeLabel(scheme, t)}</legend>
            {scheme.description && <p className="rd-pm__hint">{scheme.description}</p>}
            <div className="rd-pm__auth">
              {scheme.type === 'http' && scheme.scheme === 'basic' ? (
                <>
                  {field('username', t.username, false)}
                  {field('password', t.password, true)}
                </>
              ) : field('value', scheme.type === 'apiKey' ? t.apiKeyValue : t.token, true, scheme.type === 'apiKey' ? undefined : 'token')}
            </div>
            {scheme.type === 'apiKey' && <p className="rd-pm__hint">{t.apiKeyWhere(scheme.in, scheme.name)}</p>}
            {scheme.type === 'oauth2' && (
              <div className="rd-pm__oauth">
                <p className="rd-pm__hint">{t.oauthTokenHint}</p>
                <dl className="rd-pm__oauth-flows">
                  {Object.entries(scheme.flows).map(([flow, details]) => (
                    <div key={flow}>
                      <dt>{t.oauthFlow(flow)}</dt>
                      <dd>
                        {details.authorizationUrl && <code>{details.authorizationUrl}</code>}
                        {details.tokenUrl && <code>{details.tokenUrl}</code>}
                      </dd>
                    </div>
                  ))}
                </dl>
                {scopes.length > 0 && <p className="rd-pm__hint">{t.oauthScopes} {scopes.map((scope) => <code key={scope}>{scope}</code>)}</p>}
              </div>
            )}
            <p className="rd-pm__hint">{t.credentialHint} <code>${scheme.env}</code>.</p>
          </fieldset>
        );
      })}
    </div>
  );
}

/** Body editor for the chosen type: JSON editor, key-value fields (form, multipart), plain text, a file or GraphQL. */
function BodyPanel({ play }: { play: PlaygroundState }) {
  const t = useDocsMessages();
  const {
    formId, options, mediaIndex, current, kind, exampleIndex, loadExample, body, setBody, fields, setFields, bodyError, setBodyError, formatBody,
    graphqlQuery, setGraphqlQuery, graphqlVariables, setGraphqlVariables, file, setFile,
  } = play;
  if (!current) return null;
  const examples = current.media?.examples ?? [];
  const groups: Array<[BodyOption['group'], string | undefined]> = [
    ['api', t.bodyGroupApi], ['none', undefined], ['form', t.bodyGroupForm], ['raw', t.bodyGroupRaw], ['other', t.bodyGroupOther],
  ];
  const errorId = `${formId}-body-error`;
  return (
    <>
      <div className="rd-pm__body-bar">
        <Select value={String(mediaIndex)} onValueChange={(value) => loadExample(Number(value), 0)}>
          <SelectTrigger size="sm" className="rd-pm__body-select" aria-label={t.bodyType}><SelectValue /></SelectTrigger>
          <SelectContent className="rd-pm__body-menu">
            {groups.map(([group, label], position) => {
              const items = options.map((option, index) => ({ option, index })).filter(({ option }) => option.group === group);
              if (!items.length) return null;
              return (
                <SelectGroup key={group}>
                  {position > 0 && <SelectSeparator />}
                  {label && <SelectLabel>{label}</SelectLabel>}
                  {items.map(({ option, index }) => <SelectItem key={option.key} value={String(index)}>{option.label}</SelectItem>)}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>
        <div className="rd-pm__body-tools">
          {examples.length > 1 && (
            <Select value={String(exampleIndex)} onValueChange={(value) => loadExample(mediaIndex, Number(value))}>
              <SelectTrigger size="sm" className="rd-pm__body-select" aria-label={t.bodyExample}><SelectValue /></SelectTrigger>
              <SelectContent align="end">
                {examples.map((example, index) => <SelectItem key={example.name} value={String(index)}>{example.summary ?? example.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {kind === 'json' && <Button type="button" variant="ghost" size="sm" onClick={formatBody}>{t.format}</Button>}
        </div>
      </div>
      {kind === 'none' && <p className="rd-pm__response-empty">{t.bodyNoneHint}</p>}
      {kind === 'json' && (
        <JsonEditor
          value={body}
          onChange={(next) => { setBody(next); if (bodyError) setBodyError(false); }}
          label={t.bodyAsJson}
          invalid={bodyError}
          describedBy={bodyError ? errorId : undefined}
          placeholder="{ }"
          className="rd-pm__editor"
        />
      )}
      {(kind === 'form' || kind === 'multipart') && (
        <KeyValueTable label={t.bodyFields} rows={fields} onChange={setFields} addLabel={t.newField} allowFiles={kind === 'multipart'} />
      )}
      {kind === 'text' && (
        <textarea className="rd-pm__textarea" value={body} onChange={(event) => setBody(event.target.value)} aria-label={t.bodyAsText(current.contentType)} spellCheck={false} rows={8} />
      )}
      {kind === 'binary' && (
        <div className="rd-pm__binary">
          <input type="file" className="rd-kv__file" onChange={(event) => setFile(event.target.files?.[0])} aria-label={t.bodyFile} aria-describedby={`${formId}-file-hint`} />
          <p id={`${formId}-file-hint`} className="rd-pm__hint">
            {file ? t.bodyFileChosen(file.name, formatBytes(file.size), file.type || 'application/octet-stream') : t.bodyFileHint}
          </p>
        </div>
      )}
      {kind === 'graphql' && (
        <div className="rd-pm__graphql">
          <label className="rd-pm__body-label" htmlFor={`${formId}-query`}>{t.graphqlQuery}</label>
          <textarea
            id={`${formId}-query`}
            className="rd-pm__textarea"
            value={graphqlQuery}
            onChange={(event) => setGraphqlQuery(event.target.value)}
            placeholder={'query {\n  posts {\n    id\n    title\n  }\n}'}
            spellCheck={false}
            rows={7}
          />
          <span className="rd-pm__body-label" aria-hidden="true">{t.graphqlVariables}</span>
          <JsonEditor
            value={graphqlVariables}
            onChange={(next) => { setGraphqlVariables(next); if (bodyError) setBodyError(false); }}
            label={t.graphqlVariables}
            invalid={bodyError}
            describedBy={bodyError ? errorId : undefined}
            placeholder="{ }"
            className="rd-pm__editor rd-pm__editor--small"
          />
        </div>
      )}
      {bodyError && <p id={errorId} className="rd-pm__error">{kind === 'graphql' ? t.invalidVariables : t.invalidJson}</p>}
    </>
  );
}

/** Postman-style client for the right column. */
export function Playground({ play }: { play: PlaygroundState }) {
  const {
    operation, formId, server, serverKey, base, chooseServer, requirement,
    params, setParams, headerRows, setHeaderRows,
    pending, result, setResult, failure, setFailure, path, query, url, autoHeaders, activeParams, activeHeaders, send, onKeyDown, fillExample, samples,
  } = play;
  const { credentials } = useConnection();
  const curl = samples.find((sample) => sample.language === 'bash')?.code ?? '';
  const t = useDocsMessages();
  const pathParts = path.split(/(\{[^}]+\})/g).filter(Boolean);
  const authFilled = Boolean(requirement?.every(({ scheme }) => isFilled(scheme, credentials[scheme.key])));
  const reset = () => { setResult(undefined); setFailure(undefined); };

  return (
    <section className="rd-aside-block" aria-labelledby={`${formId}-title`}>
      <div className="rd-aside-block__header">
        <h4 id={`${formId}-title`} className="rd-aside-block__title">{t.tryIt}</h4>
        <div className="rd-aside-block__tools">
          <IconButton icon={<WandSparkles />} size="sm" aria-label={t.fillExample} onClick={fillExample} />
          <CopyButton value={curl} label={t.copyCurl} text="cURL" />
        </div>
        {operation.servers.length > 1 ? (
          <Select value={server.url} onValueChange={(value) => { chooseServer(serverKey, value); reset(); }}>
            <SelectTrigger size="sm" className="rd-pm__env" aria-label={t.server}><SelectValue /></SelectTrigger>
            <SelectContent align="end">
              {operation.servers.map((item) => <SelectItem key={item.url} value={item.url}>{item.description}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="rd-pm__server-label" title={server.url}>{server.named ? server.description : t.server}</span>
        )}
      </div>
      {/* Server variables ({host}…) aren't editable here: the URL uses each one's default from the spec. */}
      <form id={formId} className="rd-pm" onSubmit={send} onKeyDown={onKeyDown} aria-label={t.apiClient(operation.summary)} noValidate>

        <div className="rd-pm__bar">
          <span className={cx('rd-pm__method', `ds-method--${operation.method.toLowerCase()}`)}>{operation.method}</span>
          <div className="rd-pm__url" title={url} tabIndex={0} role="textbox" aria-readonly="true" aria-label={t.requestUrl}>
            <span className="rd-pm__url-base">{base}</span>
            {pathParts.map((part, index) => <span key={index} className={cx(part.startsWith('{') && 'rd-pm__url-param')}>{part}</span>)}
            {query && <span className="rd-pm__url-query">{query}</span>}
          </div>
          <Button type="submit" size="sm" loading={pending} iconStart={<Play />} className="rd-pm__send">{t.send}</Button>
        </div>

        <Tabs defaultValue={params.length ? 'params' : operation.body ? 'body' : operation.security.length ? 'auth' : 'headers'} className="rd-pm__tabs">
          <TabsList variant="line" aria-label={t.requestSettings} className="rd-pm__tablist">
            <TabsTrigger value="params">Params{activeParams > 0 && <span className="rd-pm__count">{activeParams}</span>}</TabsTrigger>
            <TabsTrigger value="headers">Headers<span className="rd-pm__count">{activeHeaders}</span></TabsTrigger>
            {operation.security.length > 0 && <TabsTrigger value="auth">Auth{authFilled && <><span className="rd-pm__ok" aria-hidden="true" /><span className="ds-sr-only">{t.filled}</span></>}</TabsTrigger>}
            {operation.body && <TabsTrigger value="body">Body</TabsTrigger>}
          </TabsList>

          <TabsContent value="params" className="rd-pm__panel">
            <KeyValueTable label={t.parameters} rows={params} onChange={setParams} addLabel={t.newKey} />
          </TabsContent>

          <TabsContent value="headers" className="rd-pm__panel">
            <KeyValueTable label={t.headers} rows={headerRows} onChange={setHeaderRows} readOnly={autoHeaders} addLabel={t.newHeader} />
          </TabsContent>

          {operation.security.length > 0 && (
            <TabsContent value="auth" className="rd-pm__panel rd-pm__panel--pad">
              <AuthPanel play={play} />
            </TabsContent>
          )}

          {operation.body && (
            <TabsContent value="body" className="rd-pm__panel">
              <BodyPanel play={play} />
            </TabsContent>
          )}
        </Tabs>

        <section className="rd-pm__response" aria-label={t.response}>
          <div className="ds-sr-only" role="status" aria-live="polite">
            {pending ? t.sending : result ? t.announce(result.status, statusText[result.status] ?? '', result.ms) : ''}
          </div>
          {failure ? (
            <div className="rd-pm__response-empty">
              <Alert variant="destructive" title={t.connectionFailed}>
                <p>{t.failure(failure.toLowerCase())}</p>
                <p className="rd-pm__cors">{t.corsHint} <CopyButton value={curl} label={t.copyCurl} text={t.copyCurl} /></p>
              </Alert>
            </div>
          ) : result ? (
            <Tabs defaultValue="body" className="rd-pm__tabs">
              <div className="rd-pm__response-bar">
                <TabsList variant="line" aria-label={t.response} className="rd-pm__tablist rd-pm__tablist--flush">
                  <TabsTrigger value="body">Body</TabsTrigger>
                  <TabsTrigger value="headers">Headers<span className="rd-pm__count">{result.headers.length}</span></TabsTrigger>
                </TabsList>
                <div className="rd-pm__stats">
                  <span className={cx('rd-pm__status', `rd-pm__status--${tone(result.status)}`)}>{result.status} {statusText[result.status] ?? ''}</span>
                  <span>{result.ms} ms</span>
                  <span>{formatBytes(result.size)}</span>
                  {result.text !== undefined && <CopyButton value={result.text} label={t.copyResponse} />}
                  {result.kind !== 'empty' && <DownloadButton result={result} label={t.downloadResponse} />}
                </div>
              </div>
              <TabsContent value="body" className="rd-pm__panel">
                {result.kind === 'text' && <ResponseBody text={result.text!} contentType={result.contentType} />}
                {result.kind === 'image' && <div className="rd-pm__image"><img src={result.objectUrl} alt={t.responseImage} /></div>}
                {result.kind === 'binary' && (
                  <p className="rd-pm__response-empty">
                    {t.binaryReceived(result.contentType || 'application/octet-stream', formatBytes(result.size))}{' '}
                    <a href={result.objectUrl} download={result.fileName} className="rd-pm__download">{t.downloadFile(result.fileName)}</a>
                  </p>
                )}
                {result.kind === 'empty' && <p className="rd-pm__response-empty">{t.noBody}</p>}
              </TabsContent>
              <TabsContent value="headers" className="rd-pm__panel">
                <table className="rd-kv rd-kv--static" aria-label={t.responseHeaders}>
                  <tbody>
                    {result.headers.map(([key, value]) => (
                      <tr key={key}><td><span className="rd-kv__text">{key}</span></td><td><span className="rd-kv__text rd-kv__text--muted">{value}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              </TabsContent>
            </Tabs>
          ) : (
            <p className="rd-pm__response-empty">
              {pending ? t.sending : <>{t.sendToSee} <KbdGroup aria-hidden="true"><Kbd>⌘</Kbd><Kbd>↵</Kbd></KbdGroup></>}
            </p>
          )}
        </section>
      </form>
    </section>
  );
}

/** Saves the response body as a file (text bodies become a Blob on demand). */
function DownloadButton({ result, label }: { result: Result; label: string }) {
  const download = () => {
    const href = result.objectUrl ?? URL.createObjectURL(new Blob([result.text ?? ''], { type: result.contentType || 'text/plain' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = result.fileName;
    link.click();
    if (!result.objectUrl) setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  return <IconButton icon={<Download />} size="sm" aria-label={label} onClick={download} />;
}
