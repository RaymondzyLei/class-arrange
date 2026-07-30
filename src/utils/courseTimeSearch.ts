import { DAYS, PERIODS } from '@/constants/grid';
import type { CourseGroup } from '@/types';
import { blockedSlotKey } from './customization';

export type CourseTimeSearchMode = 'contains' | 'within';

const VALID_DAYS: ReadonlySet<number> = new Set(DAYS);
const VALID_PERIODS: ReadonlySet<number> = new Set(PERIODS);

/**
 * Return the 7×13 timetable cells occupied by a canonical course time group.
 *
 * The search grid has no week dimension, so a cell is occupied when the group
 * uses that weekday and period in any week. Exact clock times are deliberately
 * not reinterpreted here: `ScheduleSlot.periods` is also what positions courses
 * on the timetable grid, including clock-based courses mapped to nearby periods.
 */
export function courseTimeSlotKeys(group: CourseGroup): Set<string> {
  const keys = new Set<string>();
  for (const slot of group.schedule) {
    if (!VALID_DAYS.has(slot.day)) continue;
    for (const period of slot.periods) {
      if (!VALID_PERIODS.has(period)) continue;
      keys.add(blockedSlotKey(slot.day, period));
    }
  }
  return keys;
}

function matchesSelection(
  group: CourseGroup,
  selectedSlots: ReadonlySet<string>,
  mode: CourseTimeSearchMode,
): boolean {
  if (selectedSlots.size === 0) return false;

  const occupiedSlots = courseTimeSlotKeys(group);
  if (mode === 'contains') {
    // Any overlap is enough; the course may occupy cells outside the selection.
    return [...selectedSlots].some((key) => occupiedSlots.has(key));
  }

  // An undetermined schedule must not match merely because the empty set is a
  // mathematical subset of every selection.
  return occupiedSlots.size > 0
    && [...occupiedSlots].every((key) => selectedSlots.has(key));
}

/**
 * Match one canonical time group against a grid selection.
 *
 * - `contains`: selected and occupied cells have a non-empty intersection.
 * - `within`: the non-empty occupied cells are a subset of selected cells.
 * - An empty selection never matches either mode.
 */
export function courseGroupMatchesTimeSelection(
  group: CourseGroup,
  selectedSlots: Iterable<string>,
  mode: CourseTimeSearchMode,
): boolean {
  return matchesSelection(group, new Set(selectedSlots), mode);
}

/** Filter canonical time groups while preserving their original order. */
export function filterCourseGroupsByTime(
  groups: readonly CourseGroup[],
  selectedSlots: Iterable<string>,
  mode: CourseTimeSearchMode,
): CourseGroup[] {
  const selection = new Set(selectedSlots);
  if (selection.size === 0) return [];
  return groups.filter((group) => matchesSelection(group, selection, mode));
}
