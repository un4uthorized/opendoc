import { useSyncExternalStore, type ReactNode } from 'react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { cx } from '../cx';

export type ToastVariant = 'default' | 'success' | 'destructive';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  /** Milliseconds before closing. Radix pauses the timer on hover, focus and when the window loses focus. */
  duration?: number;
  /** One quick action. altText tells screen-reader users how to do it another way (the toast may vanish). */
  action?: { label: string; altText: string; onClick: () => void };
}

interface ToastItem extends ToastOptions { id: number; open: boolean }

/* A tiny external store so toast() can be called from anywhere, outside React too. */
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const setItems = (next: ToastItem[]) => { items = next; emit(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => items;

/** Shows a toast and returns its id. Keeps at most 3 on screen. */
export function toast(options: ToastOptions) {
  const id = nextId++;
  const open = items.filter((item) => item.open);
  setItems([...items, { ...options, id, open: true }]);
  if (open.length >= 3) toast.dismiss(open[0]!.id);
  return id;
}

toast.dismiss = (id: number) => {
  setItems(items.map((item) => (item.id === id ? { ...item, open: false } : item)));
  // Drop it after the exit animation.
  window.setTimeout(() => setItems(items.filter((item) => item.id !== id)), 400);
};

const icons = { default: Info, success: CircleCheck, destructive: CircleAlert };

/**
 * Renders toasts in a Radix viewport: an ordered list landmark reachable with F8.
 * Destructive toasts are announced assertively ("foreground"); others politely.
 * Swipe right or press Esc to dismiss. Mount once near the root.
 */
export function Toaster({ duration = 5000 }: { duration?: number }) {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={duration} label="Notificação">
      {list.map((item) => {
        const variant = item.variant ?? 'default';
        const Icon = icons[variant];
        return (
          <ToastPrimitive.Root
            key={item.id}
            open={item.open}
            onOpenChange={(open) => { if (!open) toast.dismiss(item.id); }}
            duration={item.duration}
            type={variant === 'destructive' ? 'foreground' : 'background'}
            className={cx('ds-toast', variant !== 'default' && `ds-toast--${variant}`)}
          >
            <Icon className="ds-toast__icon" aria-hidden="true" />
            <div className="ds-toast__content">
              <ToastPrimitive.Title className="ds-toast__title">{item.title}</ToastPrimitive.Title>
              {item.description && <ToastPrimitive.Description className="ds-toast__description">{item.description}</ToastPrimitive.Description>}
            </div>
            {item.action && (
              <ToastPrimitive.Action altText={item.action.altText} className="ds-toast__action" onClick={item.action.onClick}>
                {item.action.label}
              </ToastPrimitive.Action>
            )}
            <ToastPrimitive.Close className="ds-toast__close" aria-label="Fechar notificação">
              <X aria-hidden="true" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="ds-toast-viewport" label="Notificações ({hotkey})" />
    </ToastPrimitive.Provider>
  );
}
