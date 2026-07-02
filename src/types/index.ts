// 课程数据类型定义（由 scripts/excel_to_ts.py 生成的结构契约）

export interface Department {
  code: string;
  name: string;
}

export interface ScheduleSlot {
  /** 上课周次。length===2 时为闭区间 [start, end]；length>2 时为显式枚举（单/双周展开） */
  weeks: number[];
  /** 教室 */
  room: string;
  /** 星期几，1=周一 ... 7=周日 */
  day: number;
  /** 节次列表，如 [8, 9] 或 [3, 4, 5] */
  periods: number[];
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

/** 课程池筛选状态 */
export interface FilterState {
  keyword: string;
  department: string; // 开课单位 name，空字符串表示不限
  courseType: string;
  sectionType: string;
  examType: string;
  language: string;
}
