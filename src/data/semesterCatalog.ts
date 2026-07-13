import type { SemesterCatalog, SemesterManifest, SemesterManifestEntry } from '@/types';

export const SEMESTER_SELECTION_KEY = 'class-arrange:v1:selected-semester';

export type CatalogFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class SemesterCatalogError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SemesterCatalogError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedBase(baseUrl: string): string {
  const withLeadingSlash = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function assertRelativeCatalogFile(file: string): void {
  const parts = file.replaceAll('\\', '/').split('/');
  if (
    !file ||
    file.startsWith('/') ||
    /^[a-z][a-z\d+.-]*:/i.test(file) ||
    parts.some((part) => part === '..' || part === '.')
  ) {
    throw new SemesterCatalogError(`学期数据文件路径无效：${file || '（空）'}`);
  }
}

export function getSemesterManifestUrl(baseUrl: string): string {
  return `${normalizedBase(baseUrl)}data/semesters/index.json`;
}

export function getSemesterCatalogUrl(
  baseUrl: string,
  entry: SemesterManifestEntry,
): string {
  assertRelativeCatalogFile(entry.file);
  return `${normalizedBase(baseUrl)}data/semesters/${entry.file.replaceAll('\\', '/')}`;
}

export function validateSemesterManifest(value: unknown): SemesterManifest {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new SemesterCatalogError('学期索引版本不受支持');
  }
  if (typeof value.defaultSemester !== 'string' || !Array.isArray(value.semesters)) {
    throw new SemesterCatalogError('学期索引结构无效');
  }

  const seen = new Set<string>();
  for (const rawEntry of value.semesters) {
    if (
      !isRecord(rawEntry) ||
      typeof rawEntry.key !== 'string' ||
      !rawEntry.key ||
      typeof rawEntry.name !== 'string' ||
      !rawEntry.name ||
      typeof rawEntry.file !== 'string'
    ) {
      throw new SemesterCatalogError('学期索引包含无效条目');
    }
    if (seen.has(rawEntry.key)) {
      throw new SemesterCatalogError(`学期索引包含重复学期：${rawEntry.key}`);
    }
    assertRelativeCatalogFile(rawEntry.file);
    seen.add(rawEntry.key);
  }
  if (seen.size === 0) throw new SemesterCatalogError('学期索引为空');
  if (!seen.has(value.defaultSemester)) {
    throw new SemesterCatalogError('学期索引的默认学期不存在');
  }
  return value as unknown as SemesterManifest;
}

export function validateSemesterCatalog(value: unknown): SemesterCatalog {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new SemesterCatalogError('课程数据版本不受支持');
  }
  if (
    typeof value.generatedAt !== 'string' ||
    !isRecord(value.source) ||
    !isRecord(value.semester) ||
    typeof value.semester.key !== 'string' ||
    typeof value.semester.name !== 'string' ||
    !isRecord(value.semester.calendar) ||
    !Array.isArray(value.courses) ||
    !isRecord(value.detailsBySection)
  ) {
    throw new SemesterCatalogError('课程数据结构无效');
  }

  const ids: string[] = [];
  for (const rawCourse of value.courses) {
    if (!isRecord(rawCourse) || typeof rawCourse.id !== 'string' || !rawCourse.id) {
      throw new SemesterCatalogError('课程数据包含无效课堂');
    }
    ids.push(rawCourse.id);
  }
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) {
    throw new SemesterCatalogError('课程数据包含重复课堂号');
  }

  const details = value.detailsBySection as Record<string, unknown>;
  const detailIds = Object.keys(details);
  const missing = ids.filter((id) => !(id in details));
  const extra = detailIds.filter((id) => !idSet.has(id));
  if (missing.length || extra.length) {
    throw new SemesterCatalogError(
      `课程详情覆盖不完整（缺少 ${missing.length}，多出 ${extra.length}）`,
    );
  }
  for (const id of ids) {
    const detail = details[id];
    if (!isRecord(detail) || (typeof detail.code === 'string' && detail.code !== id)) {
      throw new SemesterCatalogError(`课堂 ${id} 的详情结构无效`);
    }
  }

  return value as unknown as SemesterCatalog;
}

export function selectInitialSemester(
  manifest: SemesterManifest,
  storedKey: string | null,
): string {
  if (storedKey && manifest.semesters.some((entry) => entry.key === storedKey)) {
    return storedKey;
  }
  return manifest.defaultSemester;
}

async function readJson(response: Response, label: string): Promise<unknown> {
  if (!response.ok) {
    throw new SemesterCatalogError(`${label}加载失败（HTTP ${response.status}）`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new SemesterCatalogError(`${label}不是有效 JSON`, { cause: error });
  }
}

export async function loadSemesterManifest(
  fetcher: CatalogFetcher = fetch,
  signal?: AbortSignal,
): Promise<SemesterManifest> {
  const response = await fetcher(getSemesterManifestUrl(import.meta.env.BASE_URL), {
    signal,
    cache: 'no-cache',
  });
  return validateSemesterManifest(await readJson(response, '学期索引'));
}

export async function loadSemesterCatalog(
  entry: SemesterManifestEntry,
  fetcher: CatalogFetcher = fetch,
  signal?: AbortSignal,
): Promise<SemesterCatalog> {
  const response = await fetcher(getSemesterCatalogUrl(import.meta.env.BASE_URL, entry), {
    signal,
    cache: 'no-cache',
  });
  const catalog = validateSemesterCatalog(await readJson(response, '课程数据'));
  if (catalog.semester.key !== entry.key) {
    throw new SemesterCatalogError(
      `课程数据学期不匹配：期望 ${entry.key}，实际 ${catalog.semester.key}`,
    );
  }
  return catalog;
}
