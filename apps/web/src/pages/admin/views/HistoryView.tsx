import { useState } from 'react';
import { Braces, FileText, History, RotateCcw, Rocket, Settings, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, EmptyState, ToggleGroup, ToggleGroupItem,
} from '../../../design-system';
import { adminApi, useAdminState } from '../data/store';
import type { Activity, ActivityKind, Project } from '../data/types';
import { formatDate } from '../format';
import { PageHeader, useAction } from '../parts';
import { navigate, projectPath } from '../router';

const kindLabels: Record<ActivityKind, string> = { spec: 'Spec', content: 'Conteúdo', access: 'Acesso', settings: 'Configurações' };
const kindIcons: Record<ActivityKind, ReactNode> = { spec: <Braces />, content: <FileText />, access: <Users />, settings: <Settings /> };
const dayFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const dayWithYearFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "Hoje", "Ontem", "sexta-feira, 20 de novembro" (with the year when it isn't this year). */
function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  const label = date.getFullYear() === today.getFullYear() ? dayFormat.format(date) : dayWithYearFormat.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function HistoryView({ project }: { project: Project }) {
  const { activity, users } = useAdminState();
  const [filter, setFilter] = useState<ActivityKind | 'all'>('all');
  const [restoring, setRestoring] = useState<Activity | null>(null);
  const { run } = useAction();

  const entries = activity.filter((entry) => entry.projectId === project.id && (filter === 'all' || entry.kind === filter));
  const days = entries.reduce<Array<{ label: string; entries: Activity[] }>>((groups, entry) => {
    const label = dayLabel(entry.at);
    const last = groups.at(-1);
    if (last?.label === label) last.entries.push(entry); else groups.push({ label, entries: [entry] });
    return groups;
  }, []);

  return (
    <div className="admin-page">
      <PageHeader
        title="Histórico"
        description="Quem mudou o quê neste projeto. Publicações guardam a spec que foi ao ar e podem ser restauradas."
        actions={(
          <ToggleGroup type="single" value={filter} onValueChange={(value) => value && setFilter(value as ActivityKind | 'all')} aria-label="Filtrar por tipo">
            <ToggleGroupItem value="all" size="sm">Tudo</ToggleGroupItem>
            {(Object.keys(kindLabels) as ActivityKind[]).map((kind) => <ToggleGroupItem key={kind} value={kind} size="sm">{kindLabels[kind]}</ToggleGroupItem>)}
          </ToggleGroup>
        )}
      />

      {days.length === 0 ? (
        <EmptyState icon={<History />} titleAs="h2" title="Nada por aqui" description={filter === 'all' ? 'As mudanças neste projeto aparecem aqui.' : `Nenhuma mudança do tipo ${kindLabels[filter].toLowerCase()}.`} />
      ) : (
        <div className="admin-timeline">
          {days.map((day) => (
            <section key={day.label} className="admin-timeline__day" aria-label={day.label}>
              <h2 className="admin-timeline__day-title">{day.label}</h2>
              <ol className="admin-timeline__list">
                {day.entries.map((entry) => {
                  const name = users.find((item) => item.id === entry.userId)?.name ?? 'Conta removida';
                  const published = Boolean(entry.snapshot);
                  return (
                    <li key={entry.id} className="admin-timeline__item">
                      <span className={published ? 'admin-timeline__node admin-timeline__node--published' : 'admin-timeline__node'} aria-hidden="true">
                        {published ? <Rocket /> : kindIcons[entry.kind]}
                      </span>
                      {/* The event as a card: its text and its action (restore) stay together. */}
                      <div className="admin-timeline__card">
                      <div className="admin-timeline__body">
                        <p className="admin-timeline__text"><strong>{name}</strong> {entry.message}</p>
                        <p className="admin-timeline__meta">
                          <time dateTime={entry.at} title={formatDate(entry.at)}>{timeFormat.format(new Date(entry.at))}</time>
                          <span aria-hidden="true">·</span>
                          <span>{kindLabels[entry.kind]}</span>
                        </p>
                      </div>
                      {entry.snapshot && (
                        <Button variant="outline" size="sm" iconStart={<RotateCcw />} className="admin-timeline__action" onClick={() => setRestoring(entry)} aria-label={`Restaurar a ${entry.snapshot.versionName} publicada em ${formatDate(entry.at)}`}>
                          Restaurar
                        </Button>
                      )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      <AlertDialog open={restoring !== null} onOpenChange={(open) => { if (!open) setRestoring(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar a {restoring?.snapshot?.versionName} de {restoring ? formatDate(restoring.at) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              A spec publicada naquele momento vira o rascunho da versão, substituindo o rascunho atual. Nada muda na documentação até você publicar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!restoring?.snapshot) return;
              const { versionId } = restoring.snapshot;
              if (await run(() => adminApi.restoreSnapshot(project.id, restoring.id), 'Restaurado como rascunho')) navigate(`${projectPath(project.slug, 'spec')}?versao=${versionId}`);
            }}>
              Restaurar como rascunho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
