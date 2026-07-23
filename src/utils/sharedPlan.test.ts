import { describe, expect, it } from 'vitest';
import type { Plan } from '@/types';
import {
  buildSharedPlanUrl,
  encodeSharedPlan,
  hasReusableSingleEmptyPlan,
  parseSharedPlanFragment,
  resolveImportedPlanName,
} from './sharedPlan';

const payload = {
  version: 1 as const,
  semesterKey: '2026-fall',
  name: '周二无早八',
  courseIds: ['MATH1006.01', 'PHYS1001B.02'],
};

function base64UrlJson(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function plan(id: string, name: string, courseIds: string[]): Plan {
  return { id, name, createdAt: 1, updatedAt: 1, courseIds };
}

describe('shared plan links', () => {
  it('round-trips UTF-8 data through a URL-safe fragment', () => {
    const encoded = encodeSharedPlan(payload);

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parseSharedPlanFragment(`#plan=${encoded}`)).toEqual({
      kind: 'success',
      payload,
    });
  });

  it('deduplicates course IDs without changing source order', () => {
    const encoded = encodeSharedPlan({
      ...payload,
      courseIds: ['A.01', 'B.01', 'A.01'],
    });

    expect(parseSharedPlanFragment(`#plan=${encoded}`)).toEqual({
      kind: 'success',
      payload: {
        ...payload,
        courseIds: ['A.01', 'B.01'],
      },
    });
  });

  it('ignores unrelated fragments', () => {
    expect(parseSharedPlanFragment('')).toEqual({ kind: 'none' });
    expect(parseSharedPlanFragment('#section=calendar')).toEqual({ kind: 'none' });
  });

  it('rejects truncated, unsupported, empty, and oversized payloads', () => {
    expect(parseSharedPlanFragment('#plan=broken')).toMatchObject({ kind: 'error' });
    expect(parseSharedPlanFragment(
      `#plan=${base64UrlJson({ v: 2, s: '2026-fall', n: '方案', c: ['A.01'] })}`,
    )).toMatchObject({ kind: 'error' });
    expect(() => encodeSharedPlan({ ...payload, courseIds: [] })).toThrow('分享课程列表无效');
    expect(() => encodeSharedPlan({
      ...payload,
      courseIds: Array.from({ length: 101 }, (_, index) => `A.${index}`),
    })).toThrow('包含 101 个课堂，超过分享上限 100 个');
    expect(() => encodeSharedPlan({ ...payload, name: '名'.repeat(21) }))
      .toThrow('方案名称无效');
  });

  it('rejects malformed wire fields and invalid UTF-8', () => {
    expect(parseSharedPlanFragment(
      `#plan=${base64UrlJson({ v: 1, s: '', n: '方案', c: ['A.01'] })}`,
    )).toMatchObject({ kind: 'error' });
    expect(parseSharedPlanFragment(
      `#plan=${base64UrlJson({ v: 1, s: '2026-fall', n: '方案', c: [1] })}`,
    )).toMatchObject({ kind: 'error' });
    expect(parseSharedPlanFragment('#plan=_w')).toMatchObject({ kind: 'error' });
  });

  it('builds a share URL without preserving an existing hash', () => {
    const url = buildSharedPlanUrl(payload, 'https://example.test/app?theme=dark#old');

    expect(url).toMatch(/^https:\/\/example\.test\/app\?theme=dark#plan=/);
    expect(parseSharedPlanFragment(new URL(url).hash)).toMatchObject({
      kind: 'success',
      payload,
    });
  });

  it('enforces the complete URL length limit', () => {
    expect(() => buildSharedPlanUrl(
      payload,
      `https://example.test/${'x'.repeat(1800)}`,
    )).toThrow('生成后的分享链接超过 1800 个字符');
  });
});

describe('shared plan import naming', () => {
  it('recognizes only a single empty plan as reusable', () => {
    expect(hasReusableSingleEmptyPlan([plan('1', '任意名称', [])])).toBe(true);
    expect(hasReusableSingleEmptyPlan([plan('1', '方案一', ['A.01'])])).toBe(false);
    expect(hasReusableSingleEmptyPlan([
      plan('1', '方案一', []),
      plan('2', '方案二', []),
    ])).toBe(false);
  });

  it('uses the next available default name for imported default names', () => {
    const plans = [
      plan('1', '方案一', ['A.01']),
      plan('2', '方案三', ['B.01']),
    ];

    expect(resolveImportedPlanName('方案九', plans)).toBe('方案二');
    expect(resolveImportedPlanName('方案9', plans)).toBe('方案二');
  });

  it('keeps unique custom names and suffixes duplicates', () => {
    const plans = [
      plan('1', '无早八', ['A.01']),
      plan('2', '无早八 副本', ['B.01']),
    ];

    expect(resolveImportedPlanName('周五没课', plans)).toBe('周五没课');
    expect(resolveImportedPlanName('无早八', plans)).toBe('无早八 副本 2');
  });
});
