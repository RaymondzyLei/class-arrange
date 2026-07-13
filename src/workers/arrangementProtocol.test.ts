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
  preferHalfDay: false,
  preferFewerEarlyMornings: false,
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
  it('serializes optional clock times into the minimal Worker DTO', () => {
    const request = createArrangementWorkerRequest(
      7,
      [group('exact', schedule([11], '19:00', '19:30'))],
      SETTINGS,
    );

    expect(request.groups[0].schedule[0]).toMatchObject({
      startTime: '19:00',
      endTime: '19:30',
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
            startTime: '19:00',
            endTime: '19:30',
          }],
          credits: 1,
          hours: 16,
        },
        {
          courseCode: 'standard',
          key: 'standard',
          schedule: [{ weeks: [1, 4], day: 1, periods: [11] }],
          credits: 1,
          hours: 16,
        },
      ],
      settings: {
        preferHalfDay: false,
        preferFewerEarlyMornings: false,
        blockedSlots: [],
      },
    } as unknown as ArrangementWorkerRequest;

    expect(executeArrangementWorkerRequest(request).arrangements[0].conflictCount).toBe(0);
  });
});
