import { describe, expect, test } from 'vitest';
import { newestFirstByDate } from './updateOrdering';

describe('newestFirstByDate', () => {
  test('sorts valid dates newest first without mutating the source', () => {
    const input = [
      { id: 'old', date: '2026-07-16' },
      { id: 'new', date: '2026-07-18T02:44:35Z' },
    ];

    expect(newestFirstByDate(input, (item) => item.date).map(({ id }) => id))
      .toEqual(['new', 'old']);
    expect(input.map(({ id }) => id)).toEqual(['old', 'new']);
  });

  test('puts later source entries first for matching dates', () => {
    const input = [
      { id: 'first', date: '2026-07-18' },
      { id: 'later', date: '2026-07-18' },
    ];

    expect(newestFirstByDate(input, (item) => item.date).map(({ id }) => id))
      .toEqual(['later', 'first']);
  });

  test('places invalid dates after valid ones and uses text fallback', () => {
    const input = [
      { id: 'invalid-a', date: 'not-a-date' },
      { id: 'valid', date: '2026-07-18' },
      { id: 'invalid-z', date: 'z-date' },
    ];

    expect(newestFirstByDate(input, (item) => item.date).map(({ id }) => id))
      .toEqual(['valid', 'invalid-z', 'invalid-a']);
    expect(newestFirstByDate([], (item: { date: string }) => item.date)).toEqual([]);
  });
});
