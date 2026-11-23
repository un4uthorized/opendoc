import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from '../cx';
import { Spinner } from './Spinner';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'default' | 'lg';

/** Class names for anything that should look like a button (e.g. links). */
export function buttonClassName({ variant = 'default', size = 'default', fullWidth = false }: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean } = {}) {
  return cx('ds-button', `ds-button--${variant}`, size !== 'default' && `ds-button--${size}`, fullWidth && 'ds-button--full');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'default', size = 'default', loading = false, iconStart, iconEnd, fullWidth, className, children, disabled, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClassName({ variant, size, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size="sm" label="" /> : iconStart}
      {children !== undefined && children !== null && <span className="ds-button__label">{children}</span>}
      {!loading && iconEnd}
    </button>
  );
}
