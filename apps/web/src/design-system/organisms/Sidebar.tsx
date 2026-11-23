import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useState,
  type HTMLAttributes, type MouseEvent, type ReactNode, type Ref,
} from 'react';
import { PanelLeft } from 'lucide-react';
import { cx } from '../cx';
import { IconButton } from '../components/IconButton';
import { Sheet, SheetContent, SheetTitle } from '../components/Sheet';
import { Tooltip } from '../components/Tooltip';
import { useMediaQuery } from './useMediaQuery';

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isMobile: boolean;
  toggle: () => void;
  sidebarId: string;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar precisa estar dentro de <SidebarProvider>.');
  return context;
}

export interface SidebarProviderProps extends HTMLAttributes<HTMLDivElement> {
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Below this query the sidebar becomes a drawer (Sheet). */
  mobileQuery?: string;
  /** ⌘/Ctrl+B toggles the sidebar. */
  shortcut?: boolean;
}

/** Holds the sidebar state and lays out <Sidebar> next to <SidebarInset>. */
export function SidebarProvider({
  defaultCollapsed = false, collapsed: controlled, onCollapsedChange, mobileQuery = '(max-width: 767px)', shortcut = true, className, children, ...props
}: SidebarProviderProps) {
  const [internal, setInternal] = useState(defaultCollapsed);
  const collapsed = controlled ?? internal;
  const setCollapsed = useCallback((next: boolean) => { setInternal(next); onCollapsedChange?.(next); }, [onCollapsedChange]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery(mobileQuery);
  const sidebarId = useId();
  const toggle = useCallback(() => {
    if (isMobile) setMobileOpen((open) => !open);
    else setCollapsed(!collapsed);
  }, [isMobile, collapsed, setCollapsed]);

  useEffect(() => {
    if (!shortcut) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // In text fields ⌘B means bold: leave it to the field.
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcut, toggle]);

  const value = useMemo(() => ({ collapsed, setCollapsed, mobileOpen, setMobileOpen, isMobile, toggle, sidebarId }), [collapsed, setCollapsed, mobileOpen, isMobile, toggle, sidebarId]);
  return (
    <SidebarContext.Provider value={value}>
      <div className={cx('ds-shell', className)} data-sidebar={isMobile ? 'mobile' : collapsed ? 'collapsed' : 'expanded'} {...props}>{children}</div>
    </SidebarContext.Provider>
  );
}

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  /** Names the complementary landmark (and the drawer on mobile). */
  label?: string;
}

/**
 * Desktop: <aside> that collapses to an icon rail. Mobile: a left drawer (Sheet) with focus trap,
 * Esc to close and focus returned to the trigger.
 */
export function Sidebar({ label = 'Barra lateral', className, children, ...props }: SidebarProps) {
  const { collapsed, isMobile, mobileOpen, setMobileOpen, sidebarId } = useSidebar();
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="ds-sidebar-sheet" aria-describedby={undefined}>
          <SheetTitle className="ds-sr-only">{label}</SheetTitle>
          <div id={sidebarId} className={cx('ds-sidebar', 'ds-sidebar--mobile', className)} {...props}>{children}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <aside id={sidebarId} aria-label={label} className={cx('ds-sidebar', className)} data-state={collapsed ? 'collapsed' : 'expanded'} {...props}>
      {children}
    </aside>
  );
}

export function SidebarHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-sidebar__header', className)} {...props} />;
}

/** The scrollable navigation area: a <nav> landmark. */
export function SidebarContent({ className, label = 'Principal', ...props }: HTMLAttributes<HTMLElement> & { label?: string }) {
  return <nav aria-label={label} className={cx('ds-sidebar__content', className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-sidebar__footer', className)} {...props} />;
}

/** A labelled group of links. The label stays available to screen readers when collapsed. */
export function SidebarGroup({ label, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { label?: string }) {
  const id = useId();
  const { collapsed, isMobile } = useSidebar();
  return (
    <div role="group" aria-labelledby={label ? id : undefined} className={cx('ds-sidebar__group', className)} {...props}>
      {label && <p id={id} className={cx('ds-sidebar__group-label', collapsed && !isMobile && 'ds-sr-only')}>{label}</p>}
      {children}
    </div>
  );
}

export function SidebarMenu({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul role="list" className={cx('ds-sidebar__menu', className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={cx('ds-sidebar__item', className)} {...props} />;
}

export interface SidebarMenuButtonProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  icon?: ReactNode;
  children: ReactNode;
  /** Renders a link; otherwise a button. */
  href?: string;
  /** Current page: aria-current="page" and the active style. */
  active?: boolean;
  /** Count or status shown at the end (hidden when collapsed). */
  badge?: ReactNode;
  /** Extra element at the end, e.g. a chevron for a menu trigger. */
  trailing?: ReactNode;
  ref?: Ref<HTMLElement>;
}

/** Link or button in the sidebar. Collapsed, it shows only the icon and the label moves to a tooltip. */
export function SidebarMenuButton({ icon, children, href, active, badge, trailing, className, onClick, ref, ...props }: SidebarMenuButtonProps) {
  const { collapsed, isMobile, setMobileOpen } = useSidebar();
  const iconOnly = collapsed && !isMobile;
  const shared = {
    ...props,
    className: cx('ds-sidebar__button', className),
    'aria-current': active ? ('page' as const) : undefined,
    // The visible (or sr-only) label already names it; don't let the tooltip add a duplicate description.
    ...(iconOnly ? { 'aria-describedby': props['aria-describedby'] } : {}),
    onClick: (event: MouseEvent<HTMLElement>) => {
      onClick?.(event);
      if (isMobile && href) setMobileOpen(false);
    },
  };
  const content = (
    <>
      {icon && <span className="ds-sidebar__icon" aria-hidden="true">{icon}</span>}
      <span className={cx('ds-sidebar__label', iconOnly && 'ds-sr-only')}>{children}</span>
      {badge !== undefined && !iconOnly && <span className="ds-sidebar__badge">{badge}</span>}
      {trailing && !iconOnly && <span className="ds-sidebar__trailing" aria-hidden="true">{trailing}</span>}
    </>
  );
  const element = href
    ? <a href={href} ref={ref as Ref<HTMLAnchorElement>} {...shared}>{content}</a>
    : <button type="button" ref={ref as Ref<HTMLButtonElement>} {...shared}>{content}</button>;
  return iconOnly ? <Tooltip content={children} side="right">{element}</Tooltip> : element;
}

export function SidebarSeparator({ className }: { className?: string }) {
  return <hr className={cx('ds-sidebar__separator', className)} />;
}

/** Toggles the sidebar: collapses/expands on desktop, opens the drawer on mobile. */
export function SidebarTrigger({ className }: { className?: string }) {
  const { toggle, collapsed, isMobile, mobileOpen, sidebarId } = useSidebar();
  const label = isMobile ? 'Abrir menu' : collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral';
  return (
    <IconButton
      icon={<PanelLeft />}
      aria-label={label}
      aria-expanded={isMobile ? mobileOpen : !collapsed}
      aria-controls={isMobile ? undefined : sidebarId}
      aria-keyshortcuts="Meta+B Control+B"
      onClick={toggle}
      className={className}
    />
  );
}

/** The main column next to the sidebar. */
export function SidebarInset({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-shell__inset', className)} {...props} />;
}
