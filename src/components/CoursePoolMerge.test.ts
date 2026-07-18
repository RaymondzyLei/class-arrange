import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const hookSource = readFileSync(new URL('../hooks/useFilteredCourses.ts', import.meta.url), 'utf8');
const poolSource = readFileSync(new URL('./CoursePool.tsx', import.meta.url), 'utf8');
const itemSource = readFileSync(new URL('./CoursePoolItem.tsx', import.meta.url), 'utf8');
const planSwitcherSource = readFileSync(new URL('./PlanSwitcher.tsx', import.meta.url), 'utf8');

describe('merged course time-group integration', () => {
  it('derives merged display groups from the persisted setting', () => {
    expect(hookSource).toContain('mergeAllTimeGroups: boolean');
    expect(hookSource).toContain('mergeCourseTimeGroups');
    expect(appSource).toContain('customSettings.mergeAllTimeGroups');
    expect(appSource).toContain('mergedGroupByKey');
  });

  it('keeps canonical time groups for conflict state and shows one course-level action', () => {
    expect(poolSource).toContain('group.timeGroups ?? [group]');
    expect(itemSource).toContain('const mergedTimeGroups = group.timeGroups');
    expect(itemSource).toContain('{!mergedTimeGroups ? (');
    expect(itemSource).toContain('个时间组，点击查看详情');
  });

  it('provides semester favorites to ranking and plan controls', () => {
    expect(appSource).toContain('<FavoritesProvider');
    expect(appSource).toContain('favorites: favoriteState.arrangementPreferences');
    expect(planSwitcherSource).toContain("toggleFavorite('plan', plan.id)");
    expect(planSwitcherSource).toContain('active={planIds.has(plan.id)}');
  });

  it('flows real time-group favorites through virtual row props without favoriting merged keys', () => {
    expect(poolSource).toContain('favoriteIds: ReadonlySet<string>');
    expect(poolSource).toContain('favoriteIds={favoriteIds}');
    expect(poolSource).toContain('favoriteIds: timeGroupKeys');
    expect(poolSource).toContain('timeGroupKeys, toggleFavorite');
    expect(itemSource).toContain("toggleFavorite('timeGroup', group.key)");
    expect(itemSource).toMatch(
      /\{!mergedTimeGroups \? \([\s\S]*?<FavoriteButton[\s\S]*?toggleFavorite\('timeGroup', group\.key\)[\s\S]*?\) : null\}/,
    );
  });
});
