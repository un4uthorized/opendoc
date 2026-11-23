import type { ComponentProps } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cx } from '../cx';

/**
 * Tabs (role="tablist"/"tab"/"tabpanel"): Tab enters the list on the active tab, ←/→ move between tabs
 * (activationMode="automatic" selects on focus), Home/End jump, Tab again moves into the panel.
 */
export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cx('ds-tabs', className)} {...props} />;
}

export function TabsList({ className, variant = 'default', ...props }: ComponentProps<typeof TabsPrimitive.List> & { variant?: 'default' | 'line' }) {
  return <TabsPrimitive.List className={cx('ds-tabs__list', variant === 'line' && 'ds-tabs__list--line', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={cx('ds-tabs__trigger', className)} {...props} />;
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cx('ds-tabs__content', className)} {...props} />;
}
