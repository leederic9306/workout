import { UnauthorizedException } from '@nestjs/common';

// Google OAuth UserInfo 응답 (OIDC userinfo endpoint)
interface GoogleUserInfoResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
}

// Google access token 으로 사용자 정보 조회
// @MX:ANCHOR: [AUTO] 외부 OAuth 시스템 통합 지점
// @MX:REASON: Google 응답 스키마 변경 또는 API 장애 시 단일 위치에서 처리
export async function getGoogleUserInfo(
  token: string,
): Promise<{ socialId: string; email?: string }> {
  let response: Response;
  try {
    response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new UnauthorizedException('Google 인증에 실패했습니다.');
  }

  if (!response.ok) {
    throw new UnauthorizedException('Google 인증에 실패했습니다.');
  }

  const data = (await response.json()) as GoogleUserInfoResponse;
  if (!data.sub) {
    throw new UnauthorizedException('Google 사용자 정보가 올바르지 않습니다.');
  }
  return {
    socialId: data.sub,
    email: data.email,
  };
}
