import { Component, type ContextType, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Alert } from './Alert';
import { Button } from './Button';
import { LocaleContext, dsMessages } from '../i18n';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** What failed, for the message ("este endpoint", "a página"). */
  label?: string;
  /** Custom fallback; receives the error and a function that retries rendering. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** When any of these change, a shown error is cleared (e.g. the route or the spec). */
  resetKeys?: unknown[];
  onError?: (error: Error, info: ErrorInfo) => void;
  className?: string;
}

interface State { error: Error | null }

/** A failed lazy chunk (new deploy, flaky network): only a reload fixes it. */
const isChunkError = (error: Error) => /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(error.message);

/**
 * Catches render errors in its subtree so one broken part doesn't blank the whole page.
 * Shows an alert with "Tentar de novo" (re-renders the subtree) or "Recarregar página" when
 * a code chunk failed to download.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  static contextType = LocaleContext;
  declare context: ContextType<typeof LocaleContext>;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    if (import.meta.env.DEV) console.error(error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    const keys = this.props.resetKeys ?? [];
    const before = previous.resetKeys ?? [];
    if (this.state.error && (keys.length !== before.length || keys.some((key, index) => !Object.is(key, before[index])))) {
      this.setState({ error: null });
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    const chunk = isChunkError(error);
    const t = dsMessages[this.context.locale];
    return (
      <Alert variant="destructive" title={t.errorTitle(this.props.label)} className={this.props.className}>
        <p>{chunk ? t.errorChunk : t.errorLocal}</p>
        <Button
          size="sm"
          variant="outline"
          iconStart={<RotateCcw />}
          onClick={chunk ? () => window.location.reload() : this.reset}
          className="ds-error-boundary__retry"
        >
          {chunk ? t.reload : t.retry}
        </Button>
      </Alert>
    );
  }
}
