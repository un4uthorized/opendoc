import { useState, type ReactNode } from 'react';
import { cx } from '../cx';
import { Field, useFieldIds } from './Field';

export interface InputOTPProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  /** Called once all slots are filled (e.g. to submit automatically). */
  onComplete?: (value: string) => void;
  length?: number;
  /** Visual grouping, e.g. [3, 3] → 123-456. */
  groups?: number[];
  mode?: 'numeric' | 'alphanumeric';
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  className?: string;
}

/**
 * One-time code as separate boxes, backed by a single real <input>: screen readers hear one
 * labelled field, paste works, and browsers/phones can autofill it (autocomplete="one-time-code").
 */
export function InputOTP({ label, value, onChange, onComplete, length = 6, groups, mode = 'numeric', hint, error, disabled, autoFocus, id, className }: InputOTPProps) {
  const { fieldId, messageId, describedBy } = useFieldIds(id, Boolean(error || hint));
  const [focused, setFocused] = useState(false);
  const layout = groups ?? [length];
  const sanitize = (raw: string) => (mode === 'numeric' ? raw.replace(/\D/g, '') : raw.replace(/[^a-z0-9]/gi, '').toUpperCase()).slice(0, length);
  const active = Math.min(value.length, length - 1);

  let index = 0;
  return (
    <Field label={label} htmlFor={fieldId} messageId={messageId} hint={hint} error={error} className={className}>
      <div className={cx('ds-otp', Boolean(error) && 'is-invalid', disabled && 'is-disabled')}>
        <div className="ds-otp__slots" aria-hidden="true">
          {layout.map((size, groupIndex) => (
            <div key={groupIndex} className="ds-otp__group">
              {groupIndex > 0 && <span className="ds-otp__separator" />}
              {Array.from({ length: size }, () => {
                const slot = index++;
                const char = value[slot];
                return (
                  <span key={slot} className={cx('ds-otp__slot', focused && slot === active && 'is-active', char && 'is-filled')}>
                    {char ?? (focused && slot === active ? <span className="ds-otp__caret" /> : null)}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <input
          id={fieldId}
          className="ds-otp__input"
          value={value}
          onChange={(event) => {
            const next = sanitize(event.target.value);
            onChange(next);
            if (next.length === length) onComplete?.(next);
          }}
          onFocus={(event) => { setFocused(true); event.currentTarget.setSelectionRange(value.length, value.length); }}
          onBlur={() => setFocused(false)}
          inputMode={mode === 'numeric' ? 'numeric' : 'text'}
          autoComplete="one-time-code"
          pattern={mode === 'numeric' ? '[0-9]*' : '[A-Za-z0-9]*'}
          maxLength={length}
          spellCheck={false}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>
    </Field>
  );
}
