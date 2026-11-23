import type { ComponentProps } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { cx } from '../cx';

/**
 * Non-modal floating panel for interactive content. Trigger gets aria-expanded/aria-controls,
 * focus moves into the content on open and back to the trigger on close; Escape and outside click close.
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({ className, align = 'center', sideOffset = 6, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content align={align} sideOffset={sideOffset} className={cx('ds-popover', className)} {...props} />
    </PopoverPrimitive.Portal>
  );
}
