/** Summaries and groupings of a spec (YAML or JSON), built on the validator in ./openapi. */
import { parseSpec, type ParsedSpec } from './openapi';

export interface SpecSummary {
  title: string;
  version: string;
  openapi: string;
  endpoints: number;
  schemas: number;
}

export type SpecCheck =
  | { status: 'empty' }
  | { status: 'invalid'; message: string; line?: number; errors: number; warnings: number }
  | { status: 'valid'; summary: SpecSummary; warnings: number };

/* The same text is parsed by several screens: keep the last few results. */
const cache = new Map<string, ParsedSpec>();
export function parsed(text: string): ParsedSpec {
  const hit = cache.get(text);
  if (hit) return hit;
  const result = parseSpec(text);
  cache.set(text, result);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return result;
}

export function checkSpec(text: string): SpecCheck {
  if (!text.trim()) return { status: 'empty' };
  const result = parsed(text);
  const errors = result.issues.filter((issue) => issue.severity === 'error');
  const warnings = result.issues.length - errors.length;
  if (errors.length || !result.value) {
    const first = errors[0];
    return { status: 'invalid', message: first?.message ?? 'A spec não é válida.', line: first?.line, errors: errors.length, warnings };
  }
  const spec = result.value;
  return {
    status: 'valid',
    warnings,
    summary: {
      title: String(spec.info?.title ?? ''),
      version: String(spec.info?.version ?? ''),
      openapi: String(spec.openapi),
      endpoints: result.endpoints.length,
      schemas: result.models.length,
    },
  };
}

export function specSummary(text: string): SpecSummary | null {
  const check = checkSpec(text);
  return check.status === 'valid' ? check.summary : null;
}

/** A minimal valid spec, in YAML (the format most teams write by hand). */
export function emptySpec(title: string) {
  return `openapi: 3.1.0\ninfo:\n  title: ${JSON.stringify(title)}\n  version: 1.0.0\npaths: {}\n`;
}

export interface SpecEndpoint { method: string; path: string; summary?: string; deprecated?: boolean }
export interface SpecTag { name: string; description?: string; endpoints: SpecEndpoint[] }

/** Endpoints grouped by their first tag, in the spec's order (untagged ones go to "Outros"). */
export function specTags(text: string): SpecTag[] {
  if (!text.trim()) return [];
  const result = parsed(text);
  if (!result.value) return [];
  const tags = new Map<string, SpecTag>();
  for (const tag of Array.isArray(result.value.tags) ? result.value.tags : []) {
    if (tag && typeof tag.name === 'string') tags.set(tag.name, { name: tag.name, description: tag.description, endpoints: [] });
  }
  for (const endpoint of result.endpoints) {
    if (!tags.has(endpoint.tag)) tags.set(endpoint.tag, { name: endpoint.tag, endpoints: [] });
    tags.get(endpoint.tag)!.endpoints.push({ method: endpoint.method, path: endpoint.path, summary: endpoint.summary, deprecated: endpoint.deprecated });
  }
  return [...tags.values()].filter((tag) => tag.endpoints.length > 0);
}

export const endpointKey = (endpoint: SpecEndpoint) => `${endpoint.method} ${endpoint.path}`;
