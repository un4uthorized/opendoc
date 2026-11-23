import type { ReactNode, Ref, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../cx';
import { Field, useFieldIds, type ControlSize } from './Field';

export interface NativeSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  size?: ControlSize;
  ref?: Ref<HTMLSelectElement>;
}

/** Native <select> styled as a control. Best on mobile and for long, simple lists. */
export function NativeSelect({ label, hint, error, size = 'md', id, className, required, disabled, children, ...props }: NativeSelectProps) {
  const { fieldId, messageId, describedBy } = useFieldIds(id, Boolean(error || hint));
  return (
    <Field label={label} htmlFor={fieldId} messageId={messageId} hint={hint} error={error} required={required} className={className}>
      <div className={cx('ds-control', 'ds-control--select', `ds-control--${size}`, Boolean(error) && 'is-invalid', disabled && 'is-disabled')}>
        <select id={fieldId} required={required} disabled={disabled} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props}>
          {children}
        </select>
        <ChevronDown className="ds-control__chevron" aria-hidden="true" />
      </div>
    </Field>
  );
}
