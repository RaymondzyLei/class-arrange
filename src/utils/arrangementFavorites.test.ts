import { describe, expect, it } from 'vitest';
import type { Arrangement, ArrangementFavoriteRecord, CourseGroup } from '@/types';
import {
  activeArrangementFavoritePreferences,
  activeArrangementFavoriteIds,
  arrangementNumbersById,
  createArrangementFavoriteRecord,
} from './arrangementFavorites';

const group = (key: string, courseName: string): CourseGroup => ({
  key,
  courseCode: key,
  courseName,
  schedule: [],
  fingerprint: key,
  sectionIds: [`${key}.01`],
  teachers: [],
  sections: [{ credits: 2, hours: 32 }] as CourseGroup['sections'],
});

const arrangement = (id: string): Arrangement => ({
  id,
  groups: [group(`${id}-course`, `课程 ${id}`)],
  conflictCount: 1,
  courseCount: 1,
  totalCredits: 2,
  totalHours: 32,
});

describe('arrangement favorite metadata', () => {
  it('keeps a favorite original number when ranking moves it to the front', () => {
    const records: ArrangementFavoriteRecord[] = [{
      ...createArrangementFavoriteRecord(
        { id: 'p1', name: '方案一', createdAt: 0, updatedAt: 0, courseIds: [] },
        arrangement('fav'),
        3,
      ),
    }];
    const numbers = arrangementNumbersById(
      [arrangement('fav'), arrangement('original-0'), arrangement('original-1')],
      records,
      'p1',
    );

    expect(numbers.get('fav')).toBe(3);
    expect(numbers.get('original-0')).toBe(0);
    expect(numbers.get('original-1')).toBe(1);
  });

  it('scopes arrangement favorites to their owning plan while retaining legacy ids', () => {
    const record = createArrangementFavoriteRecord(
      { id: 'p1', name: '方案一', createdAt: 0, updatedAt: 0, courseIds: [] },
      arrangement('owned'),
      2,
    );

    expect(activeArrangementFavoriteIds(['owned', 'legacy'], [record], 'p1'))
      .toEqual(['owned', 'legacy']);
    expect(activeArrangementFavoriteIds(['owned', 'legacy'], [record], 'p2'))
      .toEqual(['legacy']);
  });

  it('limits course favorites to groups selected by the active plan', () => {
    const selected = group('selected', '已选课程');

    expect(activeArrangementFavoritePreferences(
      ['arrangement'],
      [selected.key, 'unselected'],
      [selected.sectionIds[0], 'unselected.01'],
      [selected],
    )).toEqual({
      arrangementIds: ['arrangement'],
      timeGroupKeys: [selected.key],
      sectionIds: [selected.sectionIds[0]],
    });
  });
});
