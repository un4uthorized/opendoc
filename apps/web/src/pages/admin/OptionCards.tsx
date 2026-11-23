import { useId } from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { Check, type LucideIcon } from 'lucide-react';
import './option-cards.css';

export interface OptionCard<T extends string> { value: T; icon: LucideIcon; label: string; description: string }

/**
 * A radio group drawn as cards: icon, title and description, with a check on the chosen one. Arrow
 * keys move between cards (Radix radio group); the description is the card's accessible description.
 */
export function OptionCards<T extends string>({ legend, value, onChange, options }: { legend: string; value: T; onChange: (value: T) => void; options: OptionCard<T>[] }) {
  const id = useId();
  return (
    <div className="admin-options-field">
      <span id={id} className="ds-label">{legend}</span>
      <RadioGroupPrimitive.Root aria-labelledby={id} value={value} onValueChange={(next) => onChange(next as T)} className="admin-options">
        {options.map(({ value: optionValue, icon: Icon, label, description }) => (
          <RadioGroupPrimitive.Item key={optionValue} value={optionValue} className="admin-option" aria-describedby={`${id}-${optionValue}`}>
            <span className="admin-option__icon" aria-hidden="true"><Icon /></span>
            <span className="admin-option__text">
              <span className="admin-option__label">{label}</span>
              <span id={`${id}-${optionValue}`} className="admin-option__description">{description}</span>
            </span>
            <span className="admin-option__check" aria-hidden="true"><Check /></span>
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  );
}
