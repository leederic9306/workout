import { useQuery } from '@tanstack/react-query';
import type { CompoundType, DashboardPeriod } from '@workout/types';
import {
  fetchBodyCompositionTrend,
  fetchOneRepMaxHistory,
  fetchWeeklyVolume,
  fetchWorkoutFrequency,
} from '../services/dashboard';
import { DASHBOARD_BODY_KEY } from './useBodyComposition';

const STALE_TIME = 5 * 60 * 1000; // 5분 (SPEC-DASHBOARD-001)

export function useBodyCompositionTrend(period: DashboardPeriod = '3m') {
  return useQuery({
    queryKey: [...DASHBOARD_BODY_KEY, period],
    queryFn: () => fetchBodyCompositionTrend(period),
    staleTime: STALE_TIME,
  });
}

export function useOneRepMaxHistory(
  exerciseType: CompoundType,
  period: DashboardPeriod = '3m',
) {
  return useQuery({
    queryKey: ['dashboard', '1rm-history', exerciseType, period],
    queryFn: () => fetchOneRepMaxHistory(exerciseType, period),
    staleTime: STALE_TIME,
  });
}

export function useWeeklyVolume(weeks = 12) {
  return useQuery({
    queryKey: ['dashboard', 'weekly-volume', weeks],
    queryFn: () => fetchWeeklyVolume(weeks),
    staleTime: STALE_TIME,
  });
}

export function useWorkoutFrequency(weeks = 12) {
  return useQuery({
    queryKey: ['dashboard', 'workout-frequency', weeks],
    queryFn: () => fetchWorkoutFrequency(weeks),
    staleTime: STALE_TIME,
  });
}
