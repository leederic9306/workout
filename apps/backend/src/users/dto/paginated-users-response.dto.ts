import type { PaginatedUsersResponse, UserProfile } from '@workout/types';

// 관리자 페이지네이션 응답 DTO
// PaginatedUsersResponse<UserProfile>의 명시적 별칭으로 사용
export type PaginatedUsersResponseDto = PaginatedUsersResponse<UserProfile>;
