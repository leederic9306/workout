import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '@workout/types';
import { PrismaService } from '../../prisma/prisma.service';

// 액세스 토큰 JWT 전략
// @MX:ANCHOR: [AUTO] 모든 보호 라우트의 JWT 검증 단일 진입점 — 소프트 삭제 사용자 거부 정책 포함 (SPEC-USER-001)
// @MX:REASON: deletedAt IS NOT NULL 사용자는 모든 토큰을 즉시 거부하여 (AC-DELETE-02) 삭제 후 잔존 액세스 토큰 사용을 차단
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET 환경 변수가 설정되지 않았습니다.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // payload 검증 후 req.user 에 결과 주입
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload?.sub) {
      throw new UnauthorizedException('잘못된 토큰입니다.');
    }

    // 소프트 삭제된 사용자의 토큰은 즉시 거부 (AC-DELETE-02)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { deletedAt: true },
    });
    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException('인증이 필요합니다.');
    }

    return payload;
  }
}
