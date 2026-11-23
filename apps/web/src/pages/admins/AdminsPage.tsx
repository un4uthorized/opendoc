import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LogOut, Users } from 'lucide-react';
import {
  Alert, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, Badge, Button, CopyButton, Spinner, TextField, toast,
} from '../../design-system';
import { adminsApi, authApi, getMe, type AdminAccount, type AdminInvitation } from '../../auth/api';
import { AuthShell, StepLayout } from '../login/LoginPage';
import './admins.css';

const message = (error: unknown) => (error instanceof Error ? error.message : 'Algo deu errado. Tente de novo.');
const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined);

type Confirm = { kind: 'remove' | 'reset'; admin: AdminAccount } | { kind: 'revoke'; invitation: AdminInvitation };

/**
 * /admins: the setup account's only screen. It invites the installation's admins (who then set up
 * their authenticator) and can remove them or reset their authenticator.
 */
export function AdminsPage() {
  const [data, setData] = useState<{ admins: AdminAccount[]; invitations: AdminInvitation[] }>();
  const [error, setError] = useState<string>();
  /** Links created this visit: the server keeps only their hash, so they can't be shown again later. */
  const [links, setLinks] = useState<{ email: string; url: string }[]>([]);
  const [confirm, setConfirm] = useState<Confirm>();

  const load = useCallback(() => {
    adminsApi.list().then(setData).catch((failure) => setError(message(failure)));
  }, []);

  useEffect(() => {
    document.title = 'Admins';
    // Only the setup account belongs here; anyone else goes back to their own start.
    getMe().then((me) => {
      if (!me || me.stage !== 'active' || !me.user.setup) window.location.replace('/');
      else load();
    }).catch((failure) => setError(message(failure)));
  }, [load]);

  const addLinks = (created: { email: string; url: string }[]) =>
    setLinks((current) => [...created, ...current.filter((link) => !created.some((item) => item.email === link.email))]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    try {
      await action();
      toast({ title: done, variant: 'success' });
      load();
    } catch (failure) {
      toast({ title: message(failure), variant: 'destructive' });
    }
  };

  const logout = async () => {
    await authApi.logout().catch(() => {});
    window.location.replace('/');
  };

  return (
    <AuthShell wide>
      <StepLayout compact icon={Users} eyebrow="Conta de configuração" title="Admins"
        description="Convide quem vai administrar a documentação. Cada admin entra com senha e app autenticador.">
        {error && <Alert variant="destructive" role="alert">{error}</Alert>}
        {!data && !error && <div className="admins__loading" role="status"><Spinner /><span className="ds-sr-only">Carregando…</span></div>}
        {data && (
          <div className="admins">
            <InviteForm onInvited={(result) => { addLinks(result.links); load(); }} />

            {links.length > 0 && (
              <section className="admins__links" aria-label="Links de convite">
                <p className="admins__hint">Envie cada link para a pessoa. Ele vale por 7 dias e só aparece aqui agora.</p>
                <ul className="admins__list">
                  {links.map((link) => (
                    <li key={link.email} className="admins__row">
                      <div className="admins__who">
                        <span className="admins__name">{link.email}</span>
                        <code className="admins__url">{link.url}</code>
                      </div>
                      <CopyButton value={link.url} label={`Copiar link de ${link.email}`} text="Copiar" />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-labelledby="admins-title">
              <h2 id="admins-title" className="admins__heading">Admins <span>{data.admins.length}</span></h2>
              {data.admins.length === 0 ? (
                <p className="admins__empty">Nenhum admin ainda. Convide o primeiro acima.</p>
              ) : (
                <ul className="admins__list">
                  {data.admins.map((admin) => (
                    <li key={admin.id} className="admins__row">
                      <div className="admins__who">
                        <span className="admins__name">{admin.name}</span>
                        <span className="admins__meta">{admin.email}{admin.lastActiveAt ? ` · ativo em ${date(admin.lastActiveAt)}` : ''}</span>
                      </div>
                      {admin.mfa ? <Badge variant="success">Autenticador ativo</Badge> : <Badge variant="warning">Sem autenticador</Badge>}
                      <div className="admins__actions">
                        <Button variant="ghost" size="sm" onClick={() => setConfirm({ kind: 'reset', admin })} disabled={!admin.mfa}>Redefinir autenticador</Button>
                        <Button variant="ghost" size="sm" className="admins__danger" onClick={() => setConfirm({ kind: 'remove', admin })}>Remover</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data.invitations.length > 0 && (
              <section aria-labelledby="invites-title">
                <h2 id="invites-title" className="admins__heading">Convites pendentes <span>{data.invitations.length}</span></h2>
                <ul className="admins__list">
                  {data.invitations.map((invitation) => (
                    <li key={invitation.id} className="admins__row">
                      <div className="admins__who">
                        <span className="admins__name">{invitation.email}</span>
                        <span className="admins__meta">{invitation.expired ? 'Expirado' : `Vale até ${date(invitation.expiresAt)}`}</span>
                      </div>
                      <div className="admins__actions">
                        <Button variant="ghost" size="sm" onClick={() => run(async () => addLinks([{ email: invitation.email, url: (await adminsApi.resend(invitation.id)).url }]), 'Novo link gerado.')}>Gerar novo link</Button>
                        <Button variant="ghost" size="sm" className="admins__danger" onClick={() => setConfirm({ kind: 'revoke', invitation })}>Cancelar</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
        <div className="login__links login__links--center">
          <Button variant="link" size="sm" onClick={logout} iconStart={<LogOut aria-hidden="true" />}>Sair</Button>
        </div>
      </StepLayout>

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => { if (!open) setConfirm(undefined); }}>
        <AlertDialogContent>
          {confirm && <ConfirmText confirm={confirm} />}
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => {
              if (!confirm) return;
              if (confirm.kind === 'remove') void run(() => adminsApi.remove(confirm.admin.id), `${confirm.admin.name} não é mais admin.`);
              if (confirm.kind === 'reset') void run(() => adminsApi.resetMfa(confirm.admin.id), 'Autenticador redefinido.');
              if (confirm.kind === 'revoke') void run(() => adminsApi.revoke(confirm.invitation.id), 'Convite cancelado.');
            }}>
              {confirm?.kind === 'remove' ? 'Remover' : confirm?.kind === 'reset' ? 'Redefinir' : 'Cancelar convite'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthShell>
  );
}

function ConfirmText({ confirm }: { confirm: Confirm }) {
  let title: string;
  let description: string;
  if (confirm.kind === 'revoke') {
    title = `Cancelar o convite de ${confirm.invitation.email}?`;
    description = 'O link deixa de funcionar.';
  } else if (confirm.kind === 'remove') {
    title = `Remover ${confirm.admin.name}?`;
    description = 'A pessoa deixa de ser admin e sai de todas as sessões. A conta continua existindo.';
  } else {
    title = `Redefinir o autenticador de ${confirm.admin.name}?`;
    description = 'A pessoa sai de todas as sessões e configura um novo app autenticador no próximo login.';
  }
  return (
    <AlertDialogHeader>
      <AlertDialogTitle>{title}</AlertDialogTitle>
      <AlertDialogDescription>{description}</AlertDialogDescription>
    </AlertDialogHeader>
  );
}

function InviteForm({ onInvited }: { onInvited: (result: Awaited<ReturnType<typeof adminsApi.invite>>) => void }) {
  const [emails, setEmails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const list = emails.split(/[\s,;]+/).map((email) => email.trim()).filter(Boolean);
    if (!list.length) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await adminsApi.invite(list);
      onInvited(result);
      setEmails('');
      const parts = [
        result.invited && `${result.invited} convite${result.invited > 1 ? 's' : ''} criado${result.invited > 1 ? 's' : ''}`,
        result.added && `${result.added} conta${result.added > 1 ? 's' : ''} já existente${result.added > 1 ? 's' : ''} virou admin`,
        result.skipped && `${result.skipped} já era admin ou tinha convite`,
      ].filter(Boolean);
      toast({ title: parts.join(' · ') || 'Nada a fazer.', variant: result.invited || result.added ? 'success' : 'default' });
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="admins__invite" onSubmit={submit} noValidate>
      {error && <Alert variant="destructive" role="alert">{error}</Alert>}
      <div className="admins__invite-row">
        <TextField label="Convidar por e-mail" hint="Separe vários e-mails com vírgula." size="lg" placeholder="pessoa@empresa.com"
          value={emails} onChange={(event) => setEmails(event.target.value)} autoComplete="off" />
        <Button type="submit" size="lg" loading={busy} disabled={!emails.trim()}>Convidar</Button>
      </div>
    </form>
  );
}
