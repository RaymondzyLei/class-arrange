import type { CourseGroup, CourseSection } from '@/types';
import { getCourseCode } from './courseGroup';
import { idsForCourse } from './courseSelection';

export interface RecognizedCourseRef {
  type: 'course';
  courseCode: string;
  courseName: string;
  sectionIds: string[];
}

export interface RecognizedSectionRef {
  type: 'section';
  sectionId: string;
  courseCode: string;
  courseName: string;
}

export type RecognizedRef = RecognizedCourseRef | RecognizedSectionRef;

export interface CourseRefContext {
  courseMap: ReadonlyMap<string, CourseSection>;
  groupsByCode: ReadonlyMap<string, CourseGroup[]>;
}

/** 课堂号：6位数字+可选字母后缀+ . +2位数字，如 001101.01 / 001661EX.01 */
const SECTION_ID_RE = /\b\d{6}[A-Z]*\.\d{2}\b/g;
/** 纯课程号：6位数字+可选字母后缀，且后面不跟 ".数字"（排除课堂号前缀），如 001101 / 001661EX */
const COURSE_CODE_RE = /\b\d{6}[A-Z]*(?!\.\d)/g;

export function extractCourseRefs(text: string, ctx: CourseRefContext): RecognizedRef[] {
  const { courseMap, groupsByCode } = ctx;

  const sectionIds = new Set<string>();
  for (const match of text.matchAll(SECTION_ID_RE)) {
    const id = match[0];
    if (courseMap.has(id)) sectionIds.add(id);
  }

  const plainCodes = new Set<string>();
  for (const match of text.matchAll(COURSE_CODE_RE)) {
    const code = match[0];
    if (groupsByCode.has(code)) plainCodes.add(code);
  }

  // 纯课程号 -> 分组（含全部班次）；其 courseCode 下的单独课堂号不再重复展示
  const courseRefs: RecognizedCourseRef[] = [...plainCodes].map((code) => {
    const groups = groupsByCode.get(code)!;
    return {
      type: 'course',
      courseCode: code,
      courseName: groups[0]?.courseName ?? code,
      sectionIds: idsForCourse(code, groupsByCode),
    };
  });

  const sectionRefs: RecognizedSectionRef[] = [...sectionIds]
    .filter((id) => !plainCodes.has(getCourseCode(id)))
    .map((id) => {
      const course = courseMap.get(id)!;
      return {
        type: 'section',
        sectionId: id,
        courseCode: getCourseCode(id),
        courseName: course.courseName,
      };
    });

  return [...courseRefs, ...sectionRefs];
}
