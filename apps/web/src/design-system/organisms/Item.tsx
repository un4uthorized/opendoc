import type { HTMLAttributes, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx } from '../cx';

/** List of rows inside one bordered container (<ul>). */
export function ItemGroup({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul role="list" className={cx('ds-item-group', className)} {...props} />;
}

export interface ItemProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Makes the whole row a link. */
  href?: string;
  /** Makes the whole row a button. */
  onClick?: () => void;
  /**
   * End slot. Interactive rows default to a chevron. For controls (Switch, Button) use a
   * non-interactive row (no href/onClick): interactive content can't live inside a link or button.
   */
  trailing?: ReactNode;
  className?: string;
}

/** A row with icon, title, description and an end slot. */
export function Item({ icon, title, description, href, onClick, trailing, className }: ItemProps) {
  const interactive = Boolean(href || onClick);
  const inner = (
    <>
      {icon && <span className="ds-item__icon" aria-hidden="true">{icon}</span>}
      <span className="ds-item__text">
        <span className="ds-item__title">{title}</span>
        {description && <span className="ds-item__description">{description}</span>}
      </span>
      {trailing ?? (interactive && <ChevronRight className="ds-item__chevron" aria-hidden="true" />)}
    </>
  );
  return (
    <li className={cx('ds-item-wrapper', className)}>
      {href ? <a href={href} className="ds-item ds-item--interactive">{inner}</a>
        : onClick ? <button type="button" className="ds-item ds-item--interactive" onClick={onClick}>{inner}</button>
          : <div className="ds-item">{inner}</div>}
    </li>
  );
}
