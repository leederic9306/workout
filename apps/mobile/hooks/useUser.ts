// 사용자 프로필 관련 React Query 훅 (SPEC-USER-001)
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  ChangePasswordPayload,
  ListUsersQuery,
  PaginatedUsersResponse,
  UpdateProfilePayload,
  UserProfile,
} from '@workout/types';
import {
  changeMyPassword,
  deleteMyAccount,
  fetchMe,
  fetchUsers,
  fetchUserById,
  updateMyProfile,
} from '../services/users';
import { useAuthStore } from '../stores/authStore';

// 내 프로필 조회
export function useMe() {
  return useQuery<UserProfile, Error>({
    queryKey: ['user', 'me'],
    queryFn: fetchMe,
  });
}

// 내 프로필 업데이트
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation<UserProfile, Error, UpdateProfilePayload>({
    mutationFn: updateMyProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(['user', 'me'], data);
    },
  });
}

// 비밀번호 변경
// 성공 시 모든 세션이 무효화되므로 클라이언트도 로그아웃해야 한다
export function useChangeMyPassword() {
  const logout = useAuthStore((s) => s.logout);
  return useMutation<void, Error, ChangePasswordPayload>({
    mutationFn: changeMyPassword,
    onSuccess: async () => {
      // 비밀번호 변경 후 강제 재로그인 흐름
      await logout();
    },
  });
}

// 계정 소프트 삭제
export function useDeleteMyAccount() {
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: deleteMyAccount,
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['user'] });
      await logout();
    },
  });
}

// 관리자: 사용자 목록
export function useUsers(query: ListUsersQuery = {}) {
  return useQuery<PaginatedUsersResponse<UserProfile>, Error>({
    queryKey: ['users', 'list', query],
    queryFn: () => fetchUsers(query),
  });
}

// 관리자: 사용자 단건
export function useUserById(id: string) {
  return useQuery<UserProfile, Error>({
    queryKey: ['users', 'detail', id],
    queryFn: () => fetchUserById(id),
    enabled: !!id,
  });
}
