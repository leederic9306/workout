import { api } from './api';
import type {
  CompoundType,
  OneRepMaxCollection,
  OneRepMaxRecord,
  OneRepMaxEstimateResponse,
} from '@workout/types';

export async function fetchOneRepMaxes(): Promise<OneRepMaxCollection> {
  const { data } = await api.get('/users/me/1rm');
  return data;
}

export async function upsertOneRepMax(
  exerciseType: CompoundType,
  value: number,
): Promise<OneRepMaxRecord> {
  const { data } = await api.put(`/users/me/1rm/${exerciseType}`, { value });
  return data;
}

export async function estimateOneRepMax(
  weight: number,
  reps: number,
): Promise<OneRepMaxEstimateResponse> {
  const { data } = await api.post('/users/me/1rm/estimate', { weight, reps });
  return data;
}
