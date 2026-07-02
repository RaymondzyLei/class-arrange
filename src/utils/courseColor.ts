/**
 * 课程类别色板：6 种去饱和颜色，给每门课程一个稳定、视觉差异明显但不过分鲜艳的标识。
 *
 * 同一 `courseId` 永远映射到同一颜色，保证课程池卡片、课表单元格、详情弹窗三处视觉一致。
 *
 * `index` 取值范围 0..5，由 hash 决定。
 */
export type CourseColorIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface CourseColor {
  /** 主色：用于左侧色条、文字前景 */
  stripe: string;
  /** 柔背景：用于单元格/卡片填充 */
  bg: string;
  /** 深色文字前景（在浅背景上读得清） */
  fg: string;
  /** 语义名：用于调试 */
  name: string;
}

/** 浅色模式下的色板 */
const LIGHT_PALETTE: CourseColor[] = [
  { name: 'sage',  stripe: '#7BA88E', bg: '#E8F1EC', fg: '#2F5A45' },
  { name: 'sky',   stripe: '#6BAEDB', bg: '#E4F0F8', fg: '#2D5A7A' },
  { name: 'sand',  stripe: '#D4A574', bg: '#F5ECDD', fg: '#6E4A1F' },
  { name: 'mauve', stripe: '#B58EAA', bg: '#EFE7EE', fg: '#5E3D55' },
  { name: 'mint',  stripe: '#7FBFAA', bg: '#E3F1EC', fg: '#2E6055' },
  { name: 'lilac', stripe: '#9B8EC4', bg: '#EAE6F1', fg: '#43396B' },
];

/** 深色模式下的色板（饱和度略降、明度提高，保证深底可读） */
const DARK_PALETTE: CourseColor[] = [
  { name: 'sage',  stripe: '#82B999', bg: '#1E2A24', fg: '#B7D6C2' },
  { name: 'sky',   stripe: '#7FBDE3', bg: '#15242F', fg: '#B0D5EB' },
  { name: 'sand',  stripe: '#D9B383', bg: '#2B231A', fg: '#DDC3A1' },
  { name: 'mauve', stripe: '#C39DBA', bg: '#251D26', fg: '#D2B8CD' },
  { name: 'mint',  stripe: '#8FCBB6', bg: '#152823', fg: '#B7DBCC' },
  { name: 'lilac', stripe: '#AFA0D2', bg: '#1F1C2C', fg: '#C8BFDE' },
];

/**
 * djb2 哈希：稳定、轻量、分布足够均匀。
 * 用于把字符串 ID 映射到 0..(palette.length - 1) 的索引。
 */
function hashId(id: string): CourseColorIndex {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  }
  // Math.abs 在极端情况下会变 -2147483648，处理掉
  const n = Math.abs(h) % LIGHT_PALETTE.length;
  return n as CourseColorIndex;
}

/**
 * 取某课程在当前主题下的颜色。同一 id 在同一主题下永远返回相同引用结构（但非单例）。
 */
export function courseColor(id: string, theme: 'light' | 'dark' = 'light'): CourseColor {
  const idx = hashId(id);
  const palette = theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  return palette[idx];
}

/**
 * 仅取索引，便于在 inline style 中直接用 CSS 变量（`var(--course-${idx}-bg)`）。
 */
export function courseColorIndex(id: string): CourseColorIndex {
  return hashId(id);
}