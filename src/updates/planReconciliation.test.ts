import { describe, expect, test } from 'vitest';
import type {
  CourseSection,
  PlansState,
  SelectedCourseSnapshot,
  SemesterUpdateBatch,
} from '@/types';
import type { StoredPlansPayloadV2 } from '@/utils/planSeed';
import {
  acknowledgeImpacts,
  reconcilePlansWithCatalog,
  reconcilePlansWithUpdates,
} from './planReconciliation';

function snapshot(
  id: string,
  teacher = '张老师',
  room = '5101',
  level?: string,
): SelectedCourseSnapshot {
  return {
    id,
    courseCode: id.split('.')[0],
    courseName: '高等数学',
    teacher,
    schedule: [{ weeks: [1, 16], room, campus: '本部', day: 1, periods: [1, 2] }],
    ...(level === undefined ? {} : { level }),
  };
}

function payload(state: PlansState, selected = snapshot('MATH100.01')): StoredPlansPayloadV2 {
  return {
    version: 2,
    state,
    selectedSnapshots: { [selected.id]: selected },
    impactHistory: [],
    pendingImpacts: [],
    catalogRevision: 'r1',
  };
}

function batch(partial: Partial<SemesterUpdateBatch>): SemesterUpdateBatch {
  return {
    id: '2026-fall:r2',
    revision: 'r2',
    previousRevision: 'r1',
    publishedAt: '2026-07-15T00:00:00Z',
    summary: { added: 0, removed: 0, modified: 0 },
    added: [],
    removed: [],
    modified: [],
    ...partial,
  };
}

const twoPlans: PlansState = {
  activePlanId: 'p1',
  plans: [
    { id: 'p1', name: '主方案', createdAt: 1, updatedAt: 1, courseIds: ['MATH100.01'] },
    { id: 'p2', name: '备选方案', createdAt: 1, updatedAt: 1, courseIds: ['MATH100.01'] },
  ],
};

describe('selected-course update reconciliation', () => {
  test('does not notify when a selected course only reorders the same teachers', () => {
    const previous = snapshot('MATH100.01', '张老师,李老师');
    const current = {
      ...snapshot('MATH100.01', '李老师,张老师'),
      department: { code: 'MATH', name: '数学学院' },
      credits: 4,
      hours: 64,
      level: '本科',
      sectionType: '计划内',
      category: '',
      courseType: '理论课',
      language: '中文',
      examType: '闭卷',
      grading: '百分制',
      undergradShared: false,
      enrolled: 1,
      capacity: 30,
      classes: [],
      rawSchedule: '',
    } satisfies CourseSection;

    const result = reconcilePlansWithCatalog(
      payload(twoPlans, previous),
      '2026-fall',
      'r2',
      new Map([[current.id, current]]),
      100,
    );

    expect(result.pendingImpacts).toEqual([]);
    expect(result.selectedSnapshots['MATH100.01'].teacher).toBe('李老师,张老师');
  });

  test('removes a deleted classroom from every plan and records all affected plans', () => {
    const removed = snapshot('MATH100.01');
    const result = reconcilePlansWithUpdates(
      payload(twoPlans),
      '2026-fall',
      'r2',
      [batch({ removed: [{ course: removed, replacementCandidates: [snapshot('MATH100.02')] }] })],
      100,
    );

    expect(result.state.plans.map((plan) => plan.courseIds)).toEqual([[], []]);
    expect(result.state.plans.map((plan) => plan.updatedAt)).toEqual([100, 100]);
    expect(result.pendingImpacts[0]).toMatchObject({
      kind: 'removed',
      semesterKey: '2026-fall',
      courseId: 'MATH100.01',
      affectedPlans: [
        { planId: 'p1', planName: '主方案', wasActive: true },
        { planId: 'p2', planName: '备选方案', wasActive: false },
      ],
      replacementCandidates: [{ id: 'MATH100.02' }],
    });
    expect(result.impactHistory).toEqual(result.pendingImpacts);
    expect(result.catalogRevision).toBe('r2');
  });

  test('folds missed revisions to the final existing classroom before changing a plan', () => {
    const removed = snapshot('MATH100.01');
    const restored = snapshot('MATH100.01', '李老师');
    const result = reconcilePlansWithUpdates(
      payload(twoPlans),
      '2026-fall',
      'r3',
      [
        batch({ revision: 'r2', removed: [{ course: removed, replacementCandidates: [] }] }),
        batch({
          id: '2026-fall:r3',
          previousRevision: 'r2',
          revision: 'r3',
          added: [restored],
        }),
      ],
      100,
    );

    expect(result.state).toEqual(twoPlans);
    expect(result.pendingImpacts).toHaveLength(1);
    expect(result.pendingImpacts[0]).toMatchObject({
      kind: 'modified',
      changes: [{ field: 'teacher', label: '授课教师' }],
    });
  });

  test('only creates a personalized modification for teacher, time, or location', () => {
    const oldSnapshot = snapshot('MATH100.01');
    const newSnapshot = snapshot('MATH100.01', '李老师', '5201');
    const result = reconcilePlansWithUpdates(
      payload(twoPlans, oldSnapshot),
      '2026-fall',
      'r2',
      [batch({
        modified: [{
          course: newSnapshot,
          previous: oldSnapshot,
          current: newSnapshot,
          changes: [
            { field: 'teacher', label: '授课教师', before: '张老师', after: '李老师' },
            { field: 'location', label: '上课地点或校区', before: '5101', after: '5201' },
            { field: 'capacity', label: '课容量', before: 30, after: 40 },
          ],
        }],
      })],
      100,
    );

    expect(result.state).toEqual(twoPlans);
    expect(result.pendingImpacts[0].changes.map((change) => change.field)).toEqual([
      'teacher',
      'location',
    ]);
    expect(result.selectedSnapshots['MATH100.01']).toEqual(newSnapshot);
  });

  test('does not report a location change when only the meeting day changes', () => {
    const oldSnapshot = snapshot('MATH100.01');
    const newSnapshot = structuredClone(oldSnapshot);
    newSnapshot.schedule[0].day = 2;

    const result = reconcilePlansWithUpdates(
      payload(twoPlans, oldSnapshot),
      '2026-fall',
      'r2',
      [batch({
        modified: [{
          course: newSnapshot,
          previous: oldSnapshot,
          current: newSnapshot,
          changes: [{ field: 'schedule', label: '上课时间与周次' }],
        }],
      })],
      100,
    );

    expect(result.pendingImpacts[0].changes.map((change) => change.field)).toEqual(['schedule']);
  });

  test('treats a real education level change as a personalized modification', () => {
    const oldSnapshot = snapshot('MATH100.01', '张老师', '5101', '本科');
    const newSnapshot = snapshot('MATH100.01', '张老师', '5101', '研究生');
    const result = reconcilePlansWithUpdates(
      payload(twoPlans, oldSnapshot),
      '2026-fall',
      'r2',
      [batch({
        modified: [{
          course: newSnapshot,
          previous: oldSnapshot,
          current: newSnapshot,
          changes: [{ field: 'level', label: '学历层次', before: '本科', after: '研究生' }],
        }],
      })],
      100,
    );

    expect(result.pendingImpacts[0].changes).toEqual([
      { field: 'level', label: '学历层次', before: '本科', after: '研究生' },
    ]);
  });

  test('baselines a legacy selected snapshot without reporting its missing education level', () => {
    const previous = snapshot('MATH100.01');
    const current = {
      ...previous,
      department: { code: 'MATH', name: '数学学院' },
      credits: 4,
      hours: 64,
      level: '本科',
      sectionType: '计划内',
      category: '',
      courseType: '理论课',
      language: '中文',
      examType: '闭卷',
      grading: '百分制',
      undergradShared: false,
      enrolled: 1,
      capacity: 30,
      classes: [],
      rawSchedule: '',
    } satisfies CourseSection;

    const result = reconcilePlansWithCatalog(
      payload(twoPlans, previous),
      '2026-fall',
      'r2',
      new Map([[current.id, current]]),
      100,
    );

    expect(result.pendingImpacts).toEqual([]);
    expect(result.selectedSnapshots[current.id].level).toBe('本科');
  });

  test('uses the update feed baseline when a legacy snapshot has no education level', () => {
    const legacySnapshot = snapshot('MATH100.01');
    const previous = snapshot('MATH100.01', '张老师', '5101', '本科');
    const current = snapshot('MATH100.01', '张老师', '5101', '研究生');

    const result = reconcilePlansWithUpdates(
      payload(twoPlans, legacySnapshot),
      '2026-fall',
      'r2',
      [batch({
        modified: [{
          course: current,
          previous,
          current,
          changes: [{ field: 'level', label: '学历层次', before: '本科', after: '研究生' }],
        }],
      })],
      100,
    );

    expect(result.pendingImpacts[0].changes).toEqual([
      { field: 'level', label: '学历层次', before: '本科', after: '研究生' },
    ]);
    expect(result.selectedSnapshots[current.id].level).toBe('研究生');
  });

  test('does not report a location change when one location gains another time range', () => {
    const oldSnapshot = snapshot('MATH100.01');
    const newSnapshot = structuredClone(oldSnapshot);
    newSnapshot.schedule.push({
      weeks: [17, 18],
      room: '5101',
      campus: '本部',
      day: 1,
      periods: [1, 2],
    });

    const result = reconcilePlansWithUpdates(
      payload(twoPlans, oldSnapshot),
      '2026-fall',
      'r2',
      [batch({
        modified: [{
          course: newSnapshot,
          previous: oldSnapshot,
          current: newSnapshot,
          changes: [{ field: 'schedule', label: '上课时间与周次' }],
        }],
      })],
      100,
    );

    expect(result.pendingImpacts[0].changes.map((change) => change.field)).toEqual(['schedule']);
  });

  test('does not report a time change when one occupied range is only split into fragments', () => {
    const oldSnapshot = snapshot('MATH100.01');
    oldSnapshot.schedule[0].weeks = [8, 13];
    const newSnapshot = structuredClone(oldSnapshot);
    newSnapshot.schedule = [
      { ...newSnapshot.schedule[0], weeks: [8, 9] },
      { ...newSnapshot.schedule[0], weeks: [10, 13] },
    ];

    const result = reconcilePlansWithUpdates(
      payload(twoPlans, oldSnapshot),
      '2026-fall',
      'r2',
      [batch({
        modified: [{
          course: newSnapshot,
          previous: oldSnapshot,
          current: newSnapshot,
          changes: [{ field: 'schedule', label: '上课时间与周次' }],
        }],
      })],
      100,
    );

    expect(result.pendingImpacts).toEqual([]);
    expect(result.selectedSnapshots['MATH100.01'].schedule).toEqual(newSnapshot.schedule);
  });

  test('acknowledges only the displayed pending impacts and keeps history', () => {
    const reconciled = reconcilePlansWithUpdates(
      payload(twoPlans),
      '2026-fall',
      'r2',
      [batch({ removed: [{ course: snapshot('MATH100.01'), replacementCandidates: [] }] })],
      100,
    );
    const acknowledged = acknowledgeImpacts(reconciled, [reconciled.pendingImpacts[0].id]);

    expect(acknowledged.pendingImpacts).toEqual([]);
    expect(acknowledged.impactHistory).toHaveLength(1);
  });

  test('uses the active catalog as a deletion fallback and snapshots valid selections', () => {
    const validCourse = {
      ...snapshot('PHYS100.01'),
      department: { code: 'PHYS', name: '物理学院' },
      credits: 4,
      hours: 64,
      level: '本科',
      sectionType: '计划内',
      category: '',
      courseType: '理论课',
      language: '中文',
      examType: '闭卷',
      grading: '百分制',
      undergradShared: false,
      enrolled: 1,
      capacity: 30,
      classes: [],
      rawSchedule: '',
    } satisfies CourseSection;
    const withValidCourse: PlansState = {
      ...twoPlans,
      plans: twoPlans.plans.map((plan) => ({
        ...plan,
        courseIds: [...plan.courseIds, 'PHYS100.01'],
      })),
    };

    const result = reconcilePlansWithCatalog(
      payload(withValidCourse),
      '2026-fall',
      'r2',
      new Map([[validCourse.id, validCourse]]),
      100,
    );

    expect(result.state.plans.map((plan) => plan.courseIds)).toEqual([
      ['PHYS100.01'],
      ['PHYS100.01'],
    ]);
    expect(result.pendingImpacts[0]).toMatchObject({
      kind: 'removed',
      courseId: 'MATH100.01',
      courseName: '高等数学',
    });
    expect(result.selectedSnapshots['PHYS100.01']).toMatchObject({
      id: 'PHYS100.01',
      teacher: '张老师',
    });
  });
});
