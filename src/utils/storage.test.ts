import { describe, it, expect } from 'vitest';
import { getBrowserStorage, type StorageLike } from './storage';

describe('storage', () => {
  it('StorageLike 接受最小 { getItem, setItem } fake', () => {
    const fake: StorageLike = { getItem: () => null, setItem: () => {} };
    expect(typeof fake.getItem).toBe('function');
    expect(typeof fake.setItem).toBe('function');
  });

  it('getBrowserStorage 返回 null 或带 getItem/setItem 的 storage', () => {
    const result = getBrowserStorage();
    if (result === null) {
      expect(result).toBeNull();
    } else {
      expect(typeof result.getItem).toBe('function');
      expect(typeof result.setItem).toBe('function');
    }
  });
});
