import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Search } from 'lucide-react';
import { cx } from '../cx';
import { useReturnFocus } from '../components/useReturnFocus';
import { Kbd, KbdGroup } from '../components/Kbd';
import { useDsMessages } from '../i18n';

export interface CommandItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Visual hint only (hidden from assistive tech). */
  shortcut?: string;
  /** Secondary text on the right (e.g. a path). */
  detail?: ReactNode;
  /** Extra search terms. */
  keywords?: string;
  onSelect: () => void;
}

export interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

export interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandGroup[];
  label?: string;
  placeholder?: string;
  emptyText?: ReactNode;
  /** Item ids shown first, under "Recent", while the query is empty (most recent first). */
  recentIds?: string[];
  /** Called once when the menu closes after a search: the last query typed and how many results it had. */
  onSearch?: (query: string, results: number) => void;
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Command palette in a modal dialog, following the WAI-ARIA combobox + listbox pattern:
 * focus stays in the input, ↑/↓/Home/End move the active option (aria-activedescendant),
 * Enter runs it, Esc closes and returns focus. The result count is announced.
 */
export function CommandMenu({ open, onOpenChange, groups, label: labelProp, placeholder: placeholderProp, emptyText: emptyProp, recentIds, onSearch }: CommandMenuProps) {
  const t = useDsMessages();
  const label = labelProp ?? t.search;
  const placeholder = placeholderProp ?? t.commandPlaceholder;
  const emptyText = emptyProp ?? t.noResults;
  const focus = useReturnFocus();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const filtered = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0 && recentIds?.length) {
      const all = groups.flatMap((group) => group.items);
      const recent = recentIds.map((id) => all.find((item) => item.id === id)).filter((item): item is CommandItem => Boolean(item));
      if (recent.length) return [{ heading: t.recent, items: recent }, ...groups];
    }
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const haystack = normalize(`${item.label} ${item.keywords ?? ''} ${group.heading}`);
          return terms.every((term) => haystack.includes(term));
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query, recentIds, t]);
  const flat = filtered.flatMap((group) => group.items);

  useEffect(() => { setActive(0); }, [query]);
  // The search as it stands when the menu closes (not every keystroke) is what gets reported.
  const lastSearch = useRef({ query: '', results: 0 });
  lastSearch.current = { query, results: flat.length };
  const report = useRef(onSearch);
  report.current = onSearch;
  useEffect(() => {
    if (open) return;
    const { query: typed, results } = lastSearch.current;
    if (typed.trim()) report.current?.(typed.trim(), results);
    setQuery('');
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const run = (item: CommandItem) => {
    onOpenChange(false);
    item.onSelect();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (flat.length === 0) return;
    const move = { ArrowDown: (active + 1) % flat.length, ArrowUp: (active - 1 + flat.length) % flat.length, Home: 0, End: flat.length - 1 }[event.key];
    if (move !== undefined) {
      event.preventDefault();
      setActive(move);
    } else if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      run(flat[active]!);
    }
  };

  let index = -1;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ds-overlay" />
        <DialogPrimitive.Content className="ds-command" aria-describedby={undefined} {...focus}>
          <DialogPrimitive.Title className="ds-sr-only">{label}</DialogPrimitive.Title>
          <div className="ds-command__search">
            <Search aria-hidden="true" />
            <input
              className="ds-command__input"
              role="combobox"
              aria-label={label}
              aria-expanded={flat.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={flat.length > 0 ? optionId(active) : undefined}
              placeholder={placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div id={listId} role="listbox" aria-label={t.results} className="ds-command__list">
            {filtered.map((group) => {
              const headingId = `${baseId}-${normalize(group.heading).replace(/\W+/g, '-')}`;
              return (
                <div key={group.heading} role="group" aria-labelledby={headingId} className="ds-command__group">
                  <div id={headingId} role="presentation" className="ds-command__heading">{group.heading}</div>
                  {group.items.map((item) => {
                    index += 1;
                    const current = index;
                    return (
                      <div
                        key={item.id}
                        id={optionId(current)}
                        role="option"
                        aria-selected={current === active}
                        className="ds-command__item"
                        onPointerMove={() => { if (current !== active) setActive(current); }}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => run(item)}
                      >
                        {item.icon && <span className="ds-command__icon" aria-hidden="true">{item.icon}</span>}
                        <span className="ds-command__label">{item.label}</span>
                        {item.detail && <span className="ds-command__detail">{item.detail}</span>}
                        {item.shortcut && (
                          <KbdGroup className="ds-command__shortcut" aria-hidden="true">
                            {item.shortcut.split(/\s*\+\s*|\s+/).filter(Boolean).map((key) => <Kbd key={key}>{key}</Kbd>)}
                          </KbdGroup>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {flat.length === 0 && <div className="ds-command__empty">{emptyText}</div>}
          </div>
          <div className="ds-sr-only" role="status" aria-live="polite">
            {query ? t.resultCount(flat.length) : ''}
          </div>
          <div className={cx('ds-command__footer')} aria-hidden="true">
            <span className="ds-command__hint"><Kbd>↑</Kbd><Kbd>↓</Kbd>{t.navigate}</span>
            <span className="ds-command__hint"><Kbd>↵</Kbd>{t.open}</span>
            <span className="ds-command__hint"><Kbd>Esc</Kbd>{t.closeHint}</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Opens something with ⌘K / Ctrl+K. */
export function useCommandShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpen]);
}
