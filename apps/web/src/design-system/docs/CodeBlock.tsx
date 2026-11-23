import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { cx } from '../cx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { CopyButton } from './CopyButton';
import { highlight, languageNames, useHighlighter } from './highlight';
import { useDsMessages } from '../i18n';

export interface CodeBlockProps {
  code: string;
  language?: string;
  /** Shown in the header, e.g. "openapi.yaml". */
  filename?: string;
  showLineNumbers?: boolean;
  /** 1-based lines to emphasize. */
  highlightLines?: number[];
  /** Hides the header bar (copy button floats instead). */
  bare?: boolean;
  className?: string;
  /** Extra header content (e.g. a select). */
  actions?: ReactNode;
}

/**
 * Highlighted code with a copy button. The scrollable <pre> is a focusable, named region so
 * keyboard users can scroll long lines; the filename/language labels the figure.
 */
export function CodeBlock({ code, language, filename, showLineNumbers = false, highlightLines = [], bare = false, className, actions }: CodeBlockProps) {
  const captionId = useId();
  const trimmed = code.replace(/\n+$/, '');
  const ready = useHighlighter();
  const lines = useMemo(() => highlight(trimmed, language).split('\n'), [trimmed, language, ready]);
  const t = useDsMessages();
  const label = filename ?? (language ? languageNames[language] ?? language.toUpperCase() : t.code);
  const marked = new Set(highlightLines);
  return (
    <figure className={cx('ds-code', bare && 'ds-code--bare', className)} aria-labelledby={captionId}>
      {bare ? (
        <figcaption id={captionId} className="ds-sr-only">{label}</figcaption>
      ) : (
        <div className="ds-code__header">
          <figcaption id={captionId} className="ds-code__title">{label}</figcaption>
          <div className="ds-code__actions">
            {actions}
            <CopyButton value={trimmed} label={filename ? t.copyFile(filename) : t.copyCode} />
          </div>
        </div>
      )}
      {bare && <div className="ds-code__floating"><CopyButton value={trimmed} label={t.copyCode} /></div>}
      <pre className={cx('ds-code__pre', showLineNumbers && 'has-line-numbers')} tabIndex={0} aria-label={t.codeRegion(label)}>
        <code className="ds-code__code">
          {lines.map((html, index) => (
            <span key={index} className={cx('ds-code__line', marked.has(index + 1) && 'is-highlighted')}>
              {showLineNumbers && <span className="ds-code__number" aria-hidden="true">{index + 1}</span>}
              <span dangerouslySetInnerHTML={{ __html: html || ' ' }} />
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

export interface CodeTabsProps {
  /** `syntax` highlights with another grammar (e.g. a shell command under the Go tab). */
  examples: Array<{ language: string; code: string; label?: string; syntax?: string }>;
  /** Same key on several CodeTabs keeps the chosen language in sync (and remembered). */
  syncKey?: string;
  label?: string;
  className?: string;
}

const syncEvent = 'ds-code-language';

/** One code sample per language, picked with a select, with a shared copy button. */
export function CodeTabs({ examples, syncKey, label: labelProp, className }: CodeTabsProps) {
  const t = useDsMessages();
  const label = labelProp ?? t.codeExample;
  const first = examples[0]?.language ?? '';
  const [value, setValue] = useState(() => {
    if (!syncKey) return first;
    try {
      const saved = localStorage.getItem(`ds-code:${syncKey}`);
      return saved && examples.some((example) => example.language === saved) ? saved : first;
    } catch { return first; }
  });
  useEffect(() => {
    if (!syncKey) return;
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; language: string }>).detail;
      if (detail.key === syncKey && examples.some((example) => example.language === detail.language)) setValue(detail.language);
    };
    window.addEventListener(syncEvent, onSync);
    return () => window.removeEventListener(syncEvent, onSync);
  }, [syncKey, examples]);
  const change = (next: string) => {
    setValue(next);
    if (!syncKey) return;
    try { localStorage.setItem(`ds-code:${syncKey}`, next); } catch { /* storage unavailable */ }
    window.dispatchEvent(new CustomEvent(syncEvent, { detail: { key: syncKey, language: next } }));
  };
  const current = examples.find((example) => example.language === value) ?? examples[0];
  const nameOf = (example: { language: string; label?: string }) => example.label ?? languageNames[example.language] ?? example.language;
  if (!current) return null;
  return (
    <div className={cx('ds-code', 'ds-code-tabs', className)}>
      <div className="ds-code__header">
        {/* A select (not tabs): any number of languages fits, and the choice reads as "label, cURL". */}
        <Select value={current.language} onValueChange={change}>
          <SelectTrigger size="sm" className="ds-code-tabs__select" aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {examples.map((example) => <SelectItem key={example.language} value={example.language}>{nameOf(example)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ds-code__actions"><CopyButton value={current.code.replace(/\n+$/, '')} label={t.copyExample(nameOf(current))} /></div>
      </div>
      <CodeBlockBody key={current.language} code={current.code} language={current.syntax ?? current.language} />
    </div>
  );
}

function CodeBlockBody({ code, language }: { code: string; language: string }) {
  const t = useDsMessages();
  const ready = useHighlighter();
  const html = useMemo(() => highlight(code.replace(/\n+$/, ''), language), [code, language, ready]);
  return (
    <pre className="ds-code__pre" tabIndex={0} aria-label={t.codeRegion(languageNames[language] ?? language)}>
      <code className="ds-code__code" dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
