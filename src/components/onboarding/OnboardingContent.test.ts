import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wizardSource = readFileSync(new URL('./OnboardingWizard.tsx', import.meta.url), 'utf8');
const customizationSource = readFileSync(new URL('../CustomizationModal.tsx', import.meta.url), 'utf8');
const spotlightSource = readFileSync(new URL('./SpotlightTour.tsx', import.meta.url), 'utf8');
const tourStepsSource = readFileSync(new URL('../../onboarding/tourSteps.tsx', import.meta.url), 'utf8');
const arrangementPanelSource = readFileSync(new URL('../ArrangementPanel.tsx', import.meta.url), 'utf8');
const statsBarSource = readFileSync(new URL('../StatsBar.tsx', import.meta.url), 'utf8');
const coursePoolSource = readFileSync(new URL('../CoursePool.tsx', import.meta.url), 'utf8');
const coursePoolItemSource = readFileSync(new URL('../CoursePoolItem.tsx', import.meta.url), 'utf8');
const selectSource = readFileSync(new URL('../SelectWithChevron.tsx', import.meta.url), 'utf8');
const onboardingStylesSource = readFileSync(new URL('./onboarding.css', import.meta.url), 'utf8');

describe('onboarding content', () => {
  it('explains where preferences can be changed later', () => {
    expect(wizardSource).toContain('稍后可在“设置”中修改');
    expect(wizardSource).toContain('你仍然可以从“设置”中重新查看');
    expect(spotlightSource).toContain('你仍然可以从“设置”中重新查看');
    expect(tourStepsSource).toContain("title: '打开设置'");
    expect(tourStepsSource).toContain('再次查看引导可以从“设置”里的“重新查看新手引导”进入');
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

  it('highlights the live arrangement panel in step 2 without rendering a screenshot preview', () => {
    expect(arrangementPanelSource).toContain('data-tour="arrangement-preview"');
    expect(tourStepsSource).toContain("target: '[data-tour=\"arrangement-preview\"]'");
    expect(tourStepsSource).not.toContain("preview: 'arrangementPanel'");
    expect(spotlightSource).not.toContain('arrangementPreviewImage');
    expect(spotlightSource).not.toContain('ArrangementPanelPreview');
    expect(spotlightSource).not.toContain('getArrangementPreviewRect');
    expect(tourStepsSource).toContain('展示数量可以在设置中调整');
    expect(tourStepsSource).toContain('不同时间组组合');
  });

  it('inserts favorite guidance between the former first and second steps', () => {
    const schemeIndex = tourStepsSource.indexOf("id: 'scheme-list'");
    const favoriteIndex = tourStepsSource.indexOf("id: 'favorite-management'");
    const arrangementIndex = tourStepsSource.indexOf("id: 'arrangement-preview'");

    expect(schemeIndex).toBeGreaterThan(-1);
    expect(favoriteIndex).toBeGreaterThan(schemeIndex);
    expect(arrangementIndex).toBeGreaterThan(favoriteIndex);
    expect(tourStepsSource).toContain("'[data-tour=\"favorites-manage\"]'");
    expect(tourStepsSource).toContain("'[data-tour=\"course-favorite\"]'");
    expect(statsBarSource).toContain('data-tour="favorites-manage"');
    expect(coursePoolSource).toContain('tourFavoriteGroupKey');
    expect(coursePoolItemSource).toContain("dataTour={tourFavorite ? 'course-favorite' : undefined}");
  });

  it('removes the former step 10 preference spotlight but keeps blocked slots', () => {
    expect(tourStepsSource).not.toContain("id: 'customization-preferences'");
    expect(tourStepsSource).not.toContain("title: '调整排课倾向'");
    expect(tourStepsSource).toContain("id: 'customization-blocked-slots'");
    expect(tourStepsSource).toContain("title: '设置占位时间'");
  });
});
