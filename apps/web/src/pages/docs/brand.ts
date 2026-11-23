import { docsSource } from './source';

/**
 * Company branding for the docs site. It will come from the CMS; every field except the name is
 * optional, and the page falls back in this order:
 *   full logo → symbol + name → OpenDoc mark + name.
 * Without a symbol, the OpenDoc mark stands in: next to the name and as the favicon.
 */
export interface DocsBranding {
  /** Company name, e.g. "Acme". Always shown as text unless a full logo replaces it. */
  name: string;
  /** Short label after the name, e.g. "API", "Docs", "Developers". */
  label?: string;
  /** Logo with symbol and name together (replaces the name text). `dark` is used in dark mode. */
  logo?: { light: string; dark?: string };
  /** Symbol only (shown before the name). */
  symbol?: { light: string; dark?: string };
}

/** The docs expect a light image; with only a dark one, it serves both themes. */
const pair = (images?: { light?: string; dark?: string }) => {
  const light = images?.light ?? images?.dark;
  return light ? { light, ...(images?.dark && images.dark !== light ? { dark: images.dark } : {}) } : undefined;
};

/** What the admin configured (Aparência, or the organization's brand); without it, the project's name. */
const { branding: configured, name } = docsSource();
export const branding: DocsBranding = configured?.name
  ? { name: configured.name, label: configured.label, logo: pair(configured.logo), symbol: pair(configured.symbol) }
  : { name };
