import { describe, expect, it } from 'vitest';
import { courseMatchesKeyword } from './courseSearch';

const course = {
  courseName: '数学实验',
  id: '001108.01',
  teacher: '王新茂',
};

describe('course keyword matching', () => {
  it('matches course names and section ids without teacher search enabled', () => {
    expect(courseMatchesKeyword(course, '数学', false)).toBe(true);
    expect(courseMatchesKeyword(course, '1108', false)).toBe(true);
  });

  it('does not match a teacher name by default', () => {
    expect(courseMatchesKeyword(course, '新茂', false)).toBe(false);
  });

  it('matches a teacher name after teacher search is enabled', () => {
    expect(courseMatchesKeyword(course, '新茂', true)).toBe(true);
  });
});
