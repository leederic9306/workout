import { Test, TestingModule } from '@nestjs/testing';
import { CompoundType, SessionStatus } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardPeriod } from './dto/dashboard-query.dto';
import { epley, startOfWeekUtcMonday, weekStarts } from './period.util';

const buildPrismaMock = () => ({
  bodyComposition: { findMany: jest.fn() },
  workoutSession: { findMany: jest.fn() },
  exercise: { findUnique: jest.fn() },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaMock;
  const USER_ID = 'user-1';

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<DashboardService>(DashboardService);
  });

  describe('period.util', () => {
    it('epley 공식: weight * (1 + reps/30)', () => {
      expect(epley(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 5);
      expect(epley(60, 10)).toBeCloseTo(60 * (1 + 10 / 30), 5);
    });

    it('startOfWeekUtcMonday: 일요일 → 직전 월요일', () => {
      // 2026-05-10 일요일 12:00 UTC → 2026-05-04 월요일 00:00 UTC
      const d = new Date('2026-05-10T12:00:00.000Z');
      expect(startOfWeekUtcMonday(d).toISOString()).toBe(
        '2026-05-04T00:00:00.000Z',
      );
    });

    it('startOfWeekUtcMonday: 월요일은 그 날 00:00', () => {
      const d = new Date('2026-05-11T15:00:00.000Z');
      expect(startOfWeekUtcMonday(d).toISOString()).toBe(
        '2026-05-11T00:00:00.000Z',
      );
    });

    it('weekStarts: N개의 월요일을 오름차순으로 반환', () => {
      const now = new Date('2026-05-13T08:00:00.000Z'); // 수요일
      const starts = weekStarts(4, now);
      expect(starts).toHaveLength(4);
      // 마지막은 이번 주 월요일
      expect(starts[3].toISOString()).toBe('2026-05-11T00:00:00.000Z');
      // 첫번째는 3주 전 월요일
      expect(starts[0].toISOString()).toBe('2026-04-20T00:00:00.000Z');
    });
  });

  describe('getBodyCompositionTrend', () => {
    it('기간 내 체성분을 시간순으로 반환', async () => {
      const t1 = new Date('2026-05-01T00:00:00.000Z');
      prisma.bodyComposition.findMany.mockResolvedValue([
        {
          id: 'b1',
          weight: 75,
          muscleMass: 35,
          bodyFatPct: 18,
          recordedAt: t1,
          createdAt: t1,
        },
      ]);
      const result = await service.getBodyCompositionTrend(USER_ID, {
        period: DashboardPeriod.ONE_MONTH,
      });
      expect(result.period).toBe(DashboardPeriod.ONE_MONTH);
      expect(result.points).toHaveLength(1);
      expect(result.points[0].weight).toBe(75);
    });

    it('데이터 없을 시 빈 points 반환', async () => {
      prisma.bodyComposition.findMany.mockResolvedValue([]);
      const result = await service.getBodyCompositionTrend(USER_ID, {});
      expect(result.points).toEqual([]);
      // period 미지정 시 기본값(THREE_MONTHS) 사용
      expect(result.period).toBe(DashboardPeriod.THREE_MONTHS);
    });
  });

  describe('getOneRepMaxHistory', () => {
    it('해당 컴파운드 Exercise가 없으면 빈 points', async () => {
      prisma.exercise.findUnique.mockResolvedValue(null);
      const result = await service.getOneRepMaxHistory(USER_ID, {
        exerciseType: CompoundType.SQUAT,
      });
      expect(result.points).toEqual([]);
      expect(result.exerciseType).toBe(CompoundType.SQUAT);
    });

    it('세션 당 최고 Epley 1점만 반환 (reps>10 또는 weight=null 제외)', async () => {
      prisma.exercise.findUnique.mockResolvedValue({ id: 'ex-squat' });
      const completedAt = new Date('2026-05-10T08:00:00.000Z');
      prisma.workoutSession.findMany.mockResolvedValue([
        {
          id: 's1',
          completedAt,
          sets: [
            { reps: 5, weight: 100 }, // Epley = 100*(1+5/30) = 116.67
            { reps: 3, weight: 110 }, // Epley = 110*(1+3/30) = 121.0
          ],
        },
      ]);
      const result = await service.getOneRepMaxHistory(USER_ID, {
        exerciseType: CompoundType.SQUAT,
      });
      expect(result.points).toHaveLength(1);
      expect(result.points[0].sessionId).toBe('s1');
      expect(result.points[0].estimated1RM).toBeCloseTo(121, 1);
    });

    it('모든 세트가 0이면 해당 세션 점 제외', async () => {
      prisma.exercise.findUnique.mockResolvedValue({ id: 'ex' });
      prisma.workoutSession.findMany.mockResolvedValue([
        { id: 's1', completedAt: new Date(), sets: [] },
      ]);
      const result = await service.getOneRepMaxHistory(USER_ID, {
        exerciseType: CompoundType.SQUAT,
      });
      expect(result.points).toHaveLength(0);
    });
  });

  describe('getWeeklyVolume', () => {
    it('주별 볼륨 = SUM(weight*reps), bodyweight 세트 제외, 0주차 포함', async () => {
      // 시스템 시간을 고정
      const fixedNow = new Date('2026-05-13T08:00:00.000Z'); // 수요일
      jest.useFakeTimers().setSystemTime(fixedNow);

      const monday = new Date('2026-05-11T00:00:00.000Z');
      prisma.workoutSession.findMany.mockResolvedValue([
        {
          id: 's1',
          completedAt: new Date('2026-05-12T10:00:00.000Z'),
          sets: [
            { reps: 5, weight: 100 }, // 500
            { reps: 10, weight: 50 }, // 500
            { reps: 8, weight: null }, // 제외 (bodyweight)
          ],
        },
      ]);

      const result = await service.getWeeklyVolume(USER_ID, { weeks: 4 });
      expect(result.weeks).toBe(4);
      expect(result.points).toHaveLength(4);

      const thisWeek = result.points.find(
        (p) => p.weekStart === monday.toISOString(),
      )!;
      expect(thisWeek.totalVolume).toBe(1000);
      expect(thisWeek.sessionCount).toBe(1);

      // 0 볼륨 주차도 포함되어야 함
      const zeroWeeks = result.points.filter((p) => p.totalVolume === 0);
      expect(zeroWeeks.length).toBe(3);

      jest.useRealTimers();
    });

    it('완료된 세션이 없으면 모든 주차 totalVolume=0, sessionCount=0', async () => {
      const fixedNow = new Date('2026-05-13T08:00:00.000Z');
      jest.useFakeTimers().setSystemTime(fixedNow);

      prisma.workoutSession.findMany.mockResolvedValue([]);

      const result = await service.getWeeklyVolume(USER_ID, { weeks: 4 });
      expect(result.points).toHaveLength(4);
      expect(result.points.every((p) => p.totalVolume === 0)).toBe(true);
      expect(result.points.every((p) => p.sessionCount === 0)).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('getWorkoutFrequency', () => {
    it('주간 COMPLETED 세션 수 반환, 0주차 포함', async () => {
      const fixedNow = new Date('2026-05-13T08:00:00.000Z');
      jest.useFakeTimers().setSystemTime(fixedNow);

      prisma.workoutSession.findMany.mockResolvedValue([
        { id: 's1', completedAt: new Date('2026-05-12T10:00:00.000Z') },
        { id: 's2', completedAt: new Date('2026-05-11T10:00:00.000Z') },
      ]);

      const result = await service.getWorkoutFrequency(USER_ID, { weeks: 4 });
      expect(result.weeks).toBe(4);
      expect(result.points).toHaveLength(4);
      const thisWeek = result.points.find(
        (p) => p.weekStart === '2026-05-11T00:00:00.000Z',
      )!;
      expect(thisWeek.sessionCount).toBe(2);

      // findMany 호출 시 status=COMPLETED 필터 적용 확인
      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: USER_ID,
            status: SessionStatus.COMPLETED,
          }),
        }),
      );

      jest.useRealTimers();
    });

    it('완료 세션 없을 시 모든 주차 sessionCount=0', async () => {
      const fixedNow = new Date('2026-05-13T08:00:00.000Z');
      jest.useFakeTimers().setSystemTime(fixedNow);

      prisma.workoutSession.findMany.mockResolvedValue([]);

      const result = await service.getWorkoutFrequency(USER_ID, { weeks: 4 });
      expect(result.points).toHaveLength(4);
      expect(result.points.every((p) => p.sessionCount === 0)).toBe(true);

      jest.useRealTimers();
    });
  });
});
