import type { HTMLAttributes, ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cx } from '../cx';
import { IconButton } from './IconButton';

export type AlertVariant = 'default' | 'destructive' | 'success' | 'warning' | 'info';

const icons = { default: Info, info: Info, success: CircleCheck, warning: TriangleAlert, destructive: CircleAlert };

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant;
  title?: ReactNode;
  /** Replace the variant icon; pass null for none. */
  icon?: ReactNode;
  onDismiss?: () => void;
}

export function Alert({ variant = 'default', title, icon, onDismiss, className, children, role, ...props }: AlertProps) {
  const Icon = icons[variant];
  return (
    <div className={cx('ds-alert', variant !== 'default' && `ds-alert--${variant}`, className)} role={role ?? (variant === 'destructive' ? 'alert' : 'status')} {...props}>
      {icon === undefined ? <Icon className="ds-alert__icon" aria-hidden="true" /> : <span className="ds-alert__icon" aria-hidden="true">{icon}</span>}
      <div className="ds-alert__content">
        {title && <p className="ds-alert__title">{title}</p>}
        {children && <div className="ds-alert__body">{children}</div>}
      </div>
      {onDismiss && <IconButton className="ds-alert__dismiss" size="sm" icon={<X />} aria-label="Fechar aviso" onClick={onDismiss} />}
    </div>
  );
}
