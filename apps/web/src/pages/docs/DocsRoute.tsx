import { useEffect, useState, type ComponentType } from 'react';
import { BookOpen, FileQuestion } from 'lucide-react';
import { parse } from 'yaml';
import { Alert, Spinner } from '../../design-system';
import { ApiError, getMe, request } from '../../auth/api';
import type { Branding, DocPage, NavigationSettings } from '../admin/data/types';
import { AuthShell, StepLayout } from '../login/LoginPage';
import { setDocsSource } from './source';
import './docs-route.css';

/** GET /api/docs/:slug: the project's published versions (never drafts) and its wiki pages. */
interface PublishedDocs {
  name: string;
  slug: string;
  description?: string;
  branding?: Branding;
  playground: boolean;
  navigation: NavigationSettings;
  defaultVersionId?: string;
  versions: Array<{ id: string; name: string; spec: string; changelog?: string; deprecated?: boolean; publishedAt: string }>;
  pages: Array<Pick<DocPage, 'id' | 'title' | 'slug' | 'body'>>;
}

interface DocsListItem { name: string; slug: string; description?: string }

type State =
  | { status: 'loading' }
  | { status: 'list'; items: DocsListItem[]; signedIn: boolean }
  | { status: 'missing'; signedIn: boolean }
  | { status: 'error'; message: string }
  | { status: 'ready'; Page: ComponentType };

/**
 * /docs/:slug shows that project's published documentation. /docs alone opens the only one the
 * visitor can see, or lists them. The docs modules read the spec when first imported, so they are
 * imported only after the spec is in place.
 */
export function DocsRoute({ slug }: { slug?: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  // The docs page sets its own title; the list and the messages here use this one.
  useEffect(() => { if (state.status !== 'ready') document.title = 'Documentação'; }, [state.status]);

  useEffect(() => {
    let active = true;
    const show = (next: State) => { if (active) setState(next); };
    const signedIn = () => getMe().then((me) => me?.stage === 'active').catch(() => false);

    (async () => {
      if (!slug) {
        const items = await request<DocsListItem[]>('GET', '/docs');
        if (items.length === 1) return window.location.replace(`/docs/${items[0]!.slug}`);
        return show({ status: 'list', items, signedIn: await signedIn() });
      }
      const docs = await request<PublishedDocs>('GET', `/docs/${encodeURIComponent(slug)}`);
      const version = docs.versions.find((item) => item.id === docs.defaultVersionId) ?? docs.versions.at(-1);
      if (!version) return show({ status: 'missing', signedIn: await signedIn() });
      const spec = parse(version.spec) as Record<string, unknown> | null;
      if (!spec || typeof spec !== 'object') throw new Error('A spec publicada não pôde ser lida.');
      setDocsSource({
        slug: docs.slug,
        name: docs.name,
        spec,
        pages: docs.pages,
        branding: docs.branding,
        playground: docs.playground,
      });
      const { DocsPage } = await import('./DocsPage');
      show({ status: 'ready', Page: DocsPage });
    })().catch(async (error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return show({ status: 'missing', signedIn: await signedIn() });
      show({ status: 'error', message: error instanceof Error ? error.message : 'Algo deu errado. Tente de novo.' });
    });
    return () => { active = false; };
  }, [slug]);

  if (state.status === 'ready') return <state.Page />;
  if (state.status === 'loading') return <div className="app-loading" role="status"><Spinner /><span className="ds-sr-only">Carregando documentação…</span></div>;

  return (
    <AuthShell>
      {state.status === 'list' && (
        <StepLayout compact icon={BookOpen} title="Documentação"
          description={state.items.length ? 'Escolha a API que você quer consultar.' : 'Ainda não há documentação publicada para você.'}>
          <div className="login__form">
            {state.items.length > 0 && (
              <ul className="docs-list">
                {state.items.map((item) => (
                  <li key={item.slug}>
                    <a href={`/docs/${item.slug}`} className="docs-list__item">
                      <span className="docs-list__name">{item.name}</span>
                      {item.description && <span className="docs-list__description">{item.description}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {!state.signedIn && <SignInHint />}
          </div>
        </StepLayout>
      )}
      {state.status === 'missing' && (
        <StepLayout compact icon={FileQuestion} title="Documentação não encontrada"
          description="O endereço pode estar errado, a documentação pode ainda não ter sido publicada ou ser privada.">
          <div className="login__form">
            {state.signedIn ? <a className="ds-button ds-button--outline ds-button--lg" href="/docs">Ver documentações disponíveis</a> : <SignInHint />}
          </div>
        </StepLayout>
      )}
      {state.status === 'error' && (
        <StepLayout compact icon={FileQuestion} title="Não foi possível abrir a documentação" description="Tente de novo em instantes.">
          <div className="login__form"><Alert variant="destructive">{state.message}</Alert></div>
        </StepLayout>
      )}
    </AuthShell>
  );
}

function SignInHint() {
  return (
    <>
      <p className="login__help">Documentações privadas aparecem depois de entrar.</p>
      <a className="ds-button ds-button--default ds-button--lg ds-button--full" href="/">Entrar</a>
    </>
  );
}
