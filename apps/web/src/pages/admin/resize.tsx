import { useEffect, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { cx } from '../../design-system';

/** A number kept in this browser's storage (column widths and the like). */
export function useStoredNumber(key: string, fallback: number, normalize: (value: number) => number = (value) => value) {
  const [value, setValue] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      if (localStorage.getItem(key) !== null && Number.isFinite(saved)) return normalize(saved);
    } catch { /* storage unavailable */ }
    return fallback;
  });
  useEffect(() => {
    try { localStorage.setItem(key, String(value)); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue] as const;
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface ResizeHandleProps {
  /** The element whose left edge the pointer position is measured from. */
  container: RefObject<HTMLElement | null>;
  label: string;
  value: number;
  min: number;
  max: number;
  valueText: string;
  /** Current position of the handle, in pixels from the container's left edge. */
  position: () => number;
  /** Moves the handle to an x position (pixels from the container's left edge). */
  onMove: (x: number) => void;
  onReset: () => void;
  onDragChange?: (dragging: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

const step = 16;

/**
 * Vertical drag handle on a column border. Drag with the pointer; ←/→ move it (Shift for bigger
 * steps); Enter or double-click restores the default.
 */
export function ResizeHandle({ container, label, value, min, max, valueText, position, onMove, onReset, onDragChange, className, style }: ResizeHandleProps) {
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    onDragChange?.(true);
    const left = container.current?.getBoundingClientRect().left ?? 0;
    const move = (next: globalThis.PointerEvent) => onMove(next.clientX - left);
    const end = () => {
      onDragChange?.(false);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    if (delta) { event.preventDefault(); onMove(position() + delta * (event.shiftKey ? 4 : 1)); }
    if (event.key === 'Enter') { event.preventDefault(); onReset(); }
  };

  return (
    <div
      className={cx('admin-resize', className)}
      style={style}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={valueText}
      tabIndex={0}
      title="Arraste para redimensionar · duplo clique restaura"
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}

interface ColumnLayoutOptions {
  /** Storage key prefix: `<key>.list` and `<key>.split`. */
  key: string;
  list: { default: number; min: number; max: number; label: string };
  splitLabel: string;
  /** Leftmost column's name in the split's value text ("Editor com 50% do espaço"). */
  splitName: string;
  /** Bar under the two right columns; the middle handle stops above it. */
  actionsSelector: string;
}

/** Neither of the two right columns gets narrower than this. */
const minPane = 280;

/**
 * Three resizable columns — a list, then two panes sharing the rest. Returns the CSS variables for
 * the grid (--col-list, --col-split, --col-actions-h) and the two handles; sizes are remembered.
 */
export function useColumnLayout(container: RefObject<HTMLElement | null>, options: ColumnLayoutOptions) {
  const { key, list: range } = options;
  const [list, setListValue] = useStoredNumber(`${key}.list`, range.default, (value) => clamp(value, range.min, range.max));
  const [split, setSplit] = useStoredNumber(`${key}.split`, 0.5, (value) => clamp(value, 0.15, 0.85));
  const [actionsHeight, setActionsHeight] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const bar = container.current?.querySelector<HTMLElement>(options.actionsSelector);
    if (!bar) return;
    setActionsHeight(bar.offsetHeight);
    const observer = new ResizeObserver(() => setActionsHeight(bar.offsetHeight));
    observer.observe(bar);
    return () => observer.disconnect();
  });

  const width = () => container.current?.clientWidth ?? 0;
  const setList = (x: number) => setListValue(clamp(x, range.min, Math.min(range.max, width() - 2 * minPane)));
  const setSplitAt = (x: number) => {
    const rest = width() - list;
    if (rest > 2 * minPane) setSplit(clamp((x - list) / rest, minPane / rest, 1 - minPane / rest));
  };

  const style = { '--col-list': `${list}px`, '--col-split': split, '--col-actions-h': `${actionsHeight}px` } as CSSProperties;

  const handles = (
    <>
      <ResizeHandle
        container={container}
        className="admin-resize--list"
        label={range.label}
        value={list}
        min={range.min}
        max={range.max}
        valueText={`${list} pixels`}
        position={() => list}
        onMove={setList}
        onReset={() => setListValue(range.default)}
        onDragChange={setDragging}
      />
      <ResizeHandle
        container={container}
        className="admin-resize--split"
        label={options.splitLabel}
        value={split * 100}
        min={0}
        max={100}
        valueText={`${options.splitName} com ${Math.round(split * 100)}% do espaço`}
        position={() => list + (width() - list) * split}
        onMove={setSplitAt}
        onReset={() => setSplit(0.5)}
        onDragChange={setDragging}
      />
    </>
  );

  return { style, handles, dragging };
}
