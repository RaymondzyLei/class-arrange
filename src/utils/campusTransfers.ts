import type { Campus, CourseGroup, ResidentCampus, ScheduleSlot } from '@/types';
import { expandWeeks } from './weeks';

export type CampusTimeBand = 'morning' | 'afternoon' | 'evening';

export interface CampusVisit {
  bucketKey: string;
  startPeriod: number;
  endPeriod: number;
  campus: Campus;
  stableKey: string;
}

function timeBand(slot: ScheduleSlot): CampusTimeBand {
  const firstPeriod = Math.min(...slot.periods);
  if (firstPeriod <= 5) return 'morning';
  if (firstPeriod <= 10) return 'afternoon';
  return 'evening';
}

export function campusVisitsForGroup(group: CourseGroup): CampusVisit[] {
  const visits: CampusVisit[] = [];
  group.schedule.forEach((slot, slotIndex) => {
    if (slot.periods.length === 0) return;
    const startPeriod = Math.min(...slot.periods);
    const endPeriod = Math.max(...slot.periods);
    const band = timeBand(slot);
    for (const week of expandWeeks(slot.weeks)) {
      visits.push({
        bucketKey: `${week}-${slot.day}-${band}`,
        startPeriod,
        endPeriod,
        campus: slot.campus,
        stableKey: `${group.key}:${slotIndex}`,
      });
    }
  });
  return visits;
}

export function scoreCampusVisits(
  visits: readonly CampusVisit[],
  residentCampus: ResidentCampus,
): number {
  if (visits.length === 0) return 0;
  const ordered = [...visits].sort((left, right) =>
    left.startPeriod - right.startPeriod
    || left.endPeriod - right.endPeriod
    || left.stableKey.localeCompare(right.stableKey));
  let transitions = ordered[0].campus === residentCampus ? 0 : 1;
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].campus !== ordered[index - 1].campus) transitions += 1;
  }
  return transitions;
}

export function countCampusTransfers(
  groups: readonly CourseGroup[],
  residentCampus: ResidentCampus,
): number {
  const visitsByBucket = new Map<string, CampusVisit[]>();
  for (const group of groups) {
    for (const visit of campusVisitsForGroup(group)) {
      const bucket = visitsByBucket.get(visit.bucketKey);
      if (bucket) bucket.push(visit);
      else visitsByBucket.set(visit.bucketKey, [visit]);
    }
  }
  let total = 0;
  for (const visits of visitsByBucket.values()) {
    total += scoreCampusVisits(visits, residentCampus);
  }
  return total;
}
