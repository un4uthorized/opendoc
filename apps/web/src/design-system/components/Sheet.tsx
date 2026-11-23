import type { ComponentProps, HTMLAttributes } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cx } from '../cx';
import { useReturnFocus } from './useReturnFocus';
import { useDsMessages } from '../i18n';

/**
 * Side panel built on Dialog: same semantics (role="dialog", focus trap, Esc closes,
 * focus returns to the trigger). Use it for filters, details and secondary forms.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  side?: 'right' | 'left' | 'top' | 'bottom';
}

export function SheetContent({ side = 'right', className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }: SheetContentProps) {
  const focus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
  const t = useDsMessages();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ds-overlay" />
      <DialogPrimitive.Content className={cx('ds-sheet', `ds-sheet--${side}`, className)} {...props} {...focus}>
        {children}
        <DialogPrimitive.Close className="ds-dialog__close" aria-label={t.close}>
          <X aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-sheet__header', className)} {...props} />;
}

export function SheetBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-sheet__body', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-sheet__footer', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cx('ds-dialog__title', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cx('ds-dialog__description', className)} {...props} />;
}
