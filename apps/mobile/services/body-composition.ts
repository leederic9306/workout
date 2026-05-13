import { api } from './api';
import type {
  BodyCompositionRecord,
  CreateBodyCompositionRequest,
  PaginatedBodyCompositionResponse,
} from '@workout/types';

// 체성분 기록 생성 (SPEC-DASHBOARD-001)
export async function createBodyComposition(
  payload: CreateBodyCompositionRequest,
): Promise<BodyCompositionRecord> {
  const { data } = await api.post('/users/me/body-composition', payload);
  return data;
}

// 체성분 목록 조회 (커서 페이지네이션)
export async function fetchBodyCompositions(params?: {
  limit?: number;
  cursor?: string;
}): Promise<PaginatedBodyCompositionResponse> {
  const { data } = await api.get('/users/me/body-composition', { params });
  return data;
}

// 체성분 삭제
export async function deleteBodyComposition(id: string): Promise<void> {
  await api.delete(`/users/me/body-composition/${id}`);
}
