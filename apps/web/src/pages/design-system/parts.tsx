import { createContext, Fragment, useCallback, useContext, type ReactNode } from 'react';
import { Kbd, KbdGroup, Text, copyText, cx, toast } from '../../design-system';

export function Section({ id, eyebrow, title, description, children }: { id: string; eyebrow: string; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="dsp-section" aria-labelledby={`${id}-title`}>
      <header className="dsp-section__header">
        <Text variant="overline" color="muted">{eyebrow}</Text>
        <Text variant="h2" id={`${id}-title`}>{title}</Text>
        <Text variant="body" color="muted" className="dsp-section__description">{description}</Text>
      </header>
      {children}
    </section>
  );
}

export type KeyboardRow = [keys: string, action: string];

export function Specimen({ title, description, layout = 'row', code, keyboard, children, stageClassName }: {
  title: string;
  description?: ReactNode;
  layout?: 'row' | 'stack' | 'grid';
  code?: string;
  /** Keyboard interactions, documented like Radix: [keys, what happens]. Keys separated by " / ". */
  keyboard?: KeyboardRow[];
  children: ReactNode;
  stageClassName?: string;
}) {
  return (
    <div className="dsp-specimen">
      <div className="dsp-specimen__head">
        <h3 className="dsp-specimen__title">{title}</h3>
        {description && <p className="dsp-specimen__description">{description}</p>}
      </div>
      <div className={cx('dsp-specimen__stage', `dsp-specimen__stage--${layout}`, stageClassName)}>{children}</div>
      {keyboard && (
        <div className="dsp-keys">
          <table>
            <caption>Teclado</caption>
            <thead><tr><th scope="col">Tecla</th><th scope="col">Ação</th></tr></thead>
            <tbody>
              {keyboard.map(([keys, action]) => (
                <tr key={keys + action}>
                  <td>
                    <span className="dsp-keys__alts">
                      {keys.split(' / ').map((alternative, index) => {
                        const combo = alternative.split('+').map((key) => key.trim()).filter(Boolean);
                        return (
                          <Fragment key={alternative}>
                            {index > 0 && <span className="dsp-keys__or">ou</span>}
                            {combo.length > 1 ? <KbdGroup>{combo.map((key) => <Kbd key={key}>{key}</Kbd>)}</KbdGroup> : <Kbd>{combo[0]}</Kbd>}
                          </Fragment>
                        );
                      })}
                    </span>
                  </td>
                  <td>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {code && <pre className="dsp-code"><code>{code}</code></pre>}
    </div>
  );
}

/* Copy-to-clipboard with a single shared toast for the page. */
const CopyContext = createContext<(text: string) => void>(() => {});
export const useCopy = () => useContext(CopyContext);

/** Copies and always gives feedback through the design-system toast. */
export function CopyProvider({ children }: { children: ReactNode }) {
  const copy = useCallback(async (text: string) => {
    const ok = await copyText(text);
    toast(ok
      ? { title: 'Copiado', description: <code>{text}</code>, variant: 'success', duration: 2000 }
      : { title: 'Não foi possível copiar', description: <>Selecione e copie manualmente: <code>{text}</code></>, variant: 'destructive', duration: 8000 });
  }, []);
  return <CopyContext.Provider value={(text) => void copy(text)}>{children}</CopyContext.Provider>;
}
