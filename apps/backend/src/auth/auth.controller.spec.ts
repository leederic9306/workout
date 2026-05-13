import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ExperienceLevel, Gender } from '@workout/types';
import type { Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<Partial<AuthService>>;

  beforeEach(async () => {
    service = {
      verifyInviteCode: jest.fn(),
      signup: jest.fn(),
      login: jest.fn(),
      rotateRefreshToken: jest.fn(),
      invalidateRefreshToken: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();
    controller = module.get(AuthController);
  });

  it('POST /auth/invite-codes/verify → service 위임', async () => {
    (service.verifyInviteCode as jest.Mock).mockResolvedValue({ valid: true });
    const result = await controller.verifyInviteCode({ code: 'C' });
    expect(result).toEqual({ valid: true });
    expect(service.verifyInviteCode).toHaveBeenCalledWith('C');
  });

  it('POST /auth/signup → service.signup 호출', async () => {
    (service.signup as jest.Mock).mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      userId: 'u1',
    });
    const dto = {
      email: 't@t.com',
      password: 'Password1!',
      inviteCode: 'C',
      nickname: 'n',
      gender: Gender.MALE,
      birthDate: new Date('2000-01-01'),
      height: 175,
      experienceLevel: ExperienceLevel.BEGINNER,
    };
    const result = await controller.signup(dto);
    expect(result.accessToken).toBe('a');
    expect(service.signup).toHaveBeenCalledWith(dto);
  });

  it('POST /auth/login → service.login 호출', async () => {
    (service.login as jest.Mock).mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      userId: 'u1',
    });
    const result = await controller.login({
      email: 'a@b.com',
      password: 'Password1!',
    });
    expect(result.accessToken).toBe('a');
  });

  it('POST /auth/refresh → req.user 의 sub/refreshToken 으로 회전', async () => {
    (service.rotateRefreshToken as jest.Mock).mockResolvedValue({
      accessToken: 'a2',
      refreshToken: 'r2',
    });
    const req = {
      user: { sub: 'u1', refreshToken: 'oldR' },
    } as unknown as Request;
    const result = await controller.refresh(req, { refreshToken: 'oldR' });
    expect(result.accessToken).toBe('a2');
    expect(service.rotateRefreshToken).toHaveBeenCalledWith('u1', 'oldR');
  });

  it('POST /auth/logout → invalidateRefreshToken 호출', async () => {
    (service.invalidateRefreshToken as jest.Mock).mockResolvedValue(undefined);
    const req = { user: { sub: 'u1', role: 'USER' } } as unknown as Request;
    await controller.logout(req);
    expect(service.invalidateRefreshToken).toHaveBeenCalledWith('u1');
  });
});
