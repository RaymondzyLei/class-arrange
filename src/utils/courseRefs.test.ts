import { describe, expect, it } from 'vitest';
import type { CourseGroup, CourseSection } from '@/types';
import { extractCourseRefs } from './courseRefs';

function makeCourse(id: string, name: string): CourseSection {
  return { id, courseName: name } as unknown as CourseSection;
}
function makeGroup(code: string, name: string, sectionIds: string[]): CourseGroup {
  return { courseCode: code, courseName: name, sectionIds } as unknown as CourseGroup;
}

const ctx = {
  courseMap: new Map<string, CourseSection>([
    ['001101.01', makeCourse('001101.01', '计算概论')],
    ['001101.02', makeCourse('001101.02', '计算概论')],
    ['001661EX.01', makeCourse('001661EX.01', '英语')],
    ['001661.01', makeCourse('001661.01', '前缀课')],
    ['MARX1014.01', makeCourse('MARX1014.01', '马原')],
    ['003154e.01', makeCourse('003154e.01', '小写课')],
  ]),
  groupsByCode: new Map<string, CourseGroup[]>([
    ['001101', [makeGroup('001101', '计算概论', ['001101.01', '001101.02'])]],
    ['001661EX', [makeGroup('001661EX', '英语', ['001661EX.01'])]],
    ['001661', [makeGroup('001661', '前缀课', ['001661.01'])]],
    ['MARX1014', [makeGroup('MARX1014', '马原', ['MARX1014.01'])]],
    ['003154e', [makeGroup('003154e', '小写课', ['003154e.01'])]],
  ]),
};

describe('extractCourseRefs', () => {
  it('识别课堂号并过滤不存在的', () => {
    const refs = extractCourseRefs('选 001101.01 和 999999.99', ctx);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ type: 'section', sectionId: '001101.01', courseName: '计算概论' });
  });

  it('识别纯课程号并展开为分组', () => {
    const refs = extractCourseRefs('要选 001101', ctx);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ type: 'course', courseCode: '001101' });
    expect((refs[0] as { sectionIds: string[] }).sectionIds).toEqual(['001101.01', '001101.02']);
  });

  it('课程号不误匹配课堂号前缀', () => {
    // 001101.01 是课堂号，不应再把 001101 当纯课程号
    const refs = extractCourseRefs('001101.01', ctx);
    expect(refs).toHaveLength(1);
    expect(refs[0].type).toBe('section');
  });

  it('纯课程号覆盖其课堂号，避免重复', () => {
    // 同时出现 001101（纯）和 001101.01（课堂号）：保留分组，不单独展示课堂号
    const refs = extractCourseRefs('001101 和 001101.01', ctx);
    expect(refs).toHaveLength(1);
    expect(refs[0].type).toBe('course');
  });

  it('兼容字母后缀课程号', () => {
    const refs = extractCourseRefs('英语 001661EX.01', ctx);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ sectionId: '001661EX.01' });
  });

  it('识别字母开头的课程号', () => {
    const refs = extractCourseRefs('选 MARX1014', ctx);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ type: 'course', courseCode: 'MARX1014', courseName: '马原' });
  });

  it('识别小写后缀课堂号', () => {
    const refs = extractCourseRefs('003154e.01', ctx);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ type: 'section', sectionId: '003154e.01' });
  });

  it('前缀课程号不误识别（001661EX.01 不应回溯匹配 001661）', () => {
    const refs = extractCourseRefs('001661EX.01', ctx);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ sectionId: '001661EX.01' });
    expect(refs.some((r) => r.type === 'course' && r.courseCode === '001661')).toBe(false);
  });

  it('不误识别日期数字为课程号', () => {
    const refs = extractCourseRefs('2026-08-30 开学', ctx);
    expect(refs).toHaveLength(0);
  });

  it('无识别时返回空数组', () => {
    expect(extractCourseRefs('没有课程号', ctx)).toEqual([]);
  });
});
