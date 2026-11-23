import { lazy, Suspense } from 'react';
import { cx } from '../cx';

export interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the editor (it has no visible label of its own). */
  label: string;
  /** Marks the editor invalid and links an error message by id. */
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

/* CodeMirror is ~400 kB: it loads on demand the first time an editor is shown. */
const Editor = lazy(() => import('./JsonEditorImpl'));

/**
 * JSON editor (CodeMirror 6, loaded on demand). Until it arrives, a plain monospace textarea
 * with the same look takes input, so typing never waits on the download.
 */
export function JsonEditor(props: JsonEditorProps) {
  const { value, onChange, label, invalid, describedBy, placeholder, readOnly, className } = props;
  return (
    <Suspense
      fallback={(
        <textarea
          className={cx('ds-json-editor', 'ds-json-editor--fallback', invalid && 'is-invalid', className)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          placeholder={placeholder}
          readOnly={readOnly}
          rows={Math.min(14, Math.max(5, value.split('\n').length))}
          spellCheck={false}
        />
      )}
    >
      <Editor {...props} />
    </Suspense>
  );
}
