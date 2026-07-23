import type { Plan } from '@/types';
import { nextDefaultPlanName, nextDuplicatePlanName } from './planSeed';

export const SHARED_PLAN_VERSION = 1 as const;
export const MAX_SHARED_COURSES = 100;
export const MAX_SHARED_URL_LENGTH = 1800;

const SHARE_FRAGMENT_PREFIX = '#plan=';
const MAX_SHARED_NAME_LENGTH = 20;
const MAX_SHARED_KEY_LENGTH = 64;
const DEFAULT_PLAN_NAME_PATTERN = /^方案(?:[一二三四五六七八九十百\d]+)$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface SharedPlanPayload {
  version: typeof SHARED_PLAN_VERSION;
  semesterKey: string;
  name: string;
  courseIds: string[];
}

interface SharedPlanWireV1 {
  v: typeof SHARED_PLAN_VERSION;
  s: string;
  n: string;
  c: string[];
}

export type SharedPlanParseResult =
  | { kind: 'none' }
  | { kind: 'success'; payload: SharedPlanPayload }
  | { kind: 'error'; message: string };

interface LocationLike {
  href: string;
}

interface HistoryLike {
  state: unknown;
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function base64UrlToBytes(encoded: string): Uint8Array {
  if (!encoded || !BASE64URL_PATTERN.test(encoded) || encoded.length % 4 === 1) {
    throw new Error('分享链接编码无效');
  }
  const base64 = encoded
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function normalizeSharedPlanPayload(value: unknown): SharedPlanPayload {
  if (!value || typeof value !== 'object') throw new Error('分享方案结构无效');
  const candidate = value as Partial<SharedPlanPayload>;
  if (candidate.version !== SHARED_PLAN_VERSION) {
    throw new Error('分享方案版本不受支持');
  }
  if (typeof candidate.semesterKey !== 'string') throw new Error('学期标识无效');
  if (typeof candidate.name !== 'string') throw new Error('方案名称无效');
  if (!Array.isArray(candidate.courseIds) || candidate.courseIds.some((id) => typeof id !== 'string')) {
    throw new Error('分享课程列表无效');
  }

  const semesterKey = candidate.semesterKey.trim();
  const name = candidate.name.trim();
  const courseIds = [...new Set(candidate.courseIds.map((id) => id.trim()))];

  if (!semesterKey || semesterKey.length > MAX_SHARED_KEY_LENGTH) {
    throw new Error('学期标识无效');
  }
  if (!name || name.length > MAX_SHARED_NAME_LENGTH) {
    throw new Error('方案名称无效');
  }
  if (
    courseIds.length === 0
    || courseIds.length > MAX_SHARED_COURSES
    || courseIds.some((id) => !id || id.length > MAX_SHARED_KEY_LENGTH)
  ) {
    throw new Error('分享课程列表无效');
  }

  return {
    version: SHARED_PLAN_VERSION,
    semesterKey,
    name,
    courseIds,
  };
}

function wireToPayload(value: unknown): SharedPlanPayload {
  if (!value || typeof value !== 'object') throw new Error('分享方案结构无效');
  const wire = value as Partial<SharedPlanWireV1>;
  return normalizeSharedPlanPayload({
    version: wire.v,
    semesterKey: wire.s,
    name: wire.n,
    courseIds: wire.c,
  });
}

export function encodeSharedPlan(input: SharedPlanPayload): string {
  const payload = normalizeSharedPlanPayload(input);
  const wire: SharedPlanWireV1 = {
    v: SHARED_PLAN_VERSION,
    s: payload.semesterKey,
    n: payload.name,
    c: payload.courseIds,
  };
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(wire)));
}

export function parseSharedPlanFragment(fragment: string): SharedPlanParseResult {
  if (!fragment.startsWith(SHARE_FRAGMENT_PREFIX)) return { kind: 'none' };
  if (fragment.length > MAX_SHARED_URL_LENGTH) {
    return { kind: 'error', message: '分享链接过长或已损坏' };
  }

  try {
    const encoded = fragment.slice(SHARE_FRAGMENT_PREFIX.length);
    const json = new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(encoded));
    return {
      kind: 'success',
      payload: wireToPayload(JSON.parse(json)),
    };
  } catch (error) {
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : '分享链接无效或已损坏',
    };
  }
}

export function buildSharedPlanUrl(payload: SharedPlanPayload, href: string): string {
  const url = new URL(href);
  url.hash = `plan=${encodeSharedPlan(payload)}`;
  if (url.href.length > MAX_SHARED_URL_LENGTH) throw new Error('分享链接过长');
  return url.href;
}

export function clearSharedPlanFragment(
  locationLike: LocationLike = window.location,
  historyLike: HistoryLike = window.history,
): void {
  const url = new URL(locationLike.href);
  if (!url.hash.startsWith(SHARE_FRAGMENT_PREFIX)) return;
  url.hash = '';
  historyLike.replaceState(historyLike.state, '', `${url.pathname}${url.search}`);
}

export function hasReusableSingleEmptyPlan(plans: Plan[]): boolean {
  return plans.length === 1 && plans[0].courseIds.length === 0;
}

export function resolveImportedPlanName(sourceName: string, retainedPlans: Plan[]): string {
  const normalizedName = sourceName.trim();
  if (DEFAULT_PLAN_NAME_PATTERN.test(normalizedName)) {
    return nextDefaultPlanName(retainedPlans);
  }
  if (!retainedPlans.some((plan) => plan.name === normalizedName)) {
    return normalizedName;
  }
  return nextDuplicatePlanName(normalizedName, retainedPlans);
}
