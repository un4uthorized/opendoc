import type { AnchorHTMLAttributes, ComponentProps, HTMLAttributes } from 'react';
import { Slot } from 'radix-ui';
import { ChevronRight, Ellipsis } from 'lucide-react';
import { cx } from '../cx';

/** <nav aria-label="Trilha"> with an ordered list: shows where the page sits in the hierarchy. */
export function Breadcrumb({ 'aria-label': ariaLabel = 'Trilha de navegação', ...props }: ComponentProps<'nav'>) {
  return <nav aria-label={ariaLabel} {...props} />;
}

export function BreadcrumbList({ className, ...props }: HTMLAttributes<HTMLOListElement>) {
  return <ol className={cx('ds-breadcrumb', className)} {...props} />;
}

export function BreadcrumbItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={cx('ds-breadcrumb__item', className)} {...props} />;
}

/** asChild lets a router link take the styles: <BreadcrumbLink asChild><Link to="/">…</Link></BreadcrumbLink>. */
export function BreadcrumbLink({ asChild, className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : 'a';
  return <Component className={cx('ds-breadcrumb__link', className)} {...props} />;
}

/** The current page: not a link, marked aria-current="page". */
export function BreadcrumbPage({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span aria-current="page" className={cx('ds-breadcrumb__page', className)} {...props} />;
}

export function BreadcrumbSeparator({ className, children, ...props }: HTMLAttributes<HTMLLIElement>) {
  return (
    <li role="presentation" aria-hidden="true" className={cx('ds-breadcrumb__separator', className)} {...props}>
      {children ?? <ChevronRight />}
    </li>
  );
}

/** Collapsed middle levels. Wrap it in a DropdownMenuTrigger to reveal them. */
export function BreadcrumbEllipsis({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx('ds-breadcrumb__ellipsis', className)} {...props}>
      <Ellipsis aria-hidden="true" />
      <span className="ds-sr-only">Mais níveis</span>
    </span>
  );
}
