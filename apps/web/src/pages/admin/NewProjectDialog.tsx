import { useEffect, useState, type FormEvent } from 'react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, TextField, Textarea,
} from '../../design-system';
import { FileCode2, Globe, Lock, Sparkles } from 'lucide-react';
import { adminApi } from './data/store';
import { reservedSlugs, type Visibility } from './data/types';
import { slugify, slugPattern } from './format';
import { OptionCards } from './OptionCards';
import { useAction } from './parts';
import { navigate, projectPath } from './router';

export function slugError(slug: string) {
  if (!slug) return 'Informe o endereço.';
  if (!slugPattern.test(slug)) return 'Use letras minúsculas, números e hífens.';
  if (reservedSlugs.has(slug)) return 'Esse endereço é reservado.';
  return undefined;
}

export function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [start, setStart] = useState<'empty' | 'sample'>('empty');
  const [submitted, setSubmitted] = useState(false);
  const { pending, run } = useAction();

  useEffect(() => {
    if (!open) return;
    setName(''); setSlug(''); setSlugEdited(false); setDescription(''); setVisibility('private'); setStart('empty'); setSubmitted(false);
  }, [open]);

  const nameError = submitted && !name.trim() ? 'Informe o nome.' : undefined;
  const currentSlugError = submitted || slugEdited ? slugError(slug) : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!name.trim() || slugError(slug)) return;
    const project = await run(
      () => adminApi.createProject({ name: name.trim(), slug, description: description.trim() || undefined, visibility, sample: start === 'sample' }),
      (created) => `Projeto “${created.name}” criado`,
    );
    if (project) {
      onOpenChange(false);
      navigate(projectPath(project.slug, 'spec'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-dialog">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>Cada projeto tem a própria spec, páginas, aparência e membros.</DialogDescription>
          </DialogHeader>
          <div className="admin-form">
            <TextField
              label="Nome"
              value={name}
              required
              autoFocus
              error={nameError}
              onChange={(event) => { setName(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value)); }}
            />
            <TextField
              label="Endereço"
              value={slug}
              required
              prefix="/docs/"
              error={currentSlugError}
              hint={currentSlugError ? undefined : 'Usado na URL da documentação.'}
              onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }}
            />
            <Textarea label="Descrição" hint="Opcional. Aparece no portal de projetos." rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
            <OptionCards legend="Visibilidade" value={visibility} onChange={setVisibility} options={[
              { value: 'private', icon: Lock, label: 'Privada', description: 'Só quem tem acesso, depois de entrar.' },
              { value: 'public', icon: Globe, label: 'Pública', description: 'Qualquer pessoa com o link.' },
            ]} />
            <OptionCards legend="Começar com" value={start} onChange={setStart} options={[
              { value: 'empty', icon: FileCode2, label: 'Minha spec', description: 'Você importa o arquivo OpenAPI em seguida.' },
              { value: 'sample', icon: Sparkles, label: 'Spec de exemplo', description: 'Uma API completa para explorar.' },
            ]} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={pending}>Criar projeto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
