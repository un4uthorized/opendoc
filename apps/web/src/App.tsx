import { lazy, Suspense } from 'react';
import { ErrorBoundary, Spinner, useDsMessages } from './design-system';
import { StartPage } from './pages/StartPage';

/* Each page is its own chunk: the home page doesn't download the docs or the design system. */
const DesignSystemPage = lazy(() => import('./pages/design-system/DesignSystemPage').then((module) => ({ default: module.DesignSystemPage })));
const DocsRoute = lazy(() => import('./pages/docs/DocsRoute').then((module) => ({ default: module.DocsRoute })));
const AdminPage = lazy(() => import('./pages/admin/AdminPage').then((module) => ({ default: module.AdminPage })));
const AdminsPage = lazy(() => import('./pages/admins/AdminsPage').then((module) => ({ default: module.AdminsPage })));
const AcceptInvitePage = lazy(() => import('./pages/invite/AcceptInvitePage').then((module) => ({ default: module.AcceptInvitePage })));

function PageLoading() {
  const t = useDsMessages();
  return (
    <div className="app-loading" role="status">
      <Spinner />
      <span className="ds-sr-only">{t.loading}…</span>
    </div>
  );
}

export function App() {
  const t = useDsMessages();
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  const invite = /^\/convite\/([^/]+)$/.exec(path)?.[1];
  const docs = /^\/docs(?:\/([^/]+))?$/.exec(path);
  const page = isAdmin ? <AdminPage />
    : path === '/admins' ? <AdminsPage />
    : invite ? <AcceptInvitePage token={decodeURIComponent(invite)} />
    : path === '/design-system' ? <DesignSystemPage />
    : docs ? <DocsRoute slug={docs[1] ? decodeURIComponent(docs[1]) : undefined} />
    : <StartPage />;
  return (
    // The admin routes inside itself: keying on the full path would reset it on every navigation.
    <ErrorBoundary label={t.thePage} className="app-error" resetKeys={[isAdmin ? '/admin' : path]}>
      <Suspense fallback={<PageLoading />}>
        {/* Comes into focus (blur to sharp) once, when the page first appears. */}
        <div className="app-enter">{page}</div>
      </Suspense>
    </ErrorBoundary>
  );
}
