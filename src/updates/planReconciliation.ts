import type {
  AffectedPlanImpact,
  CourseSection,
  CourseFieldChange,
  CourseImpactEvent,
  ScheduleSlot,
  SelectedCourseSnapshot,
  SemesterUpdateBatch,
} from '@/types';
import type { StoredPlansPayloadV2 } from '@/utils/planSeed';
import { sameTeacherSet } from '../utils/teachers';

interface FinalCourseState {
  exists: boolean;
  snapshot?: SelectedCourseSnapshot;
  removed?: SemesterUpdateBatch['removed'][number];
  occurredAt: string;
}

function batchesAfterRevision(
  batches: SemesterUpdateBatch[],
  previousRevision: string | null,
  targetRevision: string,
): SemesterUpdateBatch[] {
  if (previousRevision === targetRevision) return [];
  if (!previousRevision) return batches;
  const start = batches.findIndex((batch) => batch.previousRevision === previousRevision);
  return start >= 0 ? batches.slice(start) : batches;
}

function selectedIds(payload: StoredPlansPayloadV2): Set<string> {
  return new Set(payload.state.plans.flatMap((plan) => plan.courseIds));
}

function affectedPlans(payload: StoredPlansPayloadV2, courseId: string): AffectedPlanImpact[] {
  return payload.state.plans
    .filter((plan) => plan.courseIds.includes(courseId))
    .map((plan) => ({
      planId: plan.id,
      planName: plan.name,
      wasActive: plan.id === payload.state.activePlanId,
    }));
}

function uniqueSorted<T>(values: T[]): T[] {
  const byKey = new Map(values.map((value) => [JSON.stringify(value), value]));
  return [...byKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

function timePart(schedule: ScheduleSlot[]) {
  return schedule.map(({ weeks, day, periods, startTime, endTime }) => ({
    weeks,
    day,
    periods,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  }));
}

function locationPart(schedule: ScheduleSlot[]) {
  return uniqueSorted(schedule.map(({ room, campus }) => ({
    room,
    campus,
  })));
}

function changed(before: unknown, after: unknown): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function selectedChanges(
  previous: SelectedCourseSnapshot,
  current: SelectedCourseSnapshot,
): CourseFieldChange[] {
  const changes: CourseFieldChange[] = [];
  if (!sameTeacherSet(previous.teacher, current.teacher)) {
    changes.push({
      field: 'teacher',
      label: '授课教师',
      before: previous.teacher,
      after: current.teacher,
    });
  }
  if (previous.level !== undefined && previous.level !== current.level) {
    changes.push({
      field: 'level',
      label: '学历层次',
      before: previous.level,
      after: current.level,
    });
  }
  const previousTime = timePart(previous.schedule);
  const currentTime = timePart(current.schedule);
  if (changed(previousTime, currentTime)) {
    changes.push({
      field: 'schedule',
      label: '上课时间与周次',
      before: previousTime,
      after: currentTime,
    });
  }
  const previousLocation = locationPart(previous.schedule);
  const currentLocation = locationPart(current.schedule);
  if (changed(previousLocation, currentLocation)) {
    changes.push({
      field: 'location',
      label: '上课地点或校区',
      before: previousLocation,
      after: currentLocation,
    });
  }
  return changes;
}

function hydrateLegacyLevel(
  stored: SelectedCourseSnapshot | undefined,
  feedSnapshot: SelectedCourseSnapshot,
): SelectedCourseSnapshot {
  if (!stored) return feedSnapshot;
  if (stored.level !== undefined || feedSnapshot.level === undefined) return stored;
  return { ...stored, level: feedSnapshot.level };
}

function withEvents(
  payload: StoredPlansPayloadV2,
  events: CourseImpactEvent[],
): Pick<StoredPlansPayloadV2, 'impactHistory' | 'pendingImpacts'> {
  const historyIds = new Set(payload.impactHistory.map((event) => event.id));
  const pendingIds = new Set(payload.pendingImpacts.map((event) => event.id));
  return {
    impactHistory: [
      ...payload.impactHistory,
      ...events.filter((event) => !historyIds.has(event.id)),
    ],
    pendingImpacts: [
      ...payload.pendingImpacts,
      ...events.filter((event) => !pendingIds.has(event.id)),
    ],
  };
}

export function reconcilePlansWithUpdates(
  payload: StoredPlansPayloadV2,
  semesterKey: string,
  targetRevision: string,
  allBatches: SemesterUpdateBatch[],
  now = Date.now(),
): StoredPlansPayloadV2 {
  const batches = batchesAfterRevision(allBatches, payload.catalogRevision, targetRevision);
  if (batches.length === 0) return { ...payload, catalogRevision: targetRevision };

  const chosenIds = selectedIds(payload);
  const finalStates = new Map<string, FinalCourseState>();
  const originalSnapshots = new Map<string, SelectedCourseSnapshot>();
  for (const id of chosenIds) {
    const stored = payload.selectedSnapshots[id];
    if (stored) originalSnapshots.set(id, stored);
  }

  for (const batch of batches) {
    for (const course of batch.added) {
      if (chosenIds.has(course.id)) {
        finalStates.set(course.id, { exists: true, snapshot: course, occurredAt: batch.publishedAt });
      }
    }
    for (const item of batch.removed) {
      const id = item.course.id;
      if (!chosenIds.has(id)) continue;
      originalSnapshots.set(
        id,
        hydrateLegacyLevel(originalSnapshots.get(id), item.course),
      );
      finalStates.set(id, { exists: false, removed: item, occurredAt: batch.publishedAt });
    }
    for (const item of batch.modified) {
      const id = item.course.id;
      if (!chosenIds.has(id)) continue;
      originalSnapshots.set(
        id,
        hydrateLegacyLevel(originalSnapshots.get(id), item.previous),
      );
      finalStates.set(id, { exists: true, snapshot: item.current, occurredAt: batch.publishedAt });
    }
  }

  let state = payload.state;
  const snapshots = { ...payload.selectedSnapshots };
  const events: CourseImpactEvent[] = [];
  for (const [courseId, finalState] of finalStates) {
    const plans = affectedPlans(payload, courseId);
    const previous = originalSnapshots.get(courseId)
      ?? finalState.removed?.course
      ?? finalState.snapshot;
    if (!previous || plans.length === 0) continue;

    if (!finalState.exists) {
      state = {
        ...state,
        plans: state.plans.map((plan) => plan.courseIds.includes(courseId)
          ? {
              ...plan,
              updatedAt: now,
              courseIds: plan.courseIds.filter((id) => id !== courseId),
            }
          : plan),
      };
      delete snapshots[courseId];
      events.push({
        id: `${semesterKey}:${targetRevision}:removed:${courseId}`,
        semesterKey,
        revision: targetRevision,
        kind: 'removed',
        courseId,
        courseName: previous.courseName,
        occurredAt: finalState.occurredAt,
        affectedPlans: plans,
        previous,
        changes: [],
        replacementCandidates: finalState.removed?.replacementCandidates ?? [],
      });
      continue;
    }

    if (!finalState.snapshot) continue;
    snapshots[courseId] = finalState.snapshot;
    const changes = selectedChanges(previous, finalState.snapshot);
    if (changes.length > 0) {
      events.push({
        id: `${semesterKey}:${targetRevision}:modified:${courseId}`,
        semesterKey,
        revision: targetRevision,
        kind: 'modified',
        courseId,
        courseName: finalState.snapshot.courseName,
        occurredAt: finalState.occurredAt,
        affectedPlans: plans,
        previous,
        current: finalState.snapshot,
        changes,
        replacementCandidates: [],
      });
    }
  }

  return {
    ...payload,
    state,
    selectedSnapshots: snapshots,
    ...withEvents(payload, events),
    catalogRevision: targetRevision,
  };
}

export function acknowledgeImpacts(
  payload: StoredPlansPayloadV2,
  displayedIds: string[],
): StoredPlansPayloadV2 {
  const acknowledged = new Set(displayedIds);
  return {
    ...payload,
    pendingImpacts: payload.pendingImpacts.filter((event) => !acknowledged.has(event.id)),
  };
}

function snapshotFromCourse(course: CourseSection): SelectedCourseSnapshot {
  const codeParts = course.id.split('.');
  const courseCode = codeParts.length > 1 ? codeParts.slice(0, -1).join('.') : course.id;
  return {
    id: course.id,
    courseCode,
    courseName: course.courseName,
    teacher: course.teacher,
    level: course.level,
    schedule: course.schedule,
  };
}

export function reconcilePlansWithCatalog(
  payload: StoredPlansPayloadV2,
  semesterKey: string,
  revision: string,
  courseMap: ReadonlyMap<string, CourseSection>,
  now = Date.now(),
): StoredPlansPayloadV2 {
  const chosenIds = selectedIds(payload);
  const snapshots = { ...payload.selectedSnapshots };
  const events: CourseImpactEvent[] = [];
  let state = payload.state;

  for (const courseId of chosenIds) {
    const course = courseMap.get(courseId);
    const plans = affectedPlans(payload, courseId);
    const previous = snapshots[courseId];
    if (!course) {
      const fallback: SelectedCourseSnapshot = previous ?? {
        id: courseId,
        courseCode: courseId.split('.').slice(0, -1).join('.') || courseId,
        courseName: courseId,
        teacher: '',
        schedule: [],
      };
      state = {
        ...state,
        plans: state.plans.map((plan) => plan.courseIds.includes(courseId)
          ? {
              ...plan,
              updatedAt: now,
              courseIds: plan.courseIds.filter((id) => id !== courseId),
            }
          : plan),
      };
      delete snapshots[courseId];
      events.push({
        id: `${semesterKey}:${revision}:removed:${courseId}`,
        semesterKey,
        revision,
        kind: 'removed',
        courseId,
        courseName: fallback.courseName,
        occurredAt: '',
        affectedPlans: plans,
        previous: fallback,
        changes: [],
        replacementCandidates: [],
      });
      continue;
    }

    const current = snapshotFromCourse(course);
    snapshots[courseId] = current;
    if (!previous) continue;
    const changes = selectedChanges(previous, current);
    if (changes.length > 0) {
      events.push({
        id: `${semesterKey}:${revision}:modified:${courseId}`,
        semesterKey,
        revision,
        kind: 'modified',
        courseId,
        courseName: current.courseName,
        occurredAt: '',
        affectedPlans: plans,
        previous,
        current,
        changes,
        replacementCandidates: [],
      });
    }
  }

  return {
    ...payload,
    state,
    selectedSnapshots: snapshots,
    ...withEvents(payload, events),
    catalogRevision: revision,
  };
}
