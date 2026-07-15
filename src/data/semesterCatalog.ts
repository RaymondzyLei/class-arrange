import type {
  SemesterCatalog,
  SemesterManifest,
  SemesterManifestEntry,
  SemesterUpdateFeed,
} from '@/types';

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

export function getSemesterUpdatesUrl(
  baseUrl: string,
  entry: SemesterManifestEntry,
): string {
  assertRelativeCatalogFile(entry.updatesFile);
  return `${normalizedBase(baseUrl)}data/semesters/${entry.updatesFile.replaceAll('\\', '/')}`;
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
      typeof rawEntry.file !== 'string' ||
      typeof rawEntry.revision !== 'string' ||
      !rawEntry.revision ||
      typeof rawEntry.updatesFile !== 'string'
    ) {
      throw new SemesterCatalogError('学期索引包含无效条目');
    }
    if (seen.has(rawEntry.key)) {
      throw new SemesterCatalogError(`学期索引包含重复学期：${rawEntry.key}`);
    }
    assertRelativeCatalogFile(rawEntry.file);
    assertRelativeCatalogFile(rawEntry.updatesFile);
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
    typeof value.revision !== 'string' ||
    !value.revision ||
    typeof value.generatedAt !== 'string' ||
    !isRecord(value.source) ||
    !isRecord(value.semester) ||
    typeof value.semester.key !== 'string' ||
    typeof value.semester.name !== 'string' ||
    typeof value.semester.startDate !== 'string' ||
    typeof value.semester.endDate !== 'string' ||
    !isRecord(value.semester.calendar) ||
    !Array.isArray(value.courses) ||
    !isRecord(value.detailsBySection)
  ) {
    throw new SemesterCatalogError('课程数据结构无效');
  }

  const calendar = value.semester.calendar;
  if (
    typeof calendar.termStartDate !== 'string' ||
    typeof calendar.termEndDate !== 'string' ||
    typeof calendar.weekStartDate !== 'string' ||
    typeof calendar.weekCount !== 'number' ||
    calendar.termStartDate !== value.semester.startDate ||
    calendar.termEndDate !== value.semester.endDate
  ) {
    throw new SemesterCatalogError('课程数据中的学期日期无效');
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

function isCourseIdentity(value: unknown): boolean {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.courseCode === 'string'
    && typeof value.courseName === 'string'
    && typeof value.teacher === 'string';
}

function isSelectedSnapshot(value: unknown): boolean {
  return isCourseIdentity(value) && isRecord(value) && Array.isArray(value.schedule);
}

export function validateSemesterUpdateFeed(value: unknown): SemesterUpdateFeed {
  if (
    !isRecord(value)
    || value.schemaVersion !== 1
    || typeof value.semesterKey !== 'string'
    || !value.semesterKey
    || typeof value.currentRevision !== 'string'
    || !value.currentRevision
    || !Array.isArray(value.entries)
  ) {
    throw new SemesterCatalogError('课程更新记录结构无效');
  }
  const ids = new Set<string>();
  for (const entry of value.entries) {
    if (
      !isRecord(entry)
      || typeof entry.id !== 'string'
      || !entry.id
      || ids.has(entry.id)
      || typeof entry.revision !== 'string'
      || typeof entry.previousRevision !== 'string'
      || typeof entry.publishedAt !== 'string'
      || !isRecord(entry.summary)
      || !Array.isArray(entry.added)
      || !entry.added.every(isSelectedSnapshot)
      || !Array.isArray(entry.removed)
      || !entry.removed.every((item) => isRecord(item)
        && isSelectedSnapshot(item.course)
        && Array.isArray(item.replacementCandidates)
        && item.replacementCandidates.every(isSelectedSnapshot))
      || !Array.isArray(entry.modified)
      || !entry.modified.every((item) => isRecord(item)
        && isCourseIdentity(item.course)
        && isSelectedSnapshot(item.previous)
        && isSelectedSnapshot(item.current)
        && Array.isArray(item.changes)
        && item.changes.every((change) => isRecord(change)
          && typeof change.field === 'string'
          && typeof change.label === 'string'))
    ) {
      throw new SemesterCatalogError('课程更新记录包含无效条目');
    }
    const summary = entry.summary;
    if (
      typeof summary.added !== 'number'
      || typeof summary.removed !== 'number'
      || typeof summary.modified !== 'number'
    ) {
      throw new SemesterCatalogError('课程更新记录统计无效');
    }
    ids.add(entry.id);
  }
  return value as unknown as SemesterUpdateFeed;
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
  if (catalog.revision !== entry.revision) {
    throw new SemesterCatalogError('课程数据版本与学期索引不匹配');
  }
  return catalog;
}

export async function loadSemesterUpdates(
  entry: SemesterManifestEntry,
  fetcher: CatalogFetcher = fetch,
  signal?: AbortSignal,
): Promise<SemesterUpdateFeed> {
  const response = await fetcher(getSemesterUpdatesUrl(import.meta.env.BASE_URL, entry), {
    signal,
    cache: 'no-cache',
  });
  const feed = validateSemesterUpdateFeed(await readJson(response, '课程更新记录'));
  if (feed.semesterKey !== entry.key || feed.currentRevision !== entry.revision) {
    throw new SemesterCatalogError('课程更新记录与学期索引不匹配');
  }
  return feed;
}
