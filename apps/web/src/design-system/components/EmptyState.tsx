import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or links that help the person move on. */
  actions?: ReactNode;
  /** Heading element for the title, to fit the page outline (default h3). */
  titleAs?: ElementType;
}

/** Explains why there is nothing here yet and what to do next. */
export function EmptyState({ icon, title, description, actions, titleAs: Title = 'h3', className, ...props }: EmptyStateProps) {
  return (
    <div className={cx('ds-empty', className)} {...props}>
      {icon && <div className="ds-empty__icon" aria-hidden="true">{icon}</div>}
      <Title className="ds-empty__title">{title}</Title>
      {description && <p className="ds-empty__description">{description}</p>}
      {actions && <div className="ds-empty__actions">{actions}</div>}
    </div>
  );
}
