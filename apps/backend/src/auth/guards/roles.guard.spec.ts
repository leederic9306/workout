import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@workout/types';

// ExecutionContext 모킹 헬퍼
const buildContext = (user: unknown): ExecutionContext => {
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => null,
    getClass: () => null,
  } as unknown as ExecutionContext;
  return ctx;
};

describe('RolesGuard', () => {
  let reflector: Reflector;
  let prisma: { user: { findUnique: jest.Mock } };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    prisma = { user: { findUnique: jest.fn() } };
    guard = new RolesGuard(reflector, prisma as never);
  });

  // AC-RBAC-01: 공개 엔드포인트는 메타데이터가 없으므로 통과
  it('@Roles 메타데이터가 없으면 통과한다', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = buildContext({ sub: 'u1', role: UserRole.USER, onboardingCompleted: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // AC-RBAC-02: USER가 ADMIN 전용 엔드포인트 호출 시 403
  it('필요 역할에 포함되지 않으면 ForbiddenException 을 던진다', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    const ctx = buildContext({ sub: 'u1', role: UserRole.USER, onboardingCompleted: true });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // AC-RBAC-03: ADMIN은 ADMIN 엔드포인트 통과
  it('필요 역할에 포함되면 통과한다', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    const ctx = buildContext({
      sub: 'admin1',
      role: UserRole.ADMIN,
      onboardingCompleted: true,
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // PREMIUM 만료된 사용자는 USER로 강등 (REQ-AUTH-RBAC-004)
  it('PREMIUM 사용자의 premiumExpiresAt 이 과거이면 USER로 강등하여 PREMIUM 엔드포인트 접근을 거부한다', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.PREMIUM]);
    prisma.user.findUnique.mockResolvedValue({
      premiumExpiresAt: new Date(Date.now() - 1000 * 60 * 60),
    });
    const ctx = buildContext({
      sub: 'u1',
      role: UserRole.PREMIUM,
      onboardingCompleted: true,
    });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // PREMIUM 유효한 사용자는 통과
  it('PREMIUM 사용자의 premiumExpiresAt 이 미래이면 PREMIUM 엔드포인트 접근을 허용한다', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.PREMIUM]);
    prisma.user.findUnique.mockResolvedValue({
      premiumExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });
    const ctx = buildContext({
      sub: 'u1',
      role: UserRole.PREMIUM,
      onboardingCompleted: true,
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // ROLES_KEY 가 export 되어 데코레이터와 동일한 키를 사용
  it('ROLES_KEY 상수가 정의되어 있다', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  // user 가 없으면 거부
  it('req.user 가 없으면 ForbiddenException 을 던진다', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    const ctx = buildContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
