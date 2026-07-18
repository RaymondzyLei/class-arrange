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
  {
    version: '2026.07.16.1',
    publishedAt: '2026-07-16',
    title: '排课方案与界面优化',
    items: [
      '排课方案标题整合计算状态，移除方案数量提示。',
      '方案列表缩短为约 1.5 行可视高度，减少页面占用。',
      '优化课程更新信息展示。',
      '其他UI改进。',
    ],
  },
  {
    version: '2026.07.18.1',
    publishedAt: '2026-07-18',
    title: '课程时间组与排课方案优化',
    items: [
      '添加“合并课程所有时间组”设置选项，更直观地展示课程信息。',
      '添加“展示排课方案数量”选项。',
      '优化排课方案结果展示，允许展示所有不冲突方案。',
      '其他UI改进。',
    ],
  },
  {
    version: '2026.07.18.2',
    publishedAt: '2026-07-18',
    title: '收藏功能与更新顺序优化',
    items: [
      '新增选课方案、排课方案、课程时间组和具体课堂收藏，收藏状态保存在本地。',
      '排课结果优先展示已收藏方案，并在冲突相同时优先满足更多收藏课程。',
      '最近更新与更新记录按日期从新到旧展示。',
    ],
  },
];

export const CURRENT_APP_VERSION = APP_RELEASES.at(-1)?.version ?? '0';
