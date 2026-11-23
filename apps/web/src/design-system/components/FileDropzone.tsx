import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { cx } from '../cx';
import { Button } from './Button';
import { IconButton } from './IconButton';

export interface FileDropzoneProps {
  label: string;
  /** e.g. ".json,.yaml,.yml" or "image/*" */
  accept?: string;
  /** Bytes. */
  maxSize?: number;
  multiple?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0).replace('.', ',')} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function accepts(file: File, accept?: string) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept.split(',').map((rule) => rule.trim().toLowerCase()).some((rule) => (
    rule.startsWith('.') ? name.endsWith(rule)
      : rule.endsWith('/*') ? file.type.startsWith(rule.slice(0, -1))
        : file.type === rule
  ));
}

/**
 * Drag-and-drop area with a real "choose file" button, so it works by keyboard and screen reader.
 * Validates type and size, lists the chosen files with remove buttons and announces changes.
 */
export function FileDropzone({ label, accept, maxSize, multiple = false, files, onFilesChange, hint, error, disabled, className }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();
  const [dragging, setDragging] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const shownError = error ?? rejection;

  const take = (list: FileList | null) => {
    if (!list || disabled) return;
    const incoming = Array.from(list);
    const wrongType = incoming.filter((file) => !accepts(file, accept));
    const tooBig = incoming.filter((file) => maxSize !== undefined && file.size > maxSize);
    const valid = incoming.filter((file) => !wrongType.includes(file) && !tooBig.includes(file));
    if (wrongType.length) setRejection(`${wrongType[0]!.name} não é um formato aceito.`);
    else if (tooBig.length) setRejection(`${tooBig[0]!.name} passa do limite de ${formatBytes(maxSize!)}.`);
    else setRejection(null);
    if (valid.length === 0) return;
    const next = multiple ? [...files, ...valid] : valid.slice(0, 1);
    onFilesChange(next);
    setAnnouncement(valid.length === 1 ? `Arquivo ${valid[0]!.name} selecionado.` : `${valid.length} arquivos selecionados.`);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    take(event.dataTransfer.files);
  };

  const remove = (file: File) => {
    onFilesChange(files.filter((item) => item !== file));
    setAnnouncement(`Arquivo ${file.name} removido.`);
    browseRef.current?.focus();
  };

  const described = [hint ? hintId : null, shownError ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('ds-field', 'ds-dropzone-field', className)} role="group" aria-labelledby={labelId} aria-describedby={described}>
      <p id={labelId} className="ds-field__label">{label}</p>
      <div
        className={cx('ds-dropzone', dragging && 'is-dragging', Boolean(shownError) && 'is-invalid', disabled && 'is-disabled')}
        onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={onDrop}
      >
        <span className="ds-dropzone__icon" aria-hidden="true"><Upload /></span>
        <p className="ds-dropzone__text">
          <span className="ds-dropzone__drag">Arraste {multiple ? 'os arquivos' : 'o arquivo'} para cá ou </span>
          <Button ref={browseRef} variant="link" size="sm" className="ds-dropzone__browse" onClick={() => inputRef.current?.click()} disabled={disabled}>
            escolha {multiple ? 'arquivos' : 'um arquivo'}
          </Button>
        </p>
        {hint && <p id={hintId} className="ds-dropzone__hint">{hint}</p>}
        <input
          ref={inputRef}
          type="file"
          className="ds-sr-only"
          tabIndex={-1}
          aria-hidden="true"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => { take(event.target.files); event.target.value = ''; }}
        />
      </div>
      {shownError && <p id={errorId} className="ds-field__message ds-field__message--error">{shownError}</p>}
      {files.length > 0 && (
        <ul className="ds-dropzone__files" aria-label="Arquivos selecionados">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`} className="ds-dropzone__file">
              <span className="ds-dropzone__file-icon" aria-hidden="true"><FileText /></span>
              <span className="ds-dropzone__file-text">
                <span className="ds-dropzone__file-name">{file.name}</span>
                <span className="ds-dropzone__file-size">{formatBytes(file.size)}</span>
              </span>
              <IconButton icon={<X />} aria-label={`Remover ${file.name}`} size="sm" onClick={() => remove(file)} />
            </li>
          ))}
        </ul>
      )}
      <p className="ds-sr-only" role="status" aria-live="polite">{announcement}</p>
    </div>
  );
}
