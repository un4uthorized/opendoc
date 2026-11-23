import { useEffect, useRef, useState } from 'react';
import { Badge, Text, ThemeToggle } from '../../design-system';
import { AccessibilitySection } from './Accessibility';
import { ButtonsSection, ContentSection, FeedbackSection, FieldsSection, NavigationSection, OverlaysSection, SelectionSection } from './Components';
import { IconsSection } from './Icons';
import { DataSection, ProgressSection } from './MoreComponents';
import { OrganismSections } from './Organisms';
import { DocsSections } from './DocsSections';
import { FormSections } from './FormSections';
import { ColorsSection, ElevationSection, RadiusSection, SpacingSection, TypographySection } from './Foundations';
import { CopyProvider } from './parts';
import './design-system-page.css';

const navigation = [
  {
    label: 'Fundamentos',
    items: [
      { id: 'acessibilidade', label: 'Acessibilidade' },
      { id: 'cores', label: 'Cores' },
      { id: 'tipografia', label: 'Tipografia' },
      { id: 'icones', label: 'Ícones' },
      { id: 'espacamento', label: 'Espaçamento' },
      { id: 'raios', label: 'Raios' },
      { id: 'sombras', label: 'Elevação e movimento' },
    ],
  },
  {
    label: 'Componentes',
    items: [
      { id: 'botoes', label: 'Button e Toggle' },
      { id: 'campos', label: 'Input e Select' },
      { id: 'selecao', label: 'Checkbox e Switch' },
      { id: 'overlays', label: 'Dialog e Menu' },
      { id: 'navegacao', label: 'Tabs e Accordion' },
      { id: 'feedback', label: 'Alert e Badge' },
      { id: 'progresso', label: 'Toast e Progress' },
      { id: 'dados', label: 'Table e Pagination' },
      { id: 'conteudo', label: 'Card e Avatar' },
    ],
  },
  {
    label: 'Organismos',
    items: [
      { id: 'app-shell', label: 'Sidebar e Navbar' },
      { id: 'command', label: 'Command menu' },
      { id: 'blocos', label: 'Cards e chat' },
    ],
  },
  {
    label: 'Documentação',
    items: [
      { id: 'doc-codigo', label: 'Código e endpoint' },
      { id: 'doc-referencia', label: 'Schema e respostas' },
      { id: 'doc-leitura', label: 'Prose e sumário' },
    ],
  },
  {
    label: 'Formulários e admin',
    items: [
      { id: 'formularios', label: 'OTP, senha e upload' },
      { id: 'admin', label: 'DataTable e editor' },
    ],
  },
];
const sectionIds = navigation.flatMap((group) => group.items.map((item) => item.id));

/** Highlights the section nearest the top of the viewport. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    // Callbacks only report entries that changed, so keep the full visible set
    // and pick the first visible section in page order.
    const visible = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      const first = ids.find((id) => visible.has(id));
      if (first) setActive(first);
    }, { rootMargin: '-120px 0px -55% 0px' });
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

export function DesignSystemPage() {
  const active = useActiveSection(sectionIds);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => { document.title = 'Design system · OpenDoc'; }, []);

  // Keep the active link visible inside the nav (vertical sidebar on desktop, horizontal bar on mobile),
  // scrolling only the nav, never the page.
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('a[aria-current]');
    if (!nav || !link) return;
    const navBox = nav.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    const margin = 32;
    // Same breakpoint as the CSS that turns the sidebar into a horizontal bar.
    if (window.matchMedia('(max-width: 860px)').matches) {
      nav.scrollTo({ left: nav.scrollLeft + linkBox.left - navBox.left - 16, behavior: 'auto' });
    } else if (nav.scrollHeight > nav.clientHeight) {
      if (linkBox.top < navBox.top + margin) nav.scrollTo({ top: nav.scrollTop - (navBox.top + margin - linkBox.top), behavior: 'auto' });
      else if (linkBox.bottom > navBox.bottom - margin) nav.scrollTo({ top: nav.scrollTop + (linkBox.bottom - navBox.bottom + margin), behavior: 'auto' });
    }
  }, [active]);

  return (
    <CopyProvider>
      <div className="dsp">
        <a className="dsp-skip" href="#conteudo-principal">Pular para o conteúdo</a>
        <header className="dsp-header">
          <div className="dsp-header__brand">
            <span className="dsp-header__title">Design system</span>
            <Badge variant="secondary">v0.3</Badge>
          </div>
          <ThemeToggle />
        </header>

        <div className="dsp-layout">
          <nav ref={navRef} className="dsp-nav" aria-label="Seções do design system">
            {navigation.map((group) => (
              <div className="dsp-nav__group" key={group.label}>
                <p className="dsp-nav__title">{group.label}</p>
                <ul role="list">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} aria-current={active === item.id ? 'location' : undefined}>{item.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <main id="conteudo-principal" className="dsp-main" tabIndex={-1}>
            <div className="dsp-intro">
              <Text variant="overline" color="muted">Foundations</Text>
              <Text variant="display">Design system</Text>
              <Text variant="lead">
                Tokens, tipografia e componentes acessíveis do OpenDoc, no estilo shadcn/ui e construídos sobre primitivos do Radix. Tudo aqui é o código real usado pela aplicação: troque o tema no topo e navegue pelo teclado.
              </Text>
              <pre className="dsp-code dsp-intro__import"><code>{`import { Button, TextField, Alert } from './design-system';`}</code></pre>
            </div>

            <AccessibilitySection />
            <ColorsSection />
            <TypographySection />
            <IconsSection />
            <SpacingSection />
            <RadiusSection />
            <ElevationSection />
            <ButtonsSection />
            <FieldsSection />
            <SelectionSection />
            <OverlaysSection />
            <NavigationSection />
            <FeedbackSection />
            <ProgressSection />
            <DataSection />
            <ContentSection />
            <OrganismSections />
            <DocsSections />
            <FormSections />
          </main>
        </div>
      </div>
    </CopyProvider>
  );
}
