import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const storageKey = 'opendoc:theme';
/** Keys used under the app's earlier names; read once so the saved choice isn't lost. */
const legacyKeys = ['folio:theme', 'facet:theme'];

function readLegacy() {
  for (const key of legacyKeys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

export function readTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(storageKey) ?? readLegacy();
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
  return 'system';
}

/** Applies the preference to <html data-theme> and remembers it for this browser. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') delete root.dataset.theme;
  else root.dataset.theme = preference;
  try {
    for (const key of legacyKeys) localStorage.removeItem(key);
    if (preference === 'system') localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, preference);
  } catch {
    // Preference still applies for this page view.
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(readTheme);
  useEffect(() => applyTheme(theme), [theme]);
  return [theme, setTheme] as const;
}
