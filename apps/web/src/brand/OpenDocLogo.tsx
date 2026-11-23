import { cx } from '../design-system';
import './brand.css';

export interface OpenDocLogoProps {
  size?: number;
  /** Decorative next to the visible "OpenDoc" text; otherwise announced as "OpenDoc". */
  decorative?: boolean;
  className?: string;
}

/** OpenDoc mark: the open book (public/brand/opendoc-mark.png). */
export function OpenDocLogo({ size = 32, decorative = false, className }: OpenDocLogoProps) {
  return <img src="/brand/opendoc-mark.png" width={size} height={size} alt={decorative ? '' : 'OpenDoc'} className={cx('opendoc-mark', className)} draggable={false} />;
}

export interface OpenDocWordmarkProps {
  /** Rendered height in px; the width follows the image (about 4.4 × the height). */
  height?: number;
  className?: string;
}

/** Full logo (book + "opendoc"). The navy wordmark turns light in the dark theme. */
export function OpenDocWordmark({ height = 32, className }: OpenDocWordmarkProps) {
  const width = Math.round(height * (422 / 96));
  return (
    <span className={cx('opendoc-wordmark', className)} role="img" aria-label="OpenDoc">
      <img src="/brand/opendoc-logo.png" width={width} height={height} alt="" className="opendoc-wordmark--light" draggable={false} />
      <img src="/brand/opendoc-logo-dark.png" width={width} height={height} alt="" className="opendoc-wordmark--dark" draggable={false} />
    </span>
  );
}
