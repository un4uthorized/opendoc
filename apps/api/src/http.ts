import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  status: number;
  code?: string;
  /** Seconds, sent as Retry-After (429). */
  retryAfter?: number;
  constructor(status: number, message: string, code?: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export const notFound = (what = 'Recurso') => new HttpError(404, `${what} não encontrado.`);
export const forbidden = () => new HttpError(403, 'Você não tem permissão para isso.');

/** Express 5 forwards rejected promises to the error handler; this only fixes the types. */
export const route = (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler => handler;

/** Validates input against a schema; the first problem becomes a 400 with a readable message. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue?.path.join('.');
  throw new HttpError(400, field ? `${field}: ${issue?.message}` : (issue?.message ?? 'Dados inválidos.'), 'VALIDATION');
}

/** Unique-constraint names → messages the admin can act on. */
const conflicts: Record<string, string> = {
  projects_slug_key: 'Já existe um projeto com esse endereço.',
  versions_project_id_name_key: 'Já existe uma versão com esse nome.',
  pages_project_id_slug_key: 'Já existe uma página com esse endereço.',
  users_email_key: 'Já existe uma conta com esse e-mail.',
  invitations_project_id_email_key: 'Já existe um convite para esse e-mail.',
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
    res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
    return;
  }
  const pgError = error as { code?: string; constraint?: string };
  if (pgError.code === '23505') {
    res.status(409).json({ error: conflicts[pgError.constraint ?? ''] ?? 'Esse registro já existe.', code: 'CONFLICT' });
    return;
  }
  // body-parser errors (invalid JSON, body too large) carry their own status.
  const status = (error as { status?: number }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: status === 413 ? 'O conteúdo enviado é grande demais.' : 'Requisição inválida.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Erro interno. Tente de novo.' });
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A route param that must be a UUID; anything else can't exist, so it's a 404. */
export function idParam(req: Request, name: string, what?: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw notFound(what);
  return value.toLowerCase();
}
