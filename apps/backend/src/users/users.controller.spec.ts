import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import {
  ExperienceLevel,
  Gender,
  UserRole,
  type JwtPayload,
  type UserProfile,
} from '@workout/types';

const buildJwt = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
  sub: 'u1',
  role: UserRole.USER,
  onboardingCompleted: true,
  ...overrides,
});

const buildProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'u1',
  email: 'user@test.com',
  nickname: '닉네임',
  gender: Gender.MALE,
  birthDate: '1990-01-01T00:00:00.000Z',
  height: 180,
  experienceLevel: ExperienceLevel.INTERMEDIATE,
  role: UserRole.USER,
  socialProvider: null,
  emailVerified: true,
  premiumExpiresAt: null,
  onboardingCompleted: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});

describe('UsersController', () => {
  let service: jest.Mocked<
    Pick<
      UsersService,
      | 'updateRole'
      | 'getMe'
      | 'updateProfile'
      | 'changePassword'
      | 'softDelete'
      | 'findAll'
      | 'findUserById'
    >
  >;
  let controller: UsersController;

  beforeEach(() => {
    service = {
      updateRole: jest.fn(),
      getMe: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      softDelete: jest.fn(),
      findAll: jest.fn(),
      findUserById: jest.fn(),
    } as never;
    controller = new UsersController(service as unknown as UsersService);
  });

  it('PATCH /users/:id/role 은 UsersService.updateRole 을 호출한다', async () => {
    service.updateRole.mockResolvedValue({
      id: 'target1',
      role: UserRole.PREMIUM,
    } as never);

    const admin = buildJwt({ sub: 'admin1', role: UserRole.ADMIN });

    const result = await controller.updateRole(
      'target1',
      { role: UserRole.PREMIUM, reason: '결제 완료' },
      admin,
    );

    expect(service.updateRole).toHaveBeenCalledWith(
      'target1',
      UserRole.PREMIUM,
      'admin1',
      '결제 완료',
    );
    expect(result).toMatchObject({ role: UserRole.PREMIUM });
  });

  it('GET /users/me 는 UsersService.getMe 를 호출한다', async () => {
    const profile = buildProfile();
    service.getMe.mockResolvedValue(profile);

    const result = await controller.getMe(buildJwt());

    expect(service.getMe).toHaveBeenCalledWith('u1');
    expect(result).toEqual(profile);
  });

  it('PATCH /users/me/profile 은 UsersService.updateProfile 을 호출한다', async () => {
    const profile = buildProfile({ nickname: '새닉네임' });
    service.updateProfile.mockResolvedValue(profile);

    const result = await controller.updateProfile(
      { nickname: '새닉네임' },
      buildJwt(),
    );

    expect(service.updateProfile).toHaveBeenCalledWith('u1', {
      nickname: '새닉네임',
    });
    expect(result.nickname).toBe('새닉네임');
  });

  it('PATCH /users/me/password 는 UsersService.changePassword 를 호출한다', async () => {
    service.changePassword.mockResolvedValue(undefined);
    const dto = {
      currentPassword: 'oldPassword!',
      newPassword: 'newPassword123',
    };
    await controller.changePassword(dto, buildJwt());
    expect(service.changePassword).toHaveBeenCalledWith('u1', dto);
  });

  it('DELETE /users/me 는 UsersService.softDelete 를 사용자 역할과 함께 호출한다', async () => {
    service.softDelete.mockResolvedValue(undefined);
    await controller.deleteMe(buildJwt({ role: UserRole.USER }));
    expect(service.softDelete).toHaveBeenCalledWith('u1', UserRole.USER);
  });

  it('GET /users 는 UsersService.findAll 을 쿼리와 함께 호출한다', async () => {
    service.findAll.mockResolvedValue({
      items: [buildProfile()],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const result = await controller.findAll({ page: 1, limit: 20 });

    expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('GET /users/:id 는 UsersService.findUserById 를 호출한다', async () => {
    const profile = buildProfile({ id: 'target' });
    service.findUserById.mockResolvedValue(profile);

    const result = await controller.findUserById('target');

    expect(service.findUserById).toHaveBeenCalledWith('target');
    expect(result.id).toBe('target');
  });
});
