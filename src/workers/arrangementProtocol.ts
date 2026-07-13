import type { CourseGroup } from '../types';
import { enumerateArrangementsExact } from '../utils/arrangementEngine';
import type { CustomScheduleSettings } from '../utils/customization';

export interface ArrangementWorkerScheduleDto {
  weeks: number[];
  day: number;
  periods: number[];
}

export interface ArrangementWorkerGroupDto {
  courseCode: string;
  key: string;
  schedule: ArrangementWorkerScheduleDto[];
  credits: number;
  hours: number;
}

export interface ArrangementWorkerSettingsDto {
  preferHalfDay: boolean;
  preferFewerEarlyMornings: boolean;
  blockedSlots: string[];
}

export interface ArrangementWorkerRequest {
  type: 'calculate';
  generation: number;
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
): ArrangementWorkerRequest {
  return {
    type: 'calculate',
    generation,
    groups: groups.map((group) => ({
      courseCode: group.courseCode,
      key: group.key,
      schedule: group.schedule.map((slot) => ({
        weeks: [...slot.weeks],
        day: slot.day,
        periods: [...slot.periods],
      })),
      credits: group.sections[0]?.credits ?? 0,
      hours: group.sections[0]?.hours ?? 0,
    })),
    settings: {
      preferHalfDay: settings.preferHalfDay,
      preferFewerEarlyMornings: settings.preferFewerEarlyMornings,
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
      day: slot.day,
      periods: slot.periods,
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
    preferHalfDay: request.settings.preferHalfDay,
    preferFewerEarlyMornings: request.settings.preferFewerEarlyMornings,
    blockedSlots: request.settings.blockedSlots,
  };
  const arrangements = enumerateArrangementsExact(
    request.groups.map(rehydrateWorkerInputGroup),
    settings,
  );
  return {
    type: 'result',
    generation: request.generation,
    arrangements: arrangements.map((arrangement) => ({
      id: arrangement.id,
      groupKeys: arrangement.groups.map((group) => group.key),
      conflictCount: arrangement.conflictCount,
      courseCount: arrangement.courseCount,
      totalCredits: arrangement.totalCredits,
      totalHours: arrangement.totalHours,
    })),
  };
}
