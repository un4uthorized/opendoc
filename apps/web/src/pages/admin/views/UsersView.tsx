import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { KeyRound, MailPlus, RefreshCw, UserMinus, UserPlus, X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Avatar, Badge, Button, CopyButton, DataTable, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, EmptyState, NativeSelect, Tabs, TabsContent, TabsList, TabsTrigger,
  Textarea, type DataTableColumn,
} from '../../../design-system';
import { adminApi, useAdminState, type InviteResult } from '../data/store';
import { projectRoleDescriptions, projectRoleLabels, type Invitation, type Project, type ProjectRole, type User } from '../data/types';
import { formatDate, plural, timeAgo } from '../format';
import { PageHeader, useAction } from '../parts';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const roles = Object.keys(projectRoleLabels) as ProjectRole[];

/** Someone with access to the project: a member with a role, or an installation owner. */
interface Row { user: User; role: ProjectRole | 'owner' }

function PersonCell({ user, you }: { user: User; you: boolean }) {
  return (
    <span className="admin-person">
      <Avatar name={user.name} size="sm" />
      <span className="admin-person__text">
        <span className="admin-person__name">{user.name}{you && ' (você)'}</span>
        <span className="admin-person__email">{user.email}</span>
      </span>
    </span>
  );
}

function RoleBadge({ role }: { role: Row['role'] }) {
  // Same neutral look for every role: color in this table is kept for status (authenticator, invitations).
  return <Badge variant="outline">{role === 'owner' ? 'Proprietário' : projectRoleLabels[role]}</Badge>;
}

type InviteLink = InviteResult['links'][number];

/**
 * Invitation links, shown right after they are created: the server sends no email and keeps only
 * a hash of each link, so this is the one time they can be copied.
 */
function InviteLinksDialog({ links, onClose }: { links: InviteLink[]; onClose: () => void }) {
  return (
    <Dialog open={links.length > 0} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="admin-dialog">
        <DialogHeader>
          <DialogTitle>{links.length > 1 ? 'Envie os links de convite' : 'Envie o link de convite'}</DialogTitle>
          <DialogDescription>Cada link vale por 7 dias e só aparece agora. Se perder, gere um novo na aba Convites.</DialogDescription>
        </DialogHeader>
        <ul className="admin-invite-links">
          {links.map((link) => (
            <li key={link.email}>
              <span className="admin-invite-links__text">
                <span className="admin-invite-links__email">{link.email}</span>
                <code className="admin-invite-links__url">{link.url}</code>
              </span>
              <CopyButton value={link.url} label={`Copiar link de ${link.email}`} text="Copiar" />
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>Pronto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({ project, open, onOpenChange, onLinks }: { project: Project; open: boolean; onOpenChange: (open: boolean) => void; onLinks: (links: InviteLink[]) => void }) {
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<ProjectRole>('viewer');
  const [submitted, setSubmitted] = useState(false);
  const { pending, run } = useAction();
  useEffect(() => { if (open) { setEmails(''); setRole('viewer'); setSubmitted(false); } }, [open]);

  const list = [...new Set(emails.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const invalid = list.filter((email) => !emailPattern.test(email));
  const emailError = !submitted ? undefined : list.length === 0 ? 'Informe pelo menos um e-mail.' : invalid.length ? `E-mail inválido: ${invalid.join(', ')}` : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (list.length === 0 || invalid.length) return;
    const result = await run(() => adminApi.invite(project.id, list, role), (done) => [
      done.added && plural(done.added, 'pessoa adicionada', 'pessoas adicionadas'),
      done.invited && plural(done.invited, 'convite criado', 'convites criados'),
      done.skipped && `${plural(done.skipped, 'já tinha', 'já tinham')} acesso ou convite`,
    ].filter(Boolean).join(' · ') || 'Nada a fazer');
    if (result) {
      onOpenChange(false);
      if (result.links.length) onLinks(result.links);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-dialog">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Adicionar pessoas a {project.name}</DialogTitle>
            <DialogDescription>Quem já tem conta ganha acesso na hora. Para os demais é gerado um link de convite, válido por 7 dias, para você enviar; a pessoa cria a senha e o autenticador ao abrir.</DialogDescription>
          </DialogHeader>
          <div className="admin-form">
            <Textarea label="E-mails" hint="Separe por vírgula ou quebra de linha." rows={3} value={emails} onChange={(event) => setEmails(event.target.value)} error={emailError} required autoFocus />
            <NativeSelect label="Papel no projeto" value={role} onChange={(event) => setRole(event.target.value as ProjectRole)} hint={projectRoleDescriptions[role]}>
              {roles.map((key) => <option key={key} value={key}>{projectRoleLabels[key]}</option>)}
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={pending}>Adicionar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Pending = { kind: 'remove'; users: User[] } | { kind: 'mfa'; user: User } | null;

export function UsersView({ project }: { project: Project }) {
  const { users, invitations: allInvitations, currentUserId } = useAdminState();
  const [inviting, setInviting] = useState(false);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [links, setLinks] = useState<InviteLink[]>([]);
  const { run } = useAction();

  const invitations = allInvitations.filter((invite) => invite.projectId === project.id);
  const rows = useMemo<Row[]>(() => [
    ...users.filter((user) => user.owner).map((user) => ({ user, role: 'owner' as const })),
    ...project.members.flatMap((member) => {
      const user = users.find((item) => item.id === member.userId);
      return user && !user.owner ? [{ user, role: member.role }] : [];
    }),
  ], [users, project.members]);
  const byIds = (ids: string[]) => rows.filter((row) => ids.includes(row.user.id) && row.role !== 'owner').map((row) => row.user);
  const setRole = (ids: string[], role: ProjectRole) => run(
    () => adminApi.setMemberRole(project.id, ids, role),
    ids.length === 1 ? `${byIds(ids)[0]?.name ?? 'Pessoa'} agora é ${projectRoleLabels[role].toLowerCase()}` : `${ids.length} pessoas agora são ${projectRoleLabels[role].toLowerCase()}`,
  );

  const userColumns: DataTableColumn<Row>[] = [
    { id: 'name', header: 'Pessoa', sortValue: (row) => row.user.name, cell: (row) => <PersonCell user={row.user} you={row.user.id === currentUserId} /> },
    { id: 'role', header: 'Papel', sortValue: (row) => ['owner', ...roles].indexOf(row.role), cell: (row) => <RoleBadge role={row.role} /> },
    { id: 'mfa', header: 'Autenticador', hideOnMobile: true, cell: (row) => (row.user.mfa ? <Badge variant="success" dot>Ativo</Badge> : <Badge variant="warning" dot>Pendente</Badge>) },
    { id: 'active', header: 'Último acesso', hideOnMobile: true, align: 'right', sortValue: (row) => row.user.lastActiveAt ?? '', cell: (row) => <span title={formatDate(row.user.lastActiveAt)}>{timeAgo(row.user.lastActiveAt)}</span> },
  ];

  const inviteColumns: DataTableColumn<Invitation>[] = [
    { id: 'email', header: 'E-mail', sortValue: (invite) => invite.email, cell: (invite) => invite.email },
    { id: 'role', header: 'Papel', cell: (invite) => <RoleBadge role={invite.role} /> },
    { id: 'sent', header: 'Enviado', hideOnMobile: true, sortValue: (invite) => invite.invitedAt, cell: (invite) => timeAgo(invite.invitedAt) },
    {
      id: 'expires', header: 'Expira', sortValue: (invite) => invite.expiresAt, cell: (invite) => (new Date(invite.expiresAt).getTime() < Date.now()
        ? <Badge variant="destructive">Expirado</Badge>
        : <span title={formatDate(invite.expiresAt)}>{timeAgo(invite.expiresAt)}</span>),
    },
  ];

  return (
    <div className="admin-page">
      <PageHeader
        title="Usuários"
        description={`Quem pode ver ou editar ${project.name}. Uma conta vale para todos os projetos, mas o acesso é dado em cada um.`}
        actions={<Button iconStart={<UserPlus />} onClick={() => setInviting(true)}>Adicionar pessoas</Button>}
      />

      <Tabs defaultValue="users">
        <TabsList variant="line" aria-label="Usuários e convites" className="admin-tabs-full">
          <TabsTrigger value="users">Com acesso <Badge variant="secondary">{rows.length}</Badge></TabsTrigger>
          <TabsTrigger value="invites">Convites pendentes <Badge variant="secondary">{invitations.length}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="admin-tab-panel">
          <DataTable
            label={`Usuários de ${project.name}`}
            data={rows}
            columns={userColumns}
            getRowId={(row) => row.user.id}
            getRowLabel={(row) => row.user.name}
            selectable
            search={{ placeholder: 'Nome ou e-mail', filter: (row, query) => `${row.user.name} ${row.user.email}`.toLowerCase().includes(query) }}
            bulkActions={(ids, clear) => {
              const members = byIds(ids).map((user) => user.id);
              return (
                <>
                  <NativeSelect
                    label={<span className="ds-sr-only">Mudar papel dos selecionados</span>}
                    size="sm"
                    className="admin-bulk-role"
                    value=""
                    disabled={members.length === 0}
                    onChange={async (event) => { if (event.target.value && await setRole(members, event.target.value as ProjectRole)) clear(); }}
                  >
                    <option value="" disabled>Mudar papel…</option>
                    {roles.map((key) => <option key={key} value={key}>{projectRoleLabels[key]}</option>)}
                  </NativeSelect>
                  <Button variant="outline" size="sm" iconStart={<UserMinus />} disabled={members.length === 0} onClick={() => setConfirm({ kind: 'remove', users: byIds(ids) })}>Remover do projeto</Button>
                </>
              );
            }}
            rowActions={(row) => (
              <>
                {row.role === 'owner' ? (
                  <DropdownMenuLabel className="admin-menu-note">Proprietários têm acesso a todos os projetos.</DropdownMenuLabel>
                ) : (
                  <>
                    <DropdownMenuLabel>Papel</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={row.role} onValueChange={(role) => setRole([row.user.id], role as ProjectRole)}>
                      {roles.map((key) => <DropdownMenuRadioItem key={key} value={key}>{projectRoleLabels[key]}</DropdownMenuRadioItem>)}
                    </DropdownMenuRadioGroup>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!row.user.mfa} onSelect={() => setConfirm({ kind: 'mfa', user: row.user })}><KeyRound />Redefinir autenticador</DropdownMenuItem>
                {row.role !== 'owner' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" disabled={row.user.id === currentUserId} onSelect={() => setConfirm({ kind: 'remove', users: [row.user] })}><UserMinus />Remover do projeto</DropdownMenuItem>
                  </>
                )}
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="invites" className="admin-tab-panel">
          <DataTable
            label={`Convites pendentes de ${project.name}`}
            data={invitations}
            columns={inviteColumns}
            getRowId={(invite) => invite.id}
            getRowLabel={(invite) => invite.email}
            rowActions={(invite) => (
              <>
                <DropdownMenuItem onSelect={async () => {
                  const result = await run(() => adminApi.resendInvitation(invite.id));
                  if (result) setLinks([{ email: invite.email, url: result.url }]);
                }}><RefreshCw />Gerar novo link</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => run(() => adminApi.revokeInvitation(invite.id), 'Convite revogado')}><X />Revogar</DropdownMenuItem>
              </>
            )}
            emptyState={(
              <EmptyState icon={<MailPlus />} titleAs="h2" title="Nenhum convite pendente" description="Convites aceitos aparecem na aba Com acesso." actions={<Button variant="outline" onClick={() => setInviting(true)}>Adicionar pessoas</Button>} />
            )}
          />
        </TabsContent>
      </Tabs>

      <InviteDialog project={project} open={inviting} onOpenChange={setInviting} onLinks={setLinks} />
      <InviteLinksDialog links={links} onClose={() => setLinks([])} />

      <AlertDialog open={confirm !== null} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          {confirm?.kind === 'remove' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirm.users.length === 1 ? `Remover ${confirm.users[0]!.name} de ${project.name}?` : `Remover ${confirm.users.length} pessoas de ${project.name}?`}</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirm.users.length === 1 ? 'A pessoa perde' : 'Elas perdem'} o acesso a este projeto. A conta e o acesso a outros projetos continuam.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => run(() => adminApi.removeMembers(project.id, confirm.users.map((user) => user.id)), plural(confirm.users.length, 'pessoa removida', 'pessoas removidas'))}>Remover</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {confirm?.kind === 'mfa' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Redefinir o autenticador de {confirm.user.name}?</AlertDialogTitle>
                <AlertDialogDescription>Use quando a pessoa perdeu o celular. O autenticador é da conta, então no próximo login ela configura um novo, valendo para todos os projetos.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(() => adminApi.resetMfa(confirm.user.id), 'Autenticador redefinido')}>Redefinir</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
