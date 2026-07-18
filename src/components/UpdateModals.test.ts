import { readFileSync } from 'node:fs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import type { CourseImpactEvent, SemesterManifestEntry, SemesterUpdateBatch } from '@/types';
import type { AutomaticNoticeSelection } from '@/updates/updateAwareness';

vi.mock('./BottomModal', () => ({
  default: ({ title, children }: { title: ReactNode; children: ReactNode }) =>
    createElement('section', null, createElement('h1', null, title), children),
}));

import UpdateHistoryModal from './UpdateHistoryModal';
import UpdateNoticeModal from './UpdateNoticeModal';
import CourseUpdateBatchDetails from './CourseUpdateBatchDetails';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const bottomModalSource = readFileSync(new URL('./BottomModal.tsx', import.meta.url), 'utf8');
const courseUpdateDetailsSource = readFileSync(new URL('./CourseUpdateBatchDetails.tsx', import.meta.url), 'utf8');
const historyModalSource = readFileSync(new URL('./UpdateHistoryModal.tsx', import.meta.url), 'utf8');
const noticeModalSource = readFileSync(new URL('./UpdateNoticeModal.tsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const normalizedStylesSource = stylesSource.replace(/\r\n/g, '\n');

const semester: SemesterManifestEntry = {
  key: '2026-fall',
  name: '2026年秋季学期',
  file: '2026-fall/courses.json',
  revision: 'r2',
  updatesFile: '2026-fall/updates.json',
};

function event(kind: CourseImpactEvent['kind']): CourseImpactEvent {
  return {
    id: kind,
    semesterKey: semester.key,
    revision: 'r2',
    kind,
    courseId: 'MATH100.01',
    courseName: '高等数学',
    occurredAt: '2026-07-15',
    affectedPlans: [
      { planId: 'p1', planName: '主方案', wasActive: true },
      { planId: 'p2', planName: '备选方案', wasActive: false },
    ],
    previous: {
      id: 'MATH100.01',
      courseCode: 'MATH100',
      courseName: '高等数学',
      teacher: '张老师',
      schedule: [],
    },
    current: kind === 'modified' ? {
      id: 'MATH100.01',
      courseCode: 'MATH100',
      courseName: '高等数学',
      teacher: '李老师',
      schedule: [],
    } : undefined,
    changes: kind === 'modified'
      ? [{ field: 'teacher', label: '授课教师', before: '张老师', after: '李老师' }]
      : [],
    replacementCandidates: kind === 'removed' ? [{
      id: 'MATH100.02',
      courseCode: 'MATH100',
      courseName: '高等数学',
      teacher: '王老师',
      schedule: [],
    }] : [],
  };
}

const notice: AutomaticNoticeSelection = {
  impacts: [event('removed'), event('modified')],
  appReleases: [{
    version: '2026.07.15.1',
    publishedAt: '2026-07-15',
    title: '更新提示',
    items: ['新增更新记录'],
  }],
  semesterUpdates: [{
    semester,
    entries: [{
      id: 'r2',
      revision: 'r2',
      previousRevision: 'r1',
      publishedAt: '2026-07-15',
      summary: { added: 1, removed: 1, modified: 2 },
      added: [{
        id: 'CS100.01',
        courseCode: 'CS100',
        courseName: '程序设计',
        teacher: '陈老师',
        schedule: [],
      }],
      removed: [{
        course: event('removed').previous,
        replacementCandidates: [],
      }],
      modified: [{
        course: {
          id: 'PHYS100.01',
          courseCode: 'PHYS100',
          courseName: '大学物理',
          teacher: '赵老师',
        },
        previous: { ...event('modified').previous, id: 'PHYS100.01', courseName: '大学物理' },
        current: { ...event('modified').previous, id: 'PHYS100.01', courseName: '大学物理' },
        changes: [{ field: 'capacity', label: '课容量', before: 30, after: 40 }],
      }],
    }],
  }],
  suppressedImpactIds: [],
};

const orderedNotice: AutomaticNoticeSelection = {
  ...notice,
  appReleases: [
    { version: 'old', publishedAt: '2026-07-16', title: '较早网站更新', items: [] },
    { version: 'new', publishedAt: '2026-07-18', title: '较新网站更新', items: [] },
  ],
  semesterUpdates: [
    {
      semester: { ...semester, key: 'older-semester', name: '较早学期' },
      entries: [{
        id: 'old-entry', revision: 'r1', previousRevision: '', publishedAt: '2026-07-16',
        summary: { added: 0, removed: 0, modified: 0 }, added: [], removed: [], modified: [],
      }],
    },
    {
      semester,
      entries: [
        {
          id: 'old-entry', revision: 'r1', previousRevision: '', publishedAt: '2026-07-16',
          summary: { added: 0, removed: 0, modified: 0 }, added: [], removed: [], modified: [],
        },
        {
          id: 'new-entry', revision: 'r2', previousRevision: 'r1', publishedAt: '2026-07-18',
          summary: { added: 0, removed: 0, modified: 0 }, added: [], removed: [], modified: [],
        },
      ],
    },
  ],
};

describe('update modals', () => {
  test('renders update data newest first without changing its domain order', () => {
    const historySemesters = [...orderedNotice.semesterUpdates];
    const noticeHtml = renderToStaticMarkup(createElement(UpdateNoticeModal, {
      open: true, notice: orderedNotice, onClose: () => undefined,
    }));
    const historyHtml = renderToStaticMarkup(createElement(UpdateHistoryModal, {
      open: true, loading: false, failedSemesterKeys: [],
      appReleases: orderedNotice.appReleases, semesters: historySemesters, onClose: () => undefined,
    }));

    for (const html of [noticeHtml, historyHtml]) {
      expect(html.indexOf('较新网站更新')).toBeLessThan(html.indexOf('较早网站更新'));
      expect(html.indexOf('2026-07-18')).toBeLessThan(html.indexOf('2026-07-16'));
      expect(html.indexOf('2026年秋季学期')).toBeLessThan(html.indexOf('较早学期'));
    }
    expect(orderedNotice.appReleases.map(({ title }) => title)).toEqual(['较早网站更新', '较新网站更新']);
    expect(orderedNotice.semesterUpdates[1].entries.map(({ id }) => id)).toEqual(['old-entry', 'new-entry']);
    expect(historySemesters.map(({ semester: item }) => item.key)).toEqual(['older-semester', '2026-fall']);
  });
  test('shows the before and after values for every modified course field', () => {
    const batch: SemesterUpdateBatch = {
      id: 'schedule-change',
      revision: 'r2',
      previousRevision: 'r1',
      publishedAt: '2026-07-16',
      summary: { added: 0, removed: 0, modified: 1 },
      added: [],
      removed: [],
      modified: [{
        course: {
          id: '009103.01',
          courseCode: '009103',
          courseName: '自动控制原理',
          teacher: '金一',
        },
        previous: {
          id: '009103.01',
          courseCode: '009103',
          courseName: '自动控制原理',
          teacher: '金一',
          schedule: [],
        },
        current: {
          id: '009103.01',
          courseCode: '009103',
          courseName: '自动控制原理',
          teacher: '金一',
          schedule: [],
        },
        changes: [{
          field: 'schedule',
          label: '上课时间与周次',
          before: [
            { weeks: [1, 16], day: 2, periods: [3, 4] },
            { weeks: [1, 16], day: 4, periods: [1, 2] },
          ],
          after: [
            { weeks: [1, 16], day: 2, periods: [8, 9] },
            { weeks: [1, 16], day: 4, periods: [8, 9] },
          ],
        }, {
          field: 'location',
          label: '上课地点或校区',
          before: [{ room: '3C302', campus: '本部' }, { room: '3C302', campus: '本部' }],
          after: [{ room: '3C304', campus: '本部' }, { room: '3C304', campus: '本部' }],
        }],
      }],
    };

    const html = renderToStaticMarkup(createElement(CourseUpdateBatchDetails, { batch }));

    expect(html).toContain('009103.01 金一');
    expect(html).toContain('上课时间与周次');
    expect(html).toContain('1~16周 周二 3–4节；1~16周 周四 1–2节');
    expect(html).toContain('1~16周 周二 8–9节；1~16周 周四 8–9节');
    expect(html).toContain('上课地点或校区');
    expect(html).toContain('3C302（本部）');
    expect(html).toContain('3C304（本部）');
    expect(html).toContain('course-update-change__arrow');
  });

  test('puts destructive plan changes before personalized and global updates', () => {
    const html = renderToStaticMarkup(
      createElement(UpdateNoticeModal, {
        open: true,
        notice,
        onClose: () => undefined,
        onSelectReplacement: vi.fn(),
      }),
    );

    expect(html).toContain('已从当前方案“主方案”和方案“备选方案”中移出');
    expect(html).toContain('可能的新课堂');
    expect(html).toContain('MATH100.02');
    expect(html).toContain('update-candidates__name">高等数学');
    expect(html).toContain('替换失效课程');
    expect(html).toContain('update-card__teacher');
    expect(html).toContain('title="张老师">张老师');
    expect(html).not.toContain('教师：张老师');
    expect(html).toContain('以下课堂已从新课程目录中删除，已自动同步清理方案中的这些课程。');
    expect(html).not.toContain('为避免无效课表');
    expect(html).toContain('授课教师');
    expect(html).toContain('更新提示');
    expect(html).toContain('2026年秋季学期');
    expect(html).toContain('新增课堂');
    expect(html).toContain('程序设计');
    expect(html).toContain('删除课堂');
    expect(html).toContain('大学物理');
    expect(html).toContain('课容量');
    expect(html).toContain('CS100.01 陈老师');
    expect(html).toContain('MATH100.01 张老师');
    expect(html).toContain('PHYS100.01 赵老师');
    expect(html).toContain('<dt>课容量</dt>');
    expect(html).toContain('<span>30</span><span class="course-update-change__arrow" aria-hidden="true">→</span><span>40</span>');
    expect(html).not.toContain('CS100.01 · 陈老师');
    expect(html).not.toContain('MATH100.01 · 张老师');
    expect(html).not.toContain('PHYS100.01 · 赵老师');
    expect(html).not.toContain('课程已移出方案');
    expect(html.indexOf('部分课程已失效')).toBeLessThan(html.indexOf('已选课程信息有变化'));
  });

  test('history has two top-level sections without plan-specific impact notices', () => {
    const html = renderToStaticMarkup(
      createElement(UpdateHistoryModal, {
        open: true,
        loading: false,
        failedSemesterKeys: [],
        appReleases: notice.appReleases,
        semesters: [...notice.semesterUpdates, {
          semester: { ...semester, key: '2026-summer', name: '2026年夏季学期' },
          entries: [],
        }],
        onClose: () => undefined,
      }),
    );

    expect(html).toContain('网站更新');
    expect(html).toContain('课程信息更新');
    expect(html).not.toContain('与我的方案相关');
    expect(html).not.toContain('课堂已删除，并从');
    expect(historyModalSource).not.toContain('CourseImpactEvent');
    expect(appSource).not.toContain('impacts={updateAwareness.history.impacts}');
    expect(noticeModalSource).toContain('notice.impacts');
    expect(html).toContain('2026年秋季学期');
    expect(html).not.toContain('2026年夏季学期');
    expect(html.match(/class="update-section"/g)).toHaveLength(2);
    expect(html).not.toContain('class="update-release"');
  });

  test('history shows one empty course message when no semester has changes', () => {
    const html = renderToStaticMarkup(
      createElement(UpdateHistoryModal, {
        open: true,
        loading: false,
        failedSemesterKeys: [],
        appReleases: notice.appReleases,
        semesters: [{ semester, entries: [] }, {
          semester: { ...semester, key: '2026-summer', name: '2026年夏季学期' },
          entries: [],
        }],
        onClose: () => undefined,
      }),
    );

    expect(html).toContain('课程信息更新');
    expect(html.match(/暂无课程更新记录。/g)).toHaveLength(1);
    expect(html).not.toContain('2026年秋季学期');
    expect(html).not.toContain('2026年夏季学期');
  });

  test('uses a neutral removal surface with an inset conflict-color line', () => {
    const html = renderToStaticMarkup(
      createElement(UpdateNoticeModal, {
        open: true,
        notice,
        onClose: () => undefined,
      }),
    );
    const dangerSection = stylesSource.match(/\.update-section--danger\s*\{([^}]*)\}/)?.[1] ?? '';
    const dangerLine = stylesSource.match(/\.update-section--danger::before\s*\{([^}]*)\}/)?.[1] ?? '';
    const dangerCard = stylesSource.match(/\.update-card--danger\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(html).toContain('update-section__danger-icon');
    expect(dangerSection).toContain('border-color: var(--border)');
    expect(dangerSection).toContain('position: relative');
    expect(dangerSection).toContain('padding-left: 30px');
    expect(dangerSection).not.toContain('border-left');
    expect(dangerSection).not.toContain('var(--conflict-bg)');
    expect(dangerLine).toContain('left: 13px');
    expect(dangerLine).toContain('width: 3px');
    expect(dangerLine).toContain('background: var(--conflict)');
    expect(dangerLine).not.toContain('border-radius');
    expect(dangerCard).toContain('border-color: var(--border)');
  });

  test('keeps removed-course teacher labels on one truncated line', () => {
    const teacherStyles = stylesSource.match(/\.update-card__teacher\s*\{([^}]*)\}/)?.[1] ?? '';
    const codeStyles = stylesSource.match(/\.update-card__code\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(codeStyles).toContain('color: var(--text-faint)');
    expect(teacherStyles).toContain('min-width: 0');
    expect(teacherStyles).toContain('overflow: hidden');
    expect(teacherStyles).toContain('text-overflow: ellipsis');
    expect(teacherStyles).toContain('white-space: nowrap');
  });

  test('uses compact update actions and lets mobile course names wrap in full', () => {
    const replacementButtonStyles = stylesSource.match(/\.update-candidates button\s*\{([^}]*)\}/)?.[1] ?? '';
    const detailsToggleStyles = stylesSource.match(/\.course-update-details__toggle\.ant-btn\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(replacementButtonStyles).toContain('padding: 2px 6px');
    expect(replacementButtonStyles).toContain('font-size: 10px');
    expect(detailsToggleStyles).toContain('min-height: 20px');
    expect(detailsToggleStyles).toContain('font-size: 11px');
    expect(normalizedStylesSource).toContain(`  .update-card__heading {
    flex-wrap: wrap;
  }

  .update-card__name {
    width: 100%;
    flex-basis: 100%;
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
  }`);
  });

  test('uses the shared chevron button and animated region for course changes', () => {
    const html = renderToStaticMarkup(
      createElement(UpdateNoticeModal, {
        open: true,
        notice,
        onClose: () => undefined,
      }),
    );
    const regionStyles = stylesSource.match(/\.course-update-details__region\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(courseUpdateDetailsSource).toContain("import { Button } from 'antd'");
    expect(courseUpdateDetailsSource).toContain('ChevronIcon');
    expect(courseUpdateDetailsSource).not.toContain('<summary>');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('select-chevron--open');
    expect(html).toContain('course-update-details__region--open');
    expect(html).toContain('class="update-release__header"');
    expect(regionStyles).toContain('grid-template-rows: 0fr');
    expect(regionStyles).toContain('grid-template-rows 0.18s ease');
    expect(stylesSource).not.toContain('.update-release > div');
  });

  test('places expanded course changes below the details toggle in update history', () => {
    expect(historyModalSource).toContain('className="update-history__entry-header"');
    expect(stylesSource).toContain('.update-history__entry-header');
    expect(stylesSource).not.toContain('.update-history__entry > div');
  });

  test('keeps update notices mounted until the shared modal exit animation completes', () => {
    expect(bottomModalSource).toContain('afterClose?: () => void');
    expect(bottomModalSource).toContain('event.target !== event.currentTarget');
    expect(bottomModalSource).toContain('afterClose?.()');
    expect(noticeModalSource).toContain('afterClose={afterClose}');
    expect(appSource).toContain('const [automaticNoticeOpen, setAutomaticNoticeOpen]');
    expect(appSource).toContain('requestAnimationFrame');
    expect(appSource).toContain('open={automaticNoticeOpen}');
    expect(appSource).toContain('onClose={() => setAutomaticNoticeOpen(false)}');
    expect(appSource).toContain('afterClose={updateAwareness.acknowledgeAutomaticNotice}');
    expect(appSource).not.toContain('onClose={updateAwareness.acknowledgeAutomaticNotice}');
  });
});
