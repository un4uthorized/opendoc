import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../cx';

export interface SparklineProps {
  data: number[];
  /** Summary read by screen readers, e.g. "Visitantes subiram de 12 mil para 18 mil". Required: the chart is an image. */
  label: string;
  variant?: 'area' | 'line' | 'bar';
  /** Marks the last point/bar (current period). */
  highlightLast?: boolean;
  className?: string;
}

type Point = readonly [number, number];

/**
 * Monotone cubic interpolation (Fritsch–Carlson): smooth, rounded curves that never
 * overshoot the data, so a peak in the line is always a real peak.
 */
function smoothPath(points: Point[]) {
  const n = points.length;
  if (n < 2) return '';
  if (n === 2) return `M${points[0]![0]} ${points[0]![1]} L${points[1]![0]} ${points[1]![1]}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1]![0] - points[i]![0]);
    slope.push((points[i + 1]![1] - points[i]![1]) / dx[i]!);
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i += 1) {
    tangent.push(slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2);
  }
  tangent.push(slope[n - 2]!);
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i]! / slope[i]!;
    const b = tangent[i + 1]! / slope[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      tangent[i] = t * a * slope[i]!;
      tangent[i + 1] = t * b * slope[i]!;
    }
  }
  let d = `M${points[0]![0].toFixed(2)} ${points[0]![1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${(x0 + h).toFixed(2)} ${(y0 + tangent[i]! * h).toFixed(2)} ${(x1 - h).toFixed(2)} ${(y1 - tangent[i + 1]! * h).toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  return d;
}

/** Bar with rounded top corners and a flat base. */
function roundedBar(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height);
  return `M${x} ${y + height} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + width - r} Q${x + width} ${y} ${x + width} ${y + r} V${y + height} Z`;
}

/** Tracks the rendered size so the chart is drawn in real pixels (no stretched curves or dots). */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry!.contentRect;
      setSize({ width: Math.round(box.width), height: Math.round(box.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Tiny trend chart. role="img" with a text summary; it never carries information alone. */
export function Sparkline({ data, label, variant = 'area', highlightLast = true, className }: SparklineProps) {
  const gradientId = `ds-spark-${useId().replace(/:/g, '')}`;
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const ready = width > 0 && height > 0 && data.length > 0;

  let content = null;
  if (ready && variant === 'bar') {
    const gap = Math.max(4, Math.min(10, width / data.length / 3));
    const barWidth = (width - gap * (data.length - 1)) / data.length;
    const max = Math.max(...data) || 1;
    content = data.map((value, index) => {
      const barHeight = Math.max(4, (value / max) * height);
      const x = index * (barWidth + gap);
      return (
        <path
          key={index}
          d={roundedBar(x, height - barHeight, barWidth, barHeight, 4)}
          className={highlightLast && index === data.length - 1 ? 'ds-sparkline__bar ds-sparkline__bar--current' : 'ds-sparkline__bar'}
        />
      );
    });
  } else if (ready) {
    const inset = 5; // room for the end dot and the rounded line caps
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const points: Point[] = data.map((value, index) => [
      data.length === 1 ? width / 2 : inset + (index / (data.length - 1)) * (width - inset * 2),
      inset + (1 - (value - min) / range) * (height - inset * 2),
    ]);
    const line = smoothPath(points);
    const last = points[points.length - 1]!;
    const first = points[0]!;
    content = (
      <>
        {variant === 'area' && (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${line} L${last[0]} ${height} L${first[0]} ${height} Z`} fill={`url(#${gradientId})`} />
          </>
        )}
        <path d={line} className="ds-sparkline__line" />
        {highlightLast && <circle cx={last[0]} cy={last[1]} r={3.5} className="ds-sparkline__dot" />}
      </>
    );
  }

  return (
    <div ref={ref} className={cx('ds-sparkline', `ds-sparkline--${variant}`, className)}>
      <svg width={width || undefined} height={height || undefined} viewBox={ready ? `0 0 ${width} ${height}` : undefined} role="img" aria-label={label}>
        {content}
      </svg>
    </div>
  );
}
