import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import {
  ExperienceLevel,
  Gender,
  UserRole,
} from '@workout/types';

// Prisma 트랜잭션 모킹 헬퍼
type TxMock = {
  user: { findUnique: jest.Mock; update: jest.Mock };
  roleChangeLog: { create: jest.Mock };
};

const buildPrismaMock = (txMock: TxMock) => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  roleChangeLog: { create: jest.fn() },
  $transaction: jest.fn(
    async <T>(cb: (tx: TxMock) => Promise<T>) => cb(txMock),
  ),
});

// 완전 프로필을 가진 더미 사용자 (이메일 가입자)
const buildUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'u1',
  email: 'user@test.com',
  passwordHash: 'hashed-pw',
  nickname: '닉네임',
  gender: Gender.MALE,
  birthDate: new Date('1990-01-01'),
  height: 180,
  experienceLevel: ExperienceLevel.INTERMEDIATE,
  role: UserRole.USER,
  socialProvider: null,
  socialId: null,
  refreshTokenHash: 'rt-hash',
  emailVerified: true,
  premiumExpiresAt: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  ...overrides,
});

describe('UsersService.updateRole (AC-ROLE-CHANGE-01..02)', () => {
  let tx: TxMock;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: UsersService;

  beforeEach(() => {
    tx = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      roleChangeLog: { create: jest.fn() },
    };
    prisma = buildPrismaMock(tx);
    service = new UsersService(prisma as never);
  });

  it('사용자 역할을 변경하고 RoleChangeLog 를 트랜잭션 내에서 생성한다', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: 'target1',
      role: UserRole.USER,
    });
    tx.user.update.mockResolvedValue({
      id: 'target1',
      role: UserRole.PREMIUM,
    });
    tx.roleChangeLog.create.mockResolvedValue({ id: 'log1' });

    const result = await service.updateRole(
      'target1',
      UserRole.PREMIUM,
      'admin1',
      '결제 완료',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'target1' },
      data: { role: UserRole.PREMIUM },
    });
    expect(tx.roleChangeLog.create).toHaveBeenCalledWith({
      data: {
        targetUserId: 'target1',
        changedByUserId: 'admin1',
        fromRole: UserRole.USER,
        toRole: UserRole.PREMIUM,
        reason: '결제 완료',
      },
    });
    expect(result.role).toBe(UserRole.PREMIUM);
  });

  it('대상 사용자가 없으면 NotFoundException 을 던진다', async () => {
    tx.user.findUnique.mockResolvedValue(null);
    await expect(
      service.updateRole('missing', UserRole.ADMIN, 'admin1', '승격'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.roleChangeLog.create).not.toHaveBeenCalled();
  });
});

describe('UsersService.findById', () => {
  it('ID로 사용자를 조회한다', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
    };
    const service = new UsersService(prisma as never);
    const result = await service.findById('u1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
    });
    expect(result).toEqual({ id: 'u1' });
  });
});

describe('UsersService.getMe (AC-PROFILE-01)', () => {
  it('비밀 필드를 제외한 프로필을 반환하고 onboardingCompleted=true 를 계산한다', async () => {
    const user = buildUser();
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(user) },
    };
    const service = new UsersService(prisma as never);

    const profile = await service.getMe('u1');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'u1', deletedAt: null },
    });
    expect(profile.onboardingCompleted).toBe(true);
    expect(profile.email).toBe('user@test.com');
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('refreshTokenHash');
    expect(profile).not.toHaveProperty('socialId');
  });

  it('5개 프로필 필드 중 하나라도 비어 있으면 onboardingCompleted=false 이다', async () => {
    const user = buildUser({ height: null });
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(user) },
    };
    const service = new UsersService(prisma as never);
    const profile = await service.getMe('u1');
    expect(profile.onboardingCompleted).toBe(false);
  });

  it('소프트 삭제된 사용자는 NotFoundException 을 던진다', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new UsersService(prisma as never);
    await expect(service.getMe('deleted-user')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('UsersService.updateProfile (AC-UPDATE-01)', () => {
  it('부분 업데이트를 수행하고 갱신된 프로필을 반환한다', async () => {
    const existing = buildUser();
    const updated = buildUser({
      nickname: '새닉네임',
      updatedAt: new Date('2026-05-13'),
    });

    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue(updated),
      },
    };
    const service = new UsersService(prisma as never);

    const result = await service.updateProfile('u1', { nickname: '새닉네임' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { nickname: '새닉네임' },
    });
    expect(result.nickname).toBe('새닉네임');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('소프트 삭제된 사용자에 대해 NotFoundException 을 던진다', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    };
    const service = new UsersService(prisma as never);
    await expect(
      service.updateProfile('deleted', { nickname: '닉' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('UsersService.changePassword (AC-PASSWORD-01..03)', () => {
  it('현재 비밀번호 검증 후 새 비밀번호 해시 저장 및 refreshTokenHash 무효화', async () => {
    const currentHash = await bcrypt.hash('oldPassword!', 4);
    const user = buildUser({ passwordHash: currentHash });

    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user),
      },
    };
    const service = new UsersService(prisma as never);

    await service.changePassword('u1', {
      currentPassword: 'oldPassword!',
      newPassword: 'newPassword123',
    });

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const updateCall = prisma.user.update.mock.calls[0][0] as {
      where: { id: string };
      data: { passwordHash: string; refreshTokenHash: null };
    };
    expect(updateCall.where).toEqual({ id: 'u1' });
    expect(updateCall.data.refreshTokenHash).toBeNull();
    // 새 비밀번호가 평문이 아닌 해시로 저장되어야 함
    expect(updateCall.data.passwordHash).not.toBe('newPassword123');
    const matchesNew = await bcrypt.compare(
      'newPassword123',
      updateCall.data.passwordHash,
    );
    expect(matchesNew).toBe(true);
  });

  it('현재 비밀번호가 일치하지 않으면 BadRequestException 을 던진다', async () => {
    const currentHash = await bcrypt.hash('correctPassword', 4);
    const user = buildUser({ passwordHash: currentHash });
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
        update: jest.fn(),
      },
    };
    const service = new UsersService(prisma as never);

    await expect(
      service.changePassword('u1', {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('소셜 전용 계정 (passwordHash=null) 은 400 으로 거부된다 (AC-PASSWORD-03)', async () => {
    const user = buildUser({ passwordHash: null });
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
        update: jest.fn(),
      },
    };
    const service = new UsersService(prisma as never);

    await expect(
      service.changePassword('u1', {
        currentPassword: 'any',
        newPassword: 'newPassword123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('소프트 삭제된 사용자에 대해 NotFoundException 을 던진다', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    };
    const service = new UsersService(prisma as never);
    await expect(
      service.changePassword('deleted', {
        currentPassword: 'a',
        newPassword: 'newPassword123',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.softDelete (AC-DELETE-01, AC-DELETE-05)', () => {
  it('deletedAt 을 현재 시각으로 설정하고 refreshTokenHash 를 무효화한다', async () => {
    const user = buildUser();
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue({
          ...user,
          deletedAt: new Date(),
          refreshTokenHash: null,
        }),
      },
    };
    const service = new UsersService(prisma as never);

    await service.softDelete('u1', UserRole.USER);

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const call = prisma.user.update.mock.calls[0][0] as {
      where: { id: string };
      data: { deletedAt: Date; refreshTokenHash: null };
    };
    expect(call.where).toEqual({ id: 'u1' });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
    expect(call.data.refreshTokenHash).toBeNull();
  });

  it('관리자(ADMIN) 의 자기 삭제 시도는 403 으로 거부된다 (AC-DELETE-05)', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    const service = new UsersService(prisma as never);

    await expect(
      service.softDelete('admin1', UserRole.ADMIN),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('이미 삭제된(또는 존재하지 않는) 사용자는 NotFoundException', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    };
    const service = new UsersService(prisma as never);
    await expect(
      service.softDelete('u1', UserRole.USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.findAll (AC-ADMIN-01, AC-ADMIN-04)', () => {
  it('소프트 삭제된 사용자를 제외한 페이지네이션 결과를 반환한다', async () => {
    const users = [buildUser({ id: 'a' }), buildUser({ id: 'b' })];
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue(users),
        count: jest.fn().mockResolvedValue(2),
      },
    };
    const service = new UsersService(prisma as never);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(1);
    // 비밀 필드가 응답에서 제외되어야 함
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });

  it('page=2, limit=5 면 skip=5, take=5 로 조회한다', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new UsersService(prisma as never);

    await service.findAll({ page: 2, limit: 5 });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });
});

describe('UsersService.findUserById (admin)', () => {
  it('관리자용으로 ID 사용자를 응답 DTO 로 반환한다 (비밀 필드 제외)', async () => {
    const user = buildUser({ id: 'target' });
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(user) },
    };
    const service = new UsersService(prisma as never);

    const result = await service.findUserById('target');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'target', deletedAt: null },
    });
    expect(result.id).toBe('target');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('refreshTokenHash');
  });

  it('소프트 삭제된 사용자는 NotFoundException 을 던진다', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new UsersService(prisma as never);
    await expect(service.findUserById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
