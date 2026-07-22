import { Button } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OnboardingPreferences } from '@/onboarding/useOnboarding';
import CalculationModePicker from '@/components/CalculationModePicker';
import SelectWithChevron from '@/components/SelectWithChevron';
import { useBodyScrollLock, useOverlayStack } from '@/components/overlayStack';
import { RESIDENT_CAMPUS_OPTIONS } from '@/utils/customization';
import OnboardingConfirm from './OnboardingConfirm';
import PreferenceSwitch from './PreferenceSwitch';
import { useManagedDialogFocus } from './useManagedDialogFocus';
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

const ARRANGEMENT_PREFERENCE_OPTIONS: PreferenceOption[] = [
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
  const panelRef = useRef<HTMLElement | null>(null);
  const confirmReturnFocusRef = useRef<HTMLElement | null>(null);
  const requestSkipConfirmation = useCallback(() => {
    if (typeof document !== 'undefined') {
      const activeElement = document.activeElement;
      confirmReturnFocusRef.current = activeElement instanceof HTMLElement
        && activeElement !== document.body
        ? activeElement
        : null;
    }
    setConfirmSkipOpen(true);
  }, []);
  const {
    id,
    isTop,
    isFocusOwner,
    isTopBlocking,
    isInteractionBlocked,
    zIndex,
  } = useOverlayStack({
    active: open,
    priority: 1400,
    blocksLowerInteraction: true,
    managesFocus: true,
    onEscape: requestSkipConfirmation,
  });
  const isWizardInteractive = open
    && !confirmSkipOpen
    && !isInteractionBlocked;
  const isWizardModal = isWizardInteractive
    && isTop
    && isFocusOwner
    && isTopBlocking;

  useBodyScrollLock(open);
  useManagedDialogFocus({
    active: open,
    interactive: isWizardInteractive && isFocusOwner,
    containerRef: panelRef,
  });

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDraft(preferences);
    setConfirmSkipOpen(false);
  }, [open, preferences]);

  if (!open || typeof document === 'undefined') return null;

  const updatePreference = (
    key: PreferenceOption['key'] | 'showUpdatePopup',
    checked: boolean,
  ) => {
    setDraft((current) => ({ ...current, [key]: checked }));
  };

  const skip = requestSkipConfirmation;

  return createPortal(
    <div
      className="onboarding-wizard"
      data-overlay-id={id}
      data-overlay-top={isTop ? 'true' : 'false'}
      style={{ zIndex }}
      inert={!isWizardInteractive}
      aria-hidden={isWizardInteractive ? undefined : true}
    >
      <section
        ref={panelRef}
        className="onboarding-wizard__panel"
        data-overlay-focus-root
        tabIndex={-1}
        role="dialog"
        aria-modal={isWizardModal ? true : undefined}
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
              <p className="onboarding-wizard__setting-note">稍后可在“设置”中修改设置</p>
              <div className="onboarding-wizard__preference-group">
                <p className="onboarding-wizard__group-label">排课偏好设置</p>
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
                  {ARRANGEMENT_PREFERENCE_OPTIONS.map((option) => (
                    <div className="onboarding-wizard__preference-item" key={option.key}>
                      <PreferenceSwitch
                        checked={draft[option.key]}
                        title={option.title}
                        onChange={(checked) => updatePreference(option.key, checked)}
                      />
                      {option.key === 'preferAvoidCampusTransfers' ? (
                        <div className="onboarding-wizard__resident-campus">
                          <span>常驻地点</span>
                          <SelectWithChevron
                            aria-label="常驻地点"
                            className="onboarding-wizard__resident-select"
                            value={draft.residentCampus}
                            options={RESIDENT_CAMPUS_OPTIONS.map((campusOption) => ({ ...campusOption }))}
                            disabled={!draft.preferAvoidCampusTransfers}
                            onChange={(residentCampus) => setDraft((current) => ({
                              ...current,
                              residentCampus,
                            }))}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              <div className="onboarding-wizard__preference-group">
                <p className="onboarding-wizard__group-label">更新设置</p>
                <div className="onboarding-wizard__preferences">
                  <PreferenceSwitch
                    checked={draft.showUpdatePopup}
                    title="有网站或课程更新时显示更新内容"
                    onChange={(checked) => updatePreference('showUpdatePopup', checked)}
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
        returnFocusTarget={confirmReturnFocusRef.current}
        title="跳过新手引导？"
        description="跳过后不会自动再次弹出，你仍然可以从“设置”中重新查看。"
        confirmText="确认跳过"
        onCancel={() => setConfirmSkipOpen(false)}
        onConfirm={onSkip}
      />
    </div>,
    document.body,
  );
}
