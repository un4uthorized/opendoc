import { Avatar as AvatarPrimitive } from 'radix-ui';
import { User } from 'lucide-react';
import { cx } from '../cx';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  /** What shows without an image: the person's initials (default) or a generic user icon. */
  fallback?: 'initials' | 'icon';
  /** Initials to show: 2 ("AS", default) or 1 ("A"). */
  maxInitials?: 1 | 2;
  /** Solid background for the fallback (initials in white), e.g. a color derived from the name. */
  color?: string;
  className?: string;
}

function initials(name: string, max: 1 | 2 = 2) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (max === 1 ? first : first + last).toUpperCase();
}

/** Radix avatar: shows the image only once it loads, otherwise the initials (or an icon). Named for assistive tech. */
export function Avatar({ name, src, size = 'md', fallback = 'initials', maxInitials = 2, color, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root className={cx('ds-avatar', size !== 'md' && `ds-avatar--${size}`, color && 'ds-avatar--colored', className)} style={color ? { background: color } : undefined} role="img" aria-label={name}>
      {src && <AvatarPrimitive.Image className="ds-avatar__image" src={src} alt="" />}
      <AvatarPrimitive.Fallback className="ds-avatar__fallback" delayMs={src ? 400 : undefined} aria-hidden="true">
        {fallback === 'icon' ? <User className="ds-avatar__icon" /> : initials(name, maxInitials)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export interface AvatarGroupProps {
  people: Array<{ name: string; src?: string }>;
  /** How many avatars to show before collapsing the rest into a "+N" counter. */
  max?: number;
  /** Total people when it is larger than the list (e.g. paginated data). */
  total?: number;
  size?: AvatarSize;
  className?: string;
}

/**
 * Overlapping avatars. Each avatar keeps its accessible name; the counter is
 * announced as "mais N pessoas", and the group gets a summary label.
 */
export function AvatarGroup({ people, max = 4, total = people.length, size = 'md', className }: AvatarGroupProps) {
  const visible = people.slice(0, max);
  const rest = total - visible.length;
  return (
    <div className={cx('ds-avatar-group', className)} role="group" aria-label={`${total} ${total === 1 ? 'pessoa' : 'pessoas'}`}>
      {visible.map((person) => <Avatar key={person.name} name={person.name} src={person.src} size={size} />)}
      {rest > 0 && (
        <span className={cx('ds-avatar', 'ds-avatar--count', size !== 'md' && `ds-avatar--${size}`)} role="img" aria-label={`mais ${rest} ${rest === 1 ? 'pessoa' : 'pessoas'}`}>
          <span aria-hidden="true">+{rest}</span>
        </span>
      )}
    </div>
  );
}
