import { api } from './api';
import type {
  ExerciseDetail,
  ExerciseListQuery,
  PaginatedExercisesResponse,
  FavoriteToggleResponse,
} from '@workout/types';

export async function fetchExercises(
  query: ExerciseListQuery & { page: number },
): Promise<PaginatedExercisesResponse> {
  const { data } = await api.get('/exercises', { params: query });
  return data;
}

export async function fetchExerciseDetail(id: string): Promise<ExerciseDetail> {
  const { data } = await api.get(`/exercises/${id}`);
  return data;
}

export async function addFavorite(id: string): Promise<FavoriteToggleResponse> {
  const { data } = await api.post(`/exercises/${id}/favorites`);
  return data;
}

export async function removeFavorite(id: string): Promise<void> {
  await api.delete(`/exercises/${id}/favorites`);
}

export async function fetchFavorites(
  query: { page: number; limit?: number },
): Promise<PaginatedExercisesResponse> {
  const { data } = await api.get('/exercises/favorites', { params: query });
  return data;
}
