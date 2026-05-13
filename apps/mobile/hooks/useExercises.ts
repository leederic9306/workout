import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
  InfiniteData,
} from '@tanstack/react-query';
import type { ExerciseListQuery, PaginatedExercisesResponse, ExerciseDetail } from '@workout/types';
import {
  fetchExercises,
  fetchExerciseDetail,
  addFavorite,
  removeFavorite,
  fetchFavorites,
} from '../services/exercises';

export function useExercises(filters: Omit<ExerciseListQuery, 'page'>) {
  return useInfiniteQuery<PaginatedExercisesResponse, Error, InfiniteData<PaginatedExercisesResponse>, string[], number>({
    queryKey: ['exercises', JSON.stringify(filters)],
    queryFn: ({ pageParam }) =>
      fetchExercises({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
  });
}

export function useExerciseDetail(id: string) {
  return useQuery({
    queryKey: ['exercise', id],
    queryFn: () => fetchExerciseDetail(id),
    enabled: !!id,
  });
}

export function useFavoriteExercises() {
  return useInfiniteQuery<PaginatedExercisesResponse, Error, InfiniteData<PaginatedExercisesResponse>, string[], number>({
    queryKey: ['exercises', 'favorites'],
    queryFn: ({ pageParam }) => fetchFavorites({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      if (isFavorite) {
        await removeFavorite(id);
      } else {
        await addFavorite(id);
      }
    },
    onMutate: async ({ id, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: ['exercise', id] });
      const previous = queryClient.getQueryData<ExerciseDetail>(['exercise', id]);
      if (previous) {
        queryClient.setQueryData<ExerciseDetail>(['exercise', id], {
          ...previous,
          isFavorite: !isFavorite,
        });
      }
      return { previous };
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['exercise', id], context.previous);
      }
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['exercise', id] });
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });
}
