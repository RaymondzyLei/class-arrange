import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./CustomizationModal.tsx', import.meta.url), 'utf8');
const onboarding = readFileSync(
  new URL('./onboarding/OnboardingWizard.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('CustomizationModal grouped settings navigation', () => {
  it('keeps the existing modal shell and introduces grouped setting rows', () => {
    expect(source).toContain('title="自定义设置"');
    expect(source).toContain('排课倾向');
    expect(source).toContain('课表生成');
    expect(source).toContain('通知与帮助');
    expect(source).toContain('customization__group');
    expect(source).toContain('customization__navigation-row');
  });

  it('opens blocked-time and calculation-mode content as secondary pages', () => {
    expect(source).toContain("type CustomizationPage = 'main' | 'blockedSlots' | 'calculationMode'");
    expect(source).toContain("setPage('blockedSlots')");
    expect(source).toContain("setPage('calculationMode')");
    expect(source).toContain('customization__subpage-header');
    expect(source).toContain('headerLeading={');
    expect(source).toContain('<span aria-hidden="true">‹</span> 返回');
    expect(source).not.toContain('返回设置');
    expect(source).toContain('bodyRef={modalBodyRef}');
    expect(source).toContain('modalBodyRef.current?.scrollTo({ top: 0 })');
    expect(styles).toMatch(
      /\.customization-modal \.bottom-modal__panel\s*\{[^}]*height:\s*min\(88vh, 776px\)/s,
    );
  });

  it('keeps the original calculation-mode picker appearance on its secondary page', () => {
    expect(source).toContain(
      '<CalculationModePicker value={settings.calculationMode} onChange={setCalculationMode} />',
    );
    expect(source).not.toContain('customization__subpage-card--picker');
    expect(styles).not.toContain('.customization__subpage-card--picker');
  });

  it('keeps navigation affordances vertically aligned and uses explicit setting-state copy', () => {
    expect(styles).toMatch(/\.customization__chevron\s*\{[^}]*border-top:/s);
    expect(styles).toMatch(/\.customization__chevron\s*\{[^}]*transform:\s*rotate\(45deg\)/s);
    expect(source).toContain('开启后，课程列表中每门课程只显示一张卡片，时间组在详情中查看。');
    expect(source).toContain('关闭后，课程删除等重要变化仍会强制提醒。');
  });

  it('reuses the existing switch for the new display preference without adding it to onboarding', () => {
    expect(source).toContain('checked={settings.mergeAllTimeGroups}');
    expect(source).toContain('label="合并课程所有时间组"');
    expect(source).toContain('<PreferenceToggle');
    expect(onboarding).not.toContain('mergeAllTimeGroups');
    expect(styles).toContain('.customization__group');
    expect(styles).toContain('.customization__subpage-header');
  });

  it('adds only the arrangement-count dropdown to the custom schedule-generation group', () => {
    expect(source).toContain('展示排课方案数量');
    expect(source).toContain('ARRANGEMENT_DISPLAY_COUNT_OPTIONS');
    expect(source).toContain('settings.arrangementDisplayCount');
    expect(source).toContain('<SelectWithChevron');
    expect(onboarding).not.toContain('arrangementDisplayCount');
  });

  it('explains campus-transfer ranking and italicizes only the ranking warning', () => {
    expect(source).toContain('在冲突课程数尽可能少的前提下，跨校区次数越少越好。');
    expect(source).toContain('上午、下午、晚上分别从常驻地点出发');
    expect(source).toContain('时段内（上午/下午/晚上）相邻课程换地区计1次，不计算返程。');
    expect(source).not.toContain('<strong>');
    expect(source).toContain('<em>这可能会导致方案被错误排序</em>');
    expect(styles).toMatch(
      /\.customization__row--with-description\s*\{[^}]*align-items:\s*center/s,
    );
    expect(onboarding).not.toContain('这可能会导致方案被错误排序');
  });
});
