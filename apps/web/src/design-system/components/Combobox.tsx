import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cx } from '../cx';
import { Field, useFieldIds } from './Field';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface ComboboxBase {
  label: ReactNode;
  options: ComboboxOption[];
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  emptyText?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export type ComboboxProps =
  | (ComboboxBase & { multiple?: false; value: string | null; onValueChange: (value: string | null) => void })
  | (ComboboxBase & { multiple: true; value: string[]; onValueChange: (value: string[]) => void });

function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Searchable select (WAI-ARIA combobox + listbox). Focus stays in the input; ↑/↓ move the active
 * option (aria-activedescendant), Enter picks, Esc closes. Multiple mode shows chips with remove
 * buttons and Backspace removes the last one.
 */
export function Combobox(props: ComboboxProps) {
  const { label, options, placeholder = 'Selecione…', hint, error, emptyText = 'Nenhuma opção encontrada.', disabled, id, className } = props;
  const { fieldId, messageId, describedBy } = useFieldIds(id, Boolean(error || hint));
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = props.multiple ? props.value : props.value ? [props.value] : [];
  const byValue = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
  const filtered = useMemo(() => options.filter((option) => normalize(option.label).includes(normalize(query.trim()))), [options, query]);
  const singleLabel = !props.multiple && props.value ? byValue.get(props.value)?.label ?? '' : '';

  const openList = () => { if (!disabled) { setOpen(true); setActive(Math.max(0, filtered.findIndex((option) => !option.disabled))); } };
  const close = () => { setOpen(false); setQuery(''); };

  const choose = (option: ComboboxOption) => {
    if (option.disabled) return;
    if (props.multiple) {
      const next = selected.includes(option.value) ? selected.filter((value) => value !== option.value) : [...selected, option.value];
      props.onValueChange(next);
      setQuery('');
    } else {
      props.onValueChange(option.value);
      close();
    }
  };

  const remove = (value: string) => {
    if (props.multiple) props.onValueChange(selected.filter((item) => item !== value));
    inputRef.current?.focus();
  };

  const move = (from: number, step: 1 | -1) => {
    if (filtered.length === 0) return from;
    let next = from;
    for (let tries = 0; tries < filtered.length; tries += 1) {
      next = (next + step + filtered.length) % filtered.length;
      if (!filtered[next]!.disabled) return next;
    }
    return from;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openList(); else setActive((current) => move(current, 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openList(); else setActive((current) => move(current, -1));
        break;
      case 'Home':
        if (open) { event.preventDefault(); setActive(move(-1, 1)); }
        break;
      case 'End':
        if (open) { event.preventDefault(); setActive(move(filtered.length, -1)); }
        break;
      case 'Enter':
        if (open && filtered[active]) { event.preventDefault(); choose(filtered[active]!); }
        break;
      case 'Escape':
        if (open) { event.preventDefault(); event.stopPropagation(); close(); }
        break;
      case 'Backspace':
        if (props.multiple && query === '' && selected.length > 0) props.onValueChange(selected.slice(0, -1));
        break;
    }
  };

  return (
    <Field label={label} htmlFor={fieldId} messageId={messageId} hint={hint} error={error} className={className}>
      <PopoverPrimitive.Root open={open} onOpenChange={(next) => (next ? openList() : close())}>
        <PopoverPrimitive.Anchor asChild>
          <div
            ref={anchorRef}
            className={cx('ds-control', 'ds-combobox', props.multiple && 'ds-combobox--multiple', Boolean(error) && 'is-invalid', disabled && 'is-disabled')}
            onClick={() => { inputRef.current?.focus(); if (!open) openList(); }}
          >
            {props.multiple && selected.map((value) => (
              <span key={value} className="ds-combobox__chip">
                {byValue.get(value)?.label ?? value}
                <button type="button" className="ds-combobox__chip-remove" aria-label={`Remover ${byValue.get(value)?.label ?? value}`} onClick={(event) => { event.stopPropagation(); remove(value); }} disabled={disabled}>
                  <X aria-hidden="true" />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              id={fieldId}
              className="ds-combobox__input"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && filtered[active] ? optionId(active) : undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              autoComplete="off"
              disabled={disabled}
              placeholder={props.multiple && selected.length ? '' : placeholder}
              value={open || props.multiple ? query : singleLabel}
              onChange={(event) => { setQuery(event.target.value); if (!open) setOpen(true); setActive(0); }}
              onKeyDown={onKeyDown}
              onBlur={(event) => { if (!anchorRef.current?.contains(event.relatedTarget as Node)) close(); }}
            />
            <ChevronsUpDown className="ds-combobox__chevron" aria-hidden="true" />
          </div>
        </PopoverPrimitive.Anchor>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={4}
            className="ds-menu ds-combobox__content"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => { if (anchorRef.current?.contains(event.target as Node)) event.preventDefault(); }}
          >
            <ul id={listId} role="listbox" aria-label={typeof label === 'string' ? label : 'Opções'} aria-multiselectable={props.multiple || undefined} className="ds-combobox__list">
              {filtered.map((option, index) => {
                const isSelected = selected.includes(option.value);
                return (
                  <li
                    key={option.value}
                    id={optionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    className={cx('ds-menu__item', 'ds-combobox__option', index === active && 'is-active')}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerMove={() => { if (index !== active && !option.disabled) setActive(index); }}
                    onClick={() => choose(option)}
                  >
                    <span className="ds-combobox__check" aria-hidden="true">{isSelected && <Check />}</span>
                    <span className="ds-combobox__text">
                      <span>{option.label}</span>
                      {option.description && <span className="ds-combobox__description">{option.description}</span>}
                    </span>
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="ds-combobox__empty" role="presentation">{emptyText}</li>}
            </ul>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      <span className="ds-sr-only" role="status" aria-live="polite">{open && query ? `${filtered.length} ${filtered.length === 1 ? 'opção' : 'opções'}` : ''}</span>
    </Field>
  );
}
