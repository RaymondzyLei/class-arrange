import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wizardSource = readFileSync(new URL('./OnboardingWizard.tsx', import.meta.url), 'utf8');
const customizationSource = readFileSync(new URL('../CustomizationModal.tsx', import.meta.url), 'utf8');
const spotlightSource = readFileSync(new URL('./SpotlightTour.tsx', import.meta.url), 'utf8');
const tourStepsSource = readFileSync(new URL('../../onboarding/tourSteps.tsx', import.meta.url), 'utf8');
const selectSource = readFileSync(new URL('../SelectWithChevron.tsx', import.meta.url), 'utf8');
const onboardingStylesSource = readFileSync(new URL('./onboarding.css', import.meta.url), 'utf8');

describe('onboarding content', () => {
  it('explains where preferences can be changed later', () => {
    expect(wizardSource).toContain('稍后可在“自定义”中修改设置');
  });

  it('offers campus transfer avoidance and a dependent residence selector in both settings surfaces', () => {
    for (const source of [wizardSource, customizationSource]) {
      expect(source).toContain('优先避免跨校区');
      expect(source).toContain('常驻地点');
      expect(source).toContain('preferAvoidCampusTransfers');
      expect(source).toContain('residentCampus');
    }
    expect(wizardSource).toContain('disabled={!draft.preferAvoidCampusTransfers}');
    expect(customizationSource).toContain('disabled={!settings.preferAvoidCampusTransfers}');
  });

  it('separates arrangement preferences from the update preference in the first-run wizard', () => {
    expect(wizardSource).toContain('排课偏好设置');
    expect(wizardSource).toContain('更新设置');
    expect(wizardSource.match(/onboarding-wizard__preference-group/g)).toHaveLength(2);

    const arrangementHeading = wizardSource.indexOf('排课偏好设置');
    const updateHeading = wizardSource.indexOf('更新设置');
    const updateSwitch = wizardSource.indexOf('checked={draft.showUpdatePopup}');
    expect(arrangementHeading).toBeGreaterThan(-1);
    expect(updateHeading).toBeGreaterThan(arrangementHeading);
    expect(updateSwitch).toBeGreaterThan(updateHeading);
  });

  it('visually distinguishes preference group headings from the calculation-mode label', () => {
    const groupHeadingStyles = onboardingStylesSource.match(/\.onboarding-wizard__group-label\s*\{([^}]*)\}/)?.[1] ?? '';
    const calculationLabelStyles = onboardingStylesSource.match(/\.onboarding-wizard__calculation-mode > p\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(groupHeadingStyles).toContain('color: var(--text)');
    expect(groupHeadingStyles).toContain('font-size: 15px');
    expect(groupHeadingStyles).toContain('font-weight: 700');
    expect(calculationLabelStyles).toContain('color: var(--text-sub)');
    expect(calculationLabelStyles).toContain('font-size: 12px');
    expect(calculationLabelStyles).toContain('font-weight: 500');
  });

  it('keeps preference groups separated by whitespace without a horizontal rule', () => {
    const groupSeparationStyles = onboardingStylesSource.match(
      /\.onboarding-wizard__preference-group \+ \.onboarding-wizard__preference-group\s*\{([^}]*)\}/,
    )?.[1] ?? '';

    expect(groupSeparationStyles).toContain('padding-top: 12px');
    expect(groupSeparationStyles).not.toContain('border-top');
  });

  it('keeps select popups inside the onboarding stacking context', () => {
    expect(selectSource).toContain("closest('.bottom-modal, .onboarding-wizard')");
  });

  it('uses a real arrangement screenshot for step 2/11', () => {
    expect(spotlightSource).toContain(
      "import arrangementPreviewImage from '@/assets/onboarding/arrangement-preview.png';",
    );
    expect(spotlightSource).toContain('src={arrangementPreviewImage}');
    expect(spotlightSource).not.toContain('ARRANGEMENT_PREVIEW_CONFLICTS');
    expect(tourStepsSource).toContain('最多展示 8 种');
    expect(tourStepsSource).toContain('不同时间组组合');
  });

  it('removes the former step 10 preference spotlight but keeps blocked slots', () => {
    expect(tourStepsSource).not.toContain("id: 'customization-preferences'");
    expect(tourStepsSource).not.toContain("title: '调整排课倾向'");
    expect(tourStepsSource).toContain("id: 'customization-blocked-slots'");
    expect(tourStepsSource).toContain("title: '设置占位时间'");
  });
});
