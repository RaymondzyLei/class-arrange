import type {
  Arrangement,
  ArrangementFavoritePreferences,
  ArrangementFavoriteRecord,
  CourseGroup,
  Plan,
} from '@/types';

export function createArrangementFavoriteRecord(
  plan: Plan,
  arrangement: Arrangement,
  originalIndex: number,
): ArrangementFavoriteRecord {
  return {
    id: arrangement.id,
    planId: plan.id,
    planName: plan.name,
    originalIndex,
    courseCount: arrangement.courseCount,
    totalCredits: arrangement.totalCredits,
    totalHours: arrangement.totalHours,
    conflictCount: arrangement.conflictCount,
    courseNames: arrangement.groups.map((group) => group.courseName),
  };
}

export function activeArrangementFavoriteIds(
  arrangementIds: readonly string[],
  records: readonly ArrangementFavoriteRecord[],
  planId: string | null | undefined,
): string[] {
  const recordedIds = new Set(records.map((record) => record.id));
  const ownedIds = new Set(
    records
      .filter((record) => record.planId === planId)
      .map((record) => record.id),
  );

  return arrangementIds.filter((id) => !recordedIds.has(id) || ownedIds.has(id));
}

export function activeArrangementFavoritePreferences(
  arrangementIds: readonly string[],
  timeGroupKeys: readonly string[],
  sectionIds: readonly string[],
  groups: readonly CourseGroup[],
): ArrangementFavoritePreferences {
  const selectedTimeGroupKeys = new Set(groups.map((group) => group.key));
  const selectedSectionIds = new Set(groups.flatMap((group) => group.sectionIds));

  return {
    arrangementIds: [...arrangementIds],
    timeGroupKeys: timeGroupKeys.filter((key) => selectedTimeGroupKeys.has(key)),
    sectionIds: sectionIds.filter((id) => selectedSectionIds.has(id)),
  };
}

export function arrangementNumbersById(
  arrangements: readonly Arrangement[],
  records: readonly ArrangementFavoriteRecord[],
  planId: string | null | undefined,
): Map<string, number> {
  const visibleIds = new Set(arrangements.map((arrangement) => arrangement.id));
  const numbers = new Map<string, number>();
  const used = new Set<number>();

  for (const record of records) {
    if (
      record.planId !== planId
      || !visibleIds.has(record.id)
      || used.has(record.originalIndex)
    ) continue;
    numbers.set(record.id, record.originalIndex);
    used.add(record.originalIndex);
  }

  let next = 0;
  for (const arrangement of arrangements) {
    if (numbers.has(arrangement.id)) continue;
    while (used.has(next)) next += 1;
    numbers.set(arrangement.id, next);
    used.add(next);
    next += 1;
  }
  return numbers;
}
