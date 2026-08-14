/** 最小存储抽象：兼容浏览器 localStorage 与测试注入的 fake storage。 */
export interface StorageLike {
  length?: number;
  key?(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 返回浏览器 localStorage；非浏览器环境（如 SSR/测试未注入）返回 null。 */
export function getBrowserStorage(): StorageLike | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}
