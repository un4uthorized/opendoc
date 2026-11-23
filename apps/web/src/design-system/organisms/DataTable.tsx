import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Ellipsis, SearchX } from 'lucide-react';
import { cx } from '../cx';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../components/DropdownMenu';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { Pagination } from '../components/Pagination';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow, type SortDirection } from '../components/Table';
import { TextField } from '../components/TextField';

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Enables sorting by this column. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right';
  /** Hidden below 640px. */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  /** Names the table (caption) and its scroll region. */
  label: string;
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  /** Human name of a row, used in "Selecionar Ana Souza" / "Ações para Ana Souza". */
  getRowLabel: (row: T) => string;
  /** Text search over the rows. */
  search?: { placeholder?: string; label?: string; filter: (row: T, query: string) => boolean };
  selectable?: boolean;
  /** Bulk actions shown when rows are selected. */
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode;
  /** DropdownMenu items for one row. */
  rowActions?: (row: T) => ReactNode;
  pageSize?: number;
  /** Extra controls next to the search (filters, primary action). */
  toolbar?: ReactNode;
  emptyState?: ReactNode;
  className?: string;
}

/**
 * Table for admin lists: search, sortable columns (aria-sort), selection with a "select all on this
 * page" checkbox (mixed state), bulk actions, a per-row actions menu and pagination. Selection and
 * result changes are announced politely.
 */
export function DataTable<T>({
  label, data, columns, getRowId, getRowLabel, search, selectable = false, bulkActions, rowActions, pageSize = 10, toolbar, emptyState, className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ id: string; direction: Exclude<SortDirection, 'none'> } | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const filtered = search && query.trim() ? data.filter((row) => search.filter(row, query.trim().toLowerCase())) : data;
    const column = sort && columns.find((item) => item.id === sort.id);
    if (!column?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const x = column.sortValue!(a);
      const y = column.sortValue!(b);
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR');
      return sort!.direction === 'ascending' ? order : -order;
    });
  }, [data, query, search, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  const visibleIds = visible.map(getRowId);
  const selectedOnPage = visibleIds.filter((id) => selected.has(id)).length;
  const allOnPage = visibleIds.length > 0 && selectedOnPage === visibleIds.length;

  useEffect(() => { setPage(1); }, [query]);
  // Drop selections for rows that no longer exist.
  useEffect(() => {
    const ids = new Set(data.map(getRowId));
    setSelected((previous) => {
      const next = new Set([...previous].filter((id) => ids.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [data, getRowId]);

  const toggleRow = (id: string, checked: boolean) => setSelected((previous) => {
    const next = new Set(previous);
    if (checked) next.add(id); else next.delete(id);
    return next;
  });
  const togglePage = (checked: boolean) => setSelected((previous) => {
    const next = new Set(previous);
    visibleIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
    return next;
  });
  const clear = () => setSelected(new Set());
  const sortBy = (id: string) => setSort((previous) => ({ id, direction: previous?.id === id && previous.direction === 'ascending' ? 'descending' : 'ascending' }));

  const from = rows.length === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, rows.length);

  return (
    <div className={cx('ds-data-table', className)}>
      <div className="ds-data-table__toolbar">
        {selected.size > 0 && bulkActions ? (
          <div className="ds-data-table__bulk">
            <span className="ds-data-table__count">{selected.size} {selected.size === 1 ? 'selecionado' : 'selecionados'}</span>
            {bulkActions([...selected], clear)}
            <Button variant="ghost" size="sm" onClick={clear}>Limpar seleção</Button>
          </div>
        ) : (
          <>
            {search && (
              <TextField
                label={search.label ?? 'Buscar'}
                className="ds-data-table__search"
                size="sm"
                type="search"
                placeholder={search.placeholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            )}
            {toolbar && <div className="ds-data-table__extra">{toolbar}</div>}
          </>
        )}
      </div>

      {rows.length === 0 ? (
        emptyState ?? (
          <EmptyState
            icon={<SearchX />}
            title="Nenhum resultado"
            description={query ? `Nada corresponde a “${query}”.` : 'Ainda não há itens aqui.'}
            actions={query ? <Button variant="outline" size="sm" onClick={() => setQuery('')}>Limpar busca</Button> : undefined}
            titleAs="h4"
          />
        )
      ) : (
        <>
          <Table label={label}>
            <TableCaption className="ds-sr-only">{label}</TableCaption>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="ds-data-table__select">
                    <Checkbox
                      aria-label="Selecionar todos desta página"
                      checked={allOnPage ? true : selectedOnPage > 0 ? 'indeterminate' : false}
                      onCheckedChange={(value) => togglePage(value === true)}
                    />
                  </TableHead>
                )}
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    align={column.align}
                    className={cx(column.hideOnMobile && 'ds-data-table__hide-mobile')}
                    sort={column.sortValue ? (sort?.id === column.id ? sort.direction : 'none') : undefined}
                    onSort={column.sortValue ? () => sortBy(column.id) : undefined}
                  >
                    {column.header}
                  </TableHead>
                ))}
                {rowActions && <TableHead className="ds-data-table__actions"><span className="ds-sr-only">Ações</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const id = getRowId(row);
                const name = getRowLabel(row);
                const isSelected = selected.has(id);
                return (
                  <TableRow key={id} selected={selectable ? isSelected : undefined}>
                    {selectable && (
                      <TableCell className="ds-data-table__select">
                        <Checkbox aria-label={`Selecionar ${name}`} checked={isSelected} onCheckedChange={(value) => toggleRow(id, value === true)} />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={column.id} align={column.align} className={cx(column.hideOnMobile && 'ds-data-table__hide-mobile')}>{column.cell(row)}</TableCell>
                    ))}
                    {rowActions && (
                      <TableCell className="ds-data-table__actions" align="right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton icon={<Ellipsis />} aria-label={`Ações para ${name}`} size="sm" tooltip={false} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">{rowActions(row)}</DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="ds-data-table__footer">
            <p className="ds-data-table__range">{from}–{to} de {rows.length}</p>
            {/* Always shown, even with one page, so the table keeps the same footer as it grows. */}
            {rows.length > 0 && <Pagination page={current} pageCount={pageCount} onPageChange={setPage} aria-label={`Paginação de ${label}`} />}
          </div>
        </>
      )}
      <p className="ds-sr-only" role="status" aria-live="polite">
        {query ? `${rows.length} ${rows.length === 1 ? 'resultado' : 'resultados'}. ` : ''}
        {selected.size > 0 ? `${selected.size} ${selected.size === 1 ? 'item selecionado' : 'itens selecionados'}.` : ''}
      </p>
    </div>
  );
}
