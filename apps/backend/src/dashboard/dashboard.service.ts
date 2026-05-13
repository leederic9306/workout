import { Injectable } from '@nestjs/common';
import { CompoundType, SessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { COMPOUND_EXERCISE_SLUG_MAP } from '../workouts/compound-exercises';
import {
  DashboardPeriod,
  OneRepMaxHistoryQueryDto,
  PeriodQueryDto,
  WeeksQueryDto,
} from './dto/dashboard-query.dto';
import {
  epley,
  periodStart,
  startOfWeekUtcMonday,
  weekStarts,
} from './period.util';

// 응답 타입 (컨트롤러에서도 재사용)
export interface BodyCompositionTrendPoint {
  recordedAt: string;
  weight: number;
  muscleMass: number | null;
  bodyFatPct: number | null;
}

export interface BodyCompositionTrendResponse {
  period: DashboardPeriod;
  points: BodyCompositionTrendPoint[];
}

export interface OneRepMaxHistoryPoint {
  sessionId: string;
  completedAt: string;
  estimated1RM: number;
}

export interface OneRepMaxHistoryResponse {
  exerciseType: CompoundType;
  period: DashboardPeriod;
  points: OneRepMaxHistoryPoint[];
}

export interface WeeklyVolumePoint {
  weekStart: string;
  totalVolume: number;
  sessionCount: number;
}

export interface WeeklyVolumeResponse {
  weeks: number;
  points: WeeklyVolumePoint[];
}

export interface WorkoutFrequencyPoint {
  weekStart: string;
  sessionCount: number;
}

export interface WorkoutFrequencyResponse {
  weeks: number;
  points: WorkoutFrequencyPoint[];
}

// @MX:ANCHOR: [AUTO] 대시보드 도메인 서비스 (4종 차트 데이터 제공)
// @MX:REASON: SPEC-DASHBOARD-001 - 컨트롤러 4개 엔드포인트가 모두 호출 (fan_in >= 4)
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Step A: 체성분 추이 ----------
  async getBodyCompositionTrend(
    userId: string,
    query: PeriodQueryDto,
  ): Promise<BodyCompositionTrendResponse> {
    const period = query.period ?? DashboardPeriod.THREE_MONTHS;
    const from = periodStart(period);

    const rows = await this.prisma.bodyComposition.findMany({
      where: { userId, recordedAt: { gte: from } },
      orderBy: { recordedAt: 'asc' },
    });

    return {
      period,
      points: rows.map((r) => ({
        recordedAt: r.recordedAt.toISOString(),
        weight: Number(r.weight),
        muscleMass: r.muscleMass != null ? Number(r.muscleMass) : null,
        bodyFatPct: r.bodyFatPct != null ? Number(r.bodyFatPct) : null,
      })),
    };
  }

  // ---------- Step B: 1RM 히스토리 ----------
  async getOneRepMaxHistory(
    userId: string,
    query: OneRepMaxHistoryQueryDto,
  ): Promise<OneRepMaxHistoryResponse> {
    const period = query.period ?? DashboardPeriod.THREE_MONTHS;
    const from = periodStart(period);
    const slug = COMPOUND_EXERCISE_SLUG_MAP[query.exerciseType];

    // 해당 컴파운드 운동의 Exercise.id 조회
    const exercise = await this.prisma.exercise.findUnique({
      where: { externalId: slug },
      select: { id: true },
    });

    if (!exercise) {
      return { exerciseType: query.exerciseType, period, points: [] };
    }

    // 완료된 세션의 해당 운동 세트 중 1≤reps≤10, weight!=null 만
    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        userId,
        status: SessionStatus.COMPLETED,
        completedAt: { gte: from, not: null },
        sets: {
          some: {
            exerciseId: exercise.id,
            reps: { gte: 1, lte: 10 },
            weight: { not: null },
          },
        },
      },
      select: {
        id: true,
        completedAt: true,
        sets: {
          where: {
            exerciseId: exercise.id,
            reps: { gte: 1, lte: 10 },
            weight: { not: null },
          },
          select: { reps: true, weight: true },
        },
      },
      orderBy: { completedAt: 'asc' },
    });

    const points: OneRepMaxHistoryPoint[] = sessions
      .map((s) => {
        let best = 0;
        for (const set of s.sets) {
          if (set.reps == null || set.weight == null) continue;
          const e = epley(set.weight, set.reps);
          if (e > best) best = e;
        }
        return {
          sessionId: s.id,
          completedAt: (s.completedAt as Date).toISOString(),
          estimated1RM: Math.round(best * 100) / 100,
        };
      })
      .filter((p) => p.estimated1RM > 0);

    return { exerciseType: query.exerciseType, period, points };
  }

  // ---------- Step B: 주간 볼륨 ----------
  async getWeeklyVolume(
    userId: string,
    query: WeeksQueryDto,
  ): Promise<WeeklyVolumeResponse> {
    const weeks = query.weeks ?? 12;
    const starts = weekStarts(weeks);
    const rangeStart = starts[0];

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        userId,
        status: SessionStatus.COMPLETED,
        completedAt: { gte: rangeStart, not: null },
      },
      select: {
        id: true,
        completedAt: true,
        sets: {
          select: { reps: true, weight: true },
        },
      },
    });

    // 주별 버킷 초기화
    const buckets = new Map<
      string,
      { totalVolume: number; sessionIds: Set<string> }
    >();
    for (const s of starts) {
      buckets.set(s.toISOString(), {
        totalVolume: 0,
        sessionIds: new Set<string>(),
      });
    }

    for (const session of sessions) {
      if (!session.completedAt) continue;
      const wkStart = startOfWeekUtcMonday(session.completedAt).toISOString();
      const bucket = buckets.get(wkStart);
      if (!bucket) continue;
      bucket.sessionIds.add(session.id);
      for (const set of session.sets) {
        if (set.weight == null || set.reps == null) continue; // bodyweight 제외
        bucket.totalVolume += set.weight * set.reps;
      }
    }

    return {
      weeks,
      points: starts.map((s) => {
        const key = s.toISOString();
        const b = buckets.get(key)!;
        return {
          weekStart: key,
          totalVolume: Math.round(b.totalVolume * 100) / 100,
          sessionCount: b.sessionIds.size,
        };
      }),
    };
  }

  // ---------- Step B: 주간 운동 빈도 ----------
  async getWorkoutFrequency(
    userId: string,
    query: WeeksQueryDto,
  ): Promise<WorkoutFrequencyResponse> {
    const weeks = query.weeks ?? 12;
    const starts = weekStarts(weeks);
    const rangeStart = starts[0];

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        userId,
        status: SessionStatus.COMPLETED,
        completedAt: { gte: rangeStart, not: null },
      },
      select: { id: true, completedAt: true },
    });

    const buckets = new Map<string, Set<string>>();
    for (const s of starts) buckets.set(s.toISOString(), new Set<string>());

    for (const s of sessions) {
      if (!s.completedAt) continue;
      const key = startOfWeekUtcMonday(s.completedAt).toISOString();
      buckets.get(key)?.add(s.id);
    }

    return {
      weeks,
      points: starts.map((s) => ({
        weekStart: s.toISOString(),
        sessionCount: buckets.get(s.toISOString())!.size,
      })),
    };
  }
}
