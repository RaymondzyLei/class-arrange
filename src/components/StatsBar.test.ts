import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StatsBar from './StatsBar';

describe('StatsBar summary layout', () => {
  it('orders selected, favorites, combined credits/hours, then conflicts', () => {
    const html = renderToStaticMarkup(createElement(StatsBar, {
      stats: { count: 3, totalCredits: 10, totalHours: 200, conflictCount: 2 },
      favoriteCount: 7,
      onOpenSelectedCourses: () => undefined,
      onOpenFavorites: () => undefined,
    }));

    const selected = html.indexOf('已选课程');
    const favorites = html.indexOf('收藏项目');
    const workload = html.indexOf('总学分 / 学时');
    const conflicts = html.indexOf('冲突课程');
    expect(selected).toBeGreaterThan(-1);
    expect(favorites).toBeGreaterThan(selected);
    expect(workload).toBeGreaterThan(favorites);
    expect(conflicts).toBeGreaterThan(workload);
    expect(html).toContain('data-tour="favorites-manage"');
    expect(html.match(/class="stats-bar__button-foot"/g)).toHaveLength(2);
    expect(html).toContain('7 <span class="stats-bar__unit">项</span>');
    expect(html).toContain('10<span class="stats-bar__separator"> / </span>200');
    expect(html).not.toContain('>总学时<');
  });
});
