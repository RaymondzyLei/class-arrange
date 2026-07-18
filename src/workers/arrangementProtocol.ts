import type { Campus, CourseGroup, ResidentCampus } from '../types';
import {
  enumerateArrangementResultsExact,
  type ArrangementResultMode,
} from '../utils/arrangementEngine';
import {
  DEFAULT_CUSTOM_SETTINGS,
  type ArrangementDisplayCount,
  type CustomScheduleSettings,
} from '../utils/customization';

export interface ArrangementWorkerScheduleDto {
  weeks: number[];
  day: number;
  periods: number[];
  campus: Campus;
  startTime?: string;
  endTime?: string;
}

export interface ArrangementWorkerGroupDto {
  courseCode: string;
  key: string;
  schedule: ArrangementWorkerScheduleDto[];
  credits: number;
  hours: number;
}

export interface ArrangementWorkerSettingsDto {
  arrangementDisplayCount: ArrangementDisplayCount;
  preferHalfDay: boolean;
  preferFewerEarlyMornings: boolean;
  preferAvoidCampusTransfers: boolean;
  residentCampus: ResidentCampus;
  blockedSlots: string[];
}

export interface ArrangementWorkerRequest {
  type: 'calculate';
  generation: number;
  mode: ArrangementResultMode;
  groups: ArrangementWorkerGroupDto[];
  settings: ArrangementWorkerSettingsDto;
}

export interface ArrangementResultDto {
  id: string;
  groupKeys: string[];
  conflictCount: number;
  courseCount: number;
  totalCredits: number;
  totalHours: number;
}

export interface ArrangementWorkerResult {
  type: 'result';
  generation: number;
  arrangements: ArrangementResultDto[];
  conflictFreePreview: ArrangementResultDto[];
  totalConflictFreeCount: number;
}

export interface ArrangementWorkerError {
  type: 'error';
  generation: number;
  message: string;
}

export type ArrangementWorkerResponse = ArrangementWorkerResult | ArrangementWorkerError;

export function createArrangementWorkerRequest(
  generation: number,
  groups: CourseGroup[],
  settings: CustomScheduleSettings,
  mode: ArrangementResultMode = 'recommended',
): ArrangementWorkerRequest {
  return {
    type: 'calculate',
    generation,
    mode,
    groups: groups.map((group) => ({
      courseCode: group.courseCode,
      key: group.key,
      schedule: group.schedule.map((slot) => ({
        weeks: [...slot.weeks],
        day: slot.day,
        periods: [...slot.periods],
        campus: slot.campus,
        ...(slot.startTime ? { startTime: slot.startTime } : {}),
        ...(slot.endTime ? { endTime: slot.endTime } : {}),
      })),
      credits: group.sections[0]?.credits ?? 0,
      hours: group.sections[0]?.hours ?? 0,
    })),
    settings: {
      arrangementDisplayCount: settings.arrangementDisplayCount,
      preferHalfDay: settings.preferHalfDay,
      preferFewerEarlyMornings: settings.preferFewerEarlyMornings,
      preferAvoidCampusTransfers: settings.preferAvoidCampusTransfers,
      residentCampus: settings.residentCampus,
      blockedSlots: [...settings.blockedSlots],
    },
  };
}

function rehydrateWorkerInputGroup(dto: ArrangementWorkerGroupDto): CourseGroup {
  return {
    courseCode: dto.courseCode,
    courseName: '',
    schedule: dto.schedule.map((slot) => ({
      weeks: slot.weeks,
      room: '',
      campus: slot.campus,
      day: slot.day,
      periods: slot.periods,
      ...(slot.startTime ? { startTime: slot.startTime } : {}),
      ...(slot.endTime ? { endTime: slot.endTime } : {}),
    })),
    fingerprint: '',
    sectionIds: [],
    teachers: [],
    sections: [{ credits: dto.credits, hours: dto.hours }] as CourseGroup['sections'],
    key: dto.key,
  };
}

export function executeArrangementWorkerRequest(
  request: ArrangementWorkerRequest,
): ArrangementWorkerResult {
  const settings: CustomScheduleSettings = {
    calculationMode: 'auto',
    arrangementDisplayCount: request.settings.arrangementDisplayCount
      ?? DEFAULT_CUSTOM_SETTINGS.arrangementDisplayCount,
    mergeAllTimeGroups: false,
    preferHalfDay: request.settings.preferHalfDay,
    preferFewerEarlyMornings: request.settings.preferFewerEarlyMornings,
    preferAvoidCampusTransfers: request.settings.preferAvoidCampusTransfers,
    residentCampus: request.settings.residentCampus,
    blockedSlots: request.settings.blockedSlots,
  };
  const result = enumerateArrangementResultsExact(
    request.groups.map(rehydrateWorkerInputGroup),
    settings,
    { mode: request.mode ?? 'recommended' },
  );
  const toDto = (arrangement: (typeof result.arrangements)[number]): ArrangementResultDto => ({
    id: arrangement.id,
    groupKeys: arrangement.groups.map((group) => group.key),
    conflictCount: arrangement.conflictCount,
    courseCount: arrangement.courseCount,
    totalCredits: arrangement.totalCredits,
    totalHours: arrangement.totalHours,
  });
  return {
    type: 'result',
    generation: request.generation,
    arrangements: result.arrangements.map(toDto),
    conflictFreePreview: result.conflictFreePreview.map(toDto),
    totalConflictFreeCount: result.totalConflictFreeCount,
  };
}
