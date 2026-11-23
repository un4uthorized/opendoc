/**
 * Minimal client-side routing for /admin (history API). Plain <a href="/admin/..."> links are
 * intercepted by `useAdminLinks`, so design system links (SidebarMenuButton, Item, Breadcrumb) work
 * unchanged. To be replaced by the app router when one is adopted (see ROADMAP).
 */
import { useEffect, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  if (to === window.location.pathname + window.location.search) return;
  window.history[options.replace ? 'replaceState' : 'pushState'](null, '', to);
  notify();
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => window.location.pathname.replace(/\/+$/, '') || '/');
}

export type AdminRoute =
  | { name: 'projects' }
  | { name: 'org-branding' }
  | { name: 'project'; slug: string; section: ProjectSection }
  | { name: 'not-found' };

export type ProjectSection =
  | 'overview' | 'spec' | 'versions' | 'pages' | 'analytics'
  | 'appearance' | 'users' | 'history' | 'settings';

const sectionPaths: Record<ProjectSection, string> = {
  overview: '', spec: 'spec', versions: 'versoes', pages: 'paginas', analytics: 'analytics',
  appearance: 'aparencia', users: 'usuarios', history: 'historico', settings: 'configuracoes',
};

export function projectPath(slug: string, section: ProjectSection = 'overview') {
  return `/admin/${slug}${sectionPaths[section] ? `/${sectionPaths[section]}` : ''}`;
}

export const adminPaths = { projects: '/admin', orgBranding: '/admin/org/marca' };

export function parseAdminPath(pathname: string): AdminRoute {
  const parts = pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent);
  if (parts.length === 0) return { name: 'projects' };
  if (parts[0] === 'org') {
    if (parts[1] === 'marca' && parts.length === 2) return { name: 'org-branding' };
    return { name: 'not-found' };
  }
  if (parts.length > 2) return { name: 'not-found' };
  const section = (Object.keys(sectionPaths) as ProjectSection[]).find((key) => sectionPaths[key] === (parts[1] ?? ''));
  return section ? { name: 'project', slug: parts[0]!, section } : { name: 'not-found' };
}

/** Intercepts same-tab clicks on /admin links and routes them without a reload. */
export function useAdminLinks() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest('a');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !/^\/admin(\/|$)/.test(url.pathname)) return;
      event.preventDefault();
      navigate(url.pathname + url.search);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}
