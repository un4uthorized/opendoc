import type { ComponentProps } from 'react';
import { Separator as SeparatorPrimitive } from 'radix-ui';
import { cx } from '../cx';

/** Decorative by default (hidden from assistive tech). Pass decorative={false} for a semantic separator. */
export function Separator({ className, orientation = 'horizontal', decorative = true, ...props }: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return <SeparatorPrimitive.Root className={cx('ds-separator', className)} orientation={orientation} decorative={decorative} {...props} />;
}
