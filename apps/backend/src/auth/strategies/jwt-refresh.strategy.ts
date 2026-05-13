import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { JwtRefreshPayload } from '@workout/types';

// 리프레시 토큰 검증을 위한 JWT 전략 (요청 본문의 refreshToken 추출)
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new UnauthorizedException(
        'JWT_REFRESH_SECRET 환경 변수가 설정되지 않았습니다.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtRefreshPayload,
  ): Promise<JwtRefreshPayload & { refreshToken: string }> {
    if (!payload?.sub) {
      throw new UnauthorizedException('잘못된 리프레시 토큰입니다.');
    }
    const refreshToken = (req.body as { refreshToken?: string })?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('리프레시 토큰이 없습니다.');
    }
    return { ...payload, refreshToken };
  }
}
