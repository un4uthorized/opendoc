import { useId, type ComponentProps, type ReactNode } from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { Check, Minus } from 'lucide-react';
import { cx } from '../cx';
import { Label } from './Label';

export interface CheckboxProps extends ComponentProps<typeof CheckboxPrimitive.Root> {
  /** Visible label. Without it, pass aria-label. */
  label?: ReactNode;
  description?: ReactNode;
}

/**
 * Radix checkbox: role="checkbox" with aria-checked true/false/"mixed".
 * Supports checked="indeterminate". Space toggles; inside a <form> a hidden input submits the value.
 */
export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const generated = useId();
  const checkboxId = id ?? generated;
  const descriptionId = `${checkboxId}-description`;
  const control = (
    <CheckboxPrimitive.Root id={checkboxId} className={cx('ds-checkbox', !label && className)} aria-describedby={description ? descriptionId : undefined} {...props}>
      <CheckboxPrimitive.Indicator className="ds-checkbox__indicator">
        {props.checked === 'indeterminate' ? <Minus aria-hidden="true" /> : <Check aria-hidden="true" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return control;
  return (
    <div className={cx('ds-choice', className)}>
      {control}
      <div className="ds-choice__text">
        <Label htmlFor={checkboxId} className="ds-choice__label">{label}</Label>
        {description && <p id={descriptionId} className="ds-choice__description">{description}</p>}
      </div>
    </div>
  );
}
