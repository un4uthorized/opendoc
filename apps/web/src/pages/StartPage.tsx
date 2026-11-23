import { useEffect, useState } from 'react';
import { Alert, Button, Spinner } from '../design-system';
import { getMe, homeFor, type Me, type SessionUser } from '../auth/api';
import { LoginPage } from './login/LoginPage';

/**
 * The first screen (/): signed out → login; signed in → the admin for admins, the docs for
 * everyone else.
 */
export function StartPage() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; me: Me | null } | { status: 'error'; message: string }>({ status: 'loading' });

  const load = () => {
    setState({ status: 'loading' });
    getMe()
      .then((me) => setState({ status: 'ready', me }))
      .catch((error: Error) => setState({ status: 'error', message: error.message }));
  };
  useEffect(load, []);

  const go = (user: SessionUser) => window.location.replace(homeFor(user));
  const me = state.status === 'ready' ? state.me : null;
  useEffect(() => { if (me?.stage === 'active') go(me.user); }, [me]);

  if (state.status === 'error') {
    return (
      <main className="app-loading">
        <Alert variant="destructive" title="Não foi possível carregar" role="alert">
          <p>{state.message}</p>
          <Button variant="outline" size="sm" onClick={load}>Tentar de novo</Button>
        </Alert>
      </main>
    );
  }
  if (state.status === 'loading' || me?.stage === 'active') {
    return <div className="app-loading" role="status"><Spinner /><span className="ds-sr-only">Carregando…</span></div>;
  }
  return <LoginPage initialStage={me?.stage} onSignedIn={go} />;
}
