import { Children, Fragment, type HTMLAttributes, type ReactNode } from 'react';
import { ArrowBigUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Command, CornerDownLeft, Option, type LucideIcon } from 'lucide-react';
import { cx } from '../cx';

/**
 * Key symbols drawn as icons: text glyphs like ↑ or ↵ sit on the font baseline (looking off-center)
 * and screen readers read them poorly, so each gets an icon and a spoken name.
 */
const glyphs: Record<string, [LucideIcon, string]> = {
  '↑': [ArrowUp, 'Seta para cima'],
  '↓': [ArrowDown, 'Seta para baixo'],
  '←': [ArrowLeft, 'Seta para a esquerda'],
  '→': [ArrowRight, 'Seta para a direita'],
  '↵': [CornerDownLeft, 'Enter'],
  '⌘': [Command, 'Command'],
  '⇧': [ArrowBigUp, 'Shift'],
  '⌥': [Option, 'Option'],
};

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Spoken name. Known symbols (↑ ↓ ← → ↵ ⌘ ⇧ ⌥) get one automatically. */
  label?: string;
}

/** A key on the keyboard. */
export function Kbd({ children, label, className, ...props }: KbdProps) {
  const glyph = typeof children === 'string' ? glyphs[children.trim()] : undefined;
  if (glyph) {
    const [Icon, name] = glyph;
    return (
      <kbd className={cx('ds-kbd', 'ds-kbd--icon', className)} {...props}>
        <Icon aria-hidden="true" />
        <span className="ds-sr-only">{label ?? name}</span>
      </kbd>
    );
  }
  return (
    <kbd className={cx('ds-kbd', className)} {...props}>
      {label ? <><span aria-hidden="true">{children}</span><span className="ds-sr-only">{label}</span></> : children}
    </kbd>
  );
}

/** A key combination, e.g. ⌘ + K. The visual "+" is hidden, so it is read as "Command K". */
export function KbdGroup({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  const keys = Children.toArray(children);
  return (
    <span className={cx('ds-kbd-group', className)} {...props}>
      {keys.map((key, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="ds-kbd-group__plus" aria-hidden="true">+</span>}
          {key}
        </Fragment>
      ))}
    </span>
  );
}
