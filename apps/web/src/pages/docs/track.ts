/**
 * Analytics events from the published docs to the API (POST /api/docs/:slug/events): which page is
 * read and what is searched. Fire-and-forget: a failure never affects reading.
 */
import { docsSource } from './source';

type DocsEvent =
  | { kind: 'view'; page: string; label?: string; method?: string; path?: string }
  | { kind: 'search'; query: string; results: number };

export function track(event: DocsEvent) {
  const { slug } = docsSource();
  fetch(`/api/docs/${encodeURIComponent(slug)}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
    credentials: 'same-origin',
    // Still sent when the reader is leaving the page.
    keepalive: true,
  }).catch(() => {});
}
