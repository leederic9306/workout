// 운동 세션 API 서비스
// /workouts 엔드포인트의 세션/세트 CRUD를 래핑한다.
import { api } from './api';
import type {
  PaginatedSessionsResponse,
  WorkoutSessionDetail,
  ActiveSessionResponse,
  SessionStatus,
  WorkoutSetItem,
} from '@workout/types';

export interface CreateSessionRequest {
  name?: string;
}

export interface UpdateSessionRequest {
  name?: string;
  notes?: string;
}

export interface AddSetRequest {
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weight?: number;
  duration?: number;
  notes?: string;
}

export interface UpdateSetRequest {
  setNumber?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  notes?: string;
}

export interface ListSessionsQuery {
  page?: number;
  limit?: number;
  status?: SessionStatus;
}

// @MX:ANCHOR: [AUTO] 운동 세션 API의 단일 진입점 (hooks/useWorkouts.ts에서 다수 참조)
// @MX:REASON: useCreateSession/useSession/useAddSet 등 fan_in >= 3

export async function createSession(req: CreateSessionRequest): Promise<WorkoutSessionDetail> {
  const { data } = await api.post<WorkoutSessionDetail>('/workouts', req);
  return data;
}

export async function getActiveSession(): Promise<ActiveSessionResponse> {
  const { data } = await api.get<ActiveSessionResponse>('/workouts/active');
  return data;
}

export async function listSessions(q: ListSessionsQuery): Promise<PaginatedSessionsResponse> {
  const { data } = await api.get<PaginatedSessionsResponse>('/workouts', { params: q });
  return data;
}

export async function getSession(id: string): Promise<WorkoutSessionDetail> {
  const { data } = await api.get<WorkoutSessionDetail>(`/workouts/${id}`);
  return data;
}

export async function updateSession(
  id: string,
  req: UpdateSessionRequest,
): Promise<WorkoutSessionDetail> {
  const { data } = await api.patch<WorkoutSessionDetail>(`/workouts/${id}`, req);
  return data;
}

export async function deleteSession(id: string): Promise<void> {
  await api.delete(`/workouts/${id}`);
}

export async function completeSession(id: string): Promise<WorkoutSessionDetail> {
  const { data } = await api.post<WorkoutSessionDetail>(`/workouts/${id}/complete`);
  return data;
}

export async function addSet(sessionId: string, req: AddSetRequest): Promise<WorkoutSetItem> {
  const { data } = await api.post<WorkoutSetItem>(`/workouts/${sessionId}/sets`, req);
  return data;
}

export async function updateSet(
  sessionId: string,
  setId: string,
  req: UpdateSetRequest,
): Promise<WorkoutSetItem> {
  const { data } = await api.patch<WorkoutSetItem>(`/workouts/${sessionId}/sets/${setId}`, req);
  return data;
}

export async function deleteSet(sessionId: string, setId: string): Promise<void> {
  await api.delete(`/workouts/${sessionId}/sets/${setId}`);
}
