import type { ComponentProps } from 'react';
import { Accordion as AccordionPrimitive } from 'radix-ui';
import { ChevronDown } from 'lucide-react';
import { cx } from '../cx';

/**
 * Accordion: each trigger is a button inside a heading, with aria-expanded and aria-controls.
 * Enter/Space toggle; ↑/↓ move between triggers; Home/End jump.
 * type="single" (with collapsible) opens one at a time; type="multiple" allows several.
 */
export function Accordion({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root className={cx('ds-accordion', className)} {...props} />;
}

export function AccordionItem({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cx('ds-accordion__item', className)} {...props} />;
}

/** headingLevel sets the <h*> wrapping the trigger so it fits the page outline (default h3). */
export function AccordionTrigger({ className, children, headingLevel = 3, ...props }: ComponentProps<typeof AccordionPrimitive.Trigger> & { headingLevel?: 2 | 3 | 4 | 5 | 6 }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <AccordionPrimitive.Header asChild>
      <Heading className="ds-accordion__header">
        <AccordionPrimitive.Trigger className={cx('ds-accordion__trigger', className)} {...props}>
          {children}
          <ChevronDown className="ds-accordion__chevron" aria-hidden="true" />
        </AccordionPrimitive.Trigger>
      </Heading>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, children, ...props }: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content className="ds-accordion__content" {...props}>
      <div className={cx('ds-accordion__body', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}
