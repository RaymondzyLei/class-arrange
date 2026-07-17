import { describe, expect, it } from 'vitest';
import type { CourseGroup, ScheduleSlot } from '@/types';
import type { CustomScheduleSettings } from '@/utils/customization';
import {
  createArrangementWorkerRequest,
  executeArrangementWorkerRequest,
  type ArrangementWorkerRequest,
} from './arrangementProtocol';

const SETTINGS: CustomScheduleSettings = {
  calculationMode: 'auto',
  mergeAllTimeGroups: false,
  preferHalfDay: false,
  preferFewerEarlyMornings: false,
  preferAvoidCampusTransfers: true,
  residentCampus: '高新区',
  blockedSlots: [],
};

function schedule(
  periods: number[],
  startTime?: string,
  endTime?: string,
): ScheduleSlot[] {
  return [{
    weeks: [1, 4],
    room: '',
    campus: '高新区',
    day: 1,
    periods,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  }] as ScheduleSlot[];
}

function group(key: string, slots: ScheduleSlot[]): CourseGroup {
  return {
    courseCode: key,
    courseName: key,
    schedule: slots,
    fingerprint: key,
    sectionIds: [],
    teachers: [],
    sections: [],
    key,
  };
}

describe('arrangement Worker precise schedule protocol', () => {
  it('serializes campus preferences and optional clock times into the Worker DTO', () => {
    const request = createArrangementWorkerRequest(
      7,
      [group('exact', schedule([11], '19:00', '19:30'))],
      SETTINGS,
    );

    expect(request.groups[0].schedule[0]).toMatchObject({
      campus: '高新区',
      startTime: '19:00',
      endTime: '19:30',
    });
    expect(request.settings).toMatchObject({
      preferAvoidCampusTransfers: true,
      residentCampus: '高新区',
    });
  });

  it('rehydrates clock times before calculating conflicts', () => {
    const request = {
      type: 'calculate',
      generation: 8,
      groups: [
        {
          courseCode: 'exact',
          key: 'exact',
          schedule: [{
            weeks: [1, 4],
            day: 1,
            periods: [11],
            campus: '本部',
            startTime: '19:00',
            endTime: '19:30',
          }],
          credits: 1,
          hours: 16,
        },
        {
          courseCode: 'standard',
          key: 'standard',
          schedule: [{ weeks: [1, 4], day: 1, periods: [11], campus: '本部' }],
          credits: 1,
          hours: 16,
        },
      ],
      settings: {
        preferHalfDay: false,
        preferFewerEarlyMornings: false,
        preferAvoidCampusTransfers: true,
        residentCampus: '本部',
        blockedSlots: [],
      },
    } as unknown as ArrangementWorkerRequest;

    expect(executeArrangementWorkerRequest(request).arrangements[0].conflictCount).toBe(0);
  });

  it('rehydrates campuses before applying transfer-aware ranking', () => {
    const request = {
      type: 'calculate',
      generation: 9,
      groups: [
        {
          courseCode: 'A', key: 'a-high', credits: 1, hours: 16,
          schedule: [{
            weeks: [1], day: 1, periods: [1, 2], campus: '高新区',
          }],
        },
        {
          courseCode: 'A', key: 'z-main', credits: 1, hours: 16,
          schedule: [{
            weeks: [1], day: 1, periods: [1, 2], campus: '本部',
          }],
        },
      ],
      settings: {
        preferHalfDay: false,
        preferFewerEarlyMornings: false,
        preferAvoidCampusTransfers: true,
        residentCampus: '本部',
        blockedSlots: [],
      },
    } as ArrangementWorkerRequest;

    expect(executeArrangementWorkerRequest(request).arrangements.map(({ id }) => id))
      .toEqual(['z-main', 'a-high']);
  });
});
