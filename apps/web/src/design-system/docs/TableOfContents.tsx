import { useEffect, useState, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { Link } from 'lucide-react';
import { cx } from '../cx';
import { useDsMessages } from '../i18n';

export interface TocItem {
  id: string;
  title: ReactNode;
  level?: 2 | 3;
}

export interface TableOfContentsProps {
  items: TocItem[];
  title?: string;
  /** Root margin for the scrollspy; adjust for sticky headers. */
  rootMargin?: string;
  className?: string;
}

/** "Nesta página": a <nav> that marks the section being read with aria-current="location". */
export function TableOfContents({ items, title: titleProp, rootMargin = '-80px 0px -65% 0px', className }: TableOfContentsProps) {
  const t = useDsMessages();
  const title = titleProp ?? t.onThisPage;
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      const first = items.find((item) => visible.has(item.id));
      if (first) setActive(first.id);
    }, { rootMargin });
    for (const item of items) {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [items, rootMargin]);
  if (items.length === 0) return null;
  return (
    <nav aria-label={title} className={cx('ds-toc', className)}>
      <p className="ds-toc__title" aria-hidden="true">{title}</p>
      <ul role="list" className="ds-toc__list">
        {items.map((item) => (
          <li key={item.id} className={cx('ds-toc__item', item.level === 3 && 'ds-toc__item--nested')}>
            <a href={`#${item.id}`} aria-current={active === item.id ? 'location' : undefined}>{item.title}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface HeadingAnchorProps extends HTMLAttributes<HTMLHeadingElement> {
  id: string;
  as?: ElementType;
  children: ReactNode;
}

/** Heading with a permalink. The link has its own name, so the heading text stays clean. */
export function HeadingAnchor({ id, as: Heading = 'h2', className, children, ...props }: HeadingAnchorProps) {
  const t = useDsMessages();
  return (
    <Heading id={id} className={cx('ds-heading-anchor', className)} {...props}>
      {children}
      <a href={`#${id}`} className="ds-heading-anchor__link" aria-label={t.linkToSection(typeof children === 'string' ? children : '')}>
        <Link aria-hidden="true" />
      </a>
    </Heading>
  );
}
