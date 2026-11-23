import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Badge } from '../components/Badge';
import { CopyButton } from './CopyButton';
import { Tooltip } from '../components/Tooltip';
import { useDsMessages } from '../i18n';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** HTTP method as text plus color (color is never the only cue). */
export function MethodBadge({ method, className }: { method: HttpMethod; className?: string }) {
  return <span className={cx('ds-method', `ds-method--${method.toLowerCase()}`, className)}>{method}</span>;
}

/**
 * Path with {params} emphasized; an optional base URL is shown muted before it.
 * With `params`, each {param} gets a tooltip (type, description) on hover and keyboard focus.
 */
export function EndpointPath({ path, baseUrl, params, className }: { path: string; baseUrl?: string; params?: Record<string, ReactNode>; className?: string }) {
  const parts = path.split(/(\{[^}]+\})/g).filter(Boolean);
  return (
    <code className={cx('ds-endpoint-path', className)}>
      {baseUrl && <span className="ds-endpoint-path__base">{baseUrl.replace(/\/$/, '')}</span>}
      {parts.map((part, index) => {
        if (!part.startsWith('{')) return <span key={index}>{part}</span>;
        const hint = params?.[part.slice(1, -1)];
        if (!hint) return <span key={index} className="ds-endpoint-path__param">{part}</span>;
        return (
          <Tooltip key={index} content={hint}>
            <span className="ds-endpoint-path__param ds-endpoint-path__param--hint" tabIndex={0}>{part}</span>
          </Tooltip>
        );
      })}
    </code>
  );
}

export interface EndpointHeaderProps {
  method: HttpMethod;
  path: string;
  /** Base URL used by the copy button. */
  baseUrl?: string;
  title?: ReactNode;
  description?: ReactNode;
  deprecated?: boolean;
  /** Shows the base URL before the path (default true when baseUrl is set). */
  showBaseUrl?: boolean;
  /** Tooltip per path parameter, by name (e.g. type and description). */
  params?: Record<string, ReactNode>;
  /** Heading level of the title, to fit the page outline (default h2). */
  titleAs?: 'h1' | 'h2' | 'h3';
  actions?: ReactNode;
  className?: string;
}

/** Title + method + path bar, with copy-URL. */
export function EndpointHeader(props: EndpointHeaderProps) {
  return <EndpointHeaderInner {...props} />;
}

function EndpointHeaderInner({ method, path, baseUrl = '', params, title, description, deprecated, showBaseUrl = true, titleAs: Title = 'h2', actions, className }: EndpointHeaderProps) {
  const t = useDsMessages();
  return (
    <header className={cx('ds-endpoint', deprecated && 'is-deprecated', className)}>
      {(title || deprecated) && (
        <div className="ds-endpoint__heading">
          {title && <Title className="ds-endpoint__title">{title}</Title>}
          {deprecated && <Badge variant="outline">{t.deprecated}</Badge>}
        </div>
      )}
      {description && <p className="ds-endpoint__description">{description}</p>}
      <div className="ds-endpoint__bar">
        <span className="ds-endpoint__method"><MethodBadge method={method} /></span>
        <EndpointPath path={path} baseUrl={showBaseUrl ? baseUrl : undefined} params={params} />
        <div className="ds-endpoint__actions">
          {actions}
          <CopyButton value={`${baseUrl}${path}`} label={t.copyUrl(method, path)} />
        </div>
      </div>
    </header>
  );
}
