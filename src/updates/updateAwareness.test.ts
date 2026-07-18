import { describe, expect, test } from 'vitest';
import type {
  CourseImpactEvent,
  SemesterManifest,
  SemesterUpdateFeed,
} from '@/types';
import {
  createInitialAwarenessState,
  detectExistingVisitor,
  entriesSinceRevision,
  loadChangedSemesterUpdates,
  selectAutomaticNotice,
  unseenAppReleases,
} from './updateAwareness';
import { APP_RELEASES, CURRENT_APP_VERSION } from './appUpdates';

const manifest: SemesterManifest = {
  schemaVersion: 1,
  defaultSemester: '2026-fall',
  semesters: [{
    key: '2026-fall',
    name: '2026年秋季学期',
    file: '2026-fall/courses.json',
    revision: 'r2',
    updatesFile: '2026-fall/updates.json',
  }],
};

const feed: SemesterUpdateFeed = {
  schemaVersion: 1,
  semesterKey: '2026-fall',
  currentRevision: 'r3',
  entries: [
    {
      id: 'r2',
      revision: 'r2',
      previousRevision: 'r1',
      publishedAt: '2026-07-14',
      summary: { added: 0, removed: 0, modified: 0 },
      added: [],
      removed: [],
      modified: [],
    },
    {
      id: 'r3',
      revision: 'r3',
      previousRevision: 'r2',
      publishedAt: '2026-07-15',
      summary: { added: 0, removed: 0, modified: 0 },
      added: [],
      removed: [],
      modified: [],
    },
  ],
};

function impact(kind: CourseImpactEvent['kind']): CourseImpactEvent {
  return {
    id: kind,
    semesterKey: '2026-fall',
    revision: 'r2',
    kind,
    courseId: 'MATH100.01',
    courseName: '高等数学',
    occurredAt: '2026-07-15',
    affectedPlans: [],
    previous: {
      id: 'MATH100.01',
      courseCode: 'MATH100',
      courseName: '高等数学',
      teacher: '张老师',
      schedule: [],
    },
    changes: [],
    replacementCandidates: [],
  };
}

describe('update awareness rules', () => {
  test('publishes the July 18 favorites release as the latest app update', () => {
    expect(APP_RELEASES.at(-1)).toEqual({
      version: '2026.07.18.2',
      publishedAt: '2026-07-18',
      title: '收藏功能与更新顺序优化',
      items: [
        '新增选课方案、排课方案、课程时间组和具体课堂收藏，收藏状态保存在本地。',
        '排课结果优先展示已收藏方案，并在冲突相同时优先满足更多收藏课程。',
        '最近更新与更新记录按日期从新到旧展示。',
      ],
    });
    expect(CURRENT_APP_VERSION).toBe('2026.07.18.2');
    expect(APP_RELEASES.at(-1)?.items.join('')).toContain('收藏');
  });

  test('does not treat the catalog provider persisted semester as prior use', () => {
    const values = new Map([['class-arrange:v1:selected-semester', '2026-fall']]);
    const storage = {
      length: values.size,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      key: (index: number) => [...values.keys()][index] ?? null,
    };

    expect(detectExistingVisitor(storage)).toBe(false);
    values.set('class-arrange:v1:onboarding', '{}');
    expect(detectExistingVisitor(storage)).toBe(true);
  });

  test('baselines true new visitors while existing visitors receive the rollout release', () => {
    const latestVersion = APP_RELEASES.at(-1)!.version;
    expect(createInitialAwarenessState(false, latestVersion, manifest)).toEqual({
      version: 1,
      appLastSeen: latestVersion,
      semesterLastSeen: { '2026-fall': 'r2' },
    });
    expect(createInitialAwarenessState(true, latestVersion, manifest)).toEqual({
      version: 1,
      appLastSeen: null,
      semesterLastSeen: {},
    });
    expect(unseenAppReleases(APP_RELEASES, latestVersion)).toEqual([]);
    expect(unseenAppReleases(APP_RELEASES, null)).toEqual(APP_RELEASES);
  });

  test('returns only update batches after the last seen revision', () => {
    expect(entriesSinceRevision(feed, 'r2').map((entry) => entry.id)).toEqual(['r3']);
    expect(entriesSinceRevision(feed, 'r3')).toEqual([]);
    expect(entriesSinceRevision(feed, 'unknown')).toEqual(feed.entries);
  });

  test('forces deletion notices even when ordinary update popups are disabled', () => {
    const selection = selectAutomaticNotice({
      showUpdatePopup: false,
      impacts: [impact('modified'), impact('removed')],
      appReleases: APP_RELEASES,
      semesterUpdates: [{ semester: manifest.semesters[0], entries: feed.entries }],
    });

    expect(selection.impacts.map((event) => event.kind)).toEqual(['removed']);
    expect(selection.appReleases).toEqual([]);
    expect(selection.semesterUpdates).toEqual([]);
    expect(selection.suppressedImpactIds).toEqual(['modified']);
  });

  test('loads only changed semester feeds and leaves failures unacknowledged', async () => {
    const twoSemesterManifest: SemesterManifest = {
      ...manifest,
      semesters: [
        manifest.semesters[0],
        {
          key: '2026-summer',
          name: '2026年夏季学期',
          file: '2026-summer/courses.json',
          revision: 'summer-r1',
          updatesFile: '2026-summer/updates.json',
        },
      ],
    };
    const state = {
      version: 1 as const,
      appLastSeen: null,
      semesterLastSeen: { '2026-summer': 'summer-r1' },
    };
    const calls: string[] = [];

    const result = await loadChangedSemesterUpdates(twoSemesterManifest, state, async (entry) => {
      calls.push(entry.key);
      throw new Error('offline');
    });

    expect(calls).toEqual(['2026-fall']);
    expect(result.feeds).toEqual([]);
    expect(result.failedSemesterKeys).toEqual(['2026-fall']);
    expect(state.semesterLastSeen).toEqual({ '2026-summer': 'summer-r1' });
  });
});
