// 课程数据类型定义（由 scripts/excel_to_ts.py 生成的结构契约）

import type { TermCalendar } from '@/config/termCalendar';

export interface Department {
  code: string;
  name: string;
}

export type Campus = '本部' | '高新区' | '其他';
export type ResidentCampus = Exclude<Campus, '其他'>;

export interface ScheduleSlot {
  /** 上课周次。length===2 时为闭区间 [start, end]；length>2 时为显式枚举（单/双周展开） */
  weeks: number[];
  /** 教室 */
  room: string;
  /** 标准化地区，用于跨校区排课偏好 */
  campus: Campus;
  /** 星期几，1=周一 ... 7=周日 */
  day: number;
  /** 节次列表，如 [8, 9] 或 [3, 4, 5] */
  periods: number[];
  /** 非标准节次课程的精确开始时间（HH:MM） */
  startTime?: string;
  /** 非标准节次课程的精确结束时间（HH:MM） */
  endTime?: string;
}

export interface CourseSection {
  /** 课堂号，如 "001101.01" */
  id: string;
  courseName: string;
  department: Department;
  teacher: string;
  credits: number;
  hours: number;
  /** 学历层次 */
  level: string;
  /** 课堂类型 */
  sectionType: string;
  /** 课程范畴分类 */
  category: string;
  /** 课程类型 */
  courseType: string;
  language: string;
  examType: string;
  grading: string;
  /** 本研同堂 */
  undergradShared: boolean;
  enrolled: number;
  capacity: number;
  /** 上课班级 */
  classes: string[];
  /** 原始时间地点字符串（用于回显/调试） */
  rawSchedule: string;
  /** 结构化时间地点 */
  schedule: ScheduleSlot[];
}

/** 选课方案 */
export interface Plan {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** 已选课堂号，有序、去重 */
  courseIds: string[];
}

export interface PlansState {
  plans: Plan[];
  activePlanId: string | null;
}

export interface ArrangementFavoritePreferences {
  arrangementIds: string[];
  timeGroupKeys: string[];
  sectionIds: string[];
}

export type FavoriteKind = 'plan' | 'arrangement' | 'timeGroup' | 'section';

export interface ArrangementFavoriteRecord {
  id: string;
  planId: string;
  planName: string;
  originalIndex: number;
  courseCount: number;
  totalCredits: number;
  totalHours: number;
  conflictCount: number;
  courseNames: string[];
}

export interface FavoritesState extends ArrangementFavoritePreferences {
  version: 1;
  planIds: string[];
  /** 排课收藏的定位与展示快照；旧数据没有此字段时会无损迁移为空数组。 */
  arrangementRecords: ArrangementFavoriteRecord[];
}

/**
 * 选课单元：把「同课程号 + 时间完全一致」的多个班次合并成一个对象。
 * 学生排课时不纠结老师，同时间同课的不同班次视为同一选课对象。
 * 同课程号但时间不同的班次 → 各自独立的 CourseGroup。
 */
export interface CourseGroup {
  /** 课程号，如 "001101"（课堂号去掉 ".班次" 后缀） */
  courseCode: string;
  /** 课程名（同课程号下应一致，取首个） */
  courseName: string;
  /** 共用时间，取代表 section 的 schedule */
  schedule: ScheduleSlot[];
  /** 时间指纹，归一化后用于判定"时间完全相同" */
  fingerprint: string;
  /** 组内所有课堂号 */
  sectionIds: string[];
  /** 组内所有老师，去重保序 */
  teachers: string[];
  /** 组内全部 section，详情弹窗用 */
  sections: CourseSection[];
  /** 仅展示层合并时存在：该课程原本的各个时间组。 */
  timeGroups?: CourseGroup[];
  /** 组唯一键：`${courseCode}::${fingerprint}` */
  key: string;
}

/** 课程池筛选状态 */
export interface FilterState {
  keyword: string;
  includeTeacher: boolean;
  department: string; // 开课单位 name，空字符串表示不限
  courseType: string;
  sectionType: string;
  examType: string;
  grading: string;
  language: string;
}

export interface CourseTextbook {
  nameZh: string;
  edition: string;
  author: string;
  publishingHouse: string;
  dates: string;
  isbn: string;
  publish: boolean;
}

export interface CourseDetail {
  code: string;
  name: {
    cn: string;
    en: string;
  };
  dept: string;
  credit: number;
  hour: number;
  sem: string;
  grading: string;
  examType: string;
  discipline: string;
  lang: string;
  prerequisite: string;
  legacyTextbook: string;
  textbooks: CourseTextbook[];
  materials: CourseTextbook[];
  referenceBooks: string;
  description: {
    cn: string;
    en: string;
  };
  syllabus: unknown;
}

export interface SemesterManifestEntry {
  key: string;
  name: string;
  file: string;
  revision: string;
  updatesFile: string;
}

export interface SemesterManifest {
  schemaVersion: 1;
  defaultSemester: string;
  semesters: SemesterManifestEntry[];
}

export interface SemesterCatalog {
  schemaVersion: 1;
  revision: string;
  generatedAt: string;
  source: {
    url: string;
    semesterId: number;
  };
  semester: {
    key: string;
    name: string;
    startDate: string;
    endDate: string;
    calendar: TermCalendar;
  };
  courses: CourseSection[];
  detailsBySection: Record<string, CourseDetail>;
}

export interface SelectedCourseSnapshot {
  id: string;
  courseCode: string;
  courseName: string;
  teacher: string;
  schedule: ScheduleSlot[];
}

export interface CourseChangeIdentity {
  id: string;
  courseCode: string;
  courseName: string;
  teacher: string;
}

export interface CourseFieldChange {
  field: string;
  label: string;
  before?: unknown;
  after?: unknown;
}

export interface RemovedCourseChange {
  course: SelectedCourseSnapshot;
  replacementCandidates: SelectedCourseSnapshot[];
}

export interface ModifiedCourseChange {
  course: CourseChangeIdentity;
  previous: SelectedCourseSnapshot;
  current: SelectedCourseSnapshot;
  changes: CourseFieldChange[];
}

export interface SemesterUpdateBatch {
  id: string;
  revision: string;
  previousRevision: string;
  publishedAt: string;
  summary: { added: number; removed: number; modified: number };
  added: SelectedCourseSnapshot[];
  removed: RemovedCourseChange[];
  modified: ModifiedCourseChange[];
}

export interface SemesterUpdateFeed {
  schemaVersion: 1;
  semesterKey: string;
  currentRevision: string;
  entries: SemesterUpdateBatch[];
}

export interface AffectedPlanImpact {
  planId: string;
  planName: string;
  wasActive: boolean;
}

export interface CourseImpactEvent {
  id: string;
  semesterKey: string;
  revision: string;
  kind: 'removed' | 'modified';
  courseId: string;
  courseName: string;
  occurredAt: string;
  affectedPlans: AffectedPlanImpact[];
  previous: SelectedCourseSnapshot;
  current?: SelectedCourseSnapshot;
  changes: CourseFieldChange[];
  replacementCandidates: SelectedCourseSnapshot[];
}

/** 排课方案：用户已选 groups 的一个具体"每个 courseCode 取一个 group"的组合 */
export interface Arrangement {
  /** 内容稳定 id：由该方案包含的 group.key 排序拼接而成 */
  id: string;
  /** 该方案选定的所有 group（每个 courseCode 恰一个） */
  groups: CourseGroup[];
  /** 该方案与全局检测冲突后涉及的 group key 数 */
  conflictCount: number;
  /** 课程数（= groups.length，因为每个 courseCode 一个） */
  courseCount: number;
  /** 总学分（每个 group 取代表 section） */
  totalCredits: number;
  /** 总学时 */
  totalHours: number;
}
