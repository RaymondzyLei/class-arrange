import { describe, expect, test, vi } from 'vitest';
import type { SemesterCatalog, SemesterManifest } from '@/types';
import {
  SemesterCatalogError,
  getSemesterCatalogUrl,
  getSemesterUpdatesUrl,
  loadSemesterCatalog,
  loadSemesterUpdates,
  selectInitialSemester,
  validateSemesterCatalog,
  validateSemesterManifest,
  validateSemesterUpdateFeed,
} from './semesterCatalog';

const manifest: SemesterManifest = {
  schemaVersion: 1,
  defaultSemester: '2026-fall',
  semesters: [
    {
      key: '2026-fall',
      name: '2026年秋季学期',
      file: '2026-fall/courses.json',
      revision: 'fall-r1',
      updatesFile: '2026-fall/updates.json',
    },
    {
      key: '2026-summer',
      name: '2026年夏季学期',
      file: '2026-summer/courses.json',
      revision: 'summer-r1',
      updatesFile: '2026-summer/updates.json',
    },
  ],
};

const catalog: SemesterCatalog = {
  schemaVersion: 1,
  revision: 'summer-r1',
  generatedAt: '2026-07-13T00:00:00Z',
  source: { url: 'https://catalog.ustc.edu.cn/query/lesson', semesterId: 1 },
  semester: {
    key: '2026-summer',
    name: '2026年夏季学期',
    startDate: '2026-06-29',
    endDate: '2026-08-02',
    calendar: {
      termId: '2026-summer',
      termName: '2026年夏季学期',
      termStartDate: '2026-06-29',
      termEndDate: '2026-08-02',
      weekStartDate: '2026-06-29',
      weekCount: 5,
      sourceUrl: 'https://catalog.ustc.edu.cn/query/lesson',
      holidays: {},
      makeupDays: {},
    },
  },
  courses: [
    {
      id: 'MATH100.01',
      courseName: '数学',
      department: { code: 'MATH', name: '数学科学学院' },
      teacher: '教师',
      credits: 2,
      hours: 32,
      level: '本科',
      sectionType: '理论',
      category: '',
      courseType: '专业课',
      language: '中文',
      examType: '考试',
      grading: '百分制',
      undergradShared: false,
      enrolled: 1,
      capacity: 10,
      classes: [],
      rawSchedule: '',
      schedule: [],
    },
  ],
  detailsBySection: {
    'MATH100.01': {
      code: 'MATH100.01',
      name: { cn: '数学', en: 'Mathematics' },
      dept: '数学科学学院',
      credit: 2,
      hour: 32,
      sem: '2026年夏季学期',
      grading: '百分制',
      examType: '考试',
      discipline: '',
      lang: '中文',
      prerequisite: '',
      legacyTextbook: '',
      textbooks: [],
      materials: [],
      referenceBooks: '',
      description: { cn: '', en: '' },
      syllabus: null,
    },
  },
};

describe('semester catalog loader', () => {
  test('uses a persisted semester only when it exists', () => {
    expect(selectInitialSemester(manifest, '2026-summer')).toBe('2026-summer');
    expect(selectInitialSemester(manifest, '2025-fall')).toBe('2026-fall');
  });

  test('builds a public-base-aware course URL', () => {
    expect(getSemesterCatalogUrl('/class-arrange/', manifest.semesters[1])).toBe(
      '/class-arrange/data/semesters/2026-summer/courses.json',
    );
  });

  test('builds and validates a public-base-aware update feed URL', () => {
    expect(getSemesterUpdatesUrl('/class-arrange/', manifest.semesters[1])).toBe(
      '/class-arrange/data/semesters/2026-summer/updates.json',
    );
    expect(() =>
      getSemesterUpdatesUrl('/class-arrange/', {
        ...manifest.semesters[1],
        updatesFile: '../private.json',
      }),
    ).toThrow(/路径/);
  });

  test('validates and loads a matching course update feed', async () => {
    const feed = {
      schemaVersion: 1,
      semesterKey: '2026-summer',
      currentRevision: 'summer-r1',
      entries: [],
    };
    expect(validateSemesterUpdateFeed(feed)).toEqual(feed);

    const fetcher = vi.fn(async () => new Response(JSON.stringify(feed), { status: 200 }));
    await expect(loadSemesterUpdates(manifest.semesters[1], fetcher)).resolves.toEqual(feed);
  });

  test('does not accept a feed from another semester or revision', async () => {
    const wrongFeed = {
      schemaVersion: 1,
      semesterKey: '2026-fall',
      currentRevision: 'old',
      entries: [],
    };
    const fetcher = vi.fn(async () => new Response(JSON.stringify(wrongFeed), { status: 200 }));
    await expect(loadSemesterUpdates(manifest.semesters[1], fetcher)).rejects.toThrow(/更新记录/);
  });

  test('requires added classrooms to include a selected-course snapshot', () => {
    expect(() => validateSemesterUpdateFeed({
      schemaVersion: 1,
      semesterKey: '2026-summer',
      currentRevision: 'summer-r2',
      entries: [{
        id: 'r2',
        revision: 'summer-r2',
        previousRevision: 'summer-r1',
        publishedAt: '2026-07-15',
        summary: { added: 1, removed: 0, modified: 0 },
        added: [{ id: 'A.01', courseCode: 'A', courseName: '课程', teacher: '教师' }],
        removed: [],
        modified: [],
      }],
    })).toThrow(/无效条目/);
  });

  test('rejects duplicate semester keys and a missing default', () => {
    expect(() =>
      validateSemesterManifest({ ...manifest, semesters: [...manifest.semesters, manifest.semesters[0]] }),
    ).toThrow(SemesterCatalogError);
    expect(() => validateSemesterManifest({ ...manifest, defaultSemester: 'missing' })).toThrow(
      SemesterCatalogError,
    );
  });

  test('rejects duplicate courses and incomplete detail coverage', () => {
    expect(() =>
      validateSemesterCatalog({ ...catalog, courses: [...catalog.courses, catalog.courses[0]] }),
    ).toThrow(/重复/);
    expect(() => validateSemesterCatalog({ ...catalog, detailsBySection: {} })).toThrow(/详情/);
  });

  test('requires calendar bounds to match the semester API bounds', () => {
    const missingEnd = structuredClone(catalog) as unknown as Record<string, unknown>;
    delete ((missingEnd.semester as Record<string, unknown>).calendar as Record<string, unknown>).termEndDate;
    expect(() => validateSemesterCatalog(missingEnd)).toThrow(/日期/);

    const mismatchedEnd = structuredClone(catalog);
    mismatchedEnd.semester.calendar.termEndDate = '2026-08-03';
    expect(() => validateSemesterCatalog(mismatchedEnd)).toThrow(/日期/);
  });

  test('rejects a catalog whose semester does not match the manifest entry', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(catalog), { status: 200 }));
    await expect(loadSemesterCatalog(manifest.semesters[0], fetcher)).rejects.toThrow(/学期/);
  });
});
