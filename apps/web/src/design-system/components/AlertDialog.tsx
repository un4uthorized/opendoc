import type { ComponentProps, HTMLAttributes } from 'react';
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import { cx } from '../cx';
import { buttonClassName, type ButtonVariant } from './Button';
import { useReturnFocus } from './useReturnFocus';

/**
 * Interrupting confirmation: role="alertdialog". Unlike Dialog, outside click does not close it;
 * the person must choose. Focus starts on Cancel, the safe choice.
 */
export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export function AlertDialogContent({ className, onOpenAutoFocus, onCloseAutoFocus, ...props }: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  const focus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="ds-overlay" />
      <AlertDialogPrimitive.Content className={cx('ds-dialog', 'ds-dialog--alert', className)} {...props} {...focus} />
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-dialog__header', className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-dialog__footer', className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title className={cx('ds-dialog__title', className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description className={cx('ds-dialog__description', className)} {...props} />;
}

export function AlertDialogAction({ className, variant = 'default', ...props }: ComponentProps<typeof AlertDialogPrimitive.Action> & { variant?: ButtonVariant }) {
  return <AlertDialogPrimitive.Action className={cx(buttonClassName({ variant }), className)} {...props} />;
}

export function AlertDialogCancel({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return <AlertDialogPrimitive.Cancel className={cx(buttonClassName({ variant: 'outline' }), className)} {...props} />;
}
