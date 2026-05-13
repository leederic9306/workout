import { api } from './api';
import type {
  BodyCompositionTrendResponse,
  CompoundType,
  DashboardPeriod,
  OneRepMaxHistoryResponse,
  WeeklyVolumeResponse,
  WorkoutFrequencyResponse,
} from '@workout/types';

// 체성분 추이 (Step A)
export async function fetchBodyCompositionTrend(
  period: DashboardPeriod = '3m',
): Promise<BodyCompositionTrendResponse> {
  const { data } = await api.get('/dashboard/body-composition', {
    params: { period },
  });
  return data;
}

// 1RM 히스토리 (Step B)
export async function fetchOneRepMaxHistory(
  exerciseType: CompoundType,
  period: DashboardPeriod = '3m',
): Promise<OneRepMaxHistoryResponse> {
  const { data } = await api.get('/dashboard/1rm-history', {
    params: { exerciseType, period },
  });
  return data;
}

// 주간 볼륨 (Step B)
export async function fetchWeeklyVolume(
  weeks = 12,
): Promise<WeeklyVolumeResponse> {
  const { data } = await api.get('/dashboard/weekly-volume', {
    params: { weeks },
  });
  return data;
}

// 주간 운동 빈도 (Step B)
export async function fetchWorkoutFrequency(
  weeks = 12,
): Promise<WorkoutFrequencyResponse> {
  const { data } = await api.get('/dashboard/workout-frequency', {
    params: { weeks },
  });
  return data;
}
