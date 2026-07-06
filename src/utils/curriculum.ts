import { curricula, type CurriculumRecord } from '@/data/curricula';

export interface CurriculumOption {
  value: string;
  label: string;
  searchText: string;
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

export function getCurriculum(id: string | null): CurriculumRecord | null {
  if (!id) return null;
  return curricula[id] ?? null;
}

export function getCurriculumTerms(record: CurriculumRecord | null): string[] {
  if (!record) return [];
  return Object.entries(record.terms)
    .filter(([, courses]) => courses.length > 0)
    .map(([term]) => term)
    .sort(compareCurriculumTerms);
}

export function getDefaultCurriculumTerm(id: string | null): string | null {
  return getCurriculumTerms(getCurriculum(id))[0] ?? null;
}

export function isValidCurriculumTerm(id: string | null, term: string | null): boolean {
  if (!id || !term) return false;
  return getCurriculumTerms(getCurriculum(id)).includes(term);
}
