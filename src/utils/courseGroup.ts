import type { CourseGroup, CourseSection, ScheduleSlot } from '@/types';
import { courses } from '@/data';
import { expandWeeks } from './weeks';

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

/**
 * 把单个 ScheduleSlot 归一化为可比较字符串：`周次列表:星期:节次列表`。
 * 周次用 expandWeeks 展开为完整集合，消除 [1,9] 与 [1,2,...,9] 的编码差异。
 * 节次排序后连接。忽略教室（教室不影响"时间相同"判定）。
 */
function slotFingerprint(slot: ScheduleSlot): string {
  const weeks = expandWeeks(slot.weeks).sort((a, b) => a - b);
  const periods = [...slot.periods].sort((a, b) => a - b);
  return `${weeks.join(',')}:${slot.day}:${periods.join(',')}`;
}

/**
 * 把整个 schedule 数组归一化为时间指纹。
 * 多个 slot 按指纹字典序排序后用 "|" 连接，保证顺序无关。
 * 空 schedule → 空字符串（"时间未定"，同课程号下所有未定班次合并为一组）。
 */
export function scheduleFingerprint(schedule: ScheduleSlot[]): string {
  if (schedule.length === 0) return '';
  return schedule
    .map(slotFingerprint)
    .sort()
    .join('|');
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

/** section.id → 所属 CourseGroup 的索引，供冲突检测/查组用 */
export function buildGroupIndex(sections: CourseSection[]): Map<string, CourseGroup> {
  const groups = buildCourseGroups(sections);
  const index = new Map<string, CourseGroup>();
  for (const g of groups) {
    for (const id of g.sectionIds) index.set(id, g);
  }
  return index;
}

let _allGroupsCache: CourseGroup[] | null = null;
let _groupByKeyCache: Map<string, CourseGroup> | null = null;

/** 全量课程聚合：模块级懒加载、所有调用方共享同一份引用 */
export function getAllCourseGroups(): CourseGroup[] {
  if (_allGroupsCache) return _allGroupsCache;
  _allGroupsCache = buildCourseGroups(courses);
  return _allGroupsCache;
}

/** 全量选课单元的 groupKey → CourseGroup 索引。弹窗按 groupKey O(1) 查找 */
export function getAllCourseGroupsByKey(): Map<string, CourseGroup> {
  if (_groupByKeyCache) return _groupByKeyCache;
  _groupByKeyCache = new Map(getAllCourseGroups().map((g) => [g.key, g]));
  return _groupByKeyCache;
}
