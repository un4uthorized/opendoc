import type { ComponentProps } from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { cx } from '../cx';

/** Accessible label (Radix): prevents text selection on double click and stays linked via htmlFor. */
export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cx('ds-label', className)} {...props} />;
}
