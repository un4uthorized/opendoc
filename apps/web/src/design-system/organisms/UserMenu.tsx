import type { ReactNode } from 'react';
import { ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cx } from '../cx';
import { Avatar } from '../components/Avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/DropdownMenu';
import { useDsMessages } from '../i18n';

export interface UserMenuProps {
  name: string;
  email?: string;
  src?: string;
  /** DropdownMenu items (profile, settings, sign out…). */
  children: ReactNode;
  /** Shows the name next to the avatar (default: avatar only). */
  showName?: boolean;
  /** Avatar without an image: initials (default) or a user icon. */
  avatarFallback?: 'initials' | 'icon';
  /** Solid avatar color (initials in white). */
  avatarColor?: string;
  /** Short secondary text after the name, e.g. plan or role ("Ana Souza · Admin"). */
  detail?: ReactNode;
  /** Initials in the avatar: 2 (default) or 1, like Claude's account button. */
  avatarMaxInitials?: 1 | 2;
  /** Detail after the name ("Ana Souza · Admin") or on a second line under it. */
  detailPlacement?: 'inline' | 'below';
  /** Text in the trigger instead of the name (e.g. "Settings"); the name stays in the menu and the accessible name. */
  triggerLabel?: ReactNode;
  /** Hides the avatar in the trigger (name and icon only). Default true. */
  showAvatar?: boolean;
  /** Icon after the name instead of the chevron, e.g. a gear. */
  trailingIcon?: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/** Avatar button that opens the account menu. Named "Conta de <nome>". */
export function UserMenu({ name, email, src, children, showName = false, avatarFallback = 'initials', avatarColor, detail, avatarMaxInitials = 2, trailingIcon, showAvatar = true, triggerLabel, detailPlacement = 'inline', align = 'end', side = 'bottom', className }: UserMenuProps) {
  const t = useDsMessages();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cx('ds-user-menu', showName && 'ds-user-menu--named', className)} aria-label={typeof triggerLabel === 'string' ? t.accountWithLabel(triggerLabel, name) : t.account(name)}>
        {/* Icon-only trigger: no avatar, no name, just the icon (e.g. a user glyph). */}
        {!showAvatar && !showName && trailingIcon && <span className="ds-user-menu__icon ds-user-menu__icon--solo" aria-hidden="true">{trailingIcon}</span>}
        {showAvatar && <Avatar name={name} src={src} size="sm" fallback={avatarFallback} color={avatarColor} maxInitials={avatarMaxInitials} />}
        {showName && (
          <>
            <span className="ds-user-menu__text" aria-hidden="true">
              <span className="ds-user-menu__name">{triggerLabel ?? name}{detail && detailPlacement === 'inline' && <span className="ds-user-menu__detail"> · {detail}</span>}</span>
              {detail && detailPlacement === 'below' && <span className="ds-user-menu__detail ds-user-menu__detail--below">{detail}</span>}
              {email && <span className="ds-user-menu__email">{email}</span>}
            </span>
            {/* Custom icon (e.g. a gear), else: opens below (navbar) → down chevron; to the side/top (sidebar footer) → up/down. */}
            {trailingIcon
              ? <span className="ds-user-menu__chevron ds-user-menu__icon" aria-hidden="true">{trailingIcon}</span>
              : side === 'bottom'
                ? <ChevronDown className="ds-user-menu__chevron ds-user-menu__chevron--down" aria-hidden="true" />
                : <ChevronsUpDown className="ds-user-menu__chevron" aria-hidden="true" />}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="ds-user-menu__content">
        <DropdownMenuLabel className="ds-user-menu__label">
          <span>{name}</span>
          {email && <span className="ds-user-menu__email">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
