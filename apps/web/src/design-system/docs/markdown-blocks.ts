import type { MarkdownIt, StateBlock } from 'markdown-it';
import { highlight, languageNames } from './highlight';

/* Content blocks for guides and wiki pages, written as Markdown containers:

     :::note Optional title      callouts: note, tip, info, warning, danger
     Text.                       (also GitHub's "> [!NOTE]" alerts)
     :::

     :::steps                    numbered steps (an ordered list inside)
     :::tabs                     tabs, one "@tab Name" line per tab
     :::code-group               one code block per tab: ```bash [npm]
     :::cards                    "- [Title](link) Description" items as cards
     :::details Title            a section that opens and closes

   Portuguese names work too (nota, dica, atencao, perigo, passos, abas, codigo, detalhes).
   ```mermaid fences become diagrams; images open zoomed; an image whose link is a video
   (.mp4/.webm, YouTube, Vimeo) becomes a player. Interactive parts (tabs, zoom, diagrams) are
   plain HTML here and are wired up by <Markdown>. Raw HTML stays disabled: every attribute
   written below is escaped, and embed URLs are rebuilt from the video id alone. */

export interface BlockLabels {
  note: string;
  tip: string;
  info: string;
  warning: string;
  danger: string;
  details: string;
  zoomImage: (alt: string) => string;
  video: string;
  diagram: string;
}

/** Passed as markdown-it's env: the labels in the reader's language and a prefix for element ids. */
export type BlockEnv = { labels: BlockLabels; idBase: string; count?: number };

const aliases: Record<string, string> = {
  note: 'note', nota: 'note',
  tip: 'tip', dica: 'tip',
  info: 'info', important: 'info', importante: 'info',
  warning: 'warning', atencao: 'warning', aviso: 'warning', caution: 'danger',
  danger: 'danger', perigo: 'danger',
  steps: 'steps', passos: 'steps',
  tabs: 'tabs', abas: 'tabs',
  'code-group': 'code-group', codigo: 'code-group', 'grupo-de-codigo': 'code-group',
  cards: 'cards',
  details: 'details', detalhes: 'details',
};
const callouts = new Set(['note', 'tip', 'info', 'warning', 'danger']);

const svg = (paths: string) => `<svg class="ds-callout__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const icons: Record<string, string> = {
  note: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  info: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  tip: svg('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
  warning: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  danger: svg('<path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.31 2a2 2 0 0 1 1.42.59l4.68 4.68A2 2 0 0 1 22 8.69v6.62a2 2 0 0 1-.59 1.42l-4.68 4.68a2 2 0 0 1-1.42.59H8.69a2 2 0 0 1-1.42-.59l-4.68-4.68A2 2 0 0 1 2 15.31V8.69a2 2 0 0 1 .59-1.42l4.68-4.68A2 2 0 0 1 8.69 2z"/>'),
};
const arrow = '<svg class="ds-card__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

const fenceOpen = /^(`{3,}|~{3,})/;

/** GitHub alerts ("> [!NOTE]" and the quoted lines after it) become containers, outside code fences. */
export function githubAlerts(source: string) {
  const lines = source.split('\n');
  const out: string[] = [];
  const kinds: Record<string, string> = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'info', WARNING: 'warning', CAUTION: 'danger' };
  let fence: string | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const trimmed = line.trim();
    if (fence) { if (trimmed.startsWith(fence)) fence = null; out.push(line); continue; }
    const open = fenceOpen.exec(trimmed);
    if (open) { fence = open[1]!; out.push(line); continue; }
    const alert = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i.exec(trimmed);
    if (!alert) { out.push(line); continue; }
    out.push(`:::${kinds[alert[1]!.toUpperCase()]}${alert[2] ? ` ${alert[2]}` : ''}`);
    while (index + 1 < lines.length && /^\s*>/.test(lines[index + 1]!)) out.push(lines[++index]!.replace(/^\s*>\s?/, ''));
    out.push(':::');
  }
  return out.join('\n');
}

/** Block rule: ":::name title" up to the matching ":::" (nesting and code fences respected). */
function container(state: StateBlock, startLine: number, endLine: number, silent: boolean) {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  const first = state.src.slice(state.bMarks[startLine]! + state.tShift[startLine]!, state.eMarks[startLine]);
  const match = /^:::\s*([\w-]+)\s*(.*)$/.exec(first);
  const name = match && aliases[match[1]!.toLowerCase()];
  if (!name) return false;
  if (silent) return true;
  let depth = 1;
  let fence: string | null = null;
  let line = startLine;
  while (++line < endLine) {
    const text = state.src.slice(state.bMarks[line]! + state.tShift[line]!, state.eMarks[line]);
    if (fence) { if (text.startsWith(fence)) fence = null; continue; }
    const open = fenceOpen.exec(text);
    if (open) { fence = open[1]!; continue; }
    if (/^:::\s*[\w-]+/.test(text)) depth++;
    else if (/^:::\s*$/.test(text) && --depth === 0) break;
  }
  const token = state.push('ds_block', 'div', 0);
  token.block = true;
  token.info = name;
  token.meta = { title: match[2]!.trim(), body: state.getLines(startLine + 1, line, state.sCount[startLine]!, true) };
  token.map = [startLine, Math.min(line + 1, endLine)];
  state.line = Math.min(line + 1, endLine);
  return true;
}

export function installBlocks(md: MarkdownIt) {
  const escape = md.utils.escapeHtml;
  const env = (value: unknown) => value as BlockEnv;
  const nextId = (value: BlockEnv) => `${value.idBase}-${(value.count = (value.count ?? 0) + 1)}`;
  const safeUrl = (url: string) => {
    const normalized = md.normalizeLink(url);
    return md.validateLink(normalized) ? normalized : '';
  };

  /** Tabs markup: buttons + panels (the first one shown); <Markdown> handles clicks and arrow keys. */
  const tabs = (value: BlockEnv, items: Array<{ label: string; html: string }>, modifier: string) => {
    const id = nextId(value);
    const buttons = items.map((item, index) => `<button type="button" role="tab" class="ds-tabs-block__tab" id="${id}-tab-${index}" aria-controls="${id}-panel-${index}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-tab="${escape(item.label)}">${escape(item.label)}</button>`).join('');
    const panels = items.map((item, index) => `<div role="tabpanel" class="ds-tabs-block__panel" id="${id}-panel-${index}" aria-labelledby="${id}-tab-${index}" tabindex="0"${index === 0 ? '' : ' hidden'}>${item.html}</div>`).join('');
    return `<div class="ds-tabs-block ${modifier}"><div role="tablist" class="ds-tabs-block__list">${buttons}</div>${panels}</div>\n`;
  };

  const render: Record<string, (title: string, body: string, value: BlockEnv) => string> = {
    steps: (_title, body, value) => `<div class="ds-steps">${md.render(body, value)}</div>\n`,
    details: (title, body, value) => `<details class="ds-details"><summary class="ds-details__summary">${md.renderInline(title || value.labels.details, value)}</summary><div class="ds-details__body">${md.render(body, value)}</div></details>\n`,
    tabs: (_title, body, value) => {
      const items: Array<{ label: string; html: string }> = [];
      let current: { label: string; lines: string[] } | null = null;
      for (const line of body.split('\n')) {
        const tab = /^@tab\s+(.+)$/.exec(line.trim());
        if (tab) { if (current) items.push({ label: current.label, html: md.render(current.lines.join('\n'), value) }); current = { label: tab[1]!.trim(), lines: [] }; }
        else current?.lines.push(line);
      }
      if (current) items.push({ label: current.label, html: md.render(current.lines.join('\n'), value) });
      return items.length ? tabs(value, items, '') : md.render(body, value);
    },
    'code-group': (_title, body, value) => {
      const fences = md.parse(body, value).filter((token) => token.type === 'fence');
      const items = fences.map((token, index) => {
        const info = token.info.trim();
        const language = info.split(/\s+/)[0] ?? '';
        const label = /\[([^\]]+)\]/.exec(info)?.[1] ?? languageNames[language] ?? (language || `#${index + 1}`);
        return { label, html: `<pre class="ds-prose__pre" tabindex="0"><code>${highlight(token.content, language || undefined)}</code></pre>` };
      });
      return items.length ? tabs(value, items, 'ds-tabs-block--code') : '';
    },
    cards: (_title, body, value) => {
      const cards = body.split('\n').map((line) => /^\s*[-*]\s+\[([^\]]+)\]\(([^)\s]+)\)\s*(?:[—–:-]\s*)?(.*)$/.exec(line)).filter((match) => match !== null).map((match) => {
        const href = safeUrl(match[2]!);
        const external = /^https?:\/\//.test(href);
        // Descriptions are inline Markdown without links (a card is already one).
        const text = match[3] ? md.renderInline(match[3], value).replace(/<\/?a\b[^>]*>/g, '') : '';
        return `<a class="ds-card" href="${escape(href)}"${external ? ' target="_blank" rel="noreferrer"' : ''}><span class="ds-card__title">${md.renderInline(match[1]!, value)}${arrow}</span>${text ? `<span class="ds-card__text">${text}</span>` : ''}</a>`;
      });
      return `<div class="ds-cards">${cards.join('')}</div>\n`;
    },
  };

  md.block.ruler.before('fence', 'ds_block', container, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.renderer.rules.ds_block = (tokens, index, _options, envValue) => {
    const token = tokens[index]!;
    const value = env(envValue);
    const { title, body } = token.meta as { title: string; body: string };
    if (callouts.has(token.info)) {
      const label = title ? md.renderInline(title, value) : escape(value.labels[token.info as 'note']);
      return `<div class="ds-callout ds-callout--${token.info}" role="note"><p class="ds-callout__title">${icons[token.info]}<span>${label}</span></p><div class="ds-callout__body">${md.render(body, value)}</div></div>\n`;
    }
    return render[token.info]!(title, body, value);
  };

  // ```mermaid: the source is shown as code until the diagram engine (loaded on demand) draws it.
  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, index, options, envValue, self) => {
    const token = tokens[index]!;
    if (token.info.trim().split(/\s+/)[0] !== 'mermaid') return fence(tokens, index, options, envValue, self);
    const source = token.content;
    return `<div class="ds-mermaid" role="img" aria-label="${escape(env(envValue).labels.diagram)}" data-mermaid="${escape(source)}"><pre class="ds-prose__pre"><code>${escape(source)}</code></pre></div>\n`;
  };

  // Images open zoomed; a link to a video becomes a player.
  md.renderer.rules.image = (tokens, index, options, envValue) => {
    const token = tokens[index]!;
    const value = env(envValue);
    const src = String(token.attrGet('src') ?? '');
    const alt = md.renderer.renderInlineAsText(token.children ?? [], options, envValue);
    const title = token.attrGet('title') === null ? '' : String(token.attrGet('title'));
    const youtube = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(src)?.[1];
    const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(src)?.[1];
    const frame = (url: string) => `<span class="ds-embed"><iframe src="${url}" title="${escape(alt || value.labels.video)}" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></span>`;
    if (youtube) return frame(`https://www.youtube-nocookie.com/embed/${youtube}`);
    if (vimeo) return frame(`https://player.vimeo.com/video/${vimeo}?dnt=1`);
    if (/\.(mp4|webm|ogv|mov)(?:[?#]|$)/i.test(src)) {
      return `<video class="ds-video" src="${escape(src)}" controls preload="metadata" playsinline aria-label="${escape(alt || value.labels.video)}"${title ? ` title="${escape(title)}"` : ''}></video>`;
    }
    return `<button type="button" class="ds-zoom" data-zoom aria-label="${escape(value.labels.zoomImage(alt))}"><img src="${escape(src)}" alt="${escape(alt)}"${title ? ` title="${escape(title)}"` : ''} loading="lazy" decoding="async"></button>`;
  };
}
