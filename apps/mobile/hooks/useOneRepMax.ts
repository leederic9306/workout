import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompoundType } from '@workout/types';
import {
  estimateOneRepMax,
  fetchOneRepMaxes,
  upsertOneRepMax,
} from '../services/one-rep-max';

const ONE_REP_MAX_QUERY_KEY = ['1rm'] as const;

export function useOneRepMaxes() {
  return useQuery({
    queryKey: ONE_REP_MAX_QUERY_KEY,
    queryFn: fetchOneRepMaxes,
  });
}

export function useUpsertOneRepMax() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      exerciseType,
      value,
    }: {
      exerciseType: CompoundType;
      value: number;
    }) => upsertOneRepMax(exerciseType, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONE_REP_MAX_QUERY_KEY });
    },
  });
}

export function useEstimateOneRepMax() {
  return useMutation({
    mutationFn: async ({ weight, reps }: { weight: number; reps: number }) =>
      estimateOneRepMax(weight, reps),
  });
}
