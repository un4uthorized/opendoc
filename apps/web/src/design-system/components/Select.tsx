import { type ComponentProps, type ReactNode } from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cx } from '../cx';
import { Field, useFieldIds, type ControlSize } from './Field';

/**
 * Custom select (Radix): the trigger is role="combobox"; the list is role="listbox".
 * Enter/Space/↑/↓ open it, arrows move, typing jumps to an option, Escape closes and returns focus.
 * A hidden native select keeps form submission and autofill working.
 */
export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, size = 'md', children, ...props }: ComponentProps<typeof SelectPrimitive.Trigger> & { size?: ControlSize }) {
  return (
    <SelectPrimitive.Trigger className={cx('ds-control', 'ds-select-trigger', `ds-control--${size}`, className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild><ChevronDown className="ds-select-trigger__icon" aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ className, children, position = 'popper', ...props }: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position={position} sideOffset={position === 'popper' ? 4 : undefined} className={cx('ds-menu', 'ds-select-content', position === 'popper' && 'ds-select-content--popper', className)} {...props}>
        <SelectPrimitive.ScrollUpButton className="ds-select-content__scroll"><ChevronUp aria-hidden="true" /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="ds-select-content__viewport">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="ds-select-content__scroll"><ChevronDown aria-hidden="true" /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item className={cx('ds-menu__item', 'ds-select-item', className)} {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="ds-select-item__indicator"><SelectPrimitive.ItemIndicator><Check aria-hidden="true" /></SelectPrimitive.ItemIndicator></span>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cx('ds-menu__label', className)} {...props} />;
}

export function SelectSeparator({ className, ...props }: ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cx('ds-menu__separator', className)} {...props} />;
}

export interface SelectFieldProps extends ComponentProps<typeof SelectPrimitive.Root> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  placeholder?: ReactNode;
  size?: ControlSize;
  id?: string;
  className?: string;
  /** SelectItem / SelectGroup elements. */
  children: ReactNode;
}

/** Select with visible label, hint and error wired with htmlFor + aria-describedby + aria-invalid. */
export function SelectField({ label, hint, error, placeholder, size, id, className, required, children, ...props }: SelectFieldProps) {
  const { fieldId, messageId, describedBy } = useFieldIds(id, Boolean(error || hint));
  return (
    <Field label={label} htmlFor={fieldId} messageId={messageId} hint={hint} error={error} required={required} className={className}>
      <Select required={required} {...props}>
        <SelectTrigger id={fieldId} size={size} className={cx(Boolean(error) && 'is-invalid')} aria-invalid={error ? true : undefined} aria-describedby={describedBy}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </Field>
  );
}
