import { Accessibility, Eye, Keyboard, MousePointerClick, Sparkles, Tags } from 'lucide-react';
import { Section } from './parts';

const principles = [
  {
    Icon: Accessibility,
    title: 'Radix por baixo',
    text: 'Componentes interativos usam primitivos do Radix, sem estilo: papéis ARIA, estados (aria-expanded, aria-checked, aria-selected) e relações (aria-controls, aria-labelledby) vêm prontos e testados com leitores de tela.',
  },
  {
    Icon: Keyboard,
    title: 'Tudo pelo teclado',
    text: 'Cada componente segue o padrão WAI-ARIA correspondente: foco itinerante com setas em grupos, Esc fecha camadas e o foco volta para quem as abriu. As tabelas “Teclado” documentam cada caso.',
  },
  {
    Icon: Eye,
    title: 'Foco sempre visível',
    text: 'Anel de foco de 3px em :focus-visible em todos os controles, sem depender de cor isolada. Diálogos prendem o foco e escondem o resto da página dos leitores de tela.',
  },
  {
    Icon: Tags,
    title: 'Nome, descrição e erro',
    text: 'Campos têm rótulo visível ligado por htmlFor; dica e erro entram por aria-describedby e o erro marca aria-invalid. Botões só de ícone exigem aria-label no tipo.',
  },
  {
    Icon: MousePointerClick,
    title: 'Alvos e estados claros',
    text: 'Controles com no mínimo 32px de altura, rótulos clicáveis e estado desabilitado que não some da leitura. Estados vêm de data-state do Radix, então o visual nunca diverge do ARIA.',
  },
  {
    Icon: Sparkles,
    title: 'Movimento respeitoso',
    text: 'Animações curtas e só de entrada e saída. Com prefers-reduced-motion, transições e animações são praticamente desligadas.',
  },
];

export function AccessibilitySection() {
  return (
    <Section id="acessibilidade" eyebrow="Fundamentos" title="Acessibilidade" description="Princípios que todo componente do design system segue. Use o teclado nesta página para testar: Tab, setas, Enter, Space e Esc.">
      <ul className="dsp-principles" role="list">
        {principles.map(({ Icon, title, text }) => (
          <li key={title} className="dsp-principle">
            <span className="dsp-principle__icon" aria-hidden="true"><Icon /></span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
