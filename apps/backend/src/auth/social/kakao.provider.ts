import { UnauthorizedException } from '@nestjs/common';

// Kakao OAuth 사용자 정보 응답 (필요한 필드만 추출)
interface KakaoUserInfoResponse {
  id: number;
  kakao_account?: {
    email?: string;
  };
}

// Kakao access token 으로 사용자 정보 조회
// @MX:ANCHOR: [AUTO] 외부 OAuth 시스템 통합 지점
// @MX:REASON: Kakao 응답 스키마 변경 또는 API 장애 시 단일 위치에서 처리
export async function getKakaoUserInfo(
  token: string,
): Promise<{ socialId: string; email?: string }> {
  let response: Response;
  try {
    response = await fetch('https://kapi.kakao.com/v2/user/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });
  } catch {
    throw new UnauthorizedException('Kakao 인증에 실패했습니다.');
  }

  if (!response.ok) {
    throw new UnauthorizedException('Kakao 인증에 실패했습니다.');
  }

  const data = (await response.json()) as KakaoUserInfoResponse;
  if (!data.id) {
    throw new UnauthorizedException('Kakao 사용자 정보가 올바르지 않습니다.');
  }
  return {
    socialId: String(data.id),
    email: data.kakao_account?.email,
  };
}
