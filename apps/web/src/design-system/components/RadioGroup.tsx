import { useId, type ComponentProps, type ReactNode } from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cx } from '../cx';
import { Label } from './Label';

/**
 * Radix radio group: role="radiogroup" with roving focus.
 * Tab enters the group on the checked item; arrow keys move and select.
 * Name the group with aria-label or aria-labelledby.
 */
export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cx('ds-radio-group', className)} {...props} />;
}

export interface RadioGroupItemProps extends ComponentProps<typeof RadioGroupPrimitive.Item> {
  label?: ReactNode;
  description?: ReactNode;
}

export function RadioGroupItem({ label, description, className, id, ...props }: RadioGroupItemProps) {
  const generated = useId();
  const itemId = id ?? generated;
  const descriptionId = `${itemId}-description`;
  const control = (
    <RadioGroupPrimitive.Item id={itemId} className={cx('ds-radio', !label && className)} aria-describedby={description ? descriptionId : undefined} {...props}>
      <RadioGroupPrimitive.Indicator className="ds-radio__indicator" />
    </RadioGroupPrimitive.Item>
  );
  if (!label) return control;
  return (
    <div className={cx('ds-choice', className)}>
      {control}
      <div className="ds-choice__text">
        <Label htmlFor={itemId} className="ds-choice__label">{label}</Label>
        {description && <p id={descriptionId} className="ds-choice__description">{description}</p>}
      </div>
    </div>
  );
}
