interface SearchableCourse {
  courseName: string;
  id: string;
  teacher: string;
}

export function courseMatchesKeyword(
  course: SearchableCourse,
  keyword: string,
  includeTeacher: boolean,
): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  return course.courseName.toLowerCase().includes(kw)
    || course.id.toLowerCase().includes(kw)
    || (includeTeacher && course.teacher.toLowerCase().includes(kw));
}
