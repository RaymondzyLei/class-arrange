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
  arrangementDisplayCount: 8,
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

function group(
  key: string,
  slots: ScheduleSlot[],
  sectionIds: string[] = [],
): CourseGroup {
  return {
    courseCode: key,
    courseName: key,
    schedule: slots,
    fingerprint: key,
    sectionIds,
    teachers: [],
    sections: [],
    key,
  };
}

describe('arrangement Worker precise schedule protocol', () => {
  it('serializes campus preferences and optional clock times into the Worker DTO', () => {
    const groups = [group('A::late', schedule([11], '19:00', '19:30'), ['A.01'])];
    const favorites = {
      arrangementIds: ['A::late'],
      timeGroupKeys: ['A::late'],
      sectionIds: ['A.01'],
    };
    const request = createArrangementWorkerRequest(
      7,
      groups,
      SETTINGS,
      'recommended',
      favorites,
    );

    groups[0].sectionIds.push('A.02');
    favorites.arrangementIds.push('changed');
    favorites.timeGroupKeys.push('changed');
    favorites.sectionIds.push('A.02');

    expect(request.groups[0].schedule[0]).toMatchObject({
      campus: '高新区',
      startTime: '19:00',
      endTime: '19:30',
    });
    expect(request.settings).toMatchObject({
      arrangementDisplayCount: 8,
      preferAvoidCampusTransfers: true,
      residentCampus: '高新区',
    });
    expect(request.groups[0].sectionIds).toEqual(['A.01']);
    expect(request.favorites).toEqual({
      arrangementIds: ['A::late'],
      timeGroupKeys: ['A::late'],
      sectionIds: ['A.01'],
    });
    expect(request.mode).toBe('recommended');
  });

  it('ranks a lexicographically later group first when its section is favorited', () => {
    const early = group('A::early', [], ['A.01']);
    const late = group('A::late', [], ['A.02']);
    early.courseCode = 'A';
    late.courseCode = 'A';
    const request = createArrangementWorkerRequest(
      8,
      [early, late],
      SETTINGS,
      'recommended',
      { arrangementIds: [], timeGroupKeys: [], sectionIds: ['A.02'] },
    );

    expect(executeArrangementWorkerRequest(request).arrangements.map(({ id }) => id))
      .toEqual(['A::late', 'A::early']);
  });

  it('returns a bounded conflict-free preview with the exact total', () => {
    const request = createArrangementWorkerRequest(
      10,
      [group('A', []), group('A', [])],
      SETTINGS,
    );
    const result = executeArrangementWorkerRequest(request);

    expect(result.totalConflictFreeCount).toBe(2);
    expect(result.arrangements).toHaveLength(2);
    expect(result.conflictFreePreview).toHaveLength(2);
  });

  it('rehydrates clock times before calculating conflicts', () => {
    const request = {
      type: 'calculate',
      generation: 8,
      mode: 'recommended',
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
        arrangementDisplayCount: 8,
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
      mode: 'recommended',
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
        arrangementDisplayCount: 8,
        preferHalfDay: false,
        preferFewerEarlyMornings: false,
        preferAvoidCampusTransfers: true,
        residentCampus: '本部',
        blockedSlots: [],
      },
    } as unknown as ArrangementWorkerRequest;

    expect(executeArrangementWorkerRequest(request).arrangements.map(({ id }) => id))
      .toEqual(['z-main', 'a-high']);
  });
});
