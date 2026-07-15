import { describe, expect, it, vi } from 'vitest';
import type { CourseGroup, PlansState, ScheduleSlot } from '@/types';

vi.mock('@/utils/planSeed', () => ({
  genId: vi.fn(),
  makePlan: vi.fn(),
  nextDefaultPlanName: vi.fn(),
  nextDuplicatePlanName: vi.fn(),
}));

import { plansReducer } from '../store/plansReducer';
import {
  conflictingCourseNamesForSelection,
  idsForCourse,
  idsForGroup,
} from './courseSelection';

function makeGroup(
  courseCode: string,
  key: string,
  sectionIds: string[],
  schedule: ScheduleSlot[] = [],
): CourseGroup {
  return {
    courseCode,
    courseName: `Course ${courseCode}`,
    schedule,
    fingerprint: key,
    sectionIds,
    teachers: [],
    sections: [],
    key,
  };
}

const slot = (day: number, period: number): ScheduleSlot => ({
  weeks: [1, 1],
  day,
  periods: [period],
  room: '',
  campus: '本部',
});

describe('course selection ID scopes', () => {
  const firstGroup = makeGroup('A', 'A::first', ['A.02', 'A.01', 'A.02']);
  const secondGroup = makeGroup('A', 'A::second', ['A.03', 'A.01']);
  const groupsByCode = new Map<string, CourseGroup[]>([
    ['A', [firstGroup, secondGroup]],
  ]);

  it('returns stable de-duplicated IDs for one time group', () => {
    expect(idsForGroup(firstGroup)).toEqual(['A.02', 'A.01']);
    expect(firstGroup.sectionIds).toEqual(['A.02', 'A.01', 'A.02']);
  });

  it('returns stable de-duplicated IDs across every time group for a course', () => {
    expect(idsForCourse('A', groupsByCode)).toEqual(['A.02', 'A.01', 'A.03']);
    expect(idsForCourse('missing', groupsByCode)).toEqual([]);
  });

  it('supports partial/all selection and idempotent batch add/remove', () => {
    const state: PlansState = {
      activePlanId: 'plan-1',
      plans: [{
        id: 'plan-1',
        name: 'Plan 1',
        createdAt: 1,
        updatedAt: 1,
        courseIds: ['A.02', 'X.01'],
      }],
    };

    const addedAll = plansReducer(state, {
      type: 'addCourses',
      courseIds: idsForCourse('A', groupsByCode),
    });
    expect(addedAll.plans[0].courseIds).toEqual(['A.02', 'X.01', 'A.01', 'A.03']);

    const addedAllAgain = plansReducer(addedAll, {
      type: 'addCourses',
      courseIds: idsForCourse('A', groupsByCode),
    });
    expect(addedAllAgain.plans[0]).toBe(addedAll.plans[0]);

    const removedCurrentGroup = plansReducer(addedAllAgain, {
      type: 'removeCourses',
      courseIds: idsForGroup(firstGroup),
    });
    expect(removedCurrentGroup.plans[0].courseIds).toEqual(['X.01', 'A.03']);

    const removedAll = plansReducer(removedCurrentGroup, {
      type: 'removeCourses',
      courseIds: idsForCourse('A', groupsByCode),
    });
    expect(removedAll.plans[0].courseIds).toEqual(['X.01']);

    const removedAllAgain = plansReducer(removedAll, {
      type: 'removeCourses',
      courseIds: idsForCourse('A', groupsByCode),
    });
    expect(removedAllAgain.plans[0]).toBe(removedAll.plans[0]);
  });
});

describe('course selection conflict summaries', () => {
  it('reports only courses that conflict with the selected scope', () => {
    const candidate = makeGroup('A', 'A::candidate', ['A.01'], [slot(1, 1)]);
    const sameCourseAlternative = makeGroup('A', 'A::other', ['A.02'], [slot(1, 1)]);
    const actualConflict = makeGroup('B', 'B::one', ['B.01'], [slot(1, 1)]);
    const unrelatedConflictOne = makeGroup('C', 'C::one', ['C.01'], [slot(2, 2)]);
    const unrelatedConflictTwo = makeGroup('D', 'D::one', ['D.01'], [slot(2, 2)]);

    expect(conflictingCourseNamesForSelection(
      [candidate],
      [sameCourseAlternative, actualConflict, unrelatedConflictOne, unrelatedConflictTwo],
    )).toEqual(['Course B']);
  });
});
