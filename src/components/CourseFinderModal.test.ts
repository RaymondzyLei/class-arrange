// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseGroup, CourseSection } from '@/types';

const coursePoolCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('./BottomModal', () => ({
  default: ({
    open,
    children,
    footer,
  }: {
    open: boolean;
    children: ReactNode;
    footer?: ReactNode;
  }) => open ? createElement('div', { 'data-testid': 'bottom-modal' }, children, footer) : null,
}));

vi.mock('./CoursePool', () => ({
  default: (props: Record<string, unknown>) => {
    coursePoolCalls.push(props);
    return createElement('div', { 'data-testid': 'course-pool' }, '课程结果');
  },
}));

import CourseFinderModal from './CourseFinderModal';

const cssSource = readFileSync(resolve('src/index.css'), 'utf8');

interface MountedRoot {
  host: HTMLDivElement;
  root: Root;
}

const mountedRoots: MountedRoot[] = [];
const originalRequestAnimationFrame = window.requestAnimationFrame;

async function mount(node: ReactNode): Promise<MountedRoot> {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const mounted = { host, root };
  mountedRoots.push(mounted);
  await act(async () => {
    root.render(node);
  });
  return mounted;
}

function section(): CourseSection {
  return {
    id: 'TEST100.01',
    courseName: '测试课程',
    department: { code: '01', name: '测试学院' },
    teacher: '测试教师',
    credits: 2,
    hours: 32,
    level: '本科',
    sectionType: '',
    category: '',
    courseType: '',
    language: '',
    examType: '',
    grading: '',
    undergradShared: false,
    enrolled: 0,
    capacity: 100,
    classes: [],
    rawSchedule: '',
    schedule: [
      { weeks: [1, 16], room: '101', campus: '本部', day: 1, periods: [1] },
      { weeks: [1, 16], room: '102', campus: '本部', day: 3, periods: [5] },
    ],
  };
}

const testSection = section();
const testGroup: CourseGroup = {
  courseCode: 'TEST100',
  courseName: testSection.courseName,
  schedule: testSection.schedule,
  fingerprint: 'test',
  sectionIds: [testSection.id],
  teachers: [testSection.teacher],
  sections: [testSection],
  key: 'TEST100::test',
};

const courseMap = new Map([[testSection.id, testSection]]);
const groupsByCode = new Map([[testGroup.courseCode, [testGroup]]]);
const onOpenDetail = vi.fn();

function finder(open: boolean): ReactNode {
  return createElement(CourseFinderModal, {
    open,
    onClose: vi.fn(),
    groups: [testGroup],
    selectedIds: new Set<string>(),
    conflictGroupKeys: new Set<string>(),
    themeMode: 'light',
    onOpenDetail,
    courseMap,
    groupsByCode,
  });
}

function findSearchButton(): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    .find((candidate) => candidate.textContent?.replace(/\s/g, '') === '寻找');
  if (!button) throw new Error('Missing finder search button');
  return button;
}

function findWithinCheckbox(): HTMLInputElement {
  const checkbox = document.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  if (!checkbox) throw new Error('Missing within-selection checkbox');
  return checkbox;
}

function findGridCell(day: number, period: number): HTMLButtonElement {
  const cell = document.querySelector<HTMLButtonElement>(
    `.course-finder__picker-pane [data-slot-key="${day}-${period}"]`,
  );
  if (!cell) throw new Error(`Missing finder grid cell ${day}-${period}`);
  return cell;
}

function mousePointerEvent(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  button = 0,
): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    button,
    buttons: type === 'pointerup' ? 0 : 1,
  });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  coursePoolCalls.length = 0;
  onOpenDetail.mockClear();
});

afterEach(async () => {
  await act(async () => {
    for (const { root } of mountedRoots.splice(0).reverse()) root.unmount();
    await Promise.resolve();
  });
  document.body.replaceChildren();
  if (originalRequestAnimationFrame) window.requestAnimationFrame = originalRequestAnimationFrame;
  else delete (window as Partial<Window>).requestAnimationFrame;
});

describe('CourseFinderModal interactions', () => {
  it('searches a selected cell and reuses CoursePool with all normal actions wired', async () => {
    window.requestAnimationFrame = (callback) => window.setTimeout(
      () => callback(window.performance.now()),
      0,
    );
    await mount(finder(true));

    const firstCell = findGridCell(1, 1);
    const secondCell = findGridCell(3, 5);
    expect(findSearchButton().disabled).toBe(true);

    act(() => {
      firstCell.click();
      secondCell.click();
    });
    expect(firstCell.getAttribute('aria-pressed')).toBe('true');
    expect(secondCell.getAttribute('aria-pressed')).toBe('true');
    expect(findSearchButton().disabled).toBe(false);

    await act(async () => {
      findSearchButton().click();
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    expect(document.body.textContent).toContain('1 门课程 · 1 个时间组');
    expect(document.body.textContent).toContain(
      '实验性功能，请仔细核对搜索结果中课程信息，搜索结果也有可能展示不全。',
    );
    expect(coursePoolCalls.at(-1)).toMatchObject({
      groups: [testGroup],
      dataTour: null,
      onOpenDetail,
      emptyDescription: '没有符合所选时间条件的课程',
    });
  });

  it('defaults to within mode and excludes a group with time outside the selection', async () => {
    window.requestAnimationFrame = (callback) => window.setTimeout(
      () => callback(window.performance.now()),
      0,
    );
    await mount(finder(true));

    const checkbox = findWithinCheckbox();
    expect(checkbox.checked).toBe(true);

    const cell = findGridCell(1, 1);
    act(() => cell.click());

    await act(async () => {
      findSearchButton().click();
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    expect(coursePoolCalls.at(-1)).toMatchObject({ groups: [] });
  });

  it('matches a group when any selected slot intersects after within mode is cleared', async () => {
    window.requestAnimationFrame = (callback) => window.setTimeout(
      () => callback(window.performance.now()),
      0,
    );
    await mount(finder(true));

    const checkbox = findWithinCheckbox();
    expect(checkbox.checked).toBe(true);
    act(() => checkbox.click());
    expect(checkbox.checked).toBe(false);

    const matchingCell = findGridCell(1, 1);
    const unrelatedCell = findGridCell(2, 2);
    act(() => {
      matchingCell.click();
      unrelatedCell.click();
    });

    await act(async () => {
      findSearchButton().click();
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    });

    expect(coursePoolCalls.at(-1)).toMatchObject({ groups: [testGroup] });
  });

  it('uses the blocked-time grid empty and blocked states without a hard state', async () => {
    await mount(finder(true));

    const cells = document.querySelectorAll<HTMLButtonElement>(
      '.course-finder__picker-pane [data-slot-key]',
    );
    expect(cells).toHaveLength(91);

    const cell = findGridCell(1, 1);
    expect(cell.classList.contains('availability-grid__cell--empty')).toBe(true);
    expect(cell.textContent).toBe('');

    act(() => cell.click());
    expect(cell.classList.contains('availability-grid__cell--blocked')).toBe(true);
    expect(cell.getAttribute('aria-pressed')).toBe('true');
    expect(cell.textContent).toBe('');

    act(() => cell.click());
    expect(cell.classList.contains('availability-grid__cell--empty')).toBe(true);
    expect(cell.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('.course-finder__picker-pane .availability-grid__cell--hard'))
      .toBeNull();
  });

  it('mouse drag paints and erases finder cells until pointerup', async () => {
    await mount(finder(true));

    const first = findGridCell(1, 1);
    const second = findGridCell(2, 1);
    const third = findGridCell(3, 1);

    act(() => {
      first.dispatchEvent(mousePointerEvent('pointerdown'));
      second.dispatchEvent(mousePointerEvent('pointermove'));
      window.dispatchEvent(mousePointerEvent('pointerup'));
    });
    expect(first.classList.contains('availability-grid__cell--blocked')).toBe(true);
    expect(second.classList.contains('availability-grid__cell--blocked')).toBe(true);

    act(() => {
      third.dispatchEvent(mousePointerEvent('pointermove'));
    });
    expect(third.classList.contains('availability-grid__cell--empty')).toBe(true);

    act(() => {
      first.dispatchEvent(mousePointerEvent('pointerdown'));
      second.dispatchEvent(mousePointerEvent('pointermove'));
      window.dispatchEvent(mousePointerEvent('pointerup'));
    });
    expect(first.classList.contains('availability-grid__cell--empty')).toBe(true);
    expect(second.classList.contains('availability-grid__cell--empty')).toBe(true);
  });

  it('uses the shared clear-button treatment and centers the experimental disclaimer', async () => {
    await mount(finder(true));

    const clearButton = document.querySelector<HTMLButtonElement>(
      '.course-finder__picker-pane .availability-grid-clear-button',
    );
    expect(clearButton).not.toBeNull();
    expect(clearButton?.textContent?.replace(/\s/g, '')).toBe('清空');
    expect(clearButton?.classList.contains('ant-btn-sm')).toBe(false);
    expect(cssSource).toMatch(
      /\.course-finder-modal \.bottom-modal__footer\s*\{[^}]*justify-content:\s*center;/s,
    );
    expect(cssSource).toMatch(
      /\.course-finder__disclaimer\s*\{[^}]*text-align:\s*center;/s,
    );
  });

  it('returns to the unsearched state when an in-flight search is closed', async () => {
    window.requestAnimationFrame = vi.fn(() => 1);
    const mounted = await mount(finder(true));
    const cell = findGridCell(1, 1);
    act(() => cell.click());

    act(() => findSearchButton().click());
    expect(document.body.textContent).toContain('正在寻找匹配课程…');

    await act(async () => {
      mounted.root.render(finder(false));
    });
    await act(async () => {
      mounted.root.render(finder(true));
    });

    expect(document.body.textContent).toContain('尚未寻找');
    expect(document.body.textContent).not.toContain('0 门课程 · 0 个时间组');
    expect(coursePoolCalls).toHaveLength(0);
  });
});
