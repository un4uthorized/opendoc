const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

/** "há 3 dias", "ontem", "agora". */
export function timeAgo(iso: string | undefined) {
  if (!iso) return '—';
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [['year', 31_536_000], ['month', 2_592_000], ['day', 86_400], ['hour', 3_600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'agora';
}

export function formatDate(iso: string | undefined) {
  return iso ? absolute.format(new Date(iso)) : '—';
}

/** "Minha API" → "minha-api". */
export function slugify(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function plural(count: number, one: string, many: string) {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? one : many}`;
}
