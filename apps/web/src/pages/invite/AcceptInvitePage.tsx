import { useEffect, useState, type FormEvent } from 'react';
import { MailOpen } from 'lucide-react';
import { Alert, Button, PasswordField, Spinner, TextField } from '../../design-system';
import { homeFor, invitationApi, type InvitationInfo } from '../../auth/api';
import { AuthShell, LoginPage, StepLayout } from '../login/LoginPage';

const minPassword = 15;

/**
 * /convite/:token: creates the account from an invitation (name + password), then goes straight
 * to setting up the authenticator, the same step as a first sign-in.
 */
export function AcceptInvitePage({ token }: { token: string }) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'invalid'; message: string } | { status: 'ready'; invitation: InvitationInfo } | { status: 'accepted' }
  >({ status: 'loading' });

  useEffect(() => {
    document.title = 'Convite';
    invitationApi.get(token)
      .then((invitation) => setState({ status: 'ready', invitation }))
      .catch((error: Error) => setState({ status: 'invalid', message: error.message }));
  }, [token]);

  if (state.status === 'accepted') return <LoginPage initialStage="enroll" onSignedIn={(user) => window.location.replace(homeFor(user))} />;

  return (
    <AuthShell>
      {state.status === 'loading' && <div className="login__qr--loading" role="status"><Spinner /><span className="ds-sr-only">Carregando convite…</span></div>}
      {state.status === 'invalid' && (
        <StepLayout compact icon={MailOpen} title="Convite indisponível" description="O link pode ter expirado ou já ter sido usado.">
          <div className="login__form">
            <Alert variant="destructive">{state.message}</Alert>
            <a className="ds-button ds-button--outline" href="/">Ir para o login</a>
          </div>
        </StepLayout>
      )}
      {state.status === 'ready' && <AcceptForm token={token} invitation={state.invitation} onAccepted={() => setState({ status: 'accepted' })} />}
    </AuthShell>
  );
}

function AcceptForm({ token, invitation, onAccepted }: { token: string; invitation: InvitationInfo; onAccepted: () => void }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await invitationApi.accept(token, name.trim(), password);
      onAccepted();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Algo deu errado. Tente de novo.');
      setBusy(false);
    }
  };

  const what = invitation.admin ? 'como admin' : `para o projeto ${invitation.project}`;
  return (
    <StepLayout compact icon={MailOpen} eyebrow="Primeiro acesso · 1 de 3" title="Crie sua conta"
      description={<>Este convite é para você entrar {what}. Escolha seu nome e uma senha; depois vem o app autenticador.</>}>
      <form className="login__form" onSubmit={submit} noValidate>
        {error && <Alert variant="destructive" role="alert">{error}</Alert>}
        <TextField label="E-mail" size="lg" value={invitation.email} readOnly />
        <TextField label="Nome" size="lg" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" autoFocus />
        <PasswordField
          label="Senha" size="lg" value={password} onChange={setPassword} autoComplete="new-password"
          requirements={[{ label: `Pelo menos ${minPassword} caracteres`, test: (value) => value.length >= minPassword }]}
        />
        <Button type="submit" size="lg" loading={busy} disabled={!name.trim() || password.length < minPassword} fullWidth>Criar conta</Button>
      </form>
    </StepLayout>
  );
}
