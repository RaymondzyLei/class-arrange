export function formatSectionTeacher(teacher: string, fallback = ''): string {
  const normalized = teacher.trim().replace(/\s*,\s*/g, '、');
  return normalized || fallback;
}

export function formatTeacherList(teachers: string[], fallback = '教师未定'): string {
  const formatted = teachers
    .map((teacher) => formatSectionTeacher(teacher))
    .filter(Boolean);
  return formatted.length ? formatted.join(' / ') : fallback;
}
