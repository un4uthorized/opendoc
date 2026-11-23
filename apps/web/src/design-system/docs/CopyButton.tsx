import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cx } from '../cx';
import { copyText } from '../clipboard';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { useDsMessages } from '../i18n';

export interface CopyButtonProps {
  value: string;
  /** Accessible name with context: "Copiar código", "Copiar URL de GET /v1/…". Starts with the visible text. */
  label?: string;
  /** Visible text (e.g. "Copiar"). Without it, the button is icon-only. Hidden below 640px. */
  text?: string;
  className?: string;
  size?: 'sm' | 'default';
}

/** Copies and confirms in place (icon/text + polite announcement). */
export function CopyButton({ value, label: labelProp, text, className, size = 'sm' }: CopyButtonProps) {
  const t = useDsMessages();
  const label = labelProp ?? t.copy;
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onClick = async () => {
    const ok = await copyText(value);
    setState(ok ? 'copied' : 'failed');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2000);
  };
  const copied = state === 'copied';
  return (
    <>
      {text ? (
        <Button
          variant="ghost"
          size={size}
          className={cx('ds-copy-button', 'ds-copy-button--text', copied && 'is-copied', className)}
          iconStart={copied ? <Check /> : <Copy />}
          aria-label={label}
          onClick={() => void onClick()}
        >
          <span className="ds-copy-button__text">{copied ? t.copied : text}</span>
        </Button>
      ) : (
        <IconButton
          size={size}
          className={cx('ds-copy-button', copied && 'is-copied', className)}
          icon={copied ? <Check /> : <Copy />}
          aria-label={label}
          onClick={() => void onClick()}
        />
      )}
      <span className="ds-sr-only" role="status" aria-live="polite">
        {copied ? t.copied : state === 'failed' ? t.copyFailed : ''}
      </span>
    </>
  );
}
