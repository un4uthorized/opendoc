import type { ComponentProps, HTMLAttributes } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cx } from '../cx';
import { useReturnFocus } from './useReturnFocus';
import { useDsMessages } from '../i18n';

/**
 * Modal dialog: role="dialog", labelled by DialogTitle and described by DialogDescription.
 * Focus is trapped inside; everything outside is hidden from assistive tech (aria-hidden),
 * blocks pointer events and stops scrolling. Escape closes and focus returns to the trigger.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Shows the X button in the corner (default true). */
  showClose?: boolean;
}

export function DialogContent({ className, children, showClose = true, onOpenAutoFocus, onCloseAutoFocus, ...props }: DialogContentProps) {
  const focus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
  const t = useDsMessages();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ds-overlay" />
      <DialogPrimitive.Content className={cx('ds-dialog', className)} {...props} {...focus}>
        {children}
        {showClose && (
          <DialogPrimitive.Close className="ds-dialog__close" aria-label={t.close}>
            <X aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-dialog__header', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-dialog__footer', className)} {...props} />;
}

/** Required: names the dialog. Hide it visually with VisuallyHidden if the design has no title. */
export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cx('ds-dialog__title', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cx('ds-dialog__description', className)} {...props} />;
}
