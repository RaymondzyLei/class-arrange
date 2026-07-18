import type { CourseGroup, CourseSection, ScheduleSlot } from '@/types';
import { expandWeeks } from './weeks';
import { exactScheduleInterval } from './scheduleTime';

/**
 * 从课堂号提取课程号：去掉最后一个 "." 及其后的班次后缀。
 * "001101.01" → "001101"
 * "001661EX.01" → "001661EX"
 * "001101"（无点） → "001101"（防御性处理）
 */
export function getCourseCode(id: string): string {
  const dot = id.lastIndexOf('.');
  return dot === -1 ? id : id.slice(0, dot);
}

function slotTimeFingerprint(slot: ScheduleSlot): string {
  const periods = [...slot.periods].sort((a, b) => a - b);
  const exact = exactScheduleInterval(slot);
  const clock = exact
    ? `:${exact.start}-${exact.end}`
    : slot.startTime || slot.endTime
      ? `:raw-${slot.startTime?.trim() ?? ''}-${slot.endTime?.trim() ?? ''}`
      : '';
  return `${slot.day}:${periods.join(',')}${clock}:${slot.campus}`;
}

/**
 * 把整个 schedule 数组展开为逐周占用指纹。
 * 相同星期、节次和校区的 1~9 周 + 10~18 周与 1~18 周得到相同结果。
 * 忽略具体教室，但保留未指定周次的独立标记，避免与明确周次误合并。
 * 空 schedule → 空字符串（"时间未定"，同课程号下所有未定班次合并为一组）。
 */
export function scheduleFingerprint(schedule: ScheduleSlot[]): string {
  if (schedule.length === 0) return '';
  const occupied = new Set<string>();
  for (const slot of schedule) {
    const time = slotTimeFingerprint(slot);
    const weeks = expandWeeks(slot.weeks);
    if (weeks.length === 0) {
      occupied.add(`week-unspecified:${time}`);
      continue;
    }
    for (const week of weeks) occupied.add(`week-${week}:${time}`);
  }
  return [...occupied].sort().join('|');
}

/** 单个 section 的组键：`${courseCode}::${fingerprint}` */
export function groupKeyForSection(section: CourseSection): string {
  return `${getCourseCode(section.id)}::${scheduleFingerprint(section.schedule)}`;
}

/**
 * 对一组 section 全量聚合为 CourseGroup[]。
 * 聚合规则：按 courseCode 分桶，桶内再按 fingerprint 分组。
 * 输入顺序不影响结果分组，但组内 sectionIds/sections 保持输入相对顺序。
 */
export function buildCourseGroups(sections: CourseSection[]): CourseGroup[] {
  const buckets = new Map<string, CourseSection[]>();
  for (const sec of sections) {
    const key = groupKeyForSection(sec);
    let arr = buckets.get(key);
    if (!arr) {
      arr = [];
      buckets.set(key, arr);
    }
    arr.push(sec);
  }

  const groups: CourseGroup[] = [];
  for (const [key, arr] of buckets) {
    const rep = arr[0];
    const teachers: string[] = [];
    const seen = new Set<string>();
    for (const s of arr) {
      if (s.teacher && !seen.has(s.teacher)) {
        seen.add(s.teacher);
        teachers.push(s.teacher);
      }
    }
    groups.push({
      key,
      courseCode: getCourseCode(rep.id),
      courseName: rep.courseName,
      schedule: rep.schedule,
      fingerprint: scheduleFingerprint(rep.schedule),
      sectionIds: arr.map((s) => s.id),
      teachers,
      sections: arr,
    });
  }
  return groups;
}

/**
 * 仅用于课程列表展示：把同一课程号下的多个时间组合成一张卡片。
 * 单时间组课程保留原对象，避免无意义的 key 和引用变化；多时间组课程
 * 通过 timeGroups 保存规范分组，选课、冲突检测和排课计算仍使用原分组。
 */
export function mergeCourseTimeGroups(groups: CourseGroup[]): CourseGroup[] {
  const byCourse = new Map<string, CourseGroup[]>();
  for (const group of groups) {
    const bucket = byCourse.get(group.courseCode);
    if (bucket) bucket.push(group);
    else byCourse.set(group.courseCode, [group]);
  }

  return [...byCourse.values()].map((timeGroups) => {
    if (timeGroups.length === 1) return timeGroups[0];
    const first = timeGroups[0];
    const sections: CourseSection[] = [];
    const sectionIds: string[] = [];
    const teachers: string[] = [];
    const seenSections = new Set<string>();
    const seenTeachers = new Set<string>();
    for (const group of timeGroups) {
      for (const section of group.sections) {
        if (seenSections.has(section.id)) continue;
        seenSections.add(section.id);
        sections.push(section);
        sectionIds.push(section.id);
      }
      for (const teacher of group.teachers) {
        if (!teacher || seenTeachers.has(teacher)) continue;
        seenTeachers.add(teacher);
        teachers.push(teacher);
      }
    }
    return {
      key: `${first.courseCode}::all-time-groups`,
      courseCode: first.courseCode,
      courseName: first.courseName,
      schedule: [],
      fingerprint: 'all-time-groups',
      sectionIds,
      teachers,
      sections,
      timeGroups,
    };
  });
}

/** section.id → 所属 CourseGroup 的索引，供冲突检测/查组用 */
export function buildGroupIndex(sections: CourseSection[]): Map<string, CourseGroup> {
  const groups = buildCourseGroups(sections);
  const index = new Map<string, CourseGroup>();
  for (const g of groups) {
    for (const id of g.sectionIds) index.set(id, g);
  }
  return index;
}
