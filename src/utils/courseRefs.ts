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

/** 在 text 中查找 key 的所有出现位置（起始索引）。 */
function findAllIndices(text: string, key: string): number[] {
  const indices: number[] = [];
  if (!key) return indices;
  let from = 0;
  let idx = text.indexOf(key, from);
  while (idx !== -1) {
    indices.push(idx);
    from = idx + 1;
    idx = text.indexOf(key, from);
  }
  return indices;
}

/** 判断 [start, end) 是否被任一区间完全包含。 */
function isContained(
  start: number,
  end: number,
  ranges: readonly (readonly [number, number])[],
): boolean {
  return ranges.some(([s, e]) => start >= s && end <= e);
}

/**
 * 从文本识别当前学期存在的课程号与课堂号。
 *
 * 不依赖正则边界，而是遍历 courseMap / groupsByCode 的 key 在文本中查找子串，
 * 这样能识别被噪音文字包围的编号（如 "001101.01wfw..001108aodfd"）。
 * 用位置重叠排除"课程号仅作为课堂号前缀/子串出现"的误识别
 * （如文本 "001101.01" 里的 "001101" 不应再当纯课程号）。
 */
export function extractCourseRefs(text: string, ctx: CourseRefContext): RecognizedRef[] {
  const { courseMap, groupsByCode } = ctx;

  // 课堂号：遍历 courseMap 的 key，记录在文本中出现的位置区间。
  const sectionRanges: Array<readonly [number, number]> = [];
  const sectionIds = new Set<string>();
  for (const id of courseMap.keys()) {
    const indices = findAllIndices(text, id);
    if (indices.length === 0) continue;
    sectionIds.add(id);
    for (const start of indices) {
      sectionRanges.push([start, start + id.length] as const);
    }
  }

  // 课程号：遍历 groupsByCode 的 key，只要有任一出现位置不被课堂号区间包含，即识别。
  const plainCodes = new Set<string>();
  for (const code of groupsByCode.keys()) {
    const indices = findAllIndices(text, code);
    if (indices.length === 0) continue;
    const hasIndependent = indices.some(
      (start) => !isContained(start, start + code.length, sectionRanges),
    );
    if (hasIndependent) plainCodes.add(code);
  }

  // 纯课程号 -> 分组（含全部班次）；其 courseCode 下的单独课堂号不再重复展示。
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
