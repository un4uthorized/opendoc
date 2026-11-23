import { lazy, Suspense } from 'react';
import type { CompletionSource } from '@codemirror/autocomplete';
import { cx } from '../../../design-system';

export type CodeLanguage = 'yaml' | 'json' | 'markdown';

export interface CodeEditorApi {
  /** Moves the cursor to a character offset and scrolls it into view. */
  goTo: (offset: number) => void;
  /** Replaces the selection (or inserts at the cursor) and focuses the editor. */
  insert: (text: string) => void;
}

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: CodeLanguage;
  /** Accessible name (the editor has no visible label of its own). */
  label: string;
  /** Problems to underline, recomputed as the text changes. */
  lint?: (text: string) => Array<{ from: number; to: number; severity: 'error' | 'warning'; message: string }>;
  completion?: CompletionSource;
  /** Ctrl/⌘+S inside the editor. */
  onSave?: () => void;
  onReady?: (api: CodeEditorApi) => void;
  placeholder?: string;
  describedBy?: string;
  className?: string;
}

/* CodeMirror and its languages load on demand; a plain textarea takes input meanwhile. */
const Editor = lazy(() => import('./CodeEditorImpl'));

export function CodeEditor(props: CodeEditorProps) {
  return (
    <Suspense
      fallback={(
        <textarea
          className={cx('ds-json-editor', 'ds-json-editor--fallback', 'code-editor', props.className)}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          aria-label={props.label}
          aria-describedby={props.describedBy}
          placeholder={props.placeholder}
          spellCheck={false}
        />
      )}
    >
      <Editor {...props} />
    </Suspense>
  );
}
