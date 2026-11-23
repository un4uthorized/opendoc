import { useEffect, useRef, useState } from 'react';
import { Check, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button, Textarea } from '../../design-system';
import { docsSource } from './source';
import { useDocsMessages } from './messages';

/**
 * "Esta página ajudou?" at the end of every docs page: yes/no, then an optional comment
 * (POST /api/docs/:slug/feedback, shown in the panel's Analytics). One answer per page per
 * browser; a vote is still sent when the reader leaves without writing or skipping.
 */
export function PageFeedback({ page, label }: { page: string; label?: string }) {
  const t = useDocsMessages();
  const { slug } = docsSource();
  const storageKey = `opendoc:feedback:${slug}:${page}`;
  const [vote, setVote] = useState<boolean | undefined>();
  const [comment, setComment] = useState('');
  // "done" (the thanks) only right after answering; a page answered on an earlier visit shows nothing.
  const [state, setState] = useState<'ask' | 'comment' | 'done' | 'hidden'>(() => (answered(storageKey) ? 'hidden' : 'ask'));
  const pending = useRef<(() => void) | undefined>(undefined);

  // Another page in the same view (the component is reused): start over for it.
  useEffect(() => {
    setVote(undefined);
    setComment('');
    setState(answered(storageKey) ? 'hidden' : 'ask');
  }, [storageKey]);

  // A vote without Enviar/Pular still counts when the reader moves on.
  useEffect(() => () => pending.current?.(), [storageKey]);

  const send = (helpful: boolean, text?: string) => {
    pending.current = undefined;
    remember(storageKey);
    fetch(`/api/docs/${encodeURIComponent(slug)}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page, label, helpful, ...(text?.trim() ? { comment: text.trim() } : {}) }),
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {});
  };

  const choose = (helpful: boolean) => {
    setVote(helpful);
    setState('comment');
    pending.current = () => send(helpful);
  };

  const finish = (text?: string) => {
    if (vote === undefined) return;
    send(vote, text);
    setState('done');
  };

  if (state === 'hidden') return null;

  if (state === 'done') {
    return (
      <section className="rd-feedback rd-feedback--done" aria-live="polite">
        <Check aria-hidden="true" />
        <p>{t.feedbackThanks}</p>
      </section>
    );
  }

  return (
    <section className="rd-feedback" aria-labelledby={`${page}-feedback`}>
      <div className="rd-feedback__ask">
        <p id={`${page}-feedback`} className="rd-feedback__question">{t.feedbackQuestion}</p>
        <div className="rd-feedback__votes" role="group" aria-label={t.feedbackQuestion}>
          <Button variant={vote === true ? 'secondary' : 'outline'} size="sm" iconStart={<ThumbsUp />} aria-pressed={vote === true} onClick={() => choose(true)}>{t.feedbackYes}</Button>
          <Button variant={vote === false ? 'secondary' : 'outline'} size="sm" iconStart={<ThumbsDown />} aria-pressed={vote === false} onClick={() => choose(false)}>{t.feedbackNo}</Button>
        </div>
      </div>
      {state === 'comment' && (
        <form className="rd-feedback__form" onSubmit={(event) => { event.preventDefault(); finish(comment); }}>
          <Textarea
            label={vote ? t.feedbackMoreYes : t.feedbackMoreNo}
            hint={t.feedbackHint}
            rows={3}
            maxLength={2000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            autoFocus
          />
          <div className="rd-feedback__actions">
            <Button variant="ghost" size="sm" onClick={() => finish()}>{t.feedbackSkip}</Button>
            <Button type="submit" size="sm" disabled={!comment.trim()}>{t.feedbackSend}</Button>
          </div>
        </form>
      )}
    </section>
  );
}

function answered(key: string) {
  try { return localStorage.getItem(key) !== null; } catch { return false; }
}
function remember(key: string) {
  try { localStorage.setItem(key, '1'); } catch { /* private mode: ask again next time */ }
}
