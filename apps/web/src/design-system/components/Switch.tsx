import { useId, type ComponentProps, type ReactNode } from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cx } from '../cx';
import { Label } from './Label';

export interface SwitchProps extends ComponentProps<typeof SwitchPrimitive.Root> {
  /** Visible label. Without it, pass aria-label. */
  label?: ReactNode;
  description?: ReactNode;
}

/** Radix switch: role="switch" + aria-checked. Space and Enter toggle. For settings that apply at once. */
export function Switch({ label, description, className, id, ...props }: SwitchProps) {
  const generated = useId();
  const switchId = id ?? generated;
  const descriptionId = `${switchId}-description`;
  const control = (
    <SwitchPrimitive.Root id={switchId} className={cx('ds-switch', !label && className)} aria-describedby={description ? descriptionId : undefined} {...props}>
      <SwitchPrimitive.Thumb className="ds-switch__thumb" />
    </SwitchPrimitive.Root>
  );
  if (!label) return control;
  return (
    <div className={cx('ds-choice', 'ds-choice--switch', className)}>
      {control}
      <div className="ds-choice__text">
        <Label htmlFor={switchId} className="ds-choice__label">{label}</Label>
        {description && <p id={descriptionId} className="ds-choice__description">{description}</p>}
      </div>
    </div>
  );
}
