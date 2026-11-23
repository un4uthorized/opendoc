import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from '../cx';
import { Field, useFieldIds, type ControlSize } from './Field';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  size?: ControlSize;
  prefix?: ReactNode;
  suffix?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({ label, hint, error, size = 'md', prefix, suffix, id, className, required, disabled, ...props }: TextFieldProps) {
  const { fieldId, messageId, describedBy } = useFieldIds(id, Boolean(error || hint));
  return (
    <Field label={label} htmlFor={fieldId} messageId={messageId} hint={hint} error={error} required={required} className={className}>
      <div className={cx('ds-control', `ds-control--${size}`, Boolean(error) && 'is-invalid', disabled && 'is-disabled')}>
        {prefix && <span className="ds-control__affix">{prefix}</span>}
        <input id={fieldId} required={required} disabled={disabled} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />
        {suffix && <span className="ds-control__affix">{suffix}</span>}
      </div>
    </Field>
  );
}
