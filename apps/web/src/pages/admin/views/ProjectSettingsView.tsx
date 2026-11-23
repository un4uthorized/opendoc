import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, RadioGroup, RadioGroupItem, Switch, TextField, Textarea,
} from '../../../design-system';
import { adminApi } from '../data/store';
import type { Project, Visibility } from '../data/types';
import { slugError } from '../NewProjectDialog';
import { PageHeader, SettingsSection, useAction } from '../parts';
import { adminPaths, navigate, projectPath } from '../router';

export function ProjectSettingsView({ project }: { project: Project }) {
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);
  const [description, setDescription] = useState(project.description ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const general = useAction();
  const quick = useAction();

  useEffect(() => { setName(project.name); setSlug(project.slug); setDescription(project.description ?? ''); }, [project.name, project.slug, project.description]);

  const generalDirty = name !== project.name || slug !== project.slug || description !== (project.description ?? '');
  const currentSlugError = slug !== project.slug ? slugError(slug) : undefined;

  const saveGeneral = async () => {
    if (!name.trim() || currentSlugError) return;
    const saved = await general.run(() => adminApi.updateProject(project.id, { name: name.trim(), slug, description: description.trim() || undefined }), 'Projeto salvo');
    if (saved && saved.slug !== project.slug) navigate(projectPath(saved.slug, 'settings'), { replace: true });
  };

  return (
    <div className="admin-page">
      <PageHeader title="Configurações" description={`Ajustes de ${project.name}.`} />

      <SettingsSection
        title="Geral"
        description="Mudar o endereço quebra links antigos para a documentação."
        footer={<Button disabled={!generalDirty || !name.trim() || Boolean(currentSlugError)} loading={general.pending} onClick={saveGeneral}>Salvar</Button>}
      >
        <div className="admin-form">
          <TextField label="Nome" value={name} required error={!name.trim() ? 'Informe o nome.' : undefined} onChange={(event) => setName(event.target.value)} />
          <TextField label="Endereço" prefix="/docs/" value={slug} required error={currentSlugError} onChange={(event) => setSlug(event.target.value.toLowerCase())} />
          <Textarea label="Descrição" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
      </SettingsSection>

      <SettingsSection title="Visibilidade" description="Vale para a documentação publicada. O admin continua restrito.">
        <RadioGroup
          aria-label="Visibilidade"
          value={project.visibility}
          disabled={quick.pending}
          onValueChange={(value) => quick.run(() => adminApi.updateProject(project.id, { visibility: value as Visibility }), value === 'public' ? 'Documentação agora é pública' : 'Documentação agora é privada')}
        >
          <RadioGroupItem value="private" label="Privada" description="Só quem faz login e tem acesso ao projeto." />
          <RadioGroupItem value="public" label="Pública" description="Qualquer pessoa com o link, sem login." />
        </RadioGroup>
      </SettingsSection>

      <SettingsSection title="Cliente de teste" description="O painel “Testar requisição” ao lado de cada endpoint.">
        <Switch
          label="Mostrar o cliente de teste"
          description="Leitores enviam requisições reais para os servidores da spec, direto do navegador."
          checked={project.playground}
          disabled={quick.pending}
          onCheckedChange={(playground) => quick.run(() => adminApi.updateProject(project.id, { playground }), playground ? 'Cliente de teste ligado' : 'Cliente de teste desligado')}
        />
      </SettingsSection>

      <SettingsSection title="Excluir projeto" description="Tira a documentação do ar e apaga as versões, as páginas e os acessos. Não dá para desfazer." tone="danger">
        <div><Button variant="destructive" iconStart={<Trash2 />} onClick={() => { setConfirmName(''); setConfirmDelete(true); }}>Excluir projeto</Button></div>
      </SettingsSection>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {project.versions.length} {project.versions.length === 1 ? 'versão' : 'versões'} e {project.pages.length} {project.pages.length === 1 ? 'página' : 'páginas'} serão apagadas, e a documentação sai do ar. Digite o nome do projeto para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <TextField label="Nome do projeto" value={confirmName} onChange={(event) => setConfirmName(event.target.value)} autoComplete="off" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={confirmName !== project.name}
              onClick={async () => {
                const done = await quick.run(() => adminApi.deleteProject(project.id), `Projeto ${project.name} excluído`);
                if (done) navigate(adminPaths.projects, { replace: true });
              }}
            >
              Excluir para sempre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
