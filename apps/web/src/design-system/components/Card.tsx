import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Hover state for cards that act as a single link/button target. */
  interactive?: boolean;
}

export function Card({ interactive = false, className, ...props }: CardProps) {
  return <div className={cx('ds-card', interactive && 'ds-card--interactive', className)} {...props} />;
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** Top-right slot, e.g. a menu button or badge. */
  actions?: ReactNode;
}

export function CardHeader({ title, description, actions, className, ...props }: CardHeaderProps) {
  return (
    <div className={cx('ds-card__header', className)} {...props}>
      <div className="ds-card__heading">
        <h3 className="ds-card__title">{title}</h3>
        {description && <p className="ds-card__description">{description}</p>}
      </div>
      {actions && <div className="ds-card__actions">{actions}</div>}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-card__content', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-card__footer', className)} {...props} />;
}
