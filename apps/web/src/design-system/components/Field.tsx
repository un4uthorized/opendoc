import { useId, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cx } from '../cx';
import { Label } from './Label';

export type ControlSize = 'sm' | 'md' | 'lg';

/** Stable ids linking a control to its label and hint/error message. */
export function useFieldIds(id: string | undefined, hasMessage: boolean) {
  const generated = useId();
  const fieldId = id ?? generated;
  const messageId = `${fieldId}-message`;
  return { fieldId, messageId, describedBy: hasMessage ? messageId : undefined };
}

export interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  messageId: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint or error. Error replaces the hint while present. */
export function Field({ label, htmlFor, messageId, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cx('ds-field', className)}>
      <Label className="ds-field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ds-field__required" aria-hidden="true">*</span>}
      </Label>
      {children}
      {error ? (
        <p id={messageId} className="ds-field__message ds-field__message--error"><CircleAlert aria-hidden="true" />{error}</p>
      ) : hint ? (
        <p id={messageId} className="ds-field__message">{hint}</p>
      ) : null}
    </div>
  );
}
