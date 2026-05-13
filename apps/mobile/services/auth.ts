// 인증 API 함수 모음
// 백엔드 엔드포인트 호출 및 응답 매핑을 담당한다.
import { api, registerRefreshHandler } from './api';
import type { UserInfo } from '../stores/authStore';
import type { Gender, ExperienceLevel } from '@workout/types';

export interface SignupRequest {
  email: string;
  password: string;
  inviteCode: string;
  nickname: string;
  gender: Gender;
  birthDate: string; // ISO 8601 (YYYY-MM-DD)
  height: number; // cm
  experienceLevel: ExperienceLevel;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export type SocialLoginResponse = AuthResponse | { needSignup: true };

export interface VerifyInviteCodeResponse {
  valid: boolean;
  reason?: string;
}

// 초대 코드 검증
export async function verifyInviteCode(code: string): Promise<VerifyInviteCodeResponse> {
  const { data } = await api.post<VerifyInviteCodeResponse>('/auth/invite-codes/verify', {
    code,
  });
  return data;
}

// @MX:ANCHOR: [AUTO] 회원가입 진입점 (register 화면이 단일 호출 지점)
// @MX:REASON: 백엔드 one-step signup 계약을 모바일에서 강제하는 단일 함수 (fan_in 잠재 >= 3 — 가입/재시도/테스트)
export async function signup(payload: SignupRequest): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/signup', payload);
  return data;
}

// 로그인
export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

// 로그아웃
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    // 서버 오류가 나더라도 클라이언트 상태는 비워야 하므로 swallow
  }
}

// 소셜 로그인
export async function socialLogin(
  provider: 'kakao' | 'google',
  token: string,
): Promise<SocialLoginResponse> {
  const { data } = await api.post<SocialLoginResponse>(`/auth/social/${provider}`, { token });
  return data;
}

// Refresh Token으로 새 토큰 획득 (api.ts 인터셉터 및 authStore.initialize에서 사용)
export async function refreshAccessToken(
  refreshToken: string,
): Promise<AuthResponse | null> {
  try {
    const { data } = await api.post<AuthResponse>(
      '/auth/refresh',
      {},
      {
        headers: { Authorization: `Bearer ${refreshToken}` },
      },
    );
    return data;
  } catch {
    return null;
  }
}

// api.ts 인터셉터에 refresh 핸들러 등록 — 모듈 로드 시점에 1회 수행
registerRefreshHandler(async (refreshToken) => {
  const result = await refreshAccessToken(refreshToken);
  if (!result) return null;
  return { accessToken: result.accessToken, refreshToken: result.refreshToken };
});
