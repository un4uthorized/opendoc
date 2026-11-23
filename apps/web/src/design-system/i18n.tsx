import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/* Interface language of the tool (labels, buttons, messages). Content that comes from the API
   (spec, descriptions, guides) is not translated here. */

export type Locale = 'pt-BR' | 'en';
export const locales: Array<{ value: Locale; label: string; short: string }> = [
  { value: 'pt-BR', label: 'Português', short: 'PT' },
  { value: 'en', label: 'English', short: 'EN' },
];

const storageKey = 'opendoc:locale';

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'pt-BR' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

interface LocaleState { locale: Locale; setLocale: (locale: Locale) => void }
export const LocaleContext = createContext<LocaleState>({ locale: 'pt-BR', setLocale: () => {} });

/** Holds the interface language: saved in this browser, mirrored on <html lang>. */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    setState(next);
    try { localStorage.setItem(storageKey, next); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** Picks the dictionary for the current language. */
export function useMessages<T>(dictionaries: Record<Locale, T>): T {
  return dictionaries[useContext(LocaleContext).locale];
}

/* ── Design system strings ───────────────────────────────────────── */

const pt = {
  copy: 'Copiar',
  copied: 'Copiado',
  copyFailed: 'Não foi possível copiar',
  copyCode: 'Copiar código',
  calloutNote: 'Nota',
  calloutTip: 'Dica',
  calloutInfo: 'Importante',
  calloutWarning: 'Atenção',
  calloutDanger: 'Perigo',
  detailsSummary: 'Detalhes',
  zoomImage: (alt: string) => (alt ? `Ampliar imagem: ${alt}` : 'Ampliar imagem'),
  zoomedImage: 'Imagem ampliada',
  video: 'Vídeo',
  diagram: 'Diagrama',
  diagramFailed: 'Não foi possível desenhar este diagrama. Confira a sintaxe do Mermaid.',
  copyFile: (file: string) => `Copiar ${file}`,
  copyExample: (language: string) => `Copiar exemplo em ${language}`,
  copyUrl: (method: string, path: string) => `Copiar URL de ${method} ${path}`,
  code: 'Código',
  codeRegion: (label: string) => `${label}, código`,
  codeExample: 'Exemplo de código',
  deprecated: 'Obsoleto',
  responses: 'Respostas',
  example: 'Exemplo',
  schema: 'Schema',
  noBody: 'Sem corpo de resposta.',
  responseFormat: (status: number) => `Formato da resposta ${status}`,
  required: '(obrigatório)',
  optional: '(opcional)',
  readOnly: 'somente leitura',
  writeOnly: 'somente escrita',
  deprecatedFlag: 'obsoleto',
  values: 'Valores',
  defaultValue: 'Padrão',
  rules: 'Regras',
  minimum: (n: number) => `mínimo ${n}`,
  maximum: (n: number) => `máximo ${n}`,
  minLength: (n: number) => `mín. ${n} caracteres`,
  maxLength: (n: number) => `máx. ${n} caracteres`,
  pattern: (p: string) => `padrão ${p}`,
  toggleProperties: (open: boolean, count: number) => `${open ? 'Ocultar' : 'Mostrar'} ${count} ${count === 1 ? 'propriedade' : 'propriedades'}`,
  ofProperty: (name: string) => ` de ${name}`,
  onThisPage: 'Nesta página',
  linkToSection: (title: string) => `Link para a seção ${title}`.trim(),
  errorTitle: (label?: string) => `Não foi possível exibir ${label ?? 'esta parte'}`,
  errorChunk: 'Parte do código não carregou. Recarregue a página para tentar de novo.',
  errorLocal: 'O resto da página continua funcionando.',
  retry: 'Tentar de novo',
  reload: 'Recarregar página',
  close: 'Fechar',
  search: 'Buscar',
  searchPlaceholder: 'Buscar…',
  commandPlaceholder: 'Digite um comando ou busque…',
  noResults: 'Nenhum resultado.',
  results: 'Resultados',
  resultCount: (n: number) => `${n} ${n === 1 ? 'resultado' : 'resultados'}`,
  navigate: 'navegar',
  open: 'abrir',
  closeHint: 'fechar',
  openMenu: 'Abrir menu',
  account: (name: string) => `Conta de ${name}`,
  accountWithLabel: (label: string, name: string) => `${label}, conta de ${name}`,
  loading: 'Carregando',
  listOf: 'Lista de',
  thePage: 'a página',
  items: 'itens',
  expandAll: 'Expandir tudo',
  collapseAll: 'Recolher tudo',
  recent: 'Recentes',
  oneOf: 'Um destes formatos:',
  anyOf: 'Um ou mais destes formatos:',
  option: (n: number) => `Opção ${n}`,
  discriminatedBy: (property: string) => `O campo ${property} diz qual formato chegou.`,
  circular: 'circular',
  circularHint: (name: string) => `Mesmo formato de ${name}, já descrito acima; não é repetido aqui.`,
  toggleVariants: (open: boolean, count: number) => `${open ? 'Ocultar' : 'Mostrar'} ${count} formatos`,
  binaryBody: (contentType: string) => `Conteúdo binário (${contentType}). Envie a requisição para ver ou baixar.`,
  exampleOf: (status: number) => `Exemplo da resposta ${status}`,
};

export type DsMessages = typeof pt;

const en: DsMessages = {
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: "Couldn't copy",
  copyCode: 'Copy code',
  calloutNote: 'Note',
  calloutTip: 'Tip',
  calloutInfo: 'Important',
  calloutWarning: 'Warning',
  calloutDanger: 'Danger',
  detailsSummary: 'Details',
  zoomImage: (alt) => (alt ? `Zoom image: ${alt}` : 'Zoom image'),
  zoomedImage: 'Zoomed image',
  video: 'Video',
  diagram: 'Diagram',
  diagramFailed: 'This diagram couldn’t be drawn. Check the Mermaid syntax.',
  copyFile: (file) => `Copy ${file}`,
  copyExample: (language) => `Copy ${language} example`,
  copyUrl: (method, path) => `Copy URL of ${method} ${path}`,
  code: 'Code',
  codeRegion: (label) => `${label}, code`,
  codeExample: 'Code example',
  deprecated: 'Deprecated',
  responses: 'Responses',
  example: 'Example',
  schema: 'Schema',
  noBody: 'No response body.',
  responseFormat: (status) => `Format of the ${status} response`,
  required: '(required)',
  optional: '(optional)',
  readOnly: 'read-only',
  writeOnly: 'write-only',
  deprecatedFlag: 'deprecated',
  values: 'Values',
  defaultValue: 'Default',
  rules: 'Rules',
  minimum: (n) => `minimum ${n}`,
  maximum: (n) => `maximum ${n}`,
  minLength: (n) => `min. ${n} characters`,
  maxLength: (n) => `max. ${n} characters`,
  pattern: (p) => `pattern ${p}`,
  toggleProperties: (open, count) => `${open ? 'Hide' : 'Show'} ${count} ${count === 1 ? 'property' : 'properties'}`,
  ofProperty: (name) => ` of ${name}`,
  onThisPage: 'On this page',
  linkToSection: (title) => `Link to the ${title} section`.trim(),
  errorTitle: (label) => `Couldn't show ${label ?? 'this part'}`,
  errorChunk: "Part of the code didn't load. Reload the page to try again.",
  errorLocal: 'The rest of the page still works.',
  retry: 'Try again',
  reload: 'Reload page',
  close: 'Close',
  search: 'Search',
  searchPlaceholder: 'Search…',
  commandPlaceholder: 'Type a command or search…',
  noResults: 'No results.',
  results: 'Results',
  resultCount: (n) => `${n} ${n === 1 ? 'result' : 'results'}`,
  navigate: 'navigate',
  open: 'open',
  closeHint: 'close',
  openMenu: 'Open menu',
  account: (name) => `${name}'s account`,
  accountWithLabel: (label, name) => `${label}, ${name}'s account`,
  loading: 'Loading',
  listOf: 'List of',
  thePage: 'the page',
  items: 'items',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  recent: 'Recent',
  oneOf: 'One of these shapes:',
  anyOf: 'One or more of these shapes:',
  option: (n) => `Option ${n}`,
  discriminatedBy: (property) => `The ${property} field says which shape arrived.`,
  circular: 'circular',
  circularHint: (name) => `Same shape as ${name}, described above; not repeated here.`,
  toggleVariants: (open, count) => `${open ? 'Hide' : 'Show'} ${count} shapes`,
  binaryBody: (contentType) => `Binary content (${contentType}). Send the request to see or download it.`,
  exampleOf: (status) => `Example of the ${status} response`,
};

export const dsMessages: Record<Locale, DsMessages> = { 'pt-BR': pt, en };

/** Strings for design system components, in the current language. */
export function useDsMessages() {
  return useMessages(dsMessages);
}
