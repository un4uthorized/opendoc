import type { ElementType, HTMLAttributes } from 'react';
import { cx } from '../cx';

export type TextVariant = 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'lead' | 'large' | 'body' | 'small' | 'caption' | 'overline' | 'code';
export type TextColor = 'default' | 'muted' | 'destructive';

const defaultElement: Record<TextVariant, ElementType> = {
  display: 'h1', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4',
  lead: 'p', large: 'p', body: 'p', small: 'p', caption: 'p', overline: 'p', code: 'code',
};

export interface TextProps extends HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  color?: TextColor;
  /** Override the element while keeping the style, e.g. an h2 styled as h3. */
  as?: ElementType;
}

export function Text({ variant = 'body', color, as, className, ...props }: TextProps) {
  const Component = as ?? defaultElement[variant];
  return <Component className={cx(`ds-text-${variant}`, color && `ds-color-${color}`, className)} {...props} />;
}
