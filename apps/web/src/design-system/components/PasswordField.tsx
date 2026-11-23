import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check, Circle, Eye, EyeOff } from 'lucide-react';
import { cx } from '../cx';
import { Field, useFieldIds, type ControlSize } from './Field';

export interface PasswordRequirement {
  label: string;
  test: (value: string) => boolean;
}

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'value' | 'onChange'> {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: ReactNode;
  size?: ControlSize;
  /** Live checklist under the field (linked with aria-describedby, not announced on every key). */
  requirements?: PasswordRequirement[];
}

/** Password input with a show/hide toggle (aria-pressed) and an optional requirements checklist. */
export function PasswordField({ label, value, onChange, hint, error, size = 'md', requirements, id, className, required, disabled, autoComplete = 'current-password', ...props }: PasswordFieldProps) {
  const { fieldId, messageId, describedBy } = useFieldIds(id, Boolean(error || hint));
  const rulesId = useId();
  const [visible, setVisible] = useState(false);
  const described = [describedBy, requirements?.length ? rulesId : undefined].filter(Boolean).join(' ') || undefined;
  return (
    <Field label={label} htmlFor={fieldId} messageId={messageId} hint={hint} error={error} required={required} className={className}>
      <div className={cx('ds-control', `ds-control--${size}`, 'ds-password', Boolean(error) && 'is-invalid', disabled && 'is-disabled')}>
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="none"
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          {...props}
        />
        <button
          type="button"
          className="ds-password__toggle"
          onClick={() => setVisible(!visible)}
          aria-pressed={visible}
          aria-controls={fieldId}
          aria-label="Mostrar senha"
          disabled={disabled}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
      {requirements && requirements.length > 0 && (
        <ul id={rulesId} className="ds-password__rules" aria-label="Requisitos da senha">
          {requirements.map((rule) => {
            const met = rule.test(value);
            return (
              <li key={rule.label} className={cx('ds-password__rule', met && 'is-met')}>
                {met ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
                <span>{rule.label}</span>
                <span className="ds-sr-only">{met ? ': atendido' : ': pendente'}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Field>
  );
}
