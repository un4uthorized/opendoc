import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../theme';
import { ToggleGroup, ToggleGroupItem } from './ToggleGroup';

const options: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Tema claro', Icon: Sun },
  { value: 'system', label: 'Tema do sistema', Icon: Monitor },
  { value: 'dark', label: 'Tema escuro', Icon: Moon },
];

/** Single-choice toggle group: arrow keys move between options. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  return (
    <ToggleGroup
      type="single"
      className={className}
      aria-label="Tema"
      value={theme}
      onValueChange={(value) => { if (value) setTheme(value as ThemePreference); }}
    >
      {options.map(({ value, label, Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} size="sm">
          <Icon aria-hidden="true" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
