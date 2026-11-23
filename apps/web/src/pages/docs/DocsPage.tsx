import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { DropdownMenu as MenuPrimitive } from 'radix-ui';
import { ArrowLeft, ArrowRight, BookOpen, Braces, ChevronRight, Download, FileText, Folder, FolderOpen, LayoutDashboard, LogIn, LogOut, Menu, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Play, Search, Sun, User, Webhook as WebhookIcon, X } from 'lucide-react';
import {
  Badge, buttonClassName, CodeBlock, ErrorBoundary, locales, useLocale, type Locale, CodeTabs, cx, DropdownMenuItem, DropdownMenuSeparator, UserMenu, useTheme,
  type ThemePreference, CommandMenu, CopyButton, EndpointHeader, IconButton, Markdown, MethodBadge, Navbar, NavbarSearch, NavbarSection,
  Button, ResponsePanel, SchemaViewer, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetHeader, SheetTitle, markdownHeadings, useCommandShortcut, useMediaQuery, type CommandGroup,
} from '../../design-system';
import { OpenDocLogo } from '../../brand/OpenDocLogo';
import { branding } from './brand';
import { authApi } from '../../auth/api';
import { useSession } from '../../auth/useSession';
import { docsSource } from './source';
import { track } from './track';
import { Playground, PlaygroundCode, PlaygroundProvider, schemeLabel, usePlayground, type PlaygroundState } from './Playground';
import { useDocsMessages } from './messages';
import {
  baseUrl, exampleText, info, models, operations, parametersSchema, serverUrl, servers, tags, webhooks,
  type Callback, type Model, type Operation, type RequestBody, type Tag, type Webhook,
} from './spec';
import './docs-page.css';

const introId = 'introducao';
const allQuickStart = [
  { title: 'Busque um post', text: '`GET /posts/1` devolve o primeiro post, sem chave.', href: '#get-post' },
  { title: 'Filtre listas', text: '`/todos?userId=1` traz só as tarefas do usuário 1.', href: '#list-todos' },
  { title: 'Teste escritas', text: '`POST /posts` responde como se salvasse, sem salvar.', href: '#create-post' },
];
/** First steps, written for the sample API: only the ones whose endpoint exists in this spec. */
const quickStart = allQuickStart.filter((step) => operations.some((operation) => `#${operation.id}` === step.href));
const source = docsSource();
/** Block syntax (":::note", "@tab npm", "> [!TIP]") isn't text a reader searches for. */
const searchableText = (markdown: string) => markdown.replace(/^\s*(?::::.*|>\s*\[![A-Z]+\].*)$/gm, '').replace(/^\s*@tab\s+/gm, '');
/**
 * Wiki pages written in the admin: each one is its own docs page (#pagina-<slug>), after the
 * overview. A page without its own "# Title" line gets one, so every page opens with its title.
 */
const wikiPages = source.pages.map((page) => ({
  id: `pagina-${page.slug}`,
  title: page.title,
  body: /^\s*#\s/.test(page.body) ? page.body : `# ${page.title}\n\n${page.body}`,
  text: searchableText(page.body),
}));
type WikiPage = (typeof wikiPages)[number];
/** The published spec as a JSON file, for the download button. */
const specUrl = URL.createObjectURL(new Blob([JSON.stringify(source.spec, null, 2)], { type: 'application/json' }));
const introHeadings = markdownHeadings(info.description).map((heading) => ({ ...heading, id: `guia-${heading.id}` }));
const guidePages = introHeadings.filter((heading) => heading.level === 2);
/** Text of each guide section (by h2), for the search. */
const guideText = searchableText(info.description).split(/^## .*$/m).slice(1);
/** Reading order for "Previous / Next": the guide, every endpoint in sidebar order, webhooks, models. */
const sequence: Array<{ id: string; label: string; method?: Operation['method'] }> = [
  ...wikiPages.map((page) => ({ id: page.id, label: page.title })),
  ...tags.flatMap((tag) => tag.operations.map((operation) => ({ id: operation.id, label: operation.summary, method: operation.method }))),
  ...webhooks.map((webhook) => ({ id: webhook.id, label: webhook.summary, method: webhook.method })),
  ...models.map((model) => ({ id: model.id, label: model.name })),
];
const RECENT_KEY = 'opendoc-docs:recent';

/* One page at a time: the guide, a single endpoint, a webhook or a model. The address hash picks it:
   #<endpoint id> opens that endpoint, #<group id> its first endpoint, #webhook-… and #model-… those
   pages, anything else (or nothing) the guide, scrolled to that heading. */
type Route =
  | { kind: 'guide'; anchor?: string }
  | { kind: 'page'; page: WikiPage }
  | { kind: 'operation'; operation: Operation; tag: Tag }
  | { kind: 'webhook'; webhook: Webhook }
  | { kind: 'model'; model: Model };
const routeId = (route: Route) => (route.kind === 'operation' ? route.operation.id : route.kind === 'webhook' ? route.webhook.id : route.kind === 'model' ? route.model.id : route.kind === 'page' ? route.page.id : undefined);
/** Prose pages (the overview and wiki pages) take the whole width: no examples column. */
const isProse = (route: Route) => route.kind === 'guide' || route.kind === 'page';
const guideIds = [introId, ...guidePages.map((page) => page.id)];
const NO_IDS: string[] = [];

function parseRoute(hash: string): Route {
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  const page = wikiPages.find((item) => item.id === id);
  if (page) return { kind: 'page', page };
  for (const tag of tags) {
    const operation = tag.id === id ? tag.operations[0] : tag.operations.find((item) => item.id === id);
    if (operation) return { kind: 'operation', operation, tag };
  }
  const webhook = webhooks.find((item) => item.id === id);
  if (webhook) return { kind: 'webhook', webhook };
  const model = models.find((item) => item.id === id);
  if (model) return { kind: 'model', model };
  return { kind: 'guide', anchor: id && id !== introId ? id : undefined };
}

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => { window.removeEventListener('hashchange', onChange); window.removeEventListener('popstate', onChange); };
  }, []);
  return route;
}

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const matches = (query: string, ...fields: Array<string | undefined>) => {
  const haystack = normalize(fields.filter(Boolean).join(' '));
  return normalize(query).split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
};

/** Turns `code` spans in a plain string into <code>. */
function inline(text: string | undefined): ReactNode {
  if (!text) return undefined;
  return text.split(/(`[^`]+`)/g).map((part, index) => (part.startsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : <Fragment key={index}>{part}</Fragment>));
}

/** The section nearest the top of the viewport (below the sticky header). */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | undefined>(undefined);
  useEffect(() => {
    // Forget the section from the last time these ids were tracked (leaving the guide and coming back
    // would otherwise mark, and write to the address, where the reader was before).
    setActive(undefined);
    const visible = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      const first = ids.find((id) => visible.has(id));
      if (!first) return;
      // A section that holds other tracked ids (the guide and its headings): the active one is the last
      // heading already scrolled past the reading line, so the section stays marked while it is read.
      const container = document.getElementById(first);
      const line = window.innerHeight * 0.4;
      const inner = ids.filter((id) => id !== first && container?.contains(document.getElementById(id)));
      const passed = inner.filter((id) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= line);
      setActive(passed.at(-1) ?? first);
    }, { rootMargin: '-80px 0px -60% 0px' });
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

/** Sidebar label: shows the full text as a tooltip only when it is cut with an ellipsis. */
function NavLabel({ children }: { children: string }) {
  return (
    <span
      className="rd-nav__label"
      onPointerEnter={(event) => {
        const label = event.currentTarget;
        if (label.scrollWidth > label.clientWidth) label.title = children;
        else label.removeAttribute('title');
      }}
    >
      {children}
    </span>
  );
}

/**
 * Scalar-style navigation: the introduction as top-level links, then one collapsible group per
 * tag (a real button with aria-expanded) with its endpoints indented and the method on the right.
 * All groups start open, and a closed group holding the section being read reopens by itself.
 */
function DocsNav({ active, onNavigate, navRef }: { active?: string; onNavigate?: () => void; navRef?: React.Ref<HTMLElement> }) {
  const t = useDocsMessages();
  const baseId = useId();
  const activeTag = tags.find((tag) => tag.operations.some((operation) => operation.id === active))?.id;
  // All groups start open; the reader can close any of them.
  const [open, setOpen] = useState<Set<string>>(() => new Set(tags.map((tag) => tag.id)));
  useEffect(() => {
    if (activeTag) setOpen((current) => (current.has(activeTag) ? current : new Set(current).add(activeTag)));
  }, [activeTag]);
  const toggle = (id: string) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const link = (id: string, children: ReactNode, className?: string) => (
    <a href={`#${id}`} className={className} aria-current={active === id ? 'location' : undefined} onClick={onNavigate}>{children}</a>
  );
  // Quick filter: narrows pages and endpoints as you type; matching groups open by themselves.
  const [filter, setFilter] = useState('');
  const filtering = filter.trim() !== '';
  const pages = [{ id: introId, title: t.overview }, ...guidePages, ...wikiPages].filter((page) => !filtering || matches(filter, page.title, 'text' in page ? page.text : undefined));
  const groups = tags
    .map((tag) => ({ ...tag, operations: filtering ? tag.operations.filter((operation) => matches(filter, operation.summary, operation.method, operation.path, tag.name)) : tag.operations }))
    .filter((tag) => tag.operations.length > 0);
  const hooks = webhooks.filter((webhook) => !filtering || matches(filter, webhook.summary, webhook.name, t.webhooks));
  const shapes = models.filter((model) => !filtering || matches(filter, model.name, t.models));
  return (
    <nav ref={navRef} className="rd-nav" aria-label={t.docsNavigation}>
      <div className="rd-nav__filter">
        <Search className="rd-nav__filter-icon" aria-hidden="true" />
        <input
          type="search"
          className="rd-nav__filter-input"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape' && filter) { event.preventDefault(); setFilter(''); } }}
          placeholder={t.filterNav}
          aria-label={t.filterNavLabel}
          spellCheck={false}
          autoComplete="off"
        />
        {filtering && (
          <button type="button" className="rd-nav__filter-clear" onClick={() => setFilter('')} aria-label={t.clearFilter}>
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      {filtering && pages.length === 0 && groups.length === 0 && hooks.length === 0 && shapes.length === 0 && <p className="rd-nav__empty" role="status">{t.noMatches}</p>}
      {/* Two kinds of content, each in its own labelled section: the guide (wiki pages, a flat list of
          documents) and the API reference (folders of requests in a file tree). */}
      {pages.length > 0 && <p className="rd-nav__section" aria-hidden="true">{t.guide}</p>}
      <ul role="list" className="rd-nav__list rd-nav__list--pages">
        {pages.map((page) => (
          <li key={page.id}>
            {link(page.id, (
              <>
                <FileText className="rd-nav__page-icon" aria-hidden="true" />
                <NavLabel>{page.title}</NavLabel>
              </>
            ))}
          </li>
        ))}
      </ul>
      {groups.length > 0 && <p className="rd-nav__section" aria-hidden="true">{t.apiReference}</p>}
      {groups.map((tag) => {
        const isOpen = filtering || open.has(tag.id);
        const listId = `${baseId}-${tag.id}`;
        return (
          <div className="rd-nav__group" key={tag.id}>
            <button type="button" className="rd-nav__folder" aria-expanded={isOpen} aria-controls={listId} onClick={() => toggle(tag.id)}>
              {isOpen ? <FolderOpen className="rd-nav__folder-icon" aria-hidden="true" /> : <Folder className="rd-nav__folder-icon" aria-hidden="true" />}
              <NavLabel>{tag.name}</NavLabel>
              {!isOpen && <span className="rd-nav__count" aria-label={t.endpointCount(tag.operations.length)}>{tag.operations.length}</span>}
              <ChevronRight className="rd-nav__chevron" aria-hidden="true" />
            </button>
            <ul id={listId} role="list" className="rd-nav__list rd-nav__list--nested" hidden={!isOpen}>
              {tag.operations.map((operation) => (
                <li key={operation.id}>
                  {link(operation.id, (
                    <>
                      <NavLabel>{operation.summary}</NavLabel>
                      {operation.badges.map((badge) => <span key={badge} className="rd-nav__badge">{badge}</span>)}
                      {operation.deprecated && <span className="ds-sr-only">{t.deprecatedSr}</span>}
                      <span className="ds-sr-only">, </span>
                      <MethodBadge method={operation.method} className="rd-nav__method" />
                    </>
                  ), cx(operation.deprecated && 'is-deprecated'))}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {hooks.length > 0 && <p className="rd-nav__section" aria-hidden="true">{t.webhooks}</p>}
      {hooks.length > 0 && (
        <ul role="list" className="rd-nav__list rd-nav__list--pages">
          {hooks.map((webhook) => (
            <li key={webhook.id}>
              {link(webhook.id, (
                <>
                  <WebhookIcon className="rd-nav__page-icon" aria-hidden="true" />
                  <NavLabel>{webhook.summary}</NavLabel>
                  {webhook.badges.map((badge) => <span key={badge} className="rd-nav__badge">{badge}</span>)}
                  <span className="ds-sr-only">, </span>
                  <MethodBadge method={webhook.method} className="rd-nav__method" />
                </>
              ))}
            </li>
          ))}
        </ul>
      )}
      {shapes.length > 0 && <p className="rd-nav__section" aria-hidden="true">{t.models}</p>}
      {shapes.length > 0 && (
        <ul role="list" className="rd-nav__list rd-nav__list--pages">
          {shapes.map((model) => (
            <li key={model.id}>
              {link(model.id, (
                <>
                  <Braces className="rd-nav__page-icon" aria-hidden="true" />
                  <NavLabel>{model.name}</NavLabel>
                </>
              ))}
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

/** "Previous / Next" at the end of a page or endpoint, in sidebar order. */
function Pager({ id }: { id: string }) {
  const t = useDocsMessages();
  const items = [{ id: introId, label: t.overview }, ...sequence];
  const index = items.findIndex((item) => item.id === id);
  const previous = items[index - 1];
  const next = items[index + 1];
  if (!previous && !next) return null;
  return (
    <nav className="rd-pager" aria-label={t.pagination}>
      {previous ? (
        <a href={`#${previous.id}`} className="rd-pager__link" rel="prev">
          <span className="rd-pager__direction"><ArrowLeft aria-hidden="true" />{t.previous}</span>
          <span className="rd-pager__title">{previous.method && <MethodBadge method={previous.method} />}{previous.label}</span>
        </a>
      ) : <span />}
      {next && (
        <a href={`#${next.id}`} className="rd-pager__link rd-pager__link--next" rel="next">
          <span className="rd-pager__direction">{t.next}<ArrowRight aria-hidden="true" /></span>
          <span className="rd-pager__title">{next.method && <MethodBadge method={next.method} />}{next.label}</span>
        </a>
      )}
    </nav>
  );
}

function ParameterGroup({ title, operation, location }: { title: string; operation: Operation; location: keyof Operation['parameters'] }) {
  const parameters = operation.parameters[location];
  if (parameters.length === 0) return null;
  return (
    <div className="rd-block">
      <h4 className="rd-block__title">{title}</h4>
      <SchemaViewer schema={parametersSchema(parameters)} />
    </div>
  );
}

/** Which credentials the endpoint accepts (any one of the listed ways). */
function SecurityBlock({ operation }: { operation: Operation }) {
  const t = useDocsMessages();
  if (operation.security.length === 0) return null;
  return (
    <div className="rd-block">
      <h4 className="rd-block__title">{t.authentication}</h4>
      {operation.security.length > 1 && <p className="rd-block__hint">{t.authAlternatives}</p>}
      <ul role="list" className="rd-security">
        {operation.security.map((requirement, index) => (
          <li key={index}>
            {requirement.map(({ scheme, scopes }) => (
              <span key={scheme.key} className="rd-security__scheme">
                <strong>{schemeLabel(scheme, t)}</strong>
                {scheme.type === 'apiKey' && <code>{scheme.name}</code>}
                {scopes.map((scope) => <code key={scope}>{scope}</code>)}
                {scheme.description && <span className="rd-security__text">{scheme.description}</span>}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Request body schema for each content type; the picker also switches the API client's body. */
function BodyBlock({ body, play, title }: { body: RequestBody; play?: PlaygroundState; title: string }) {
  const t = useDocsMessages();
  const [own, setOwn] = useState(0);
  // The client's body type when it is one the spec declares (it can also pick none, GraphQL…).
  const index = play && play.mediaIndex < body.media.length ? play.mediaIndex : own;
  const select = (next: number) => (play ? play.loadExample(next, 0) : setOwn(next));
  const media = body.media[index] ?? body.media[0]!;
  const plainText = !media.schema || (media.schema.type === 'string' && !media.schema.properties && media.kind === 'text');
  return (
    <div className="rd-block">
      <h4 className="rd-block__title">
        {title}
        {body.media.length > 1 ? (
          <Select value={String(index)} onValueChange={(value) => select(Number(value))}>
            <SelectTrigger size="sm" className="rd-block__select" aria-label={t.contentType}><SelectValue /></SelectTrigger>
            <SelectContent align="end">
              {body.media.map((item, position) => <SelectItem key={item.contentType} value={String(position)}>{item.contentType}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="rd-block__meta">{media.contentType}{body.required ? '' : t.optionalSuffix}</span>
        )}
      </h4>
      {plainText
        ? media.examples[0] && <CodeBlock code={exampleText(media)} language={/xml/.test(media.contentType) ? 'xml' : undefined} filename={media.contentType} />
        : <SchemaViewer schema={media.schema!} />}
    </div>
  );
}

/** Requests the API makes back to the client after this operation (OpenAPI callbacks). */
function CallbacksBlock({ callbacks }: { callbacks: Callback[] }) {
  const t = useDocsMessages();
  if (callbacks.length === 0) return null;
  return (
    <div className="rd-block">
      <h4 className="rd-block__title">{t.callbacks}</h4>
      {callbacks.map((callback) => (
        <div key={`${callback.name}-${callback.method}`} className="rd-callback">
          <p className="rd-callback__title"><MethodBadge method={callback.method} /> <strong>{callback.summary ?? callback.name}</strong></p>
          <p className="rd-block__hint">{t.callbackHint} <code>{callback.expression}</code></p>
          {callback.description && <p className="rd-callback__text">{inline(callback.description)}</p>}
          {callback.body && <BodyBlock body={callback.body} title={t.payload} />}
          {callback.responses.length > 0 && <ResponsePanel responses={callback.responses} label={t.expectedResponses} />}
        </div>
      ))}
    </div>
  );
}

function OperationHeader({ operation, tag }: { operation: Operation; tag: Tag }) {
  const t = useDocsMessages();
  const params = Object.fromEntries(operation.parameters.path.map((parameter) => [parameter.name, (
    <span className="rd-param-hint">
      <code>{parameter.name}</code> {parameter.schema.type}{parameter.required ? ` · ${t.required}` : ''}
      {parameter.description && <span className="rd-param-hint__text">{parameter.description}</span>}
    </span>
  )]));
  return (
    <>
    <p className="rd-operation__group">{tag.name}</p>
    <EndpointHeader
      params={params}
      method={operation.method}
      path={operation.path}
      baseUrl={serverUrl(operation.servers[0]!)}
      showBaseUrl={false}
      title={<span id={`${operation.id}-title`}>{operation.summary}{operation.badges.map((badge) => <Badge key={badge} variant="info" className="rd-badge">{badge}</Badge>)}</span>}
      titleAs="h1"
      description={inline(operation.description)}
      deprecated={operation.deprecated}
    />
    {operation.rateLimit && <p className="rd-operation__meta"><span>{t.rateLimit}</span> {operation.rateLimit}</p>}
    </>
  );
}

/** The endpoint page; each part sits in an error boundary so a failure stays local. */
function OperationSection({ operation, tag }: { operation: Operation; tag: Tag }) {
  const t = useDocsMessages();
  return (
    <section id={operation.id} className="rd-row rd-operation" aria-labelledby={`${operation.id}-title`}>
      <ErrorBoundary label={t.errorEndpoint} className="rd-operation__error">
        <OperationBody operation={operation} tag={tag} />
      </ErrorBoundary>
    </section>
  );
}

function OperationBody({ operation, tag }: { operation: Operation; tag: Tag }) {
  const play = usePlayground(operation);
  const t = useDocsMessages();
  // One column (phones, narrow windows): the client opens in a bottom sheet instead of being stacked.
  const compact = useMediaQuery('(max-width: 860px)');
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <>
      <div className="rd-row__content rd-operation__main">
        <OperationHeader operation={operation} tag={tag} />
        {compact && (
          <>
            <Button variant="outline" size="sm" iconStart={<Play />} className="rd-try" onClick={() => setSheetOpen(true)}>{t.tryIt}</Button>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetContent
                side="bottom"
                className="rd-try-sheet"
                aria-describedby={undefined}
                // Focus "Send" (not the first tool button, whose tooltip would pop up on open).
                onOpenAutoFocus={(event) => {
                  event.preventDefault();
                  (event.currentTarget as HTMLElement).querySelector<HTMLElement>('.rd-pm__send')?.focus();
                }}
              >
                <SheetHeader><SheetTitle>{operation.summary}</SheetTitle></SheetHeader>
                <div className="rd-try-sheet__body">
                  <ErrorBoundary label={t.errorClient}>
                    <Playground play={play} />
                  </ErrorBoundary>
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
        <SecurityBlock operation={operation} />
        <ParameterGroup title={t.pathParameters} operation={operation} location="path" />
        <ParameterGroup title={t.queryParameters} operation={operation} location="query" />
        <ParameterGroup title={t.headers} operation={operation} location="header" />
        {operation.body && <BodyBlock body={operation.body} play={play} title={t.requestBody} />}
        <div className="rd-block">
          <h4 className="rd-block__title">{t.codeExample}</h4>
          <PlaygroundCode play={play} />
        </div>
        <div className="rd-block rd-block--responses">
          <ResponsePanel responses={operation.responses} label={t.responses} />
        </div>
        <CallbacksBlock callbacks={operation.callbacks} />
        <Pager id={operation.id} />
      </div>
      <div className="rd-row__aside">
        {!compact && (
          <div className="rd-row__sticky">
            <ErrorBoundary label={t.errorClient}>
              <Playground play={play} />
            </ErrorBoundary>
          </div>
        )}
      </div>
    </>
  );
}

/** A webhook: the request the API sends to the reader's URL, with its payload and expected answers. */
function WebhookSection({ webhook }: { webhook: Webhook }) {
  const t = useDocsMessages();
  const media = webhook.body?.media[0];
  return (
    <section id={webhook.id} className="rd-row rd-operation" aria-labelledby={`${webhook.id}-title`}>
      <div className="rd-row__content rd-operation__main">
        <p className="rd-operation__group">{t.webhook}</p>
        <header className="ds-endpoint">
          <div className="ds-endpoint__heading">
            <h1 id={`${webhook.id}-title`} className="ds-endpoint__title">{webhook.summary}{webhook.badges.map((badge) => <Badge key={badge} variant="info" className="rd-badge">{badge}</Badge>)}</h1>
          </div>
          {webhook.description && <p className="ds-endpoint__description">{inline(webhook.description)}</p>}
          <div className="ds-endpoint__bar">
            <span className="ds-endpoint__method"><MethodBadge method={webhook.method} /></span>
            <code className="ds-endpoint-path">{webhook.name}</code>
          </div>
        </header>
        <p className="rd-block__hint">{t.webhookHint}</p>
        {webhook.body && <BodyBlock body={webhook.body} title={t.payload} />}
        {webhook.responses.length > 0 && (
          <div className="rd-block rd-block--responses">
            <ResponsePanel responses={webhook.responses} label={t.expectedResponses} />
          </div>
        )}
        <Pager id={webhook.id} />
      </div>
      <div className="rd-row__aside">
        {media && media.examples.length > 0 && (
          <div className="rd-row__sticky">
            <CodeTabs label={t.payload} examples={media.examples.map((example) => ({ language: example.name, label: example.summary ?? example.name, syntax: media.kind === 'json' ? 'json' : undefined, code: exampleText(media, example) }))} />
          </div>
        )}
      </div>
    </section>
  );
}

/** A model (components.schemas entry): its fields and a generated example. */
function ModelSection({ model }: { model: Model }) {
  const t = useDocsMessages();
  return (
    <section id={model.id} className="rd-row rd-operation" aria-labelledby={`${model.id}-title`}>
      <div className="rd-row__content rd-operation__main">
        <p className="rd-operation__group">{t.model}</p>
        <header className="ds-endpoint">
          <div className="ds-endpoint__heading"><h1 id={`${model.id}-title`} className="ds-endpoint__title">{model.name}</h1></div>
          {model.schema.description && <p className="ds-endpoint__description">{inline(model.schema.description)}</p>}
        </header>
        <div className="rd-block"><SchemaViewer schema={model.schema} /></div>
        <Pager id={model.id} />
      </div>
      <div className="rd-row__aside">
        {model.example !== undefined && (
          <div className="rd-row__sticky">
            <CodeBlock code={JSON.stringify(model.example, null, 2)} language="json" filename={t.example} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Resizable examples column ─────────────────────────────────────── */
const ASIDE_MIN = 360;
/** Keep in sync with --rd-content-min in docs-page.css. */
const CONTENT_MIN = 480;
const ASIDE_KEY = 'opendoc-docs:aside-width';
const NAV_KEY = 'opendoc-docs:nav-collapsed';

function readAsideWidth() {
  try {
    const saved = Number(localStorage.getItem(ASIDE_KEY));
    return Number.isFinite(saved) && saved >= ASIDE_MIN ? saved : null;
  } catch { return null; }
}

/**
 * Vertical splitter (role="separator") on the border of the examples column.
 * Drag to resize; ←/→ move 24px (Shift: 96px), Home/End go to the limits, double-click or Enter resets.
 * The CSS clamps the width too, so it stays valid when the window shrinks.
 */
function ColumnResizer({ mainRef, width, onChange }: { mainRef: RefObject<HTMLElement | null>; width: number | null; onChange: (width: number | null) => void }) {
  const t = useDocsMessages();
  const [dragging, setDragging] = useState(false);
  const limits = () => {
    const total = mainRef.current?.clientWidth ?? 0;
    return { min: ASIDE_MIN, max: Math.max(ASIDE_MIN, total - CONTENT_MIN) };
  };
  const current = () => mainRef.current?.querySelector<HTMLElement>('.rd-row__aside')?.offsetWidth ?? ASIDE_MIN;
  const set = (next: number) => {
    const { min, max } = limits();
    onChange(Math.round(Math.min(max, Math.max(min, next))));
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !mainRef.current) return;
    set(mainRef.current.getBoundingClientRect().right - event.clientX);
  };
  const stop = () => setDragging(false);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 96 : 24;
    const { min, max } = limits();
    const actions: Record<string, () => void> = {
      ArrowLeft: () => set(current() + step),
      ArrowRight: () => set(current() - step),
      Home: () => set(max),
      End: () => set(min),
      Enter: () => onChange(null),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };
  // Rendered width and current limit, re-measured after every change and window resize
  // (the CSS clamp may differ from the stored width on a narrower window).
  const [measured, setMeasured] = useState({ value: width ?? ASIDE_MIN, max: ASIDE_MIN });
  useEffect(() => {
    const update = () => setMeasured({ value: current(), max: limits().max });
    const frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', update); };
  }, [width]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = measured.max;
  const value = width !== null ? Math.min(width, Math.max(max, ASIDE_MIN)) : measured.value;
  return (
    <div
      className={cx('rd-resizer', dragging && 'is-dragging')}
      role="separator"
      aria-orientation="vertical"
      aria-label={t.columnWidth}
      aria-controls="conteudo"
      aria-valuemin={ASIDE_MIN}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={t.pixels(value)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={() => onChange(null)}
      onKeyDown={onKeyDown}
    />
  );
}

const themeOptions: Array<{ value: ThemePreference; label: 'light' | 'dark' | 'system'; Icon: typeof Sun }> = [
  { value: 'light', label: 'light', Icon: Sun },
  { value: 'dark', label: 'dark', Icon: Moon },
  { value: 'system', label: 'system', Icon: Monitor },
];

/**
 * "Tema" row inside the account menu: a segmented control whose segments are real menu radio
 * items (menuitemradio + aria-checked), so ↑/↓ reach them and the menu stays open on change.
 */
function ThemeMenuRow({ theme, onChange }: { theme: ThemePreference; onChange: (theme: ThemePreference) => void }) {
  const t = useDocsMessages();
  return (
    <div className="rd-theme-row">
      <span className="rd-theme-row__label" id="rd-theme-label">{t.theme}</span>
      <MenuPrimitive.RadioGroup className="rd-theme-row__group" aria-labelledby="rd-theme-label" value={theme} onValueChange={(value) => onChange(value as ThemePreference)}>
        {themeOptions.map(({ value, label, Icon }) => (
          <MenuPrimitive.RadioItem key={value} value={value} className="rd-theme-row__option" onSelect={(event) => event.preventDefault()}>
            <Icon aria-hidden="true" />
            <span className="ds-sr-only">{t[label]}</span>
          </MenuPrimitive.RadioItem>
        ))}
      </MenuPrimitive.RadioGroup>
    </div>
  );
}

/** Interface language (tool strings only), as a segmented control like the theme row. */
function LanguageMenuRow() {
  const t = useDocsMessages();
  const { locale, setLocale } = useLocale();
  return (
    <div className="rd-theme-row">
      <span className="rd-theme-row__label" id="rd-language-label">{t.language}</span>
      <MenuPrimitive.RadioGroup className="rd-theme-row__group" aria-labelledby="rd-language-label" value={locale} onValueChange={(value) => setLocale(value as Locale)}>
        {locales.map((option) => (
          <MenuPrimitive.RadioItem key={option.value} value={option.value} lang={option.value} className="rd-theme-row__option rd-theme-row__option--text" onSelect={(event) => event.preventDefault()}>
            <span aria-hidden="true">{option.short}</span>
            <span className="ds-sr-only">{option.label}</span>
          </MenuPrimitive.RadioItem>
        ))}
      </MenuPrimitive.RadioGroup>
    </div>
  );
}

/** Platform credit at the bottom of the sidebar; the customer's brand stays on top. */
function PoweredBy() {
  const t = useDocsMessages();
  return (
    <a href="/" className="rd-powered">
      <OpenDocLogo size={18} decorative />
      <span>{t.poweredBy} <strong>OpenDoc</strong></span>
    </a>
  );
}

/** Light and dark variants of a CMS image; CSS shows the one matching the theme. */
function ThemedImage({ source, alt, className }: { source: { light: string; dark?: string }; alt: string; className: string }) {
  if (!source.dark) return <img src={source.light} alt={alt} className={className} />;
  return (
    <>
      <img src={source.light} alt={alt} className={cx(className, 'rd-themed--light')} />
      <img src={source.dark} alt={alt} className={cx(className, 'rd-themed--dark')} />
    </>
  );
}

/**
 * Company brand from the CMS: full logo, else symbol + name, else the OpenDoc mark + name.
 */
function Brand() {
  const { name, label, logo, symbol } = branding;
  return (
    <div className="rd-brand-group">
      <a href="#introducao" className="rd-brand">
        {logo ? (
          <ThemedImage source={logo} alt={name} className="rd-brand__logo" />
        ) : (
          <>
            {symbol
              ? <ThemedImage source={symbol} alt="" className="rd-brand__symbol" />
              : <OpenDocLogo size={24} decorative className="rd-brand__symbol" />}
            <span className="rd-brand__name">{name}</span>
          </>
        )}
        {label && <span className="rd-brand__section">{label}</span>}
      </a>
    </div>
  );
}

export function DocsPage() {
  const t = useDocsMessages();
  const session = useSession();
  const user = session?.stage === 'active' && !session.user.setup ? session.user : undefined;
  const signOut = async () => {
    await authApi.logout().catch(() => {});
    // Private docs are gone once signed out: start over from the login.
    window.location.replace('/');
  };
  const [menuOpen, setMenuOpen] = useState(false);
  // Desktop sidebar: collapsed or expanded, remembered in this browser; ⌘/Ctrl+B toggles it.
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return localStorage.getItem(NAV_KEY) === '1'; } catch { return false; }
  });
  const toggleNav = useCallback(() => {
    setNavCollapsed((collapsed) => {
      try { localStorage.setItem(NAV_KEY, collapsed ? '0' : '1'); } catch { /* storage unavailable */ }
      return !collapsed;
    });
  }, []);
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // In text fields and the JSON editor, ⌘B belongs to the field.
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        toggleNav();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleNav]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const mainRef = useRef<HTMLElement>(null);
  const [asideWidth, setAsideWidth] = useState<number | null>(readAsideWidth);
  const changeAsideWidth = useCallback((next: number | null) => {
    setAsideWidth(next);
    try {
      if (next === null) localStorage.removeItem(ASIDE_KEY);
      else localStorage.setItem(ASIDE_KEY, String(next));
    } catch { /* storage unavailable */ }
  }, []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useCommandShortcut(openSearch);
  useEffect(() => { document.title = t.docTitle(info.title); }, [t]);
  const route = useRoute();
  const routeKey = routeId(route) ?? `guide:${route.kind === 'guide' ? route.anchor ?? '' : ''}`;
  // A group link (#posts) opens its first endpoint: show that endpoint's own address.
  useEffect(() => {
    if (route.kind === 'operation' && window.location.hash !== `#${route.operation.id}`) {
      window.history.replaceState(window.history.state, '', `#${route.operation.id}`);
    }
  }, [route]);
  // On every page change: endpoint pages start at the top; guide links scroll to their heading.
  // Focus moves to the main region (after the first load) so keyboard and screen reader users land on the new page.
  const shownRoute = useRef<string | undefined>(undefined);
  useEffect(() => {
    const anchor = route.kind === 'guide' ? route.anchor : undefined;
    const target = anchor ? document.getElementById(anchor) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
    // Not on the first load, nor when development re-runs the effect for the same page.
    if (shownRoute.current !== undefined && shownRoute.current !== routeKey) mainRef.current?.focus({ preventScroll: true });
    shownRoute.current = routeKey;
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // One view per page opened (guide, wiki page, endpoint, webhook or model), for the admin's Analytics.
  // Development runs effects twice: the same page in a row counts once.
  const trackedRoute = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (trackedRoute.current === routeKey) return;
    trackedRoute.current = routeKey;
    if (route.kind === 'operation') track({ kind: 'view', page: route.operation.id, label: route.operation.summary, method: route.operation.method, path: route.operation.path });
    else if (route.kind === 'page') track({ kind: 'view', page: route.page.id, label: route.page.title });
    else if (route.kind === 'webhook') track({ kind: 'view', page: route.webhook.id, label: route.webhook.summary });
    else if (route.kind === 'model') track({ kind: 'view', page: route.model.id, label: route.model.name });
    else track({ kind: 'view', page: introId, label: t.overview });
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // The docs belong to the company: its symbol is the tab icon while on this page.
  // Without one, the OpenDoc favicon (already in index.html) stays.
  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const symbol = branding.symbol?.light;
    if (!icon || !symbol) return;
    const previous = { href: icon.getAttribute('href'), type: icon.type };
    icon.type = 'image/svg+xml';
    icon.href = symbol;
    return () => {
      if (previous.href) icon.setAttribute('href', previous.href);
      icon.type = previous.type;
    };
  }, []);

  // In the guide, the current section follows the scroll; on an endpoint page it is that endpoint.
  const guideSection = useActiveSection(route.kind === 'guide' ? guideIds : NO_IDS);
  // Until the observer reports (right after opening the guide), the link that was followed is the current one.
  const active = routeId(route) ?? guideSection ?? (route.kind === 'guide' ? route.anchor ?? introId : undefined);

  // In the guide, the address follows the section being read, so copying it shares the right place.
  useEffect(() => {
    if (route.kind !== 'guide' || !guideSection) return;
    const hash = guideSection === introId && window.scrollY < 40 ? '' : `#${guideSection}`;
    if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash || `${window.location.pathname}${window.location.search}`);
  }, [route.kind, guideSection]);

  // Keep the active link visible inside the sidebar, scrolling only the sidebar.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('a[aria-current]');
    if (!nav || !link || nav.scrollHeight <= nav.clientHeight) return;
    const navBox = nav.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    const margin = 32;
    if (linkBox.top < navBox.top + margin) nav.scrollTo({ top: nav.scrollTop - (navBox.top + margin - linkBox.top) });
    else if (linkBox.bottom > navBox.bottom - margin) nav.scrollTo({ top: nav.scrollTop + (linkBox.bottom - navBox.bottom + margin) });
  }, [active]);

  // Recently opened results, shown first in the search while it is empty.
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]; } catch { return []; }
  });
  const go = (id: string) => {
    setRecentIds((current) => {
      const next = [id, ...current.filter((item) => item !== id)].slice(0, 5);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
    window.location.hash = id;
  };
  const commandGroups: CommandGroup[] = useMemo(() => [
    {
      heading: t.introduction,
      items: [
        { id: introId, label: t.overview, text: info.summary },
        ...guidePages.map((page, index) => ({ id: page.id, label: page.title, text: guideText[index] })),
        ...wikiPages.map((page) => ({ id: page.id, label: page.title, text: page.text })),
      ].map((item) => ({
        id: item.id, label: item.label, icon: <BookOpen />, keywords: item.text, onSelect: () => go(item.id),
      })),
    },
    ...tags.map((tag) => ({
      heading: tag.name,
      items: tag.operations.map((operation) => ({
        id: operation.id,
        label: operation.summary,
        icon: <MethodBadge method={operation.method} />,
        detail: operation.path,
        // Full text: description and field names, so "userId" or "comentário" find the endpoint.
        keywords: [operation.method, operation.path, operation.description, ...Object.values(operation.parameters).flat().map((parameter) => parameter.name), ...(operation.body?.media ?? []).flatMap((media) => Object.keys(media.schema?.properties ?? {}))].join(' '),
        onSelect: () => go(operation.id),
      })),
    })),
    ...(webhooks.length ? [{
      heading: t.webhooks,
      items: webhooks.map((webhook) => ({ id: webhook.id, label: webhook.summary, icon: <MethodBadge method={webhook.method} />, detail: webhook.name, keywords: [webhook.name, webhook.description].join(' '), onSelect: () => go(webhook.id) })),
    }] : []),
    ...(models.length ? [{
      heading: t.models,
      items: models.map((model) => ({ id: model.id, label: model.name, icon: <Braces />, keywords: [model.schema.description, ...Object.keys(model.schema.properties ?? {})].join(' '), onSelect: () => go(model.id) })),
    }] : []),
  ], [t]);

  return (
    <PlaygroundProvider>
    <div className="rd">
      <a className="rd-skip" href="#conteudo">{t.skipToContent}</a>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="rd-sheet" aria-describedby={undefined}>
          <SheetHeader><SheetTitle>{info.title}</SheetTitle></SheetHeader>
          <DocsNav active={active} onNavigate={() => setMenuOpen(false)} />
          <PoweredBy />
        </SheetContent>
      </Sheet>

      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} groups={commandGroups} recentIds={recentIds} label={t.searchLabel} placeholder={t.searchPlaceholder}
        onSearch={(query, results) => track({ kind: 'search', query, results })} />

      <div className="rd-layout" data-nav={navCollapsed ? 'collapsed' : 'expanded'}>
        {/* Full height: brand on top, navigation below; the top bar only covers the content column.
            Collapsed, it is inert (out of the tab order and the accessibility tree). */}
        <div id="rd-sidebar" className="rd-sidebar" inert={navCollapsed}>
          <div className="rd-sidebar__header"><Brand /></div>
          <ErrorBoundary label={t.errorNavigation} className="rd-nav-error">
            <DocsNav active={active} navRef={navRef} />
          </ErrorBoundary>
          <PoweredBy />
        </div>

        <div className="rd-column">
          <Navbar sticky className="rd-header">
            <NavbarSection className="rd-header__start">
              <IconButton icon={<Menu />} aria-label={t.openNavigation} tooltip={false} onClick={() => setMenuOpen(true)} className="rd-header__menu" />
              <IconButton
                icon={navCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                aria-label={navCollapsed ? t.expandNavigation : t.collapseNavigation}
                aria-expanded={!navCollapsed}
                aria-controls="rd-sidebar"
                aria-keyshortcuts="Meta+B Control+B"
                onClick={toggleNav}
                className="rd-header__toggle"
              />
              <span className="rd-header__brand"><Brand /></span>
            </NavbarSection>
            <NavbarSearch onOpen={openSearch} placeholder={t.navbarSearch} className="rd-header__search" />
            <NavbarSection className="rd-header__end">
              {/* The person signed in (from the API); visitors get the theme, the language and a way in. */}
              <UserMenu name={user ? user.name : t.visitor} email={user ? user.email : t.notSignedIn} showAvatar={false} trailingIcon={<User />} className="rd-header__user">
                {user?.admin && (
                  <>
                    <DropdownMenuItem onSelect={() => { window.location.href = '/admin'; }}><LayoutDashboard />{t.adminPanel}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <ThemeMenuRow theme={theme} onChange={setTheme} />
                <LanguageMenuRow />
                <DropdownMenuSeparator />
                {user
                  ? <DropdownMenuItem variant="destructive" onSelect={() => { void signOut(); }}><LogOut />{t.signOut}</DropdownMenuItem>
                  : <DropdownMenuItem onSelect={() => { window.location.href = '/'; }}><LogIn />{t.signIn}</DropdownMenuItem>}
              </UserMenu>
            </NavbarSection>
          </Navbar>

        <main
          id="conteudo"
          ref={mainRef}
          className="rd-main"
          tabIndex={-1}
          style={asideWidth ? ({ '--rd-aside-w': `${asideWidth}px` } as CSSProperties) : undefined}
        >
          {/* The guide is prose only: one column, no examples column (and so no splitter). */}
          <div className={cx('rd-rows', isProse(route) && 'rd-rows--single')}>
            {!isProse(route) && <ColumnResizer mainRef={mainRef} width={asideWidth} onChange={changeAsideWidth} />}
            {route.kind === 'page' ? (
            <section key={route.page.id} className="rd-row rd-intro" aria-label={route.page.title}>
              <div className="rd-row__content">
                <ErrorBoundary label={t.errorGuide}>
                  <Markdown source={route.page.body} idPrefix={`${route.page.id}-`} className="rd-guide__prose" />
                </ErrorBoundary>
                <Pager id={route.page.id} />
              </div>
            </section>
            ) : route.kind === 'guide' ? (
            <section id={introId} className="rd-row rd-intro" aria-labelledby="rd-title">
              <div className="rd-row__content">
                <header className="rd-hero">
                  <h1 id="rd-title" className="rd-hero__title">{info.title}</h1>
                  <p className="rd-hero__lead">{info.summary}</p>
                  <div className="rd-hero__actions">
                    {sequence[0] && <a href={`#${sequence[0].id}`} className={buttonClassName({ size: 'sm' })}>{t.startHere}</a>}
                    <a href={specUrl} download={`${source.slug}-openapi.json`} className={buttonClassName({ variant: 'outline', size: 'sm' })}><Download aria-hidden="true" />{t.downloadSpec}</a>
                    <span className="rd-hero__meta">OpenAPI 3.1</span>
                  </div>
                  <dl className="rd-servers">
                    {servers.map((server) => (
                      <div key={server.url} className="rd-servers__row">
                        <dt>{server.description}</dt>
                        <dd>
                          <code title={Object.keys(server.variables).length ? server.url : undefined}>{serverUrl(server)}</code>
                          <CopyButton value={serverUrl(server)} label={`Copiar URL de ${server.description.toLowerCase()}`} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </header>

                {quickStart.length > 0 && <ol className="rd-steps" aria-label={t.quickStart}>
                  {quickStart.map((step, index) => (
                    <li key={step.title}>
                      <a href={step.href} className="rd-steps__link">
                        <span className="rd-steps__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                        <span className="rd-steps__body">
                          <span className="rd-steps__title">{step.title}</span>
                          <span className="rd-steps__text">{inline(step.text)}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>}

                <ErrorBoundary label={t.errorGuide}>
                  <Markdown source={info.description} idPrefix="guia-" className="rd-guide__prose" />
                </ErrorBoundary>
                <Pager id={introId} />
              </div>
            </section>
            ) : (
              route.kind === 'operation' ? <OperationSection key={route.operation.id} operation={route.operation} tag={route.tag} />
                : route.kind === 'webhook' ? <WebhookSection key={route.webhook.id} webhook={route.webhook} />
                  : <ModelSection key={route.model.id} model={route.model} />
            )}

          <footer className="rd-row rd-footer">
            <p className="rd-row__content">{t.generatedFrom} <code>openapi.json</code> ({info.version}) · {t.defaultServer} <code>{baseUrl}</code></p>
            <div className="rd-row__aside" aria-hidden="true" />
          </footer>
          </div>
        </main>
        </div>
      </div>
    </div>
    </PlaygroundProvider>
  );
}
