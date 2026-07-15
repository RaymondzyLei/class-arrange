import { Button } from 'antd';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OnboardingPreferences } from '@/onboarding/useOnboarding';
import CalculationModePicker from '@/components/CalculationModePicker';
import SelectWithChevron from '@/components/SelectWithChevron';
import { RESIDENT_CAMPUS_OPTIONS } from '@/utils/customization';
import OnboardingConfirm from './OnboardingConfirm';
import PreferenceSwitch from './PreferenceSwitch';
import './onboarding.css';

interface Props {
  open: boolean;
  preferences: OnboardingPreferences;
  onComplete: (preferences: OnboardingPreferences, startTour: boolean) => void;
  onSkip: () => void;
}

interface PreferenceOption {
  key: 'preferHalfDay' | 'preferFewerEarlyMornings' | 'preferAvoidCampusTransfers';
  title: string;
}

const PREFERENCE_OPTIONS: PreferenceOption[] = [
  {
    key: 'preferAvoidCampusTransfers',
    title: '优先避免跨校区',
  },
  {
    key: 'preferHalfDay',
    title: '优先空出半天',
  },
  {
    key: 'preferFewerEarlyMornings',
    title: '优先减少早八天数',
  },
];

export default function OnboardingWizard({ open, preferences, onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(preferences);
  const [confirmSkipOpen, setConfirmSkipOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDraft(preferences);
    setConfirmSkipOpen(false);
  }, [open, preferences]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setConfirmSkipOpen(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onSkip, open]);

  if (!open || typeof document === 'undefined') return null;

  const updatePreference = (key: PreferenceOption['key'], checked: boolean) => {
    setDraft((current) => ({ ...current, [key]: checked }));
  };

  const skip = () => {
    setConfirmSkipOpen(true);
  };

  return createPortal(
    <div className="onboarding-wizard" aria-hidden={!open}>
      <section
        className="onboarding-wizard__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-wizard-title"
      >
        <div className="onboarding-wizard__content">
          {step === 0 ? (
            <div className="onboarding-wizard__step">
              <p className="onboarding-wizard__eyebrow">首次进入</p>
              <h2 id="onboarding-wizard-title" className="onboarding-wizard__title">欢迎使用排课工具</h2>
              <p className="onboarding-wizard__body">
                你可以在这里搜索课程、生成多个课表方案、查询培养方案，并根据自己的偏好筛选出更合适的安排。
              </p>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="onboarding-wizard__step">
              <p className="onboarding-wizard__eyebrow">基础偏好</p>
              <h2 id="onboarding-wizard-title" className="onboarding-wizard__title">选择使用偏好</h2>
              <p className="onboarding-wizard__setting-note">稍后可在“自定义”中修改设置</p>
              <div className="onboarding-wizard__calculation-mode">
                <p>排课计算方式</p>
                <CalculationModePicker
                  value={draft.calculationMode}
                  onChange={(calculationMode) => setDraft((current) => ({
                    ...current,
                    calculationMode,
                  }))}
                />
              </div>
              <div className="onboarding-wizard__preferences">
                {PREFERENCE_OPTIONS.map((option) => (
                  <PreferenceSwitch
                    key={option.key}
                    checked={draft[option.key]}
                    title={option.title}
                    onChange={(checked) => updatePreference(option.key, checked)}
                  />
                ))}
                <div className="onboarding-wizard__resident-campus">
                  <span>常驻地点</span>
                  <SelectWithChevron
                    aria-label="常驻地点"
                    className="onboarding-wizard__resident-select"
                    value={draft.residentCampus}
                    options={RESIDENT_CAMPUS_OPTIONS.map((option) => ({ ...option }))}
                    disabled={!draft.preferAvoidCampusTransfers}
                    onChange={(residentCampus) => setDraft((current) => ({
                      ...current,
                      residentCampus,
                    }))}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="onboarding-wizard__footer">
          <div className="onboarding-wizard__actions">
            {step > 0 ? <Button onClick={() => setStep((current) => current - 1)}>上一步</Button> : null}
            {step === 0 ? (
              <Button className="onboarding-wizard__skip-button" type="text" onClick={skip}>跳过</Button>
            ) : null}
            {step === 0 ? (
              <Button
                type="primary"
                onClick={() => setStep((current) => current + 1)}
              >
                开始设置
              </Button>
            ) : (
              <Button type="primary" onClick={() => onComplete(draft, true)}>下一步</Button>
            )}
          </div>
        </div>
      </section>
      <OnboardingConfirm
        open={confirmSkipOpen}
        title="跳过新手引导？"
        description="跳过后不会自动再次弹出，你仍然可以从“自定义”中重新查看。"
        confirmText="确认跳过"
        onCancel={() => setConfirmSkipOpen(false)}
        onConfirm={onSkip}
      />
    </div>,
    document.body,
  );
}
