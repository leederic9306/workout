// 대시보드 도메인 타입 (SPEC-DASHBOARD-001)
import type { CompoundType } from './index';

export type DashboardPeriod = '1m' | '3m' | '6m' | '1y';

// 1RM 히스토리 응답
export interface OneRepMaxHistoryPoint {
  sessionId: string;
  completedAt: string; // ISO 8601
  estimated1RM: number;
}

export interface OneRepMaxHistoryResponse {
  exerciseType: CompoundType;
  period: DashboardPeriod;
  points: OneRepMaxHistoryPoint[];
}

// 체성분 추이 응답
export interface BodyCompositionPoint {
  recordedAt: string; // ISO 8601
  weight: number;
  muscleMass: number | null;
  bodyFatPct: number | null;
}

export interface BodyCompositionTrendResponse {
  period: DashboardPeriod;
  points: BodyCompositionPoint[];
}

// 주간 볼륨 응답
export interface WeeklyVolumePoint {
  weekStart: string; // ISO 8601 (Monday UTC 00:00)
  totalVolume: number;
  sessionCount: number;
}

export interface WeeklyVolumeResponse {
  weeks: number;
  points: WeeklyVolumePoint[];
}

// 주간 운동 빈도 응답
export interface WorkoutFrequencyPoint {
  weekStart: string; // ISO 8601 (Monday UTC 00:00)
  sessionCount: number;
}

export interface WorkoutFrequencyResponse {
  weeks: number;
  points: WorkoutFrequencyPoint[];
}
