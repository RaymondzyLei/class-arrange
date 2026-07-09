import { curricula, type CurriculumCourse, type CurriculumRecord } from '@/data/curricula';

export interface CurriculumOption {
  value: string;
  label: string;
  searchText: string;
}

export const ALL_CURRICULUM_TERMS = '__all_terms__';
export const UNSPECIFIED_CURRICULUM_TERM = '未指定学期';
const CURRICULUM_SOURCE_URL = 'https://catalog.ustc.edu.cn/plan';

const CURRICULUM_TERM_LABELS: Record<string, string> = {
  [UNSPECIFIED_CURRICULUM_TERM]: '学期未定',
};

export function formatCurriculumTerm(term: string): string {
  return CURRICULUM_TERM_LABELS[term] ?? term;
}

export function getCurriculumSourceUrl(record: CurriculumRecord | null): string | null {
  if (!record) return null;
  return record.sourceUrl ?? CURRICULUM_SOURCE_URL;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'zh-Hans-CN');
}

function compareCurriculumRecords(a: CurriculumRecord, b: CurriculumRecord): number {
  return compareText(b.grade, a.grade)
    || compareText(a.department, b.department)
    || compareText(a.major, b.major)
    || compareText(a.trainType, b.trainType)
    || compareText(a.name, b.name);
}

export function compareCurriculumTerms(a: string, b: string): number {
  const parse = (term: string) => {
    const match = /^(\d+)(秋|春|夏|--)?$/.exec(term);
    if (!match) return { year: 99, season: 99, raw: term };
    const seasonOrder: Record<string, number> = { 秋: 0, 春: 1, 夏: 2, '--': 9 };
    return {
      year: Number(match[1]),
      season: seasonOrder[match[2] ?? '--'] ?? 99,
      raw: term,
    };
  };
  const pa = parse(a);
  const pb = parse(b);
  return pa.year - pb.year || pa.season - pb.season || compareText(pa.raw, pb.raw);
}

export const curriculumRecords: CurriculumRecord[] =
  Object.values(curricula).sort(compareCurriculumRecords);

export const curriculumOptions: CurriculumOption[] = curriculumRecords.map((record) => ({
  value: String(record.id),
  label: `${record.grade} · ${record.department} · ${record.major} · ${record.trainType} · ${record.name || record.id}`,
  searchText: [
    record.id,
    record.grade,
    record.department,
    record.major,
    record.trainType,
    record.name,
    `${record.grade}${record.department}${record.major}${record.trainType}${record.name}`,
  ].join(' '),
}));

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·・•,，.。:：;；/\\|_()（）【】[\]{}-]+/g, '');
}

function splitSearchText(value: string): string[] {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .split(/[\s·・•,，.。:：;；/\\|_()（）【】[\]{}-]+/g)
    .flatMap((part) => part.match(/\d+|[^\d]+/g) ?? [])
    .map(normalizeSearchText)
    .filter(Boolean);
}

function getOptionSearchText(option: unknown): string {
  if (!option || typeof option !== 'object') return '';
  const item = option as { label?: unknown; searchText?: unknown; value?: unknown };
  return [item.searchText, item.label, item.value]
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .join(' ');
}

export function filterCurriculumOption(input: string, option?: unknown): boolean {
  const query = normalizeSearchText(input);
  if (!query) return true;
  const optionText = getOptionSearchText(option);
  const compactOptionText = normalizeSearchText(optionText);
  if (compactOptionText.includes(query)) return true;
  const terms = splitSearchText(input);
  return terms.length > 0 && terms.every((term) => compactOptionText.includes(term));
}

const DEFERRED_CURRICULUM_CODES = new Set(['HS1003', 'MIL1001', 'MIL1002', 'PE00001', 'THESIS', 'THESIS-M']);
const DEFERRED_CURRICULUM_NAMES = new Set(['军事理论', '军事技能', '艺术实践', '基础体育', '毕业论文']);

export function isDeferredCurriculumCourse(course: CurriculumCourse): boolean {
  return DEFERRED_CURRICULUM_CODES.has(course.code)
    || DEFERRED_CURRICULUM_NAMES.has(course.name)
    || course.modulePath.some((item) => item.includes('体育通修'));
}

export function getCurriculum(id: string | null): CurriculumRecord | null {
  if (!id) return null;
  return curricula[id] ?? null;
}

export function getCurriculumTerms(record: CurriculumRecord | null): string[] {
  if (!record) return [];
  const terms = Object.entries(record.terms)
    .filter(([term, courses]) =>
      term === UNSPECIFIED_CURRICULUM_TERM
        ? courses.length > 0
        : courses.some((course) => !isDeferredCurriculumCourse(course)),
    )
    .map(([term]) => term)
    .sort(compareCurriculumTerms);
  const regularTerms = terms.filter((term) => term !== UNSPECIFIED_CURRICULUM_TERM);
  if (!terms.includes(UNSPECIFIED_CURRICULUM_TERM)) return regularTerms;
  return regularTerms.length
    ? [regularTerms[0], UNSPECIFIED_CURRICULUM_TERM, ...regularTerms.slice(1)]
    : [UNSPECIFIED_CURRICULUM_TERM];
}

export function getDefaultCurriculumTerm(id: string | null): string | null {
  return getCurriculumTerms(getCurriculum(id))[0] ?? null;
}

export function isValidCurriculumTerm(id: string | null, term: string | null): boolean {
  if (!id || !term) return false;
  if (term === ALL_CURRICULUM_TERMS) return Boolean(getCurriculum(id));
  return getCurriculumTerms(getCurriculum(id)).includes(term);
}
