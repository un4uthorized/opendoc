import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';
import { cx } from '../cx';
import { buttonClassName } from './Button';

type PageItem = number | 'gap-start' | 'gap-end';

/** First, last, current ± siblings; gaps collapse into "…". */
function pageItems(page: number, pageCount: number, siblings: number): PageItem[] {
  if (pageCount <= 5 + siblings * 2) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const start = Math.max(2, page - siblings);
  const end = Math.min(pageCount - 1, page + siblings);
  const items: PageItem[] = [1];
  if (start > 2) items.push('gap-start');
  for (let current = start; current <= end; current += 1) items.push(current);
  if (end < pageCount - 1) items.push('gap-end');
  items.push(pageCount);
  return items;
}

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  siblings?: number;
  className?: string;
  /** Names the landmark; change it when a page has more than one pagination. */
  'aria-label'?: string;
}

/**
 * <nav aria-label="Paginação">: each page is a button named "Página N", the current one
 * has aria-current="page". Previous/next are disabled at the ends instead of disappearing.
 */
export function Pagination({ page, pageCount, onPageChange, siblings = 1, className, 'aria-label': ariaLabel = 'Paginação' }: PaginationProps) {
  if (pageCount < 1) return null;
  return (
    <nav aria-label={ariaLabel} className={cx('ds-pagination', className)}>
      <ul className="ds-pagination__list">
        <li>
          <button type="button" className={cx(buttonClassName({ variant: 'ghost', size: 'sm' }), 'ds-pagination__step')} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Página anterior">
            <ChevronLeft aria-hidden="true" /><span className="ds-pagination__step-label">Anterior</span>
          </button>
        </li>
        {pageItems(page, pageCount, siblings).map((item) => (
          <li key={item}>
            {typeof item === 'number' ? (
              <button
                type="button"
                className={cx(buttonClassName({ variant: item === page ? 'outline' : 'ghost', size: 'sm' }), 'ds-pagination__page')}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Página ${item}`}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            ) : (
              <span className="ds-pagination__gap" aria-hidden="true"><Ellipsis /></span>
            )}
          </li>
        ))}
        <li>
          <button type="button" className={cx(buttonClassName({ variant: 'ghost', size: 'sm' }), 'ds-pagination__step')} onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Próxima página">
            <span className="ds-pagination__step-label">Próxima</span><ChevronRight aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
