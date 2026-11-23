import type { LucideIcon, LucideProps } from 'lucide-react';
import { AccessibleIcon } from 'radix-ui';
import { cx } from '../cx';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Mirrors the --icon-* tokens (px), since lucide needs a number for its viewBox math. */
export const iconSizes: Record<IconSize, number> = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 };

export interface IconProps extends Omit<LucideProps, 'size' | 'ref'> {
  /** A lucide-react icon component, e.g. `Search`. */
  icon: LucideIcon;
  size?: IconSize;
  /**
   * Accessible name. Leave it out when the icon is decorative (next to visible text):
   * the svg is then hidden from assistive tech. Pass it when the icon alone carries meaning.
   */
  label?: string;
}

/** Icon with design-system sizes. Color follows `currentColor`. */
export function Icon({ icon: Glyph, size = 'md', label, className, strokeWidth = 2, ...props }: IconProps) {
  const svg = <Glyph size={iconSizes[size]} strokeWidth={strokeWidth} className={cx('ds-icon', className)} aria-hidden={label ? undefined : true} focusable="false" {...props} />;
  // AccessibleIcon hides the svg and renders the label as visually hidden text.
  return label ? <AccessibleIcon.Root label={label}>{svg}</AccessibleIcon.Root> : svg;
}
