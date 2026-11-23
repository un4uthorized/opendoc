import { useState, type FormEvent } from 'react';
import { Mail, Pencil, RotateCw, Trash2, UserPlus } from 'lucide-react';
import {
  Avatar, Badge, Button, Combobox, DataTable, DropdownMenuItem, DropdownMenuSeparator, ErrorSummary, FileDropzone, InputOTP, MarkdownEditor,
  PasswordField, TextField, toast, type DataTableColumn,
} from '../../design-system';
import { Section, Specimen, type KeyboardRow } from './parts';

const keys = {
  otp: [['0–9', 'Preenche a próxima caixa'], ['Backspace', 'Apaga a última'], ['⌘+V / Ctrl+V', 'Cola o código inteiro']] as KeyboardRow[],
  combobox: [
    ['Digitar', 'Filtra as opções'],
    ['↓ / ↑', 'Abre a lista e move entre as opções'],
    ['Enter', 'Seleciona (no modo múltiplo, marca e desmarca)'],
    ['Backspace', 'No campo vazio, remove a última seleção'],
    ['Esc', 'Fecha a lista'],
  ] as KeyboardRow[],
  editor: [
    ['⌘+B / Ctrl+B', 'Negrito'],
    ['⌘+I / Ctrl+I', 'Itálico'],
    ['⌘+K / Ctrl+K', 'Link'],
    ['← / →', 'Na barra de formatação, move entre os botões'],
  ] as KeyboardRow[],
};

const roleOptions = [
  { value: 'reader', label: 'Leitor', description: 'Lê a documentação e usa o API Explorer.' },
  { value: 'editor', label: 'Editor', description: 'Edita páginas e publica especificações.' },
  { value: 'admin', label: 'Administrador', description: 'Gerencia pessoas, chaves e faturamento.' },
  { value: 'owner', label: 'Proprietário', description: 'Somente um por espaço.', disabled: true },
];

const passwordRules = [
  { label: 'Pelo menos 15 caracteres', test: (value: string) => value.length >= 15 },
  { label: 'Letras e números', test: (value: string) => /[a-z]/i.test(value) && /\d/.test(value) },
  { label: 'Sem espaços no início ou no fim', test: (value: string) => value.length > 0 && value === value.trim() },
];

function OtpDemo() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  return (
    <InputOTP
      label="Código de verificação"
      hint="6 dígitos do aplicativo autenticador. Nesta demonstração, use 123456."
      value={code}
      groups={[3, 3]}
      error={error}
      onChange={(value) => { setCode(value); setError(undefined); }}
      onComplete={(value) => {
        if (value === '123456') toast({ title: 'Código confirmado', variant: 'success' });
        else setError('Código incorreto. Confira o aplicativo e tente de novo.');
      }}
    />
  );
}

function InviteForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [submits, setSubmits] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next['invite-name'] = 'Informe o nome da pessoa.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next['invite-email'] = 'Informe um e-mail válido, como nome@empresa.com.';
    if (!role) next['invite-role'] = 'Escolha um papel.';
    if (!passwordRules.every((rule) => rule.test(password))) next['invite-password'] = 'A senha temporária não atende aos requisitos.';
    return next;
  };

  // Clear a field's error as soon as it is edited; the full check runs again on submit.
  const clearError = (id: string) => setErrors((current) => {
    if (!(id in current)) return current;
    const { [id]: _removed, ...rest } = current;
    return rest;
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    setSubmits((count) => count + 1);
    if (Object.keys(next).length === 0) toast({ title: 'Convite enviado', description: `${name} vai receber o link em ${email}.`, variant: 'success' });
  };

  return (
    <form className="dsp-invite" onSubmit={submit} noValidate>
      <ErrorSummary errors={Object.entries(errors).map(([id, message]) => ({ id, message }))} focusKey={submits} title="Não foi possível enviar o convite" />
      <div className="dsp-invite__grid">
        <TextField id="invite-name" label="Nome" required autoComplete="off" value={name} onChange={(event) => { setName(event.target.value); clearError('invite-name'); }} error={errors['invite-name']} />
        <TextField id="invite-email" label="E-mail" type="email" required autoComplete="off" value={email} onChange={(event) => { setEmail(event.target.value); clearError('invite-email'); }} error={errors['invite-email']} />
      </div>
      <Combobox id="invite-role" label="Papel" options={roleOptions} value={role} onValueChange={(value) => { setRole(value); clearError('invite-role'); }} placeholder="Escolha um papel" error={errors['invite-role']} />
      <PasswordField id="invite-password" label="Senha temporária" autoComplete="new-password" value={password} onChange={(value) => { setPassword(value); clearError('invite-password'); }} requirements={passwordRules} error={errors['invite-password']} />
      <div><Button type="submit" iconStart={<UserPlus />}>Enviar convite</Button></div>
    </form>
  );
}

function UploadDemo() {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <FileDropzone
      label="Especificação OpenAPI"
      accept=".json,.yaml,.yml"
      maxSize={2 * 1024 * 1024}
      files={files}
      onFilesChange={setFiles}
      hint="JSON ou YAML, OpenAPI 3.0 ou 3.1, até 2 MB."
    />
  );
}

/* ── Admin ──────────────────────────────────────────────────────────── */

type Person = { id: string; name: string; email: string; role: 'Administrador' | 'Editor' | 'Leitor'; status: 'Ativo' | 'Convidado' | 'Desativado'; lastSeen: string; lastSeenDays: number };

const firstNames = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Karina', 'Lucas', 'Marina', 'Nicolas', 'Olívia', 'Paulo', 'Renata', 'Sérgio', 'Tatiana', 'Vitor', 'Yasmin', 'Zeca'];
const lastNames = ['Souza', 'Lima', 'Dias', 'Alves', 'Rocha', 'Costa', 'Pereira', 'Melo'];
const initialPeople: Person[] = firstNames.map((first, index) => {
  const last = lastNames[index % lastNames.length]!;
  const days = (index * 7) % 45;
  return {
    id: `u${index + 1}`,
    name: `${first} ${last}`,
    email: `${first.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()}.${last.toLowerCase()}@empresa.com`,
    role: index === 0 ? 'Administrador' : index % 4 === 1 ? 'Editor' : 'Leitor',
    status: index % 9 === 4 ? 'Convidado' : index % 11 === 7 ? 'Desativado' : 'Ativo',
    lastSeen: days === 0 ? 'Hoje' : days === 1 ? 'Ontem' : `Há ${days} dias`,
    lastSeenDays: days,
  };
});

const statusVariant = { Ativo: 'success', Convidado: 'info', Desativado: 'secondary' } as const;

function PeopleTable() {
  const [people, setPeople] = useState(initialPeople);
  const columns: DataTableColumn<Person>[] = [
    {
      id: 'name',
      header: 'Nome',
      sortValue: (person) => person.name,
      cell: (person) => (
        <span className="dsp-person-cell">
          <Avatar name={person.name} size="sm" />
          <span><span className="dsp-person-cell__name">{person.name}</span><span className="dsp-person-cell__email">{person.email}</span></span>
        </span>
      ),
    },
    { id: 'role', header: 'Papel', sortValue: (person) => person.role, cell: (person) => person.role, hideOnMobile: true },
    { id: 'status', header: 'Status', sortValue: (person) => person.status, cell: (person) => <Badge variant={statusVariant[person.status]} dot>{person.status}</Badge> },
    { id: 'lastSeen', header: 'Último acesso', align: 'right', sortValue: (person) => person.lastSeenDays, cell: (person) => <span className="dsp-number">{person.lastSeen}</span>, hideOnMobile: true },
  ];
  const removeIds = (ids: string[]) => {
    setPeople((current) => current.filter((person) => !ids.includes(person.id)));
    toast({ title: ids.length === 1 ? 'Pessoa removida' : `${ids.length} pessoas removidas`, action: { label: 'Desfazer', altText: 'Desfazer a remoção', onClick: () => setPeople(initialPeople) } });
  };
  return (
    <DataTable
      label="Pessoas com acesso"
      data={people}
      columns={columns}
      getRowId={(person) => person.id}
      getRowLabel={(person) => person.name}
      search={{ label: 'Buscar pessoas', placeholder: 'Nome ou e-mail', filter: (person, query) => `${person.name} ${person.email}`.toLowerCase().includes(query) }}
      selectable
      pageSize={8}
      toolbar={<Button size="sm" iconStart={<UserPlus />}>Convidar</Button>}
      bulkActions={(ids, clear) => (
        <>
          <Button variant="outline" size="sm" iconStart={<Mail />} onClick={() => { toast({ title: `Convite reenviado para ${ids.length}` }); clear(); }}>Reenviar convite</Button>
          <Button variant="destructive" size="sm" iconStart={<Trash2 />} onClick={() => { removeIds(ids); clear(); }}>Remover</Button>
        </>
      )}
      rowActions={(person) => (
        <>
          <DropdownMenuItem><Pencil aria-hidden="true" />Editar</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toast({ title: `Convite reenviado para ${person.name}` })}><RotateCw aria-hidden="true" />Reenviar convite</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => removeIds([person.id])}><Trash2 aria-hidden="true" />Remover</DropdownMenuItem>
        </>
      )}
    />
  );
}

const tagOptions = ['Pagamentos', 'Reembolsos', 'Clientes', 'Webhooks', 'Assinaturas', 'Faturas', 'Disputas', 'Relatórios', 'Autenticação', 'Beta']
  .map((label) => ({ value: label.toLowerCase(), label }));

const initialPage = `## Visão geral

A API de pagamentos permite **criar cobranças**, reembolsar e acompanhar tudo por _webhooks_.

- Autenticação por token
- Respostas em JSON

\`\`\`json
{ "id": "ch_8f2a", "amount": 5000 }
\`\`\`
`;

export function FormSections() {
  const [tags, setTags] = useState<string[]>(['reembolsos', 'webhooks']);
  const [page, setPage] = useState(initialPage);
  return (
    <>
      <Section id="formularios" eyebrow="Formulários e admin" title="OTP, senha e upload" description="Peças para autenticação e importação. Todo campo tem rótulo visível; erros entram por aria-describedby e, ao enviar, um resumo leva a cada problema.">
        <Specimen
          title="InputOTP"
          description={<>Caixas visuais sobre um único campo real, com <code>autocomplete="one-time-code"</code>: o leitor de tela ouve um campo só, colar funciona e o celular sugere o código do SMS.</>}
          keyboard={keys.otp}
          code={`<InputOTP label="Código de verificação" value={code} onChange={setCode} groups={[3, 3]} onComplete={verify} />`}
        >
          <OtpDemo />
        </Specimen>
        <Specimen
          title="Formulário com ErrorSummary, Combobox e PasswordField"
          description="Envie vazio para ver o resumo de erros: ele recebe o foco, é anunciado e cada item leva ao campo. A senha mostra os requisitos ao vivo; o botão de mostrar usa aria-pressed."
          layout="stack"
          code={`<ErrorSummary errors={[{ id: 'invite-email', message: 'Informe um e-mail válido.' }]} focusKey={submits} />\n<PasswordField label="Senha" value={password} onChange={setPassword} requirements={rules} />`}
        >
          <InviteForm />
        </Specimen>
        <Specimen
          title="FileDropzone"
          description="Arraste um arquivo ou use o botão (que funciona pelo teclado). Valida formato e tamanho, lista os arquivos com botão de remover e anuncia cada mudança."
          layout="stack"
          code={`<FileDropzone label="Especificação OpenAPI" accept=".json,.yaml,.yml" maxSize={2 * 1024 * 1024} files={files} onFilesChange={setFiles} />`}
        >
          <UploadDemo />
        </Specimen>
      </Section>

      <Section id="admin" eyebrow="Formulários e admin" title="DataTable, Combobox e editor" description="Para o painel de administração: gerenciar pessoas, classificar conteúdo e escrever páginas da documentação.">
        <Specimen
          title="DataTable"
          description="Busca, ordenação, seleção com “selecionar todos desta página” (estado misto), ações em massa, menu por linha e paginação. Cada caixa e cada menu têm o nome da pessoa: “Selecionar Ana Souza”, “Ações para Ana Souza”."
          layout="stack"
          code={`<DataTable\n  label="Pessoas com acesso"\n  data={people}\n  columns={columns}\n  getRowId={(p) => p.id}\n  getRowLabel={(p) => p.name}\n  search={{ filter: (p, q) => p.name.toLowerCase().includes(q) }}\n  selectable\n  bulkActions={(ids, clear) => …}\n  rowActions={(p) => …}\n/>`}
        >
          <PeopleTable />
        </Specimen>
        <Specimen
          title="Combobox múltiplo"
          description="Busca entre muitas opções e mostra as escolhidas como fichas removíveis. A lista é um listbox com aria-multiselectable."
          layout="stack"
          keyboard={keys.combobox}
          code={`<Combobox multiple label="Tags" options={tags} value={selected} onValueChange={setSelected} />`}
        >
          <Combobox multiple label="Tags do endpoint" options={tagOptions} value={tags} onValueChange={setTags} placeholder="Adicionar tag…" hint="Ajudam a agrupar endpoints na navegação." className="dsp-combobox-demo" />
        </Specimen>
        <Specimen
          title="MarkdownEditor"
          description="Barra de formatação no padrão toolbar (um único Tab, setas entre os botões), atalhos de teclado e pré-visualização com o mesmo renderizador da documentação."
          layout="stack"
          keyboard={keys.editor}
          code={`<MarkdownEditor label="Conteúdo da página" value={source} onChange={setSource} />`}
        >
          <MarkdownEditor label="Conteúdo da página" value={page} onChange={setPage} hint="Títulos ## viram itens do sumário da página." />
        </Specimen>
      </Section>
    </>
  );
}
