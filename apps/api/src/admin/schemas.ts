import { z } from 'zod';

/** Paths under /admin that can't be project slugs (apps/web/src/pages/admin/data/types.ts). */
const reservedSlugs = new Set(['org', 'novo', 'conta']);

export const slug = z.string().trim().toLowerCase().min(1).max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens.');
export const projectSlug = slug.refine((value) => !reservedSlugs.has(value), 'Esse endereço é reservado.');

/** Logos are links or uploaded images (data URLs); nothing that can run script in a page. */
const image = z.string().max(2_000_000).refine(
  (value) => /^(https?:\/\/|\/(?!\/))/.test(value) || /^data:image\/(png|jpeg|webp|gif|svg\+xml|avif);base64,[A-Za-z0-9+/=]+$/.test(value),
  'Imagem inválida.',
);
const imagePair = z.object({ light: image.optional(), dark: image.optional() }).strict();

export const branding = z.object({
  name: z.string().trim().min(1).max(80),
  label: z.string().trim().max(40).optional(),
  logo: imagePair.optional(),
  symbol: imagePair.optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor hexadecimal (#RRGGBB).').optional(),
}).strict();

export const role = z.enum(['admin', 'editor', 'viewer']);
export const visibility = z.enum(['public', 'private']);
/** Specs are YAML/JSON text; kept as typed by the editor. */
export const specText = z.string().max(5_000_000);
const uuid = z.uuid();

export const organizationPatch = z.object({ name: z.string().trim().min(1).max(80).optional(), branding: branding.optional() }).strict();

export const projectCreate = z.object({
  name: z.string().trim().min(1).max(120),
  slug: projectSlug,
  description: z.string().trim().max(500).optional(),
  visibility,
  /** Starting draft of v1 (the web app sends the sample spec when asked). */
  draft: specText.optional(),
}).strict();

export const projectPatch = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slug: projectSlug.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  visibility: visibility.optional(),
  playground: z.boolean().optional(),
  defaultVersionId: uuid.optional(),
  branding: branding.nullable().optional(),
}).strict();

export const versionCreate = z.object({
  name: z.string().trim().min(1).max(40).regex(/^[\w.-]+$/, 'Use letras, números, ponto, hífen ou sublinhado.'),
  copyFrom: uuid.optional(),
}).strict();

export const navigation = z.object({
  order: z.array(z.string().max(200)).max(500),
  labels: z.record(z.string().max(200), z.string().max(200)),
  hidden: z.array(z.string().max(300)).max(1000),
}).strict();

export const page = z.object({
  title: z.string().trim().min(1).max(200),
  slug,
  body: z.string().max(1_000_000),
}).strict();

export const invite = z.object({
  emails: z.array(z.string().trim().toLowerCase().max(254).pipe(z.email('E-mail inválido.'))).min(1).max(50),
  role,
}).strict();

export const userIds = z.object({ userIds: z.array(uuid).min(1).max(200) }).strict();
