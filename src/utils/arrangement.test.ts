import { describe, it, expect } from 'vitest';
import type { CourseGroup } from '@/types';
import { findAmbiguousCodes, enumerateArrangements } from './arrangement';

function mkGroup(courseCode: string, key: string): CourseGroup {
  return {
    courseCode,
    courseName: `Course ${courseCode}`,
    schedule: [],
    fingerprint: '',
    sectionIds: [`${courseCode}.01`],
    teachers: ['T'],
    sections: [],
    key,
  };
}

describe('findAmbiguousCodes', () => {
  it('空输入返回空数组', () => {
    expect(findAmbiguousCodes([])).toEqual([]);
  });

  it('每个 courseCode 只出现一次 → 空数组', () => {
    const groups = [mkGroup('001', 'a'), mkGroup('002', 'b'), mkGroup('003', 'c')];
    expect(findAmbiguousCodes(groups)).toEqual([]);
  });

  it('同一 courseCode 出现两次 → 列表里出现一次', () => {
    const groups = [
      mkGroup('MATH1006', 'm1'),
      mkGroup('PHYS1000', 'p1'),
      mkGroup('MATH1006', 'm2'),
    ];
    expect(findAmbiguousCodes(groups)).toEqual(['MATH1006']);
  });

  it('多个 courseCode 各自重复 → 全部列出且首次出现顺序', () => {
    const groups = [
      mkGroup('A', 'a1'),
      mkGroup('B', 'b1'),
      mkGroup('A', 'a2'),
      mkGroup('B', 'b2'),
      mkGroup('C', 'c1'), // 唯一
    ];
    expect(findAmbiguousCodes(groups)).toEqual(['A', 'B']);
  });
});

describe('enumerateArrangements', () => {
  it('空输入返回空数组', () => {
    expect(enumerateArrangements([])).toEqual([]);
  });

  it('无歧义：返回长度为 1 的数组（唯一确定）', () => {
    const groups = [
      mkGroup('A', 'a1'),
      mkGroup('B', 'b1'),
      mkGroup('C', 'c1'),
    ];
    const arrs = enumerateArrangements(groups);
    expect(arrs).toHaveLength(1);
    expect(arrs[0].groups).toEqual(groups);
    expect(arrs[0].conflictCount).toBe(0);
  });

  it('单门课程 2 个 group → 2 个安排', () => {
    const groups = [
      mkGroup('MATH1006', 'm1'),
      mkGroup('MATH1006', 'm2'),
    ];
    const arrs = enumerateArrangements(groups);
    expect(arrs).toHaveLength(2);
    expect(arrs.map((a) => a.id)).toEqual(['arr-0', 'arr-1']);
  });

  it('两门课程各 2 个 group → 4 个安排', () => {
    const groups = [
      mkGroup('A', 'a1'),
      mkGroup('A', 'a2'),
      mkGroup('B', 'b1'),
      mkGroup('B', 'b2'),
    ];
    const arrs = enumerateArrangements(groups);
    expect(arrs).toHaveLength(4);
  });

  it('安排按冲突数升序', () => {
    // m1 与 p1 时间重叠，m2 不冲突
    const groups: CourseGroup[] = [
      { ...mkGroup('M', 'm1'), schedule: [{ weeks: [1], day: 1, periods: [1, 2], room: '' }], fingerprint: 'm1' },
      { ...mkGroup('M', 'm2'), schedule: [{ weeks: [1], day: 3, periods: [5, 6], room: '' }], fingerprint: 'm2' },
      { ...mkGroup('P', 'p1'), schedule: [{ weeks: [1], day: 1, periods: [2, 3], room: '' }], fingerprint: 'p1' },
    ];
    const arrs = enumerateArrangements(groups);
    // (m1, p1) 冲突 → 排在后；(m2, p1) 不冲突 → 排在前
    const conflictFreeIdx = arrs.findIndex((a) => a.conflictCount === 0);
    expect(conflictFreeIdx).toBe(0);
    expect(arrs[arrs.length - 1].conflictCount).toBeGreaterThan(0);
  });

  it('冲突数相同时按 group.keys 字典序稳定排序', () => {
    // 两个安排冲突数都为 0，按字典序
    const groups = [
      mkGroup('X', 'x2'), // 输入顺序 x2 在前
      mkGroup('X', 'x1'),
      mkGroup('Y', 'y1'),
    ];
    const arrs = enumerateArrangements(groups);
    // 第一个安排始终是 (x1, y1)，因为排序稳定
    const keys0 = arrs[0].groups.map((g) => g.key).sort().join(',');
    expect(keys0).toBe('x1,y1');
  });
});
