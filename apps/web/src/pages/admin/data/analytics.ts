/** Docs usage from the API (GET /api/projects/:id/analytics), for Analytics and the overview. */
import { useEffect, useState } from 'react';
import { request } from '../../../auth/api';

export type Period = '7' | '30' | '90';

export interface Analytics {
  days: number;
  visits: number;
  previousVisits: number;
  visitors: number;
  searches: number;
  searchesWithoutResults: number;
  daily: Array<{ day: string; views: number }>;
  endpoints: Array<{ method: string; path: string; label?: string; views: number }>;
  pages: Array<{ page: string; title: string; views: number }>;
  missedSearches: Array<{ term: string; count: number }>;
  /** "Esta página ajudou?" answers in the period, and the latest ones with a comment. */
  feedback: {
    yes: number;
    no: number;
    comments: Array<{ page: string; title: string; helpful: boolean; comment: string; at: string }>;
  };
}

/** Loads the numbers for a period; `key` (e.g. the project's updatedAt) reloads them. */
export function useAnalytics(projectId: string, period: Period, key?: string, enabled = true) {
  const [state, setState] = useState<{ data?: Analytics; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: undefined }));
    request<Analytics>('GET', `/projects/${projectId}/analytics?days=${period}`)
      .then((data) => { if (active) setState({ data, loading: false }); })
      .catch((error: Error) => { if (active) setState({ error: error.message, loading: false }); });
    return () => { active = false; };
  }, [projectId, period, key, enabled]);
  return state;
}
