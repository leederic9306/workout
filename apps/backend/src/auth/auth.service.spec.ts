import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ResendService } from '../common/services/resend.service';
import { ExperienceLevel, Gender, SocialProvider, UserRole } from '@workout/types';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

// Prisma 트랜잭션 모킹 헬퍼
type TxClient = {
  inviteCode: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

const buildTxMock = (): TxClient => ({
  inviteCode: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

const buildPrismaMock = (tx: TxClient) => ({
  inviteCode: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(async (cb: (t: TxClient) => unknown) => cb(tx)),
});

const buildConfigMock = () => {
  const map: Record<string, string> = {
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters!!',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-chars!!',
    JWT_ACCESS_EXPIRY: '900',
    JWT_REFRESH_EXPIRY: '2592000',
  };
  return {
    get: jest.fn((k: string) => map[k]),
    getOrThrow: jest.fn((k: string) => {
      const v = map[k];
      if (!v) throw new Error(`missing ${k}`);
      return v;
    }),
  };
};

describe('AuthService', () => {
  let service: AuthService;
  let tx: TxClient;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let resend: { sendVerificationEmail: jest.Mock };

  beforeEach(async () => {
    tx = buildTxMock();
    prisma = buildPrismaMock(tx);
    resend = { sendVerificationEmail: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: buildConfigMock() },
        { provide: ResendService, useValue: resend },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // --- AC-INVITE ---
  describe('verifyInviteCode', () => {
    it('AC-INVITE-01: 유효한 코드면 valid:true 반환', async () => {
      prisma.inviteCode.findUnique.mockResolvedValue({
        code: 'CODE1',
        usedBy: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      await expect(service.verifyInviteCode('CODE1')).resolves.toEqual({
        valid: true,
      });
    });

    it('AC-INVITE-02: 존재하지 않는 코드는 BadRequest', async () => {
      prisma.inviteCode.findUnique.mockResolvedValue(null);
      await expect(service.verifyInviteCode('X')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('AC-INVITE-03: 이미 사용된 코드는 BadRequest', async () => {
      prisma.inviteCode.findUnique.mockResolvedValue({
        code: 'C',
        usedBy: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
      });
      await expect(service.verifyInviteCode('C')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('AC-INVITE-04: 만료된 코드는 BadRequest', async () => {
      prisma.inviteCode.findUnique.mockResolvedValue({
        code: 'C',
        usedBy: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.verifyInviteCode('C')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // --- AC-SIGNUP ---
  describe('signup', () => {
    const dto: SignupDto = {
      email: 'test@workout.com',
      password: 'Password1!',
      inviteCode: 'CODE1',
      nickname: '테스터',
      gender: Gender.MALE,
      birthDate: new Date('2000-01-01'),
      height: 175,
      experienceLevel: ExperienceLevel.BEGINNER,
    };

    const setupValidInvite = () => {
      tx.inviteCode.findUnique.mockResolvedValue({
        code: 'CODE1',
        usedBy: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      tx.user.findUnique.mockResolvedValue(null);
      tx.user.create.mockResolvedValue({
        id: 'u1',
        email: dto.email,
        role: 'USER',
      });
      tx.inviteCode.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
    };

    it('AC-SIGNUP-01: 정상 가입 → 토큰 발급 + 초대코드 소비', async () => {
      setupValidInvite();
      const result = await service.signup(dto);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.userId).toBe('u1');
      expect(tx.inviteCode.update).toHaveBeenCalledWith({
        where: { code: 'CODE1' },
        data: expect.objectContaining({ usedBy: 'u1' }),
      });
      expect(prisma.user.update).toHaveBeenCalled(); // refreshTokenHash 저장
    });

    it('AC-SIGNUP-02: 잘못된 초대코드 → BadRequest', async () => {
      tx.inviteCode.findUnique.mockResolvedValue(null);
      await expect(service.signup(dto)).rejects.toThrow(BadRequestException);
      expect(tx.user.create).not.toHaveBeenCalled();
    });

    it('AC-SIGNUP-03: 이메일 중복 → Conflict', async () => {
      tx.inviteCode.findUnique.mockResolvedValue({
        code: 'CODE1',
        usedBy: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      tx.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
    });

    it('AC-SIGNUP-04: 이메일 발송 실패해도 가입은 성공', async () => {
      setupValidInvite();
      resend.sendVerificationEmail.mockRejectedValue(new Error('SMTP down'));
      const result = await service.signup(dto);
      expect(result.userId).toBe('u1');
    });

    it('passwordHash 는 평문이 아니어야 함', async () => {
      setupValidInvite();
      await service.signup(dto);
      const createArgs = tx.user.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).not.toBe(dto.password);
      const valid = await bcrypt.compare(
        dto.password,
        createArgs.data.passwordHash,
      );
      expect(valid).toBe(true);
    });
  });

  // --- AC-LOGIN ---
  describe('login', () => {
    const dto: LoginDto = { email: 'a@b.com', password: 'Password1!' };

    it('AC-LOGIN-01: 올바른 자격증명 → 토큰 발급', async () => {
      const hash = await bcrypt.hash(dto.password, 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: dto.email,
        passwordHash: hash,
        role: 'USER',
        nickname: 'n',
        gender: 'MALE',
        birthDate: new Date(),
        height: 175,
        experienceLevel: 'BEGINNER',
      });
      const result = await service.login(dto);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('AC-LOGIN-02: 존재하지 않는 이메일 → 401 (정보 누설 방지)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('AC-LOGIN-02: 잘못된 비밀번호 → 401 (동일 메시지)', async () => {
      const hash = await bcrypt.hash('other-password!A1', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        passwordHash: hash,
        role: 'USER',
        nickname: null,
        gender: null,
        birthDate: null,
        height: null,
        experienceLevel: null,
      });
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('소셜 가입 사용자(passwordHash null) → 401', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        passwordHash: null,
        role: 'USER',
      });
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // --- AC-JWT (Phase 3) ---
  describe('rotateRefreshToken', () => {
    it('AC-JWT-01: 유효한 리프레시 토큰 → 새 토큰 쌍 발급 & DB 회전', async () => {
      const originalToken = 'original-refresh-token';
      const hash = await bcrypt.hash(originalToken, 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'USER',
        refreshTokenHash: hash,
        nickname: 'n',
        gender: 'MALE',
        birthDate: new Date(),
        height: 175,
        experienceLevel: 'BEGINNER',
      });
      prisma.user.update.mockResolvedValue({});

      const tokens = await service.rotateRefreshToken('u1', originalToken);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.refreshToken).not.toBe(originalToken);
      // DB 의 hash 도 새 토큰으로 갱신됨
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({ refreshTokenHash: expect.any(String) }),
        }),
      );
    });

    it('AC-JWT-02: 일치하지 않는 토큰 → 401 + DB 무효화', async () => {
      const hash = await bcrypt.hash('real-token', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        refreshTokenHash: hash,
        role: 'USER',
        nickname: null,
        gender: null,
        birthDate: null,
        height: null,
        experienceLevel: null,
      });
      prisma.user.update.mockResolvedValue({});
      await expect(
        service.rotateRefreshToken('u1', 'stolen-token'),
      ).rejects.toThrow(UnauthorizedException);
      // 강제 로그아웃 처리
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { refreshTokenHash: null },
      });
    });

    it('AC-JWT-03: refreshTokenHash가 null이면 401', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        refreshTokenHash: null,
      });
      await expect(service.rotateRefreshToken('u1', 'any')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('invalidateRefreshToken', () => {
    it('AC-JWT-03: 로그아웃 시 refreshTokenHash null 처리', async () => {
      prisma.user.update.mockResolvedValue({});
      await service.invalidateRefreshToken('u1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { refreshTokenHash: null },
      });
    });
  });

  // --- AC-SECURITY-01 ---
  describe('generateTokens', () => {
    it('AC-SECURITY-01: 액세스 토큰 페이로드에 sub/role/onboardingCompleted 포함', async () => {
      const tokens = await service.generateTokens('u1', UserRole.USER, true);
      expect(tokens.accessToken).toBeDefined();
      // JwtService 로 디코드
      const jwt = new JwtService({});
      const decoded = jwt.decode(tokens.accessToken) as Record<string, unknown>;
      expect(decoded.sub).toBe('u1');
      expect(decoded.role).toBe(UserRole.USER);
      expect(decoded.onboardingCompleted).toBe(true);
      expect(decoded.exp).toBeDefined();
    });

    it('AC-SECURITY-01: 리프레시 토큰은 sub만 포함', async () => {
      const tokens = await service.generateTokens('u1', UserRole.USER, false);
      const jwt = new JwtService({});
      const decoded = jwt.decode(tokens.refreshToken) as Record<string, unknown>;
      expect(decoded.sub).toBe('u1');
      expect(decoded.role).toBeUndefined();
    });
  });

  // --- AC-SOCIAL (Phase 5) ---
  describe('socialLogin', () => {
    let kakaoFetcher: jest.Mock;
    let googleFetcher: jest.Mock;

    beforeEach(() => {
      kakaoFetcher = jest.fn();
      googleFetcher = jest.fn();
      (
        service as unknown as { kakaoFetcher: typeof kakaoFetcher }
      ).kakaoFetcher = kakaoFetcher;
      (
        service as unknown as { googleFetcher: typeof googleFetcher }
      ).googleFetcher = googleFetcher;
    });

    it('AC-SOCIAL-01: Kakao 기존 사용자 → 토큰 발급', async () => {
      kakaoFetcher.mockResolvedValue({ socialId: '12345', email: 'k@x.com' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'USER',
        nickname: 'n',
        gender: 'MALE',
        birthDate: new Date(),
        height: 175,
        experienceLevel: 'BEGINNER',
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.socialLogin('kakao', 'kakao-token');

      expect(kakaoFetcher).toHaveBeenCalledWith('kakao-token');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: {
          socialProvider_socialId: {
            socialProvider: SocialProvider.KAKAO,
            socialId: '12345',
          },
        },
      });
      expect(result).toMatchObject({
        userId: 'u1',
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('AC-SOCIAL-02: Google 신규 사용자 → needSignup', async () => {
      googleFetcher.mockResolvedValue({ socialId: 'sub-1', email: 'g@x.com' });
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.socialLogin('google', 'google-token');

      expect(result).toEqual({
        needSignup: true,
        socialProvider: SocialProvider.GOOGLE,
        socialId: 'sub-1',
        email: 'g@x.com',
      });
    });

    it('AC-SOCIAL-03: Apple 등 미지원 provider → BadRequest(Unsupported provider)', async () => {
      await expect(
        service.socialLogin('apple', 'token'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.socialLogin('apple', 'token')).rejects.toThrow(
        'Unsupported provider',
      );
      expect(kakaoFetcher).not.toHaveBeenCalled();
      expect(googleFetcher).not.toHaveBeenCalled();
    });

    it('provider 가 대소문자 무관하게 정규화된다', async () => {
      kakaoFetcher.mockResolvedValue({ socialId: '1' });
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.socialLogin('KAKAO', 'token');
      expect(kakaoFetcher).toHaveBeenCalled();
      expect((result as { needSignup: boolean }).needSignup).toBe(true);
    });
  });

  // --- AC-ONBOARD (Phase 6) ---
  describe('completeOnboarding', () => {
    it('AC-ONBOARD-01: 프로필 업데이트 후 onboardingCompleted=true 토큰 재발급', async () => {
      prisma.user.update
        .mockResolvedValueOnce({ id: 'u1', role: 'USER' })
        .mockResolvedValueOnce({});

      const tokens = await service.completeOnboarding('u1', {
        nickname: 'tester',
        gender: Gender.MALE,
        birthDate: new Date('1990-01-01'),
        height: 175,
        experienceLevel: ExperienceLevel.BEGINNER,
      });

      expect(prisma.user.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'u1' },
        data: {
          nickname: 'tester',
          gender: Gender.MALE,
          birthDate: new Date('1990-01-01'),
          height: 175,
          experienceLevel: ExperienceLevel.BEGINNER,
        },
      });
      const jwt = new JwtService({});
      const decoded = jwt.decode(tokens.accessToken) as Record<string, unknown>;
      expect(decoded.onboardingCompleted).toBe(true);
      expect(tokens.refreshToken).toBeDefined();
    });
  });
});
