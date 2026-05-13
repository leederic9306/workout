import type { UserProfile } from '@workout/types';
import {
  ExperienceLevel,
  Gender,
  SocialProvider,
  UserRole,
} from '@workout/types';

// 응답 매핑에 필요한 사용자 필드 (Prisma User 모델의 부분 집합)
// 절대로 passwordHash, refreshTokenHash, socialId 를 포함시키지 않는다.
export interface UserForResponse {
  id: string;
  email: string;
  nickname: string | null;
  gender: Gender | null;
  birthDate: Date | null;
  height: number | null;
  experienceLevel: ExperienceLevel | null;
  role: UserRole;
  socialProvider: SocialProvider | null;
  emailVerified: boolean;
  premiumExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// 온보딩 완료 여부 계산 (5개 프로필 필드가 모두 채워졌는지)
export function isOnboardingCompleted(user: {
  nickname: string | null;
  gender: Gender | null;
  birthDate: Date | null;
  height: number | null;
  experienceLevel: ExperienceLevel | null;
}): boolean {
  return Boolean(
    user.nickname &&
      user.gender &&
      user.birthDate &&
      user.height !== null &&
      user.height !== undefined &&
      user.experienceLevel,
  );
}

// Prisma User -> UserProfile DTO 변환
// @MX:NOTE: [AUTO] 비밀 필드(passwordHash, refreshTokenHash, socialId)를 응답에서 영구 제외하는 단일 매핑 함수
export function toUserResponse(user: UserForResponse): UserProfile {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    gender: user.gender,
    birthDate: user.birthDate ? user.birthDate.toISOString() : null,
    height: user.height,
    experienceLevel: user.experienceLevel,
    role: user.role,
    socialProvider: user.socialProvider,
    emailVerified: user.emailVerified,
    premiumExpiresAt: user.premiumExpiresAt
      ? user.premiumExpiresAt.toISOString()
      : null,
    onboardingCompleted: isOnboardingCompleted(user),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
