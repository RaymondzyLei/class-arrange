import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const switcher = readFileSync(new URL('./PlanSwitcher.tsx', import.meta.url), 'utf8');
const sender = readFileSync(new URL('./SharePlanModal.tsx', import.meta.url), 'utf8');
const receiver = readFileSync(new URL('./SharedPlanImportModal.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('shared-plan sender UI', () => {
  it('places share between create and delete and disables empty plans', () => {
    const create = switcher.indexOf('aria-label="新建方案"');
    const share = switcher.indexOf('aria-label="分享当前方案"');
    const remove = switcher.indexOf('aria-label="删除当前方案"');

    expect(create).toBeGreaterThan(-1);
    expect(share).toBeGreaterThan(create);
    expect(remove).toBeGreaterThan(share);
    expect(switcher).toContain('activePlan.courseIds.length === 0');
  });

  it('offers copy and optional native share without QR', () => {
    expect(sender).toContain('复制链接');
    expect(sender).toContain('navigator.share');
    expect(sender).not.toContain('二维码');
  });

  it('shows the complete selected plan name while keeping the selector compact', () => {
    expect(switcher).toContain('title={activePlan?.name}');
    expect(styles).toMatch(
      /\.plan-switcher__main-row\s*\{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/s,
    );
    expect(styles).toMatch(
      /\.plan-switcher__select\s*\{[^}]*min-width:\s*0/s,
    );
  });

  it('explains that the copied link is readable by its recipients', () => {
    expect(sender).toContain('获得链接的人可以查看其中的方案名称和课堂信息');
  });
});

describe('shared-plan receiver UI', () => {
  it('previews valid and missing courses before importing', () => {
    expect(receiver).toContain('可导入课堂');
    expect(receiver).toContain('已失效课堂');
    expect(receiver).toContain('导入方案');
    expect(receiver).toContain('preview.blockReason');
  });

  it('wires the shared-plan import hook into the main app', () => {
    expect(app).toContain('useSharedPlanImport({');
    expect(app).toContain('<SharedPlanImportModal');
    expect(app).toContain('sharedPlanImport.confirmImport()');
  });

  it('styles bounded course lists and a mobile summary', () => {
    expect(styles).toMatch(
      /\.shared-plan-import__courses\s*\{[^}]*max-height:\s*280px/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 640px\)[\s\S]*\.share-plan-modal__summary[\s\S]*grid-template-columns:\s*1fr/s,
    );
  });
});
