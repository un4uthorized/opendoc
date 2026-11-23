import type { HTMLAttributes, ReactNode } from 'react';
import { Menu, Search } from 'lucide-react';
import { cx } from '../cx';
import { IconButton } from '../components/IconButton';
import { Kbd, KbdGroup } from '../components/Kbd';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/Sheet';
import { useDsMessages } from '../i18n';

export interface NavbarProps extends HTMLAttributes<HTMLElement> {
  /** Sticks to the top of the scrolling container. */
  sticky?: boolean;
}

/** Top bar (<header>). Compose it with NavbarSection, NavbarSpacer, NavbarNav and NavbarSearch. */
export function Navbar({ sticky = false, className, ...props }: NavbarProps) {
  return <header className={cx('ds-navbar', sticky && 'ds-navbar--sticky', className)} {...props} />;
}

export function NavbarSection({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ds-navbar__section', className)} {...props} />;
}

/** Pushes what follows to the end. */
export function NavbarSpacer() {
  return <div className="ds-navbar__spacer" aria-hidden="true" />;
}

export interface NavbarLink {
  label: string;
  href: string;
  active?: boolean;
}

/** Horizontal links (hidden on small screens; pair it with NavbarMobileMenu). */
export function NavbarNav({ links, label = 'Principal', className }: { links: NavbarLink[]; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={cx('ds-navbar__nav', className)}>
      <ul role="list">
        {links.map((link) => (
          <li key={`${link.label}-${link.href}`}>
            <a href={link.href} className="ds-navbar__link" aria-current={link.active ? 'page' : undefined}>{link.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Menu button + drawer with the same links, shown only on small screens. */
export function NavbarMobileMenu({ links, title = 'Menu', label = 'Principal', footer }: { links: NavbarLink[]; title?: string; label?: string; footer?: ReactNode }) {
  const t = useDsMessages();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <IconButton icon={<Menu />} aria-label={t.openMenu} className="ds-navbar__mobile-trigger" tooltip={false} />
      </SheetTrigger>
      <SheetContent side="left" aria-describedby={undefined}>
        <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
        <nav aria-label={label} className="ds-navbar__mobile-nav">
          {links.map((link) => <a key={`${link.label}-${link.href}`} href={link.href} aria-current={link.active ? 'page' : undefined}>{link.label}</a>)}
        </nav>
        {footer && <div className="ds-navbar__mobile-footer">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}

export interface NavbarSearchProps {
  onOpen: () => void;
  placeholder?: string;
  className?: string;
}

/** Search field look-alike that opens the CommandMenu. Announced as "Buscar" with its ⌘K shortcut. */
export function NavbarSearch({ onOpen, placeholder: placeholderProp, className }: NavbarSearchProps) {
  const t = useDsMessages();
  const placeholder = placeholderProp ?? t.searchPlaceholder;
  return (
    <button type="button" className={cx('ds-navbar__search', className)} onClick={onOpen} aria-haspopup="dialog" aria-label={t.search} aria-keyshortcuts="Meta+K Control+K">
      <Search aria-hidden="true" />
      <span className="ds-navbar__search-text" aria-hidden="true">{placeholder}</span>
      <KbdGroup className="ds-navbar__search-kbd" aria-hidden="true"><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup>
    </button>
  );
}
