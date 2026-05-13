import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@workout/types';
import type { JwtPayload } from '@workout/types';
import { ROLES_KEY } from '../decorators/roles.decorator';

// 역할 기반 접근 제어 가드
// @MX:ANCHOR: [AUTO] 모든 보호 라우트의 권한 판정 단일 진입점 (fan_in: UsersController + 향후 추가 컨트롤러)
// @MX:REASON: PREMIUM 만료 시점 강등 등 보안 정책을 한 곳에서만 결정해야 우회를 방지
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 핸들러 또는 클래스에 부착된 @Roles 메타데이터 조회
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 역할 메타데이터가 없으면 공개 엔드포인트로 간주
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (!user?.role) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    // PREMIUM 토큰의 경우 premiumExpiresAt 만료 여부를 DB에서 확인 (REQ-AUTH-RBAC-004)
    let effectiveRole: UserRole = user.role;
    if (user.role === UserRole.PREMIUM) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { premiumExpiresAt: true },
      });
      if (!dbUser?.premiumExpiresAt || dbUser.premiumExpiresAt < new Date()) {
        effectiveRole = UserRole.USER;
      }
    }

    if (!requiredRoles.includes(effectiveRole)) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }
    return true;
  }
}
