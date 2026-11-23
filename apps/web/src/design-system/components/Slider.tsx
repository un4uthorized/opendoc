import { useId, useState, type ComponentProps } from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { cx } from '../cx';

export interface SliderProps extends Omit<ComponentProps<typeof SliderPrimitive.Root>, 'children'> {
  /** Visible label; also names each thumb (role="slider"). */
  label: string;
  /** Names for each thumb in a range, e.g. ['mínimo', 'máximo']. */
  thumbLabels?: string[];
  /** Formats the value shown and announced (aria-valuetext), e.g. v => `${v} ms`. */
  formatValue?: (value: number) => string;
  showValue?: boolean;
}

/**
 * Radix slider: ←/↓ and →/↑ change by one step, Page Up/Down by 10 steps, Home/End jump to the ends.
 * Several values make a range with one thumb each.
 */
export function Slider({ label, thumbLabels, formatValue = String, showValue = true, value, defaultValue, onValueChange, className, min = 0, ...props }: SliderProps) {
  const labelId = useId();
  const [internal, setInternal] = useState<number[]>(defaultValue ?? [min]);
  const current = value ?? internal;
  return (
    <div className={cx('ds-slider-field', className)}>
      <div className="ds-slider-field__top">
        <span id={labelId} className="ds-label">{label}</span>
        {showValue && <output className="ds-slider-field__value" aria-hidden="true">{current.map(formatValue).join(' – ')}</output>}
      </div>
      <SliderPrimitive.Root
        className="ds-slider"
        value={value}
        defaultValue={defaultValue}
        min={min}
        onValueChange={(next) => { setInternal(next); onValueChange?.(next); }}
        {...props}
      >
        <SliderPrimitive.Track className="ds-slider__track">
          <SliderPrimitive.Range className="ds-slider__range" />
        </SliderPrimitive.Track>
        {current.map((thumbValue, index) => (
          <SliderPrimitive.Thumb
            key={index}
            className="ds-slider__thumb"
            aria-label={thumbLabels?.[index] ? `${label}, ${thumbLabels[index]}` : label}
            aria-valuetext={formatValue(thumbValue)}
          />
        ))}
      </SliderPrimitive.Root>
    </div>
  );
}
