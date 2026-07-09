import { Button } from 'antd';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function OnboardingConfirm({
  open,
  title,
  description,
  confirmText,
  cancelText = '继续引导',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="onboarding-confirm" role="alertdialog" aria-modal="true" aria-labelledby="onboarding-confirm-title">
      <section className="onboarding-confirm__panel">
        <h2 id="onboarding-confirm-title" className="onboarding-confirm__title">{title}</h2>
        <p className="onboarding-confirm__description">{description}</p>
        <div className="onboarding-confirm__actions">
          <Button onClick={onCancel}>{cancelText}</Button>
          <Button danger type="primary" onClick={onConfirm}>{confirmText}</Button>
        </div>
      </section>
    </div>
  );
}
