// 사용자 프로필 관련 타입 (SPEC-USER-001)
import type {
  ExperienceLevel,
  Gender,
  SocialProvider,
  UserRole,
} from './index';

// 사용자 프로필 응답 (비밀 필드 제외)
export interface UserProfile {
  id: string;
  email: string;
  nickname: string | null;
  gender: Gender | null;
  birthDate: string | null; // ISO 8601
  height: number | null;
  experienceLevel: ExperienceLevel | null;
  role: UserRole;
  socialProvider: SocialProvider | null;
  emailVerified: boolean;
  premiumExpiresAt: string | null; // ISO 8601
  onboardingCompleted: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// 프로필 부분 업데이트 페이로드
export interface UpdateProfilePayload {
  nickname?: string;
  gender?: Gender;
  birthDate?: string; // ISO 8601
  height?: number;
  experienceLevel?: ExperienceLevel;
}

// 비밀번호 변경 페이로드
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// 페이지네이션 응답 제네릭
export interface PaginatedUsersResponse<T = UserProfile> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 관리자 사용자 목록 쿼리 파라미터
export interface ListUsersQuery {
  page?: number;
  limit?: number;
}
