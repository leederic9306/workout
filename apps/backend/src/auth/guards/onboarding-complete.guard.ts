import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { JwtPayload } from '@workout/types';

// 온보딩 완료 여부 검증 가드 (AC-ONBOARD-01)
// JwtAuthGuard 이후에 사용되어야 함
@Injectable()
export class OnboardingCompleteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException({
        message: 'Onboarding required',
        code: 'ONBOARDING_REQUIRED',
      });
    }
    if (!user.onboardingCompleted) {
      throw new ForbiddenException({
        message: 'Onboarding required',
        code: 'ONBOARDING_REQUIRED',
      });
    }
    return true;
  }
}
