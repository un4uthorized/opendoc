import { useId, useState } from 'react';
import { cx } from '../cx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { CodeBlock } from './CodeBlock';
import { SchemaViewer, type Schema } from './SchemaViewer';
import { useDsMessages } from '../i18n';

const statusText: Record<number, string> = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 301: 'Moved Permanently', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 422: 'Unprocessable Entity',
  429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
};

export interface ApiResponse {
  status: number;
  description?: string;
  contentType?: string;
  example?: unknown;
  /** Named examples (OpenAPI `examples`); when there are several, a picker switches between them. */
  examples?: Array<{ name: string; summary?: string; value: unknown }>;
  schema?: Schema;
}

const tone = (status: number) => (status < 300 ? 'success' : status < 400 ? 'info' : status < 500 ? 'warning' : 'danger');

const isBinary = (response: ApiResponse) => Boolean(response.contentType && (/^(image|audio|video)\//.test(response.contentType) || /octet-stream|pdf|zip/.test(response.contentType) || response.schema?.format === 'binary'));
const languageOf = (contentType = 'application/json') => (/json/.test(contentType) ? 'json' : /xml|html/.test(contentType) ? 'xml' : undefined);
const asText = (value: unknown, contentType?: string) => (typeof value === 'string' && !/json/.test(contentType ?? 'json') ? value : JSON.stringify(value, null, 2));

/** Example (with a picker when there are several named ones) and schema of one response. Binary bodies are described, not shown. */
function ResponseBody({ response }: { response: ApiResponse }) {
  const t = useDsMessages();
  const examples = response.examples ?? (response.example !== undefined ? [{ name: 'example', value: response.example }] : []);
  const [selected, setSelected] = useState(0);
  const example = examples[Math.min(selected, examples.length - 1)];
  if (isBinary(response)) return <p className="ds-responses__empty">{t.binaryBody(response.contentType!)}</p>;
  // A plain string schema (text/plain, XML) has no fields worth a Schema tab.
  const showSchema = Boolean(response.schema && !(response.schema.type === 'string' && !response.schema.properties));
  if (!example && !showSchema) return <p className="ds-responses__empty">{response.contentType ? response.contentType : t.noBody}</p>;
  return (
    <Tabs defaultValue={example ? 'example' : 'schema'} className="ds-responses__views">
      <div className="ds-responses__views-bar">
        <TabsList aria-label={t.responseFormat(response.status)}>
          {example && <TabsTrigger value="example">{t.example}</TabsTrigger>}
          {showSchema && <TabsTrigger value="schema">{t.schema}</TabsTrigger>}
        </TabsList>
        {examples.length > 1 && (
          <Select value={String(selected)} onValueChange={(value) => setSelected(Number(value))}>
            <SelectTrigger size="sm" className="ds-responses__example-select" aria-label={t.exampleOf(response.status)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {examples.map((item, index) => <SelectItem key={item.name} value={String(index)}>{item.summary ?? item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      {example && (
        <TabsContent value="example">
          <CodeBlock code={asText(example.value, response.contentType)} language={languageOf(response.contentType)} filename={response.contentType ?? 'application/json'} />
        </TabsContent>
      )}
      {showSchema && (
        <TabsContent value="schema">
          <SchemaViewer schema={response.schema!} />
        </TabsContent>
      )}
    </Tabs>
  );
}

export interface ResponsePanelProps {
  responses: ApiResponse[];
  label?: string;
  className?: string;
}

/**
 * Responses by status code. A select (not tabs) picks the status, so any number of codes fits and
 * each option reads in full ("422 Unprocessable Entity"); the dot color is never the only cue.
 */
export function ResponsePanel({ responses, label: labelProp, className }: ResponsePanelProps) {
  const t = useDsMessages();
  const label = labelProp ?? t.responses;
  const triggerId = useId();
  const [selected, setSelected] = useState(String(responses[0]?.status ?? ''));
  const response = responses.find((item) => String(item.status) === selected) ?? responses[0];
  if (!response) return null;
  return (
    <div className={cx('ds-responses', className)}>
      <div className="ds-responses__header">
        <label htmlFor={triggerId} className="ds-responses__title">{label}</label>
        <Select value={String(response.status)} onValueChange={setSelected}>
          <SelectTrigger size="sm" id={triggerId} className="ds-responses__select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {responses.map((item) => (
              <SelectItem key={item.status} value={String(item.status)} className="ds-responses__option">
                <span className={`ds-responses__dot ds-responses__dot--${tone(item.status)}`} aria-hidden="true" />
                <span className="ds-responses__code">{item.status}</span>{' '}
                <span className="ds-responses__status">{statusText[item.status] ?? ''}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="ds-responses__panel" key={response.status}>
        {response.description && <p className="ds-responses__description">{response.description}</p>}
        <ResponseBody response={response} />
      </div>
    </div>
  );
}
