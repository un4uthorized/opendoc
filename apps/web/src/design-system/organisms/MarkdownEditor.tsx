import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Toolbar as ToolbarPrimitive } from 'radix-ui';
import { Bold, Code, Heading2, Italic, Link, List, ListOrdered, Quote } from 'lucide-react';
import { cx } from '../cx';
import { Field, useFieldIds } from '../components/Field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { Markdown } from '../docs/Prose';

export interface MarkdownEditorProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
  rows?: number;
  id?: string;
  className?: string;
}

type Action = 'heading' | 'bold' | 'italic' | 'code' | 'link' | 'list' | 'ordered' | 'quote';

const actions: Array<{ id: Action; label: string; icon: ReactNode; shortcut?: string }> = [
  { id: 'heading', label: 'Título', icon: <Heading2 /> },
  { id: 'bold', label: 'Negrito', icon: <Bold />, shortcut: '⌘B' },
  { id: 'italic', label: 'Itálico', icon: <Italic />, shortcut: '⌘I' },
  { id: 'code', label: 'Código', icon: <Code /> },
  { id: 'link', label: 'Link', icon: <Link />, shortcut: '⌘K' },
  { id: 'quote', label: 'Citação', icon: <Quote /> },
  { id: 'list', label: 'Lista', icon: <List /> },
  { id: 'ordered', label: 'Lista numerada', icon: <ListOrdered /> },
];

/**
 * Markdown textarea with a formatting toolbar (Radix Toolbar: one Tab stop, arrows move between
 * buttons) and a preview tab rendered with the same <Markdown> used by the docs.
 */
export function MarkdownEditor({ label, value, onChange, hint, error, placeholder = 'Escreva em Markdown…', rows = 10, id, className }: MarkdownEditorProps) {
  const { fieldId, messageId, describedBy } = useFieldIds(id, Boolean(error || hint));
  const previewPrefix = `${useId().replace(/:/g, '')}-`;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const apply = (action: Action) => {
    const area = textareaRef.current;
    if (!area) return;
    const { selectionStart: start, selectionEnd: end } = area;
    const chosen = value.slice(start, end);
    let replacement = chosen;
    let cursorStart = start;
    let cursorEnd = end;
    const wrap = (before: string, after: string, fallback: string) => {
      const text = chosen || fallback;
      replacement = `${before}${text}${after}`;
      cursorStart = start + before.length;
      cursorEnd = cursorStart + text.length;
    };
    const prefixLines = (prefix: (index: number) => string) => {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const block = value.slice(lineStart, end) || '';
      const updated = block.split('\n').map((line, index) => `${prefix(index)}${line}`).join('\n');
      const next = value.slice(0, lineStart) + updated + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => { area.focus(); area.setSelectionRange(lineStart, lineStart + updated.length); });
    };
    switch (action) {
      case 'bold': wrap('**', '**', 'texto em negrito'); break;
      case 'italic': wrap('_', '_', 'texto em itálico'); break;
      case 'code': chosen.includes('\n') ? wrap('```\n', '\n```', 'código') : wrap('`', '`', 'código'); break;
      case 'link': wrap('[', '](https://)', 'texto do link'); break;
      case 'heading': return prefixLines(() => '## ');
      case 'quote': return prefixLines(() => '> ');
      case 'list': return prefixLines(() => '- ');
      case 'ordered': return prefixLines((index) => `${index + 1}. `);
    }
    onChange(value.slice(0, start) + replacement + value.slice(end));
    requestAnimationFrame(() => { area.focus(); area.setSelectionRange(cursorStart, cursorEnd); });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    const map: Record<string, Action> = { b: 'bold', i: 'italic', k: 'link' };
    if (map[key]) {
      event.preventDefault();
      // Keep page-level shortcuts (⌘K search, ⌘B sidebar) from firing while editing.
      event.stopPropagation();
      apply(map[key]!);
    }
  };

  return (
    <Field label={label} htmlFor={fieldId} messageId={messageId} hint={hint} error={error} className={cx('ds-md-editor-field', className)}>
      <Tabs defaultValue="write" className={cx('ds-md-editor', Boolean(error) && 'is-invalid')}>
        <div className="ds-md-editor__bar">
          <TabsList variant="line" aria-label="Modo do editor" className="ds-md-editor__tabs">
            <TabsTrigger value="write">Escrever</TabsTrigger>
            <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
          </TabsList>
          <ToolbarPrimitive.Root className="ds-md-editor__toolbar" aria-label="Formatação" aria-controls={fieldId}>
            {actions.map((action) => (
              <ToolbarPrimitive.Button
                key={action.id}
                className="ds-md-editor__tool"
                aria-label={action.label}
                aria-keyshortcuts={action.shortcut ? `Meta+${action.shortcut.slice(1)} Control+${action.shortcut.slice(1)}` : undefined}
                title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => apply(action.id)}
              >
                {action.icon}
              </ToolbarPrimitive.Button>
            ))}
          </ToolbarPrimitive.Root>
        </div>
        <TabsContent value="write" className="ds-md-editor__panel" forceMount>
          <textarea
            ref={textareaRef}
            id={fieldId}
            className="ds-md-editor__textarea"
            rows={rows}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            spellCheck
          />
        </TabsContent>
        <TabsContent value="preview" className="ds-md-editor__panel ds-md-editor__preview">
          {value.trim() ? <Markdown source={value} idPrefix={previewPrefix} /> : <p className="ds-md-editor__empty">Nada para pré-visualizar ainda.</p>}
        </TabsContent>
        <div className="ds-md-editor__footer">
          <span>Markdown suportado</span>
          <span>{value.length.toLocaleString('pt-BR')} caracteres</span>
        </div>
      </Tabs>
    </Field>
  );
}
