import type { HTMLAttributes, ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cx } from '../cx';
import { Card } from '../components/Card';

export type Trend = 'up' | 'down' | 'flat';

export interface StatCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  label: ReactNode;
  /** Small decorative icon next to the label. */
  icon?: ReactNode;
  value: ReactNode;
  /** Change vs. the previous period. `good` sets the color: down can be good (e.g. latency). */
  delta?: { value: string; trend: Trend; good?: boolean; srLabel?: string };
  description?: ReactNode;
  /** Top-right slot: a link or menu. */
  action?: ReactNode;
  /** Usually a <Sparkline>; rendered flush at the bottom. */
  chart?: ReactNode;
}

const trendIcons = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight };
const trendWords = { up: 'aumento de', down: 'queda de', flat: 'estável,' };

/** Metric card: label, big value, change and an optional trend chart. */
export function StatCard({ label, icon, value, delta, description, action, chart, className, ...props }: StatCardProps) {
  const TrendIcon = delta ? trendIcons[delta.trend] : null;
  const good = delta?.good ?? delta?.trend === 'up';
  return (
    <Card className={cx('ds-stat', chart ? 'ds-stat--with-chart' : undefined, className)} {...props}>
      <div className="ds-stat__body">
        <div className="ds-stat__top">
          <p className="ds-stat__label">
            {icon && <span className="ds-stat__icon" aria-hidden="true">{icon}</span>}
            {label}
          </p>
          {action}
        </div>
        <p className="ds-stat__value">{value}</p>
        {(delta || description) && (
          <p className="ds-stat__meta">
            {delta && TrendIcon && (
              <span className="ds-stat__delta" data-tone={delta.trend === 'flat' ? 'neutral' : good ? 'good' : 'bad'}>
                <TrendIcon aria-hidden="true" />
                <span className="ds-sr-only">{delta.srLabel ?? trendWords[delta.trend]} </span>
                {delta.value}
              </span>
            )}
            {description && <span className="ds-stat__description">{description}</span>}
          </p>
        )}
      </div>
      {chart && <div className="ds-stat__chart">{chart}</div>}
    </Card>
  );
}
