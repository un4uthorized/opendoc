import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, FileText, KeyRound, ShieldCheck, Smartphone, type LucideIcon } from 'lucide-react';
import { Alert, Button, CopyButton, InputOTP, PasswordField, Spinner, TextField, ThemeToggle } from '../../design-system';
import { ApiError, authApi, getMe, type SessionUser, type Stage } from '../../auth/api';
import './login.css';

type Step =
  | { name: 'credentials' | 'mfa' | 'enroll' }
  | { name: 'recovery'; codes: string[]; user: SessionUser };

export interface LoginPageProps {
  /** A login already half done in this browser (password checked, code pending). */
  initialStage?: Exclude<Stage, 'active'>;
  onSignedIn: (user: SessionUser) => void;
}

const message = (error: unknown) => (error instanceof Error ? error.message : 'Algo deu errado. Tente de novo.');
/** The half-open session ended (too many codes, or it expired): the password is needed again. */
const sessionEnded = (error: unknown) => error instanceof ApiError && error.status === 401 && error.code !== 'INVALID_CODE';

/**
 * Sign-in in steps: email and password, then the authenticator code. On the first sign-in the
 * authenticator is set up here (QR code, first code) and the recovery codes are shown once.
 */
export function LoginPage({ initialStage, onSignedIn }: LoginPageProps) {
  const [step, setStep] = useState<Step>({ name: initialStage ?? 'credentials' });
  const [notice, setNotice] = useState<string>();

  useEffect(() => { document.title = 'Entrar'; }, []);

  const restart = (reason?: string) => {
    setNotice(reason);
    setStep({ name: 'credentials' });
  };
  const back = () => {
    authApi.logout().catch(() => {});
    restart();
  };

  // The setup account is signed in by the password alone.
  const next = async (stage: Stage) => {
    setNotice(undefined);
    if (stage !== 'active') return setStep({ name: stage });
    const me = await getMe();
    if (me) onSignedIn(me.user);
    else restart('Entre de novo.');
  };

  return (
    <AuthShell>
        {step.name === 'credentials' && <Credentials notice={notice} onNext={next} />}
        {step.name === 'mfa' && <Verify onBack={back} onExpired={restart} onSignedIn={onSignedIn} />}
        {step.name === 'enroll' && (
          <Enroll onBack={back} onExpired={restart} onDone={(user, codes) => setStep({ name: 'recovery', user, codes })} />
        )}
        {step.name === 'recovery' && <RecoveryCodes codes={step.codes} onContinue={() => onSignedIn(step.user)} />}
    </AuthShell>
  );
}

/** The page around every sign-in screen: soft background, the framed card and its glow. */
export function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="login">
      <div className="login__theme"><ThemeToggle /></div>
      <div className={wide ? 'login__frame login__frame--wide' : 'login__frame'}>
        <div className="login__card">
          <div className="login__glow" aria-hidden="true" />
          {children}
        </div>
      </div>
    </main>
  );
}

export function StepLayout({ icon: StepIcon, eyebrow, title, description, compact, children }: { icon: LucideIcon; eyebrow?: string; title: string; description: ReactNode; compact?: boolean; children: ReactNode }) {
  return (
    <section className="login__step" aria-labelledby="login-title">
      <header className="login__step-header">
        <span className="login__mark" aria-hidden="true"><StepIcon /></span>
        {eyebrow && <p className="login__eyebrow">{eyebrow}</p>}
        <h1 id="login-title" className={compact ? 'login__title login__title--compact' : 'login__title'}>{title}</h1>
        <p className="login__description">{description}</p>
      </header>
      {children}
    </section>
  );
}

function Credentials({ notice, onNext }: { notice?: string; onNext: (stage: Stage) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      onNext((await authApi.login(email.trim(), password)).stage);
    } catch (failure) {
      setError(message(failure));
      setBusy(false);
    }
  };

  return (
    <StepLayout icon={FileText} title="Acesse a documentação" description="Entre com seu e-mail e senha para continuar.">
        <form className="login__form" onSubmit={submit} noValidate>
          {(error ?? notice) && <Alert variant="destructive" role="alert">{error ?? notice}</Alert>}
          <TextField label="E-mail" type="email" placeholder="voce@empresa.com" size="lg" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" autoFocus />
          <PasswordField label="Senha" size="lg" placeholder="Sua senha" value={password} onChange={setPassword} autoComplete="current-password" />
          <Button type="submit" size="lg" loading={busy} disabled={!email.trim() || !password} fullWidth>Entrar</Button>
        </form>
        <p className="login__help"><span>Esqueceu a senha?</span> <strong>Fale com o administrador.</strong></p>
    </StepLayout>
  );
}

function Verify({ onBack, onExpired, onSignedIn }: { onBack: () => void; onExpired: (reason: string) => void; onSignedIn: (user: SessionUser) => void }) {
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (value = code) => {
    if (busy || !value.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      onSignedIn((await authApi.verify(value.trim())).user);
    } catch (failure) {
      if (sessionEnded(failure)) return onExpired('A verificação expirou. Entre de novo.');
      setError(message(failure));
      setCode('');
      setBusy(false);
    }
  };

  return (
    <StepLayout compact icon={ShieldCheck} eyebrow="Etapa 2 de 2" title="Verificação em duas etapas" description={recovery ? 'Digite um dos códigos de recuperação que você guardou. Cada um vale uma vez.' : 'Digite o código de 6 dígitos do seu app autenticador.'}>
        <form className="login__form" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
          {error && <Alert variant="destructive" role="alert">{error}</Alert>}
          {recovery
            ? <TextField key="recovery" label="Código de recuperação" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" spellCheck={false} autoFocus />
            : <InputOTP key="totp" label="Código" value={code} onChange={setCode} onComplete={(value) => void submit(value)} groups={[3, 3]} disabled={busy} autoFocus />}
          <Button type="submit" loading={busy} disabled={recovery ? !code.trim() : code.length < 6} fullWidth>Entrar</Button>
          <div className="login__links">
            <Button type="button" variant="link" size="sm" onClick={onBack} iconStart={<ArrowLeft aria-hidden="true" />}>Voltar</Button>
            <Button type="button" variant="link" size="sm" onClick={() => { setRecovery(!recovery); setCode(''); setError(undefined); }}>
              {recovery ? 'Usar o app autenticador' : 'Usar um código de recuperação'}
            </Button>
          </div>
        </form>
    </StepLayout>
  );
}

function Enroll({ onBack, onExpired, onDone }: { onBack: () => void; onExpired: (reason: string) => void; onDone: (user: SessionUser, codes: string[]) => void }) {
  const [setup, setSetup] = useState<{ secret: string; qrCode: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Once per mount: StrictMode runs effects twice, and each call makes a new secret.
    if (started.current) return;
    started.current = true;
    authApi.setup().then(setSetup).catch((failure) => {
      if (sessionEnded(failure)) onExpired('A configuração expirou. Entre de novo.');
      else setError(message(failure));
    });
  }, [onExpired]);

  const submit = async (value = code) => {
    if (busy || value.length < 6) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await authApi.enable(value);
      onDone(result.user, result.recoveryCodes);
    } catch (failure) {
      if (sessionEnded(failure)) return onExpired('A configuração expirou. Entre de novo.');
      setError(message(failure));
      setCode('');
      setBusy(false);
    }
  };

  return (
    <StepLayout compact icon={Smartphone} eyebrow="Primeiro acesso · 2 de 3" title="Configure o autenticador"
      description="Proteja sua conta com um app autenticador, como Google Authenticator, 1Password ou Authy.">
      <form className="login__form" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
        {error && <Alert variant="destructive" role="alert">{error}</Alert>}
        <ol className="login__setup">
          <li className="login__setup-step">
            <p className="login__setup-label"><span className="login__setup-number" aria-hidden="true">1</span>Escaneie o QR code com o app</p>
            {setup ? (
              <div className="login__qr">
                <img src={setup.qrCode} width={168} height={168} alt="QR code para cadastrar a conta no app autenticador" />
                <details className="login__manual">
                  <summary>Não consegue escanear? Digite a chave</summary>
                  <span className="login__key">
                    <code>{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
                    <CopyButton value={setup.secret} label="Copiar chave" />
                  </span>
                </details>
              </div>
            ) : !error && (
              <div className="login__qr login__qr--loading" role="status"><Spinner /><span className="ds-sr-only">Gerando QR code…</span></div>
            )}
          </li>
          <li className="login__setup-step">
            <InputOTP
              label={<><span className="login__setup-number" aria-hidden="true">2</span>Digite o código de 6 dígitos</>}
              value={code} onChange={setCode} onComplete={(value) => void submit(value)} groups={[3, 3]} disabled={busy || !setup}
            />
          </li>
        </ol>
        <Button type="submit" size="lg" loading={busy} disabled={code.length < 6 || !setup} fullWidth>Ativar e entrar</Button>
        <div className="login__links login__links--center">
          <Button type="button" variant="link" size="sm" onClick={onBack} iconStart={<ArrowLeft aria-hidden="true" />}>Voltar</Button>
        </div>
      </form>
    </StepLayout>
  );
}

function RecoveryCodes({ codes, onContinue }: { codes: string[]; onContinue: () => void }) {
  return (
    <StepLayout compact icon={KeyRound} eyebrow="Primeiro acesso · 3 de 3" title="Guarde seus códigos de recuperação" description="Se perder o celular, cada código substitui o app uma vez. Eles não vão aparecer de novo.">
        <div className="login__form">
          <ol className="login__codes">{codes.map((code) => <li key={code}><code>{code}</code></li>)}</ol>
          <CopyButton value={codes.join('\n')} label="Copiar códigos de recuperação" text="Copiar códigos" className="login__copy-codes" />
          <Button onClick={onContinue} fullWidth autoFocus>Já guardei, continuar</Button>
        </div>
    </StepLayout>
  );
}
