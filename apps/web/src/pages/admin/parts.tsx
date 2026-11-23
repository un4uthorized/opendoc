import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx, toast } from '../../design-system';
import { errorMessage } from './data/store';
import type { Branding } from './data/types';

/** Page title (h1, focused on navigation), description and actions. */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-header__text">
        <h1 className="admin-page-header__title" tabIndex={-1} data-page-title>{title}</h1>
        {description && <p className="admin-page-header__description">{description}</p>}
      </div>
      {actions && <div className="admin-page-header__actions">{actions}</div>}
    </header>
  );
}

/** Square with the project's symbol, or its initial on the accent color. */
export function ProjectMark({ name, branding, size = 'md', className }: { name: string; branding?: Branding; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const symbol = branding?.symbol?.light ?? branding?.symbol?.dark;
  return (
    <span className={cx('admin-mark', `admin-mark--${size}`, className)} style={branding?.accent && !symbol ? { background: branding.accent } : undefined} aria-hidden="true">
      {symbol ? <img src={symbol} alt="" /> : name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/**
 * Runs an API call with a pending flag, a success toast and an error toast. Returns whether it
 * succeeded, so dialogs can close only on success.
 */
export function useAction() {
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  // Set on every mount, not only at creation: StrictMode (and fast refresh) unmount and mount
  // again, and a flag left false would keep the button spinning after the work is done.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const run = useCallback(async <T,>(work: () => Promise<T>, success?: string | ((result: T) => string)): Promise<T | undefined> => {
    setPending(true);
    try {
      const result = await work();
      if (success) toast({ title: typeof success === 'function' ? success(result) : success, variant: 'success' });
      // Calls without a result resolve to `true`, so callers can test success with a truthy check.
      return (result === undefined ? true : result) as T;
    } catch (error) {
      toast({ title: 'Não foi possível concluir', description: errorMessage(error), variant: 'destructive' });
      return undefined;
    } finally {
      if (mounted.current) setPending(false);
    }
  }, []);
  return { pending, run };
}

/**
 * A card section in settings pages: title and description on the left, controls on the right.
 */
export function SettingsSection({ title, description, children, footer, tone }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; tone?: 'danger' }) {
  return (
    <section className={cx('admin-settings', tone === 'danger' && 'admin-settings--danger')} aria-label={title}>
      <div className="admin-settings__intro">
        <h2 className="admin-settings__title">{title}</h2>
        {description && <p className="admin-settings__description">{description}</p>}
      </div>
      <div className="admin-settings__body">
        {children}
        {footer && <div className="admin-settings__footer">{footer}</div>}
      </div>
    </section>
  );
}
