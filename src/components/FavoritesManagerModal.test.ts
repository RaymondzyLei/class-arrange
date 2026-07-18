import { createElement, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import FavoritesManagerModal, { type FavoriteManagerItem } from './FavoritesManagerModal';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

vi.mock('./BottomModal', () => ({
  default: ({ title, children }: { title: ReactNode; children: ReactNode }) =>
    createElement('section', null, createElement('h1', null, title), children),
}));

describe('FavoritesManagerModal', () => {
  it('groups every favorite kind and exposes an unfavorite action', () => {
    const items: FavoriteManagerItem[] = [
      { kind: 'plan', id: 'p1', title: '主方案', detail: '选课方案' },
      { kind: 'arrangement', id: 'a1', title: '排课方案 · 3 门', detail: '10 学分 · 0 冲突' },
      { kind: 'timeGroup', id: 'g1', title: '数学实验', detail: '时间组 · 001108.01' },
      { kind: 'section', id: 's1', title: '数学实验', detail: '具体课堂 · 001108.01' },
    ];
    const html = renderToStaticMarkup(createElement(FavoritesManagerModal, {
      open: true,
      items,
      onClose: () => undefined,
      onOpen: vi.fn(),
      onRemove: vi.fn(),
    }));

    expect(html).toContain('收藏项目管理');
    expect(html).toContain('选课方案');
    expect(html).toContain('排课方案');
    expect(html).toContain('课程时间组');
    expect(html).toContain('具体课堂');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(4);
    expect(html).toContain('取消收藏：主方案');
    expect(html).toContain('aria-label="打开：主方案"');
  });

  it('keeps the favorites manager open underneath course details', () => {
    const handler = appSource.match(
      /const handleOpenFavorite[\s\S]*?const handleRemoveFavorite/,
    )?.[0] ?? '';
    const courseBranch = handler.slice(handler.indexOf('if (item.groupKey'));

    expect(handler.match(/setFavoritesOpen\(false\)/g)).toHaveLength(2);
    expect(courseBranch).not.toContain('setFavoritesOpen(false)');
    expect(courseBranch).toContain('setDetailGroupKey(item.groupKey)');
  });
});
