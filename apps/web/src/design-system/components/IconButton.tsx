import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from '../cx';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './Button';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  /** Required: icon-only buttons need an accessible name. */
  'aria-label': string;
  icon: ReactNode;
  variant?: Exclude<ButtonVariant, 'link'>;
  size?: ButtonSize;
  /** Shows the label in a tooltip on hover and focus (default true). Needs TooltipProvider at the root. */
  tooltip?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ icon, variant = 'ghost', size = 'default', className, type = 'button', tooltip = true, ...props }: IconButtonProps) {
  const button = (
    <button
      type={type}
      className={cx(buttonClassName({ variant, size }), 'ds-button--icon', className)}
      {...props}
      // The tooltip repeats the accessible name; keeping the button's own aria-describedby
      // (usually undefined) stops Radix from adding it as a description read twice.
      aria-describedby={props['aria-describedby']}
    >
      {icon}
    </button>
  );
  // Disabled buttons cannot be focused, so their tooltip would be mouse-only: skip it.
  if (!tooltip || props.disabled) return button;
  return <Tooltip content={props['aria-label']}>{button}</Tooltip>;
}
