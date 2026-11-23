import type { ComponentProps } from 'react';
import { Toggle as TogglePrimitive, ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { cx } from '../cx';

type ToggleSize = 'sm' | 'default' | 'lg';
type ToggleVariant = 'default' | 'outline';

/** Two-state button (aria-pressed). Icon-only toggles need aria-label. */
export function Toggle({ className, size = 'default', variant = 'default', ...props }: ComponentProps<typeof TogglePrimitive.Root> & { size?: ToggleSize; variant?: ToggleVariant }) {
  return <TogglePrimitive.Root className={cx('ds-toggle', `ds-toggle--${variant}`, size !== 'default' && `ds-toggle--${size}`, className)} {...props} />;
}

/**
 * Radix toggle group with roving focus: Tab enters the group, arrow keys move between items.
 * type="single" behaves like a radio group (role="radio" + aria-checked); type="multiple" uses aria-pressed.
 * Name the group with aria-label.
 */
export function ToggleGroup({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return <ToggleGroupPrimitive.Root className={cx('ds-toggle-group', className)} {...props} />;
}

export function ToggleGroupItem({ className, size = 'default', ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item> & { size?: ToggleSize }) {
  return <ToggleGroupPrimitive.Item className={cx('ds-toggle', 'ds-toggle-group__item', size !== 'default' && `ds-toggle--${size}`, className)} {...props} />;
}
