import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Spinner } from '../../../design-system';
import { request } from '../../../auth/api';
import type { Project } from '../data/types';
import { formatDate, timeAgo } from '../format';

interface Entry { id: string; userId: string; userName?: string; message: string; at: string }
interface Page { items: Entry[]; next?: string }

const pageSize = 20;

/**
 * The project's history in a scrolling list that loads older entries as it nears the bottom
 * (GET /api/projects/:id/activity, cursor-paginated). A fade at the bottom says there is more;
 * it disappears once the last entry is in view.
 */
export function RecentActivity({ project }: { project: Project }) {
  const [items, setItems] = useState<Entry[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [status, setStatus] = useState<'loading' | 'idle' | 'error' | 'done'>('loading');
  const [atBottom, setAtBottom] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  const loading = useRef(false);

  const load = useCallback(async (after?: string) => {
    if (loading.current) return;
    loading.current = true;
    setStatus('loading');
    try {
      const page = await request<Page>('GET', `/projects/${project.id}/activity?limit=${pageSize}${after ? `&after=${after}` : ''}`);
      setItems((current) => (after ? [...current, ...page.items] : page.items));
      setNext(page.next);
      setStatus(page.next ? 'idle' : 'done');
    } catch {
      setStatus('error');
    } finally {
      loading.current = false;
    }
  }, [project.id]);

  // First page, and again whenever the project changes (a save adds an entry at the top).
  useEffect(() => { void load(); }, [load, project.updatedAt]);

  // Near the bottom of the list: the next page.
  useEffect(() => {
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || status !== 'idle' || !next) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) void load(next); }, { root, rootMargin: '0px 0px 120px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [load, next, status]);

  // The fade shows while there is more to scroll to (or more to load).
  const updateFade = useCallback(() => {
    const root = listRef.current;
    if (!root) return;
    setAtBottom(root.scrollTop + root.clientHeight >= root.scrollHeight - 2);
  }, []);
  useEffect(updateFade, [items, updateFade]);

  if (status === 'loading' && items.length === 0) {
    return <div className="admin-activity-feed__state" role="status"><Spinner size="sm" /><span className="ds-sr-only">Carregando atividade…</span></div>;
  }
  if (items.length === 0) {
    return <p className="admin-muted">{status === 'error' ? 'Não foi possível carregar a atividade.' : 'Nenhuma mudança ainda.'}</p>;
  }

  const more = !atBottom || status === 'idle' || status === 'loading';
  return (
    <div className={more ? 'admin-activity-feed has-more' : 'admin-activity-feed'}>
      <div ref={listRef} className="admin-activity-feed__scroll" onScroll={updateFade} tabIndex={0} aria-label="Atividade do projeto">
        <ol className="admin-activity">
          {items.map((entry) => {
            const name = entry.userName ?? 'Conta removida';
            return (
              <li key={entry.id} className="admin-activity__item">
                <Avatar name={name} size="sm" />
                <p><strong>{name}</strong> {entry.message}</p>
                <time dateTime={entry.at} title={formatDate(entry.at)}>{timeAgo(entry.at)}</time>
              </li>
            );
          })}
          <li ref={sentinelRef} className="admin-activity-feed__footer" aria-live="polite">
            {status === 'loading' && <><Spinner size="sm" /><span className="ds-sr-only">Carregando mais…</span></>}
            {status === 'error' && <button type="button" className="admin-card-link" onClick={() => void load(next)}>Tentar de novo</button>}
            {status === 'done' && items.length > 6 && <span>Início do histórico</span>}
          </li>
        </ol>
      </div>
    </div>
  );
}
