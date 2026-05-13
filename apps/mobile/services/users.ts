// 사용자 프로필 API 클라이언트 (SPEC-USER-001)
import { api } from './api';
import type {
  ChangePasswordPayload,
  ListUsersQuery,
  PaginatedUsersResponse,
  UpdateProfilePayload,
  UserProfile,
} from '@workout/types';

// GET /users/me — 내 프로필 조회
export async function fetchMe(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>('/users/me');
  return data;
}

// PATCH /users/me/profile — 프로필 부분 업데이트
export async function updateMyProfile(
  payload: UpdateProfilePayload,
): Promise<UserProfile> {
  const { data } = await api.patch<UserProfile>('/users/me/profile', payload);
  return data;
}

// PATCH /users/me/password — 비밀번호 변경 (204 No Content)
export async function changeMyPassword(
  payload: ChangePasswordPayload,
): Promise<void> {
  await api.patch('/users/me/password', payload);
}

// DELETE /users/me — 계정 소프트 삭제 (204 No Content)
export async function deleteMyAccount(): Promise<void> {
  await api.delete('/users/me');
}

// GET /users — 관리자: 사용자 목록 (페이지네이션)
export async function fetchUsers(
  query: ListUsersQuery = {},
): Promise<PaginatedUsersResponse<UserProfile>> {
  const { data } = await api.get<PaginatedUsersResponse<UserProfile>>(
    '/users',
    {
      params: query,
    },
  );
  return data;
}

// GET /users/:id — 관리자: 사용자 단건 조회
export async function fetchUserById(id: string): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>(`/users/${id}`);
  return data;
}
