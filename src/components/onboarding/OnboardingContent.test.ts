import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wizardSource = readFileSync(new URL('./OnboardingWizard.tsx', import.meta.url), 'utf8');
const spotlightSource = readFileSync(new URL('./SpotlightTour.tsx', import.meta.url), 'utf8');
const tourStepsSource = readFileSync(new URL('../../onboarding/tourSteps.tsx', import.meta.url), 'utf8');

describe('onboarding content', () => {
  it('explains where preferences can be changed later', () => {
    expect(wizardSource).toContain('稍后可在“自定义”中修改设置');
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
