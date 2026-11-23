import { useId, type ReactNode } from 'react';
import { ArrowUp } from 'lucide-react';
import { cx } from '../cx';
import { IconButton } from '../components/IconButton';
import { Spinner } from '../components/Spinner';

export interface PromptInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  /** Accessible name of the text area (visually hidden). */
  label?: string;
  placeholder?: string;
  /** While a reply is generating: the send button shows a spinner and is disabled. */
  loading?: boolean;
  disabled?: boolean;
  /** Buttons at the start of the toolbar (attach, model picker…). */
  startActions?: ReactNode;
  className?: string;
}

/**
 * Chat composer: a text area that grows with the content (up to a limit) and a send button.
 * Enter sends, Shift+Enter breaks the line (the hint is exposed to screen readers).
 */
export function PromptInput({ value, onValueChange, onSubmit, label = 'Mensagem', placeholder = 'Escreva uma mensagem…', loading = false, disabled = false, startActions, className }: PromptInputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const canSend = value.trim().length > 0 && !loading && !disabled;
  return (
    <form
      className={cx('ds-prompt', disabled && 'is-disabled', className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit(value.trim());
      }}
    >
      <label htmlFor={id} className="ds-sr-only">{label}</label>
      <textarea
        id={id}
        className="ds-prompt__textarea"
        rows={1}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <p id={hintId} className="ds-sr-only">Enter envia; Shift+Enter quebra a linha.</p>
      <div className="ds-prompt__toolbar">
        <div className="ds-prompt__start">{startActions}</div>
        <IconButton
          type="submit"
          variant="default"
          size="sm"
          className="ds-prompt__send"
          icon={loading ? <Spinner size="sm" label="" /> : <ArrowUp />}
          aria-label={loading ? 'Enviando' : 'Enviar mensagem'}
          disabled={!canSend}
        />
      </div>
    </form>
  );
}
