import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { CreateBodyCompositionRequest } from '@workout/types';
import {
  createBodyComposition,
  deleteBodyComposition,
  fetchBodyCompositions,
} from '../services/body-composition';

export const BODY_COMPOSITION_KEY = ['body-composition'] as const;
export const DASHBOARD_BODY_KEY = ['dashboard', 'body-composition'] as const;

// 체성분 목록 (무한 스크롤)
export function useBodyCompositions(limit = 20) {
  return useInfiniteQuery({
    queryKey: [...BODY_COMPOSITION_KEY, { limit }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchBodyCompositions({ limit, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000, // 5분
  });
}

// 체성분 생성
export function useCreateBodyComposition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBodyCompositionRequest) =>
      createBodyComposition(payload),
    onSuccess: () => {
      // SPEC-DASHBOARD-001 - 두 캐시 모두 무효화
      qc.invalidateQueries({ queryKey: BODY_COMPOSITION_KEY });
      qc.invalidateQueries({ queryKey: DASHBOARD_BODY_KEY });
    },
  });
}

// 체성분 삭제
export function useDeleteBodyComposition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBodyComposition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BODY_COMPOSITION_KEY });
      qc.invalidateQueries({ queryKey: DASHBOARD_BODY_KEY });
    },
  });
}
