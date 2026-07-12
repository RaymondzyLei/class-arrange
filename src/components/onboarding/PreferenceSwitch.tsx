import './onboarding.css';

interface Props {
  checked: boolean;
  title: string;
  onChange: (checked: boolean) => void;
}

export function PreferenceSwitchVisual({ checked }: Pick<Props, 'checked'>) {
  return (
    <span className={`onboarding-preference__switch${checked ? ' onboarding-preference__switch--checked' : ''}`}>
      <span className="onboarding-preference__thumb" />
    </span>
  );
}

/** Shared preference control used by onboarding and customization. */
export default function PreferenceSwitch({ checked, title, onChange }: Props) {
  return (
    <button
      type="button"
      className="onboarding-preference"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="onboarding-preference__copy">
        <span className="onboarding-preference__title">{title}</span>
      </span>
      <PreferenceSwitchVisual checked={checked} />
    </button>
  );
}
