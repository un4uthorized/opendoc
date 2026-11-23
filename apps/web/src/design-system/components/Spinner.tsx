import { LoaderCircle } from 'lucide-react';
import { cx } from '../cx';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label. Pass an empty string when the spinner is decorative. */
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label = 'Carregando', className }: SpinnerProps) {
  return (
    <span
      className={cx('ds-spinner', size !== 'md' && `ds-spinner--${size}`, className)}
      role={label ? 'status' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <LoaderCircle aria-hidden="true" />
    </span>
  );
}
