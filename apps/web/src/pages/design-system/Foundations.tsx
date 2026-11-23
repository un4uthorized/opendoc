import { Text } from '../../design-system';
import { Section, Specimen, useCopy } from './parts';

const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const scales = [
  { name: 'neutral', label: 'Neutral', use: 'Base de toda a interface' },
  { name: 'red', label: 'Red', use: 'Destructive' },
  { name: 'green', label: 'Green', use: 'Success' },
  { name: 'amber', label: 'Amber', use: 'Warning' },
  { name: 'blue', label: 'Blue', use: 'Info' },
];

type Pair = { name: string; foreground?: string; use: string; ref: string };
const pairs: Pair[] = [
  { name: '--background', foreground: '--foreground', use: 'Fundo da aplicação e texto principal', ref: 'neutral-0 · neutral-950' },
  { name: '--card', foreground: '--card-foreground', use: 'Cards e painéis', ref: 'neutral-0 · neutral-900' },
  { name: '--popover', foreground: '--popover-foreground', use: 'Menus, popovers e selects', ref: 'neutral-0 · neutral-900' },
  { name: '--primary', foreground: '--primary-foreground', use: 'Ação principal, itens marcados', ref: 'neutral-900 · neutral-200' },
  { name: '--secondary', foreground: '--secondary-foreground', use: 'Ação secundária', ref: 'neutral-100 · neutral-800' },
  { name: '--muted', foreground: '--muted-foreground', use: 'Fundos discretos e texto secundário', ref: 'neutral-100 · neutral-800' },
  { name: '--accent', foreground: '--accent-foreground', use: 'Hover de itens e menus', ref: 'neutral-100 · neutral-800' },
];
const singles: Pair[] = [
  { name: '--border', use: 'Bordas de cards e divisórias', ref: 'neutral-200 · branco 10%' },
  { name: '--input', use: 'Borda e fundo de campos', ref: 'neutral-200 · branco 15%' },
  { name: '--ring', use: 'Anel de foco', ref: 'neutral-400 · neutral-500' },
  { name: '--destructive', use: 'Erros e ações destrutivas', ref: 'red-600 · red-400' },
  { name: '--success', use: 'Extensão: confirmações', ref: 'green-700 · green-400' },
  { name: '--warning', use: 'Extensão: atenção', ref: 'amber-700 · amber-400' },
  { name: '--info', use: 'Extensão: informação', ref: 'blue-600 · blue-400' },
];

const typeScale = [
  { variant: 'display', name: 'Display', spec: '48 / 1.1 · Extrabold', sample: 'Documentação que se lê' },
  { variant: 'h1', name: 'Heading 1', spec: '36 / 40 · Bold', sample: 'Referência da API' },
  { variant: 'h2', name: 'Heading 2', spec: '30 / 36 · Semibold', sample: 'Autenticação' },
  { variant: 'h3', name: 'Heading 3', spec: '24 / 32 · Semibold', sample: 'Criar um token de acesso' },
  { variant: 'h4', name: 'Heading 4', spec: '20 / 28 · Semibold', sample: 'Parâmetros da requisição' },
  { variant: 'lead', name: 'Lead', spec: '20 / 28 · Muted', sample: 'Abertura de página, logo abaixo do título.' },
  { variant: 'large', name: 'Large', spec: '18 / 28 · Semibold', sample: 'Destaque curto dentro do conteúdo.' },
  { variant: 'body', name: 'Body', spec: '16 / 28 · Regular', sample: 'Texto corrido para parágrafos e conteúdo longo.' },
  { variant: 'small', name: 'Small', spec: '14 / 20 · Regular', sample: 'Interface: rótulos, tabelas, botões e descrições.' },
  { variant: 'caption', name: 'Caption', spec: '12 / 16 · Regular', sample: 'Metadados e textos de apoio.' },
  { variant: 'overline', name: 'Overline', spec: '12 / 16 · Medium · +5%', sample: 'Categoria de seção' },
  { variant: 'code', name: 'Inline code', spec: '14 · Geist Mono · Semibold', sample: 'GET /v1/projects/{id}' },
] as const;

const weights = [
  { value: 400, name: 'Regular', token: '--font-weight-regular' },
  { value: 500, name: 'Medium', token: '--font-weight-medium' },
  { value: 600, name: 'Semibold', token: '--font-weight-semibold' },
  { value: 700, name: 'Bold', token: '--font-weight-bold' },
  { value: 800, name: 'Extrabold', token: '--font-weight-extrabold' },
];

const spacing = [
  ['0-5', 2], ['1', 4], ['1-5', 6], ['2', 8], ['2-5', 10], ['3', 12], ['4', 16], ['5', 20], ['6', 24], ['8', 32], ['10', 40], ['12', 48], ['16', 64], ['20', 80],
] as const;
const radii = [
  ['xs', 'radius − 6 · 4px'], ['sm', 'radius − 4 · 6px'], ['md', 'radius − 2 · 8px'], ['lg', 'radius · 10px'], ['xl', 'radius + 4 · 14px'], ['2xl', 'radius + 8 · 18px'], ['full', '9999px'],
] as const;
const shadows = [
  ['xs', 'Botões e campos'], ['sm', 'Cards'], ['md', 'Dropdowns'], ['lg', 'Popovers'], ['xl', 'Dialogs'],
] as const;
const motion = [
  ['--duration-fast', '150ms', 'Hover, cor, foco'],
  ['--duration-base', '200ms', 'Toggles e pequenas transições'],
  ['--duration-slow', '300ms', 'Painéis e overlays'],
  ['--ease-standard', 'cubic-bezier(.4, 0, .2, 1)', 'Padrão para quase tudo'],
  ['--ease-out', 'cubic-bezier(0, 0, .2, 1)', 'Elementos que entram na tela'],
] as const;

export function ColorsSection() {
  const copy = useCopy();
  return (
    <Section id="cores" eyebrow="Fundamentos" title="Cores" description={<>Paleta neutra no estilo shadcn/ui. Os tokens semânticos vêm em pares <code>--x</code> / <code>--x-foreground</code>: o primeiro é o fundo, o segundo o texto sobre ele. Clique em uma cor para copiar.</>}>
      <Specimen title="Pares semânticos" description="O quadrado mostra o fundo com um “Aa” na cor do foreground correspondente." layout="grid" stageClassName="dsp-tokens">
        {pairs.map((token) => (
          <button key={token.name} type="button" className="dsp-token" onClick={() => copy(`var(${token.name})`)}>
            <span className="dsp-token__swatch" style={{ background: `var(${token.name})`, color: `var(${token.foreground})` }}>Aa</span>
            <span className="dsp-token__meta">
              <code>{token.name}</code>
              <span>{token.use}</span>
              <span className="dsp-token__ref">{token.ref}</span>
            </span>
          </button>
        ))}
      </Specimen>

      <Specimen title="Bordas, foco e status" layout="grid" stageClassName="dsp-tokens">
        {singles.map((token) => (
          <button key={token.name} type="button" className="dsp-token" onClick={() => copy(`var(${token.name})`)}>
            <span className="dsp-token__swatch" style={{ background: `var(${token.name})` }} />
            <span className="dsp-token__meta">
              <code>{token.name}</code>
              <span>{token.use}</span>
              <span className="dsp-token__ref">{token.ref}</span>
            </span>
          </button>
        ))}
      </Specimen>

      <Specimen title="Escalas primitivas" description="Referência de paleta. Componentes nunca usam primitivas diretamente." layout="stack">
        <div className="dsp-scales">
          {scales.map((scale) => (
            <div className="dsp-scale" key={scale.name}>
              <div className="dsp-scale__name">
                <span>{scale.label}</span>
                <small>{scale.use}</small>
              </div>
              <div className="dsp-scale__swatches">
                {steps.map((step) => (
                  <button key={step} type="button" className="dsp-swatch" onClick={() => copy(`var(--${scale.name}-${step})`)} aria-label={`Copiar --${scale.name}-${step}`}>
                    <span className="dsp-swatch__color" style={{ background: `var(--${scale.name}-${step})` }} />
                    <span className="dsp-swatch__step">{step}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Specimen>
    </Section>
  );
}

export function TypographySection() {
  const copy = useCopy();
  return (
    <Section id="tipografia" eyebrow="Fundamentos" title="Tipografia" description="Geist para interface e leitura; Geist Mono para código, endpoints e valores técnicos. Títulos usam tracking apertado.">
      <div className="dsp-fonts">
        <div className="dsp-font">
          <span className="dsp-font__glyph">Aa</span>
          <div>
            <Text variant="large">Geist</Text>
            <Text variant="small" color="muted"><code>--font-sans</code> · Interface e conteúdo</Text>
          </div>
          <p className="dsp-font__chars">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789 ção ê à !?&amp;@</p>
        </div>
        <div className="dsp-font dsp-font--mono">
          <span className="dsp-font__glyph">{'{}'}</span>
          <div>
            <Text variant="large">Geist Mono</Text>
            <Text variant="small" color="muted"><code>--font-mono</code> · Código e dados técnicos</Text>
          </div>
          <p className="dsp-font__chars">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789 =&gt; !== {'{ }'} [ ]</p>
        </div>
      </div>

      <Specimen title="Escala tipográfica" description={<>Use <code>&lt;Text variant&gt;</code> ou as classes <code>.ds-text-*</code>.</>} layout="stack" code={`<Text variant="h2">Autenticação</Text>\n<Text variant="lead">Descrição da seção.</Text>`}>
        <div className="dsp-type">
          {typeScale.map((item) => (
            <div className="dsp-type__row" key={item.variant}>
              <div className="dsp-type__meta">
                <span>{item.name}</span>
                <button type="button" className="dsp-link-code" onClick={() => copy(`.ds-text-${item.variant}`)}>.ds-text-{item.variant}</button>
                <small>{item.spec}</small>
              </div>
              <div className="dsp-type__sample">
                <Text variant={item.variant} as={item.variant === 'code' ? 'code' : 'p'}>{item.sample}</Text>
              </div>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen title="Pesos" layout="grid" stageClassName="dsp-weights">
        {weights.map((weight) => (
          <div className="dsp-weight" key={weight.value}>
            <span style={{ fontWeight: weight.value }}>Ag</span>
            <div>
              <strong>{weight.name} · {weight.value}</strong>
              <code>{weight.token}</code>
            </div>
          </div>
        ))}
      </Specimen>
    </Section>
  );
}

export function SpacingSection() {
  const copy = useCopy();
  return (
    <Section id="espacamento" eyebrow="Fundamentos" title="Espaçamento" description="Grade de 4px, com nomes no múltiplo de 4 (--space-4 = 16px), igual à escala do Tailwind. Valores intermediários servem para ajustes finos em componentes.">
      <Specimen title="Escala de espaçamento" layout="stack">
        <div className="dsp-spacing">
          {spacing.map(([name, px]) => (
            <button type="button" className="dsp-spacing__row" key={name} onClick={() => copy(`var(--space-${name})`)}>
              <code>--space-{name}</code>
              <span className="dsp-spacing__px">{px}px</span>
              <span className="dsp-spacing__bar" style={{ width: `var(--space-${name})` }} />
            </button>
          ))}
        </div>
      </Specimen>
    </Section>
  );
}

export function RadiusSection() {
  const copy = useCopy();
  return (
    <Section id="raios" eyebrow="Fundamentos" title="Raios" description={<>Um único ajuste: <code>--radius</code> (10px). Os outros raios derivam dele, então mudar esse valor arredonda ou endurece a interface inteira.</>}>
      <Specimen title="Escala de raios" layout="row" stageClassName="dsp-radii">
        {radii.map(([name, value]) => (
          <button type="button" key={name} className="dsp-radius" onClick={() => copy(`var(--radius-${name})`)}>
            <span className="dsp-radius__box" style={{ borderRadius: `var(--radius-${name})` }} />
            <code>--radius-{name}</code>
            <small>{value}</small>
          </button>
        ))}
      </Specimen>
    </Section>
  );
}

export function ElevationSection() {
  const copy = useCopy();
  return (
    <Section id="sombras" eyebrow="Fundamentos" title="Elevação e movimento" description="Sombras discretas: a hierarquia vem principalmente das bordas. Animações respeitam prefers-reduced-motion.">
      <Specimen title="Sombras" layout="row" stageClassName="dsp-shadows">
        {shadows.map(([name, use]) => (
          <button type="button" key={name} className="dsp-shadow" style={{ boxShadow: `var(--shadow-${name})` }} onClick={() => copy(`var(--shadow-${name})`)}>
            <code>--shadow-{name}</code>
            <small>{use}</small>
          </button>
        ))}
      </Specimen>
      <Specimen title="Movimento" description="Passe o mouse em uma linha para ver a curva." layout="stack">
        <div className="dsp-motion">
          {motion.map(([token, value, use]) => (
            <div className="dsp-motion__row" key={token}>
              <code>{token}</code>
              <span className="dsp-motion__value">{value}</span>
              <span className="dsp-motion__use">{use}</span>
              <span className="dsp-motion__track" aria-hidden="true">
                <span
                  className="dsp-motion__dot"
                  style={token.startsWith('--duration')
                    ? { transitionDuration: `var(${token})`, transitionTimingFunction: 'var(--ease-standard)' }
                    : { transitionDuration: '600ms', transitionTimingFunction: `var(${token})` }}
                />
              </span>
            </div>
          ))}
        </div>
      </Specimen>
    </Section>
  );
}
