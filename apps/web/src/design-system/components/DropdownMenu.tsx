import type { ComponentProps, HTMLAttributes } from 'react';
import { DropdownMenu as MenuPrimitive } from 'radix-ui';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cx } from '../cx';

/**
 * Menu button (role="menu"): Enter/Space/↓ open it, arrows move, typing jumps to an item,
 * ←/→ open and close submenus, Escape closes and returns focus to the trigger.
 * Use it for actions; use Select to pick a value in a form.
 */
export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuSub = MenuPrimitive.Sub;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export function DropdownMenuContent({ className, sideOffset = 4, ...props }: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content sideOffset={sideOffset} className={cx('ds-menu', className)} {...props} />
    </MenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps extends ComponentProps<typeof MenuPrimitive.Item> {
  variant?: 'default' | 'destructive';
  /** Aligns text with items that have an icon or indicator. */
  inset?: boolean;
}

export function DropdownMenuItem({ className, variant = 'default', inset, ...props }: DropdownMenuItemProps) {
  return <MenuPrimitive.Item className={cx('ds-menu__item', variant === 'destructive' && 'ds-menu__item--destructive', inset && 'ds-menu__item--inset', className)} {...props} />;
}

export function DropdownMenuCheckboxItem({ className, children, ...props }: ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
  return (
    <MenuPrimitive.CheckboxItem className={cx('ds-menu__item', 'ds-menu__item--inset', className)} {...props}>
      <span className="ds-menu__indicator"><MenuPrimitive.ItemIndicator><Check aria-hidden="true" /></MenuPrimitive.ItemIndicator></span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cx('ds-menu__item', 'ds-menu__item--inset', className)} {...props}>
      <span className="ds-menu__indicator"><MenuPrimitive.ItemIndicator><Circle className="ds-menu__dot" aria-hidden="true" /></MenuPrimitive.ItemIndicator></span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({ className, inset, ...props }: ComponentProps<typeof MenuPrimitive.Label> & { inset?: boolean }) {
  return <MenuPrimitive.Label className={cx('ds-menu__label', inset && 'ds-menu__item--inset', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cx('ds-menu__separator', className)} {...props} />;
}

/** Visual hint only; register the actual shortcut yourself. Hidden from assistive tech to avoid noise. */
export function DropdownMenuShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('ds-menu__shortcut', className)} aria-hidden="true" {...props} />;
}

export function DropdownMenuSubTrigger({ className, inset, children, ...props }: ComponentProps<typeof MenuPrimitive.SubTrigger> & { inset?: boolean }) {
  return (
    <MenuPrimitive.SubTrigger className={cx('ds-menu__item', inset && 'ds-menu__item--inset', className)} {...props}>
      {children}
      <ChevronRight className="ds-menu__chevron" aria-hidden="true" />
    </MenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({ className, ...props }: ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent className={cx('ds-menu', className)} {...props} />
    </MenuPrimitive.Portal>
  );
}
