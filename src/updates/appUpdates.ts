export interface AppRelease {
  version: string;
  publishedAt: string;
  title: string;
  items: string[];
}

/** Manually curated, user-facing website changelog. Keep versions oldest to newest. */
export const APP_RELEASES: AppRelease[] = [
  {
    version: '2026.07.15.1',
    publishedAt: '2026-07-15',
    title: '更新提示与课程变更保护',
    items: [
      '新增网站和课程信息更新记录，可查看上次访问以来的变化。',
      '已选课堂被删除时会从受影响方案中移除，并明确列出课程和方案。',
      '已选课堂的教师、上课时间或地点变化时会单独提示。',
    ],
  },
];

export const CURRENT_APP_VERSION = APP_RELEASES.at(-1)?.version ?? '0';
