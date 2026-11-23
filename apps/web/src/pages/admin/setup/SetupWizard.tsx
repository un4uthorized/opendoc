import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Building2, Check, ClipboardPaste, Clock, FileCode2, FolderPlus, Globe, Lock, Rocket, Sparkles, Upload } from 'lucide-react';
import {
  Alert, Button, FileDropzone, Switch, TextField, Textarea,
} from '../../../design-system';
import { authApi } from '../../../auth/api';
import { AuthShell, StepLayout } from '../../login/LoginPage';
import { adminApi, errorMessage, sampleSpec, useAdminState } from '../data/store';
import { checkSpec } from '../data/spec';
import type { Visibility } from '../data/types';
import { plural, slugify } from '../format';
import { slugError } from '../NewProjectDialog';
import { OptionCards } from '../OptionCards';
import { navigate, projectPath } from '../router';
import './setup.css';

type SpecSource = 'file' | 'paste' | 'sample' | 'later';

const steps = [
  { key: 'organization', label: 'Organização', icon: Building2 },
  { key: 'project', label: 'Projeto', icon: FolderPlus },
  { key: 'spec', label: 'API', icon: FileCode2 },
  { key: 'review', label: 'Publicar', icon: Rocket },
] as const;

/** The organization name the server starts with: shown empty, so it is replaced by the real one. */
const placeholderOrgName = 'OpenDoc';

/**
 * First run of the admin (no projects yet): names the organization, creates the first project,
 * brings in its OpenAPI spec and optionally publishes it, one step at a time. Nothing is saved
 * until the last step, so going back and forth is free.
 */
export function SetupWizard() {
  const { organization } = useAdminState();
  const [step, setStep] = useState(0);

  const [orgName, setOrgName] = useState(organization.name === placeholderOrgName ? '' : organization.name);
  const [orgLabel, setOrgLabel] = useState(organization.branding.label ?? 'API');

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');

  const [source, setSource] = useState<SpecSource>('file');
  const [files, setFiles] = useState<File[]>([]);
  const [fileText, setFileText] = useState('');
  const [pasted, setPasted] = useState('');
  const [publishNow, setPublishNow] = useState(true);

  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => { document.title = 'Configuração inicial · Admin'; }, []);

  // The chosen file is read as text as soon as it is dropped.
  useEffect(() => {
    const file = files[0];
    if (!file) { setFileText(''); return; }
    file.text().then(setFileText).catch(() => setFileText(''));
  }, [files]);

  const specText = source === 'file' ? fileText : source === 'paste' ? pasted : source === 'sample' ? sampleSpec() : '';
  const check = checkSpec(specText);
  const canPublish = check.status === 'valid';

  const errors = {
    orgName: !orgName.trim() ? 'Informe o nome da organização.' : undefined,
    name: !name.trim() ? 'Informe o nome do projeto.' : undefined,
    slug: slugError(slug),
    spec: (source === 'file' || source === 'paste') && check.status !== 'valid'
      ? (check.status === 'empty' ? (source === 'file' ? 'Escolha o arquivo da spec.' : 'Cole a spec.') : `${check.message}${check.line ? ` (linha ${check.line})` : ''}`)
      : undefined,
  };
  const stepErrors = [[errors.orgName], [errors.name, errors.slug], [errors.spec], []][step]!.filter(Boolean);

  const next = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (stepErrors.length) return;
    setSubmitted(false);
    setError(undefined);
    if (step < steps.length - 1) setStep(step + 1);
    else void finish();
  };
  const back = () => { setSubmitted(false); setError(undefined); setStep(Math.max(0, step - 1)); };

  const finish = async () => {
    setBusy(true);
    try {
      if (orgName.trim() !== organization.name || orgLabel.trim() !== (organization.branding.label ?? '')) {
        await adminApi.updateOrganization({
          name: orgName.trim(),
          branding: { ...organization.branding, name: orgName.trim(), label: orgLabel.trim() || undefined },
        });
      }
      const project = await adminApi.createProject({
        name: name.trim(), slug, description: description.trim() || undefined, visibility,
        sample: source === 'sample', draft: source === 'file' || source === 'paste' ? specText : undefined,
      });
      if (publishNow && canPublish && source !== 'later') await adminApi.publish(project.id, project.defaultVersionId, specText);
      // The admin shows the project as soon as the state has it; land on its page.
      navigate(projectPath(project.slug, source === 'later' ? 'spec' : 'overview'));
    } catch (failure) {
      setError(errorMessage(failure));
      // The address is the usual conflict: send the person back to fix it.
      if (/endereço/i.test(errorMessage(failure))) setStep(1);
      setBusy(false);
    }
  };

  const signOut = async () => {
    await authApi.logout().catch(() => {});
    window.location.replace('/');
  };

  const current = steps[step]!;
  return (
    <AuthShell wide>
      <StepLayout compact icon={current.icon} eyebrow={`Configuração inicial · ${step + 1} de ${steps.length}`} title={titles[current.key]} description={descriptions[current.key]}>
        <Stepper step={step} />
        <form className="login__form setup" onSubmit={next} noValidate>
          {error && <Alert variant="destructive" role="alert">{error}</Alert>}

          {current.key === 'organization' && (
            <>
              <TextField label="Nome da organização" size="lg" placeholder="Acme" value={orgName} autoFocus
                error={submitted ? errors.orgName : undefined} onChange={(event) => setOrgName(event.target.value)} />
              <TextField label="Rótulo" size="lg" placeholder="API" hint="Aparece depois do nome no topo da documentação: “Acme API”, “Acme Developers”."
                value={orgLabel} onChange={(event) => setOrgLabel(event.target.value)} />
            </>
          )}

          {current.key === 'project' && (
            <>
              <TextField label="Nome do projeto" size="lg" placeholder="Pagamentos" value={name} autoFocus
                error={submitted ? errors.name : undefined}
                onChange={(event) => { setName(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value)); }} />
              <TextField label="Endereço" size="lg" prefix="/docs/" value={slug}
                error={submitted || slugEdited ? errors.slug : undefined} hint="Usado no link da documentação."
                onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }} />
              <Textarea label="Descrição" hint="Opcional." rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
              <OptionCards legend="Quem pode ler a documentação" value={visibility} onChange={setVisibility} options={[
                { value: 'private', icon: Lock, label: 'Só quem tem acesso', description: 'Pessoas que você convidar, depois de entrar.' },
                { value: 'public', icon: Globe, label: 'Qualquer pessoa com o link', description: 'Sem login. Rascunhos nunca aparecem.' },
              ]} />
            </>
          )}

          {current.key === 'spec' && (
            <>
              <OptionCards legend="Como você quer trazer a spec OpenAPI" value={source} onChange={(value) => { setSource(value); setSubmitted(false); }} options={[
                { value: 'file', icon: Upload, label: 'Enviar arquivo', description: 'YAML ou JSON, OpenAPI 3.' },
                { value: 'paste', icon: ClipboardPaste, label: 'Colar o conteúdo', description: 'Direto do seu editor.' },
                { value: 'sample', icon: Sparkles, label: 'API de exemplo', description: 'Para conhecer antes de trazer a sua.' },
                { value: 'later', icon: Clock, label: 'Fazer depois', description: 'Começa vazio; a spec vem no editor.' },
              ]} />
              {source === 'file' && (
                <FileDropzone label="Arquivo da spec" accept=".json,.yaml,.yml" maxSize={5_000_000} files={files} onFilesChange={setFiles}
                  error={submitted && errors.spec ? errors.spec : undefined} />
              )}
              {source === 'paste' && (
                <Textarea label="Spec" rows={8} className="setup__code" placeholder={'openapi: 3.1.0\ninfo:\n  title: Minha API\n  version: 1.0.0\npaths: {}'}
                  value={pasted} onChange={(event) => setPasted(event.target.value)} error={submitted ? errors.spec : undefined} spellCheck={false} />
              )}
              {(source === 'file' || source === 'paste') && <SpecStatus text={specText} />}
            </>
          )}

          {current.key === 'review' && (
            <>
              <dl className="setup__summary">
                <SummaryRow label="Organização" value={[orgName.trim(), orgLabel.trim()].filter(Boolean).join(' ')} onEdit={() => setStep(0)} />
                <SummaryRow label="Projeto" value={<>{name.trim()} <code>/docs/{slug}</code></>} onEdit={() => setStep(1)} />
                <SummaryRow label="Leitura" value={visibility === 'public' ? 'Qualquer pessoa com o link' : 'Só quem tem acesso'} onEdit={() => setStep(1)} />
                <SummaryRow label="Spec" onEdit={() => setStep(2)} value={source === 'later'
                  ? 'Depois, no editor'
                  : check.status === 'valid' ? `${check.summary.title || 'Sem título'} · ${plural(check.summary.endpoints, 'endpoint', 'endpoints')}` : 'Inválida'} />
              </dl>
              {source !== 'later' && (
                <Switch label="Publicar a v1 agora" checked={publishNow && canPublish} disabled={!canPublish} onCheckedChange={setPublishNow}
                  description={publishNow ? 'A documentação fica no ar ao concluir.' : 'A spec fica como rascunho para você revisar antes.'} />
              )}
            </>
          )}

          <Button type="submit" size="lg" loading={busy} fullWidth iconEnd={step === steps.length - 1 ? <Check aria-hidden="true" /> : undefined}>
            {step === steps.length - 1 ? 'Concluir configuração' : 'Continuar'}
          </Button>
          <div className="login__links">
            {step > 0
              ? <Button type="button" variant="link" size="sm" onClick={back} iconStart={<ArrowLeft aria-hidden="true" />}>Voltar</Button>
              : <span />}
            <Button type="button" variant="link" size="sm" onClick={signOut}>Sair</Button>
          </div>
        </form>
      </StepLayout>
    </AuthShell>
  );
}

const titles: Record<(typeof steps)[number]['key'], string> = {
  organization: 'Vamos configurar',
  project: 'Primeiro projeto',
  spec: 'Spec da API',
  review: 'Tudo pronto?',
};
const descriptions: Record<(typeof steps)[number]['key'], string> = {
  organization: 'Comece pelo nome da sua organização. Ele aparece no topo da documentação.',
  project: 'Cada projeto é uma documentação, com sua spec, páginas e pessoas.',
  spec: 'A referência é gerada a partir da spec OpenAPI. Dá para editar tudo depois.',
  review: 'Confira antes de criar. Nada foi salvo ainda.',
};

function Stepper({ step }: { step: number }) {
  return (
    <ol className="setup-stepper" aria-label="Etapas">
      {steps.map((item, index) => (
        <li key={item.key} className={index < step ? 'is-done' : index === step ? 'is-current' : undefined} aria-current={index === step ? 'step' : undefined}>
          <span className="setup-stepper__dot" aria-hidden="true">{index < step ? <Check /> : index + 1}</span>
          <span className="setup-stepper__label">{item.label}</span>
        </li>
      ))}
    </ol>
  );
}

function SpecStatus({ text }: { text: string }) {
  const check = checkSpec(text);
  if (check.status === 'empty') return null;
  if (check.status === 'invalid') return null;
  return (
    <Alert variant="success" title={check.summary.title || 'Spec válida'}>
      OpenAPI {check.summary.openapi} · {plural(check.summary.endpoints, 'endpoint', 'endpoints')} · {plural(check.summary.schemas, 'modelo', 'modelos')}
      {check.warnings > 0 && ` · ${check.warnings} aviso${check.warnings > 1 ? 's' : ''}`}
    </Alert>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: ReactNode; onEdit: () => void }) {
  return (
    <div className="setup__summary-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>Alterar</Button>
    </div>
  );
}
