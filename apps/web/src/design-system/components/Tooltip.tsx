import type { ComponentProps, ReactNode } from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { cx } from '../cx';

/** Mount once near the root. Shares delay between tooltips (moving across a toolbar opens instantly). */
export function TooltipProvider({ delayDuration = 300, ...props }: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({ className, sideOffset = 6, children, ...props }: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content sideOffset={sideOffset} className={cx('ds-tooltip', className)} {...props}>
        {children}
        <TooltipPrimitive.Arrow className="ds-tooltip__arrow" width={10} height={5} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export interface TooltipProps extends Omit<ComponentProps<typeof TooltipPrimitive.Content>, 'content'> {
  /** Short, supplementary text. Opens on hover and keyboard focus; Escape closes it. */
  content: ReactNode;
  /** A single focusable element (button, link). Disabled buttons never receive focus: wrap them in a span. */
  children: ReactNode;
}

/**
 * Convenience wrapper. Tooltip text is exposed as the trigger's description (aria-describedby),
 * so never put essential information or interactive content in it.
 */
export function Tooltip({ content, children, ...props }: TooltipProps) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent {...props}>{content}</TooltipContent>
    </TooltipRoot>
  );
}
