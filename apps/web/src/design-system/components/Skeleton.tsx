import type { HTMLAttributes } from 'react';
import { cx } from '../cx';

/**
 * Loading placeholder. Hidden from assistive tech: mark the loading region with
 * aria-busy="true" and give it a visually hidden "Carregando…" status instead.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-skeleton', className)} aria-hidden="true" {...props} />;
}
