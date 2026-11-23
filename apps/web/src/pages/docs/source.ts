/**
 * The documentation being shown: the published spec of one project, loaded from the API by
 * DocsRoute before the docs modules load. Those modules (spec.ts, brand.ts, DocsPage) read it once,
 * when they are first imported, which is why DocsRoute imports them only after setting it.
 */
import type { Branding } from '../admin/data/types';

export interface DocsSource {
  slug: string;
  /** Project name, shown when the brand has none. */
  name: string;
  /** The OpenAPI document, already parsed. */
  spec: Record<string, unknown>;
  branding?: Branding;
  playground: boolean;
  /** Wiki pages written in the admin, in their order: one docs page each. */
  pages: Array<{ id: string; title: string; slug: string; body: string }>;
}

let current: DocsSource | undefined;

export function setDocsSource(source: DocsSource) {
  current = source;
}

export function docsSource(): DocsSource {
  if (!current) throw new Error('A documentação ainda não carregou.');
  return current;
}
