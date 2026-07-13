import {
  CALCULATION_MODE_OPTIONS,
  type CalculationMode,
} from '@/utils/customization';

interface Props {
  value: CalculationMode;
  onChange: (value: CalculationMode) => void;
  ariaLabel?: string;
}

export default function CalculationModePicker({
  value,
  onChange,
  ariaLabel = '排课计算方式',
}: Props) {
  return (
    <div className="calculation-mode-picker" role="radiogroup" aria-label={ariaLabel}>
      {CALCULATION_MODE_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`calculation-mode-picker__option${selected ? ' calculation-mode-picker__option--selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            <span className="calculation-mode-picker__indicator" aria-hidden="true" />
            <span className="calculation-mode-picker__copy">
              <span className="calculation-mode-picker__label">{option.label}</span>
              <span className="calculation-mode-picker__description">{option.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
