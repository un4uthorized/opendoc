import { useEffect, useId, useState } from 'react';
import { Button, Card, CardContent, CardHeader, TextField } from '../../../design-system';
import { OpenDocLogo } from '../../../brand/OpenDocLogo';
import { adminApi, useAdminState } from '../data/store';
import { isHttpUrl, type Branding, type ImagePair, type Project } from '../data/types';
import { PageHeader, SettingsSection, useAction } from '../parts';

const hexPattern = /^#[0-9a-f]{6}$/i;

/** One image (light or dark variant), by link only: nothing is uploaded or stored here. */
function ImageSlot({ label, value, onChange, dark }: { label: string; value?: string; onChange: (value: string | undefined) => void; dark?: boolean }) {
  const id = useId();
  const [link, setLink] = useState(value ?? '');
  const [broken, setBroken] = useState(false);
  useEffect(() => { setLink(value ?? ''); setBroken(false); }, [value]);
  const trimmed = link.trim();
  const linkError = trimmed && !isHttpUrl(trimmed)
    ? 'Use um link completo, como https://empresa.com/logo.svg.'
    : broken ? 'Não foi possível carregar a imagem desse link.' : undefined;
  return (
    <div className="admin-image-slot" role="group" aria-labelledby={id}>
      <span id={id} className="ds-label">{label}</span>
      <div className={dark ? 'admin-image-slot__preview admin-image-slot__preview--dark' : 'admin-image-slot__preview'}>
        {value && !broken ? <img src={value} alt={`Prévia: ${label}`} onError={() => setBroken(true)} /> : <span className="admin-muted">Nenhuma</span>}
      </div>
      <TextField
        label="Link da imagem"
        type="url"
        inputMode="url"
        placeholder="https://empresa.com/logo.svg"
        value={link}
        error={linkError}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => {
          const next = event.target.value;
          setLink(next);
          if (isHttpUrl(next.trim())) onChange(next.trim());
          else if (!next.trim()) onChange(undefined);
        }}
      />
    </div>
  );
}

/** Each theme keeps its own link (one may be empty); the docs fall back to the other one. */
function setPair(pair: ImagePair | undefined, key: 'light' | 'dark', value: string | undefined): ImagePair | undefined {
  const next: ImagePair = { ...pair, [key]: value };
  if (!next.light && !next.dark) return undefined;
  return { ...(next.light ? { light: next.light } : {}), ...(next.dark ? { dark: next.dark } : {}) };
}

/** What the docs header will show, following the fallback chain. */
function BrandPreview({ branding }: { branding: Branding }) {
  const variants: Array<{ theme: 'light' | 'dark'; label: string }> = [{ theme: 'light', label: 'Tema claro' }, { theme: 'dark', label: 'Tema escuro' }];
  return (
    <div className="admin-brand-preview">
      {variants.map(({ theme, label }) => {
        const logo = theme === 'dark' ? branding.logo?.dark ?? branding.logo?.light : branding.logo?.light ?? branding.logo?.dark;
        const symbol = theme === 'dark' ? branding.symbol?.dark ?? branding.symbol?.light : branding.symbol?.light ?? branding.symbol?.dark;
        return (
          <figure key={theme} className="admin-brand-preview__frame" data-preview-theme={theme}>
            <div className="admin-brand-preview__bar" style={branding.accent ? { borderBottomColor: branding.accent } : undefined}>
              {logo ? <img src={logo} alt="" className="admin-brand-preview__logo" /> : (
                <>
                  {symbol ? <img src={symbol} alt="" className="admin-brand-preview__symbol" /> : <OpenDocLogo size={22} decorative />}
                  <span className="admin-brand-preview__name">{branding.name || 'Sem nome'}</span>
                </>
              )}
              {branding.label && <span className="admin-brand-preview__label">{branding.label}</span>}
            </div>
            <figcaption>{label}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function BrandingFields({ value, onChange }: { value: Branding; onChange: (value: Branding) => void }) {
  const [accentText, setAccentText] = useState(value.accent ?? '');
  useEffect(() => { setAccentText(value.accent ?? ''); }, [value.accent]);
  const accentError = accentText && !hexPattern.test(accentText) ? 'Use o formato #RRGGBB.' : undefined;
  return (
    <>
      <SettingsSection title="Nome" description="Aparece no topo da documentação quando não há logo completo.">
        <div className="admin-form admin-form--row">
          <TextField label="Nome" value={value.name} required onChange={(event) => onChange({ ...value, name: event.target.value })} />
          <TextField label="Rótulo" hint="Ex.: API, Docs, Developers." value={value.label ?? ''} onChange={(event) => onChange({ ...value, label: event.target.value || undefined })} />
        </div>
      </SettingsSection>
      <SettingsSection title="Logo completo" description="Símbolo e nome juntos. Substitui o nome em texto.">
        <div className="admin-image-row">
          <ImageSlot label="Logo para tema claro" value={value.logo?.light} onChange={(next) => onChange({ ...value, logo: setPair(value.logo, 'light', next) })} />
          <ImageSlot label="Logo para tema escuro" dark value={value.logo?.dark} onChange={(next) => onChange({ ...value, logo: setPair(value.logo, 'dark', next) })} />
        </div>
      </SettingsSection>
      <SettingsSection title="Símbolo" description="Aparece antes do nome e vira o favicon. Sem símbolo, fica o do OpenDoc.">
        <div className="admin-image-row">
          <ImageSlot label="Símbolo para tema claro" value={value.symbol?.light} onChange={(next) => onChange({ ...value, symbol: setPair(value.symbol, 'light', next) })} />
          <ImageSlot label="Símbolo para tema escuro" dark value={value.symbol?.dark} onChange={(next) => onChange({ ...value, symbol: setPair(value.symbol, 'dark', next) })} />
        </div>
      </SettingsSection>
      <SettingsSection title="Cor de destaque" description="Usada em links, botões principais e no item atual da navegação.">
        <div className="admin-inline-form">
          <input
            type="color"
            className="admin-color-input"
            aria-label="Escolher cor de destaque"
            value={hexPattern.test(accentText) ? accentText : '#2563eb'}
            onChange={(event) => { setAccentText(event.target.value); onChange({ ...value, accent: event.target.value }); }}
          />
          <TextField
            label="Hexadecimal"
            placeholder="#2563eb"
            value={accentText}
            error={accentError}
            onChange={(event) => {
              setAccentText(event.target.value);
              if (!event.target.value) onChange({ ...value, accent: undefined });
              else if (hexPattern.test(event.target.value)) onChange({ ...value, accent: event.target.value });
            }}
          />
        </div>
      </SettingsSection>
    </>
  );
}

export function SaveBar({ dirty, pending, onSave, onReset, invalid }: { dirty: boolean; pending: boolean; onSave: () => void; onReset: () => void; invalid?: boolean }) {
  return (
    <div className="admin-action-bar" role="group" aria-label="Salvar alterações">
      <p className="admin-action-bar__status" aria-live="polite">{dirty ? 'Alterações não salvas' : 'Tudo salvo'}</p>
      <Button variant="ghost" disabled={!dirty || pending} onClick={onReset}>Desfazer</Button>
      <Button disabled={!dirty || invalid} loading={pending} onClick={onSave}>Salvar</Button>
    </div>
  );
}

export function OrgBrandingView() {
  const { organization } = useAdminState();
  const [draft, setDraft] = useState(organization.branding);
  const { pending, run } = useAction();
  useEffect(() => { setDraft(organization.branding); }, [organization.branding]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(organization.branding);

  return (
    <div className="admin-page">
      <PageHeader title="Marca da organização" description="Ponto de partida da marca de cada projeto novo. Cada projeto ajusta a sua em Aparência." />
      <Card>
        <CardHeader title="Prévia" description="Cabeçalho da documentação nos dois temas." />
        <CardContent><BrandPreview branding={draft} /></CardContent>
      </Card>
      <BrandingFields value={draft} onChange={setDraft} />
      <SaveBar
        dirty={dirty}
        pending={pending}
        invalid={!draft.name.trim()}
        onReset={() => setDraft(organization.branding)}
        onSave={() => run(() => adminApi.updateOrganization({ name: draft.name.trim(), branding: { ...draft, name: draft.name.trim() } }), 'Marca salva')}
      />
    </div>
  );
}

export function AppearanceView({ project }: { project: Project }) {
  const { organization } = useAdminState();
  // A project without its own brand yet starts from the organization's, with the project's name.
  const baseline = project.branding ?? { ...organization.branding, name: project.name };
  const [draft, setDraft] = useState<Branding>(baseline);
  const { pending, run } = useAction();
  useEffect(() => { setDraft(baseline); }, [JSON.stringify(baseline)]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  return (
    <div className="admin-page">
      <PageHeader title="Aparência" description="Marca exibida na documentação deste projeto." />
      <Card>
        <CardHeader title="Prévia" description="Cabeçalho da documentação nos dois temas." />
        <CardContent><BrandPreview branding={draft} /></CardContent>
      </Card>
      <BrandingFields value={draft} onChange={setDraft} />
      <SaveBar
        dirty={dirty}
        pending={pending}
        invalid={!draft.name.trim()}
        onReset={() => setDraft(baseline)}
        onSave={() => run(() => adminApi.updateProject(project.id, { branding: { ...draft, name: draft.name.trim() } }), 'Aparência salva')}
      />
    </div>
  );
}
