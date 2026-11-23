import { useEffect, useId, useRef } from 'react';
import { CircleAlert } from 'lucide-react';
import { cx } from '../cx';

export interface ErrorSummaryProps {
  /** `id` is the id of the field to jump to. */
  errors: Array<{ id: string; message: string }>;
  title?: string;
  /** Change it on every submit (e.g. the submit count) to move focus to the summary again. */
  focusKey?: number | string;
  className?: string;
}

/**
 * List of form errors shown above the form after a failed submit. It takes focus so screen
 * readers announce it, and each item is a link that focuses the field with the problem.
 */
export function ErrorSummary({ errors, title = 'Corrija os campos abaixo', focusKey, className }: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (errors.length > 0) ref.current?.focus();
  }, [focusKey]);
  if (errors.length === 0) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" aria-labelledby={titleId} className={cx('ds-error-summary', className)}>
      <p id={titleId} className="ds-error-summary__title">
        <CircleAlert aria-hidden="true" />
        {title} ({errors.length})
      </p>
      <ul className="ds-error-summary__list">
        {errors.map((error) => (
          <li key={error.id}>
            <a
              href={`#${error.id}`}
              onClick={(event) => {
                event.preventDefault();
                const field = document.getElementById(error.id);
                field?.focus();
                field?.scrollIntoView({ block: 'center' });
              }}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
