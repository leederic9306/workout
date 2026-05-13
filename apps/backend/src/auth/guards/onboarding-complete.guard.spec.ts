import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OnboardingCompleteGuard } from './onboarding-complete.guard';
import { UserRole } from '@workout/types';

const buildContext = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('OnboardingCompleteGuard (AC-ONBOARD-01)', () => {
  const guard = new OnboardingCompleteGuard();

  it('onboardingCompleted=true 사용자는 통과한다', () => {
    const ctx = buildContext({
      sub: 'u1',
      role: UserRole.USER,
      onboardingCompleted: true,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('onboardingCompleted=false 사용자는 ONBOARDING_REQUIRED 로 차단된다', () => {
    const ctx = buildContext({
      sub: 'u1',
      role: UserRole.USER,
      onboardingCompleted: false,
    });
    try {
      guard.canActivate(ctx);
      fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      const response = (e as ForbiddenException).getResponse() as {
        code: string;
      };
      expect(response.code).toBe('ONBOARDING_REQUIRED');
    }
  });

  it('user 가 없으면 ONBOARDING_REQUIRED 로 차단된다', () => {
    const ctx = buildContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
