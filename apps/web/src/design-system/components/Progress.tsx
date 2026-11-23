import { useId, type ComponentProps } from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';
import { cx } from '../cx';

export interface ProgressProps extends Omit<ComponentProps<typeof ProgressPrimitive.Root>, 'children'> {
  /** Visible name of the task. Required: role="progressbar" needs an accessible name. */
  label: string;
  /** Hides the label visually (still announced). */
  hideLabel?: boolean;
  /** Shows the percentage next to the label. */
  showValue?: boolean;
}

/**
 * role="progressbar" with aria-valuenow / aria-valuetext as a percentage.
 * value={null} renders an indeterminate bar (no aria-valuenow), for unknown duration.
 */
export function Progress({ label, hideLabel = false, showValue = false, value, max = 100, className, ...props }: ProgressProps) {
  const labelId = useId();
  const percent = value === null || value === undefined ? null : Math.round((value / max) * 100);
  return (
    <div className={cx('ds-progress-field', className)}>
      <div className={cx('ds-progress-field__top', hideLabel && 'ds-sr-only')}>
        <span id={labelId}>{label}</span>
        {showValue && percent !== null && <span className="ds-progress-field__value" aria-hidden="true">{percent}%</span>}
      </div>
      <ProgressPrimitive.Root
        className="ds-progress"
        aria-labelledby={labelId}
        value={value}
        max={max}
        getValueLabel={(current, total) => `${Math.round((current / total) * 100)}%`}
        {...props}
      >
        <ProgressPrimitive.Indicator className="ds-progress__indicator" style={percent === null ? undefined : { transform: `translateX(-${100 - percent}%)` }} />
      </ProgressPrimitive.Root>
    </div>
  );
}
