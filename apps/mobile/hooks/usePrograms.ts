// 운동 프로그램 React Query 훅 (SPEC-PROGRAM-001)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateAiProgramRequest } from '@workout/types';
import {
  fetchCatalog,
  fetchProgramDetail,
  fetchActiveProgram,
  activateProgram,
  deactivateProgram,
  createAiProgram,
} from '../services/programs';

export function useCatalog() {
  return useQuery({
    queryKey: ['programs', 'catalog'],
    queryFn: fetchCatalog,
    staleTime: Infinity,
  });
}

export function useProgramDetail(id: string) {
  return useQuery({
    queryKey: ['programs', 'detail', id],
    queryFn: () => fetchProgramDetail(id),
    enabled: !!id,
  });
}

export function useActiveProgram() {
  return useQuery({
    queryKey: ['programs', 'active'],
    queryFn: fetchActiveProgram,
    staleTime: 30_000,
  });
}

export function useActivateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activateProgram(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs', 'active'] });
    },
  });
}

export function useDeactivateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateProgram,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs', 'active'] });
    },
  });
}

export function useCreateAiProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAiProgramRequest) => createAiProgram(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs', 'active'] });
    },
  });
}
