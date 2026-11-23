import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cx } from '../cx';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /**
   * Names the scrollable region. When set, the wrapper becomes a focusable region so keyboard
   * users can scroll wide tables (WCAG: scrollable content must be reachable).
   */
  label?: string;
}

/** Semantic <table>. Always add a TableCaption (or aria-label) so the table has a name. */
export function Table({ label, className, ...props }: TableProps) {
  return (
    <div className="ds-table-wrapper" role={label ? 'region' : undefined} aria-label={label} tabIndex={label ? 0 : undefined}>
      <table className={cx('ds-table', className)} {...props} />
    </div>
  );
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cx('ds-table__caption', className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cx('ds-table__header', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cx('ds-table__body', className)} {...props} />;
}

export function TableFooter({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cx('ds-table__footer', className)} {...props} />;
}

export function TableRow({ className, selected, ...props }: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return <tr className={cx('ds-table__row', className)} data-state={selected ? 'selected' : undefined} aria-selected={selected} {...props} />;
}

export type SortDirection = 'ascending' | 'descending' | 'none';

export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Current sort of this column. Sets aria-sort on the header. */
  sort?: SortDirection;
  /** Makes the header a button that cycles the sort. */
  onSort?: () => void;
  align?: 'left' | 'right';
}

export function TableHead({ sort, onSort, align = 'left', scope = 'col', className, children, ...props }: TableHeadProps) {
  const SortIcon = sort === 'ascending' ? ArrowUp : sort === 'descending' ? ArrowDown : ChevronsUpDown;
  return (
    <th scope={scope} aria-sort={onSort ? sort ?? 'none' : undefined} className={cx('ds-table__head', align === 'right' && 'ds-table__cell--right', className)} {...props}>
      {onSort ? (
        <button type="button" className="ds-table__sort" onClick={onSort}>
          {children}
          <SortIcon className={cx('ds-table__sort-icon', sort && sort !== 'none' && 'is-active')} aria-hidden="true" />
        </button>
      ) : children}
    </th>
  );
}

export function TableCell({ className, align = 'left', ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' }) {
  return <td className={cx('ds-table__cell', align === 'right' && 'ds-table__cell--right', className)} {...props} />;
}
