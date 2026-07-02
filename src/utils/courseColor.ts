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

/**
 * 浅色模式下的色板。
 * 设计原则：6 色在色相环上尽量拉开（绿/青/橙/玫红/琥珀/紫），
 * 饱和度比之前高一些，避免大量课程时颜色循环后视觉发"灰"。
 */
const LIGHT_PALETTE: CourseColor[] = [
  { name: 'sage',  stripe: '#2E9D6A', bg: '#D2EEDE', fg: '#1F5A3D' }, // 绿
  { name: 'sky',   stripe: '#1F86D6', bg: '#D2E7F8', fg: '#1A4A78' }, // 青蓝
  { name: 'amber', stripe: '#E08A1E', bg: '#FBE3C2', fg: '#6E3F0F' }, // 琥珀橙
  { name: 'rose',  stripe: '#D6436A', bg: '#FAD3DE', fg: '#7A2540' }, // 玫红
  { name: 'teal',  stripe: '#159A9A', bg: '#CFE9E9', fg: '#0F4A4A' }, // 青绿
  { name: 'violet',stripe: '#7152D6', bg: '#E0D8F4', fg: '#3D2A7A' }, // 紫
];

/**
 * 深色模式下的色板：色调与浅色一致，背景降明度，文字提亮。
 */
const DARK_PALETTE: CourseColor[] = [
  { name: 'sage',  stripe: '#5BC189', bg: '#163324', fg: '#B8E6CB' },
  { name: 'sky',   stripe: '#5AAEEA', bg: '#0F2C42', fg: '#B6DCF2' },
  { name: 'amber', stripe: '#E8A655', bg: '#3A2A14', fg: '#F1CBA0' },
  { name: 'rose',  stripe: '#E97090', bg: '#3A1A24', fg: '#F2BCCB' },
  { name: 'teal',  stripe: '#4FC2C2', bg: '#0F3333', fg: '#B6E4E4' },
  { name: 'violet',stripe: '#9A82E5', bg: '#241B3F', fg: '#CFC4F0' },
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