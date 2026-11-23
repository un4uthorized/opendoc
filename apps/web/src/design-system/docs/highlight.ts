import { useEffect, useSyncExternalStore } from 'react';
import type { HLJSApi } from 'highlight.js';

/* highlight.js is loaded on demand: code renders as escaped plain text first and is
   re-rendered with colors as soon as the engine arrives (components use useHighlighter()). */

let engine: HLJSApi | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadHighlighter() {
  loading ??= import('./highlight-engine').then((module) => {
    engine = module.default;
    listeners.forEach((listener) => listener());
  });
  return loading;
}

/** True once highlight.js is ready; starts loading it and re-renders the caller when it arrives. */
export function useHighlighter() {
  const ready = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => engine !== null,
    () => false,
  );
  useEffect(() => { void loadHighlighter(); }, []);
  return ready;
}

export const languageNames: Record<string, string> = {
  bash: 'cURL', sh: 'Shell', shell: 'Shell', curl: 'cURL', javascript: 'JavaScript', js: 'JavaScript', node: 'Node.js',
  typescript: 'TypeScript', ts: 'TypeScript', python: 'Python', py: 'Python', json: 'JSON', yaml: 'YAML', yml: 'YAML',
  go: 'Go', ruby: 'Ruby', php: 'PHP', http: 'HTTP', xml: 'XML', html: 'HTML',
  java: 'Java', csharp: 'C#', cs: 'C#', kotlin: 'Kotlin', kt: 'Kotlin', swift: 'Swift', rust: 'Rust', rs: 'Rust',
  httpie: 'HTTPie', powershell: 'PowerShell', dart: 'Dart', elixir: 'Elixir', c: 'C', cpp: 'C++', scala: 'Scala', r: 'R',
};

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Returns escaped, highlighted HTML (safe for innerHTML); plain escaped text until the engine loads. */
export function highlight(code: string, language?: string) {
  if (!engine) return escapeHtml(code);
  if (language && engine.getLanguage(language)) return engine.highlight(code, { language, ignoreIllegals: true }).value;
  // No (or an unregistered) language: plain escaped text. ('plaintext' isn't registered in the slim engine.)
  return escapeHtml(code);
}
