import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import MarkdownIt from 'markdown-it';
import { cx } from '../cx';
import { useDsMessages } from '../i18n';
import { Dialog, DialogContent, DialogTitle } from '../components/Dialog';
import { highlight, useHighlighter } from './highlight';
import { githubAlerts, installBlocks, type BlockEnv } from './markdown-blocks';

/** Typography for long-form content (rendered Markdown, guides). */
export function Prose({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cx('ds-prose', className)} {...props} />;
}

function slugify(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
}

/**
 * Markdown renderer. Raw HTML is disabled (user content is safe), links with unsafe schemes are
 * dropped by markdown-it, code fences are highlighted, and h2/h3 get ids for anchors and the TOC.
 * Content blocks (callouts, steps, tabs, code groups, cards, details, diagrams, zoomable images and
 * videos) come from markdown-blocks.ts.
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight: (code, language) => `<pre class="ds-prose__pre" tabindex="0"><code>${highlight(code, language || undefined)}</code></pre>`,
});
md.core.ruler.push('heading_ids', (state) => {
  const used = new Map<string, number>();
  state.tokens.forEach((token, index) => {
    if (token.type !== 'heading_open' || !['h2', 'h3'].includes(token.tag)) return;
    const text = state.tokens[index + 1]?.content ?? '';
    const base = slugify(text) || 'secao';
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    token.attrSet('id', count ? `${base}-${count}` : base);
  });
});
const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const href = String(tokens[index]!.attrGet("href") ?? "");
  if (/^https?:\/\//.test(href)) {
    tokens[index]!.attrSet('target', '_blank');
    tokens[index]!.attrSet('rel', 'noreferrer');
  }
  return defaultLinkOpen(tokens, index, options, env, self);
};
installBlocks(md);

/** Extracts h2/h3 headings (same ids as the renderer) to feed a TableOfContents. */
export function markdownHeadings(source: string) {
  const tokens = md.parse(source, {});
  const used = new Map<string, number>();
  const items: Array<{ id: string; title: string; level: 2 | 3 }> = [];
  tokens.forEach((token, index) => {
    if (token.type !== 'heading_open' || !['h2', 'h3'].includes(token.tag)) return;
    const title = tokens[index + 1]?.content ?? '';
    const base = slugify(title) || 'secao';
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    items.push({ id: count ? `${base}-${count}` : base, title, level: token.tag === 'h2' ? 2 : 3 });
  });
  return items;
}

export interface MarkdownProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  source: string;
  /** Prefix for heading ids when several documents share a page. */
  idPrefix?: string;
}

/* Tabs with the same name stay in sync across the page and between visits (pick "pnpm" once and
   every install snippet shows pnpm), like Docusaurus' tab groups. */
const TABS_KEY = 'opendoc:tabs';
function readTabChoices(): string[] {
  try { return JSON.parse(localStorage.getItem(TABS_KEY) ?? '[]') as string[]; } catch { return []; }
}

function selectTab(tab: HTMLElement) {
  const list = tab.closest('[role="tablist"]');
  const block = list?.parentElement;
  if (!list || !block) return;
  for (const other of list.querySelectorAll<HTMLElement>('[role="tab"]')) {
    const selected = other === tab;
    other.setAttribute('aria-selected', String(selected));
    other.tabIndex = selected ? 0 : -1;
    const panel = block.querySelector<HTMLElement>(`#${CSS.escape(other.getAttribute('aria-controls') ?? '')}`);
    if (panel) panel.hidden = !selected;
  }
}

/** In every tab block, shows the most recently chosen tab name it has. */
function applyTabChoices(root: HTMLElement, choices: string[]) {
  for (const list of root.querySelectorAll<HTMLElement>('[role="tablist"]')) {
    const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
    const match = choices.map((label) => tabs.find((tab) => tab.dataset.tab === label)).find(Boolean);
    if (match) selectTab(match);
  }
}

const isDark = () => {
  const theme = document.documentElement.dataset.theme;
  return theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

/** Draws the ```mermaid blocks (the engine loads only on pages that have one) and redraws them when the theme changes. */
function useDiagrams(root: RefObject<HTMLDivElement | null>, html: string, idBase: string, failed: string) {
  useEffect(() => {
    const element = root.current;
    if (!element?.querySelector('[data-mermaid]')) return;
    let run = 0;
    const draw = async () => {
      const current = ++run;
      const { default: mermaid } = await import('mermaid');
      if (current !== run) return;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: isDark() ? 'dark' : 'neutral', fontFamily: 'inherit' });
      const nodes = [...element.querySelectorAll<HTMLElement>('[data-mermaid]')];
      for (const [index, node] of nodes.entries()) {
        try {
          const { svg } = await mermaid.render(`${idBase}-diagram-${index}-${current}`, node.dataset.mermaid ?? '');
          if (current !== run) return;
          node.innerHTML = svg;
          node.classList.add('is-drawn');
        } catch {
          // Invalid diagram: the source stays visible as code, with a note.
          if (!node.querySelector('.ds-mermaid__error')) node.insertAdjacentHTML('beforeend', `<p class="ds-mermaid__error">${failed}</p>`);
        }
      }
    };
    void draw();
    const observer = new MutationObserver(() => void draw());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onMedia = () => void draw();
    media.addEventListener('change', onMedia);
    return () => { run++; observer.disconnect(); media.removeEventListener('change', onMedia); };
  }, [root, html, idBase, failed]);
}

export function Markdown({ source, idPrefix, className, onClick, onKeyDown, ...props }: MarkdownProps) {
  const ready = useHighlighter();
  const t = useDsMessages();
  const idBase = `md${useId().replace(/[^\w-]/g, '')}`;
  const labels: BlockEnv['labels'] = useMemo(() => ({
    note: t.calloutNote, tip: t.calloutTip, info: t.calloutInfo, warning: t.calloutWarning, danger: t.calloutDanger,
    details: t.detailsSummary, zoomImage: t.zoomImage, video: t.video, diagram: t.diagram,
  }), [t]);
  const html = useMemo(() => {
    const rendered = md.render(githubAlerts(source), { labels, idBase } satisfies BlockEnv);
    return idPrefix ? rendered.replace(/<(h[23]) id="/g, `<$1 id="${idPrefix}`) : rendered;
  }, [source, idPrefix, ready, labels, idBase]); // eslint-disable-line react-hooks/exhaustive-deps
  const root = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);

  // New HTML (first render, highlighter ready, new content) resets the tabs: show the names chosen before.
  useLayoutEffect(() => { if (root.current) applyTabChoices(root.current, readTabChoices()); }, [html]);
  useDiagrams(root, html, idBase, t.diagramFailed);

  const choose = (tab: HTMLElement) => {
    const label = tab.dataset.tab ?? '';
    const choices = [label, ...readTabChoices().filter((item) => item !== label)].slice(0, 20);
    try { localStorage.setItem(TABS_KEY, JSON.stringify(choices)); } catch { /* storage unavailable */ }
    selectTab(tab);
    if (root.current) applyTabChoices(root.current, [label]);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    const target = event.target as HTMLElement;
    const tab = target.closest<HTMLElement>('[role="tab"][data-tab]');
    if (tab) { choose(tab); return; }
    const image = target.closest<HTMLElement>('[data-zoom]')?.querySelector('img');
    if (image) setZoom({ src: image.currentSrc || image.src, alt: image.alt });
  };

  // Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern, automatic activation).
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const tab = (event.target as HTMLElement).closest<HTMLElement>('[role="tab"][data-tab]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...(tab.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
    const index = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next]!.focus();
    choose(tabs[next]!);
  };

  return (
    <>
      <Prose ref={root} className={className} {...props} onClick={handleClick} onKeyDown={handleKeyDown} dangerouslySetInnerHTML={{ __html: html }} />
      <Dialog open={zoom !== null} onOpenChange={(open) => { if (!open) setZoom(null); }}>
        <DialogContent className="ds-zoom-dialog" aria-describedby={undefined}>
          <DialogTitle className="ds-sr-only">{zoom?.alt || t.zoomedImage}</DialogTitle>
          {zoom && <img src={zoom.src} alt={zoom.alt} className="ds-zoom-dialog__image" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
