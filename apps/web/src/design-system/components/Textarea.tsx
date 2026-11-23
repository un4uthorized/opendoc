import type { ReactNode, Ref, TextareaHTMLAttributes } from 'react';
import { cx } from '../cx';
import { Field, useFieldIds } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ label, hint, error, id, className, required, disabled, rows = 4, ...props }: TextareaProps) {
  const { fieldId, messageId, describedBy } = useFieldIds(id, Boolean(error || hint));
  return (
    <Field label={label} htmlFor={fieldId} messageId={messageId} hint={hint} error={error} required={required} className={className}>
      <div className={cx('ds-control', 'ds-control--textarea', Boolean(error) && 'is-invalid', disabled && 'is-disabled')}>
        <textarea id={fieldId} rows={rows} required={required} disabled={disabled} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />
      </div>
    </Field>
  );
}
