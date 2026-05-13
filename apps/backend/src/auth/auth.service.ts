import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ResendService } from '../common/services/resend.service';
import type {
  AuthTokens,
  JwtPayload,
  JwtRefreshPayload,
} from '@workout/types';
import { SocialProvider, UserRole } from '@workout/types';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { getKakaoUserInfo } from './social/kakao.provider';
import { getGoogleUserInfo } from './social/google.provider';

// 소셜 로그인 결과
export type SocialLoginResult =
  | (AuthTokens & { userId: string })
  | {
      needSignup: true;
      socialProvider: SocialProvider;
      socialId: string;
      email?: string;
    };

// 소셜 사용자 정보 조회 함수 시그니처 (테스트에서 오버라이드 가능)
export type SocialUserInfoFetcher = (
  token: string,
) => Promise<{ socialId: string; email?: string }>;

// bcrypt 비용 계수
const BCRYPT_COST = 10;

// 온보딩 완료 여부 계산
function isOnboardingCompleted(user: {
  nickname: string | null;
  gender: unknown | null;
  birthDate: Date | null;
  height: number | null;
  experienceLevel: unknown | null;
}): boolean {
  return Boolean(
    user.nickname &&
      user.gender &&
      user.birthDate &&
      user.height &&
      user.experienceLevel,
  );
}

// 인증 도메인 서비스
// @MX:ANCHOR: [AUTO] 회원가입/로그인/토큰 회전 트랜잭션의 핵심 경계 (fan_in: controller + 향후 social/admin)
// @MX:REASON: 트랜잭션 일관성과 보안 정책(토큰 해시, 비밀번호 해시)을 단일 위치에서 강제
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessExpiry: number;
  private readonly refreshExpiry: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  // 소셜 사용자 정보 fetcher (테스트에서 오버라이드 가능)
  protected kakaoFetcher: SocialUserInfoFetcher = getKakaoUserInfo;
  protected googleFetcher: SocialUserInfoFetcher = getGoogleUserInfo;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly resendService: ResendService,
  ) {
    this.accessSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    this.refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessExpiry = Number(
      this.configService.get<string>('JWT_ACCESS_EXPIRY') ?? 900,
    );
    this.refreshExpiry = Number(
      this.configService.get<string>('JWT_REFRESH_EXPIRY') ?? 2592000,
    );
  }

  // 초대 코드 검증 (사용 가능 여부만 확인, 소비하지 않음)
  async verifyInviteCode(code: string): Promise<{ valid: true }> {
    const invite = await this.prisma.inviteCode.findUnique({
      where: { code },
    });

    if (!invite) {
      throw new BadRequestException('유효하지 않은 초대 코드입니다.');
    }
    if (invite.usedBy) {
      throw new BadRequestException('이미 사용된 초대 코드입니다.');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('만료된 초대 코드입니다.');
    }

    return { valid: true };
  }

  // 회원가입 (단일 트랜잭션)
  // @MX:WARN: [AUTO] 초대 코드 소비와 사용자 생성이 원자적으로 실행되어야 함
  // @MX:REASON: 동시 가입 시 한 초대코드가 중복 사용되는 경쟁 조건을 방지
  async signup(dto: SignupDto): Promise<AuthTokens & { userId: string }> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    const user = await this.prisma.$transaction(async (tx) => {
      // 1. 초대코드 재검증 (트랜잭션 내부)
      const invite = await tx.inviteCode.findUnique({
        where: { code: dto.inviteCode },
      });
      if (!invite) {
        throw new BadRequestException('유효하지 않은 초대 코드입니다.');
      }
      if (invite.usedBy) {
        throw new BadRequestException('이미 사용된 초대 코드입니다.');
      }
      if (invite.expiresAt < new Date()) {
        throw new BadRequestException('만료된 초대 코드입니다.');
      }

      // 2. 이메일 중복 확인
      const existing = await tx.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('이미 사용 중인 이메일입니다.');
      }

      // 3. 사용자 생성
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          nickname: dto.nickname,
          gender: dto.gender,
          birthDate: new Date(dto.birthDate),
          height: dto.height,
          experienceLevel: dto.experienceLevel,
          inviteCodeUsed: dto.inviteCode,
        },
      });

      // 4. 초대코드 소비 마킹
      await tx.inviteCode.update({
        where: { code: dto.inviteCode },
        data: { usedBy: created.id, usedAt: new Date() },
      });

      return created;
    });

    // 이메일 인증 메일 발송 (fire-and-forget, 실패 무시)
    const verificationToken = randomBytes(32).toString('hex');
    this.resendService
      .sendVerificationEmail(user.email, verificationToken)
      .catch((err: Error) => {
        this.logger.error(`Verification email dispatch failed: ${err.message}`);
      });

    // 토큰 발급 + DB 저장
    const tokens = await this.generateTokens(user.id, user.role as UserRole, true);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    return { ...tokens, userId: user.id };
  }

  // 로그인
  async login(dto: LoginDto): Promise<AuthTokens & { userId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // 사용자 존재 여부를 노출하지 않기 위해 동일 메시지 사용
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.role as UserRole,
      isOnboardingCompleted(user),
    );
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    return { ...tokens, userId: user.id };
  }

  // 리프레시 토큰 회전
  // @MX:WARN: [AUTO] 회전 시 기존 토큰을 즉시 무효화해야 재사용 공격을 방지
  // @MX:REASON: 토큰 탈취 시 단일 사용으로 제한하여 피해 범위를 축소
  async rotateRefreshToken(
    userId: string,
    presentedRefreshToken: string,
  ): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('인증이 필요합니다.');
    }

    const match = await bcrypt.compare(
      presentedRefreshToken,
      user.refreshTokenHash,
    );
    if (!match) {
      // 토큰 재사용 의심 → 강제 로그아웃
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: null },
      });
      throw new UnauthorizedException('리프레시 토큰이 유효하지 않습니다.');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.role as UserRole,
      isOnboardingCompleted(user),
    );
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  // 로그아웃 (refreshTokenHash 제거)
  async invalidateRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  // 액세스/리프레시 토큰 쌍 생성
  async generateTokens(
    userId: string,
    role: UserRole,
    onboardingCompleted: boolean,
  ): Promise<AuthTokens> {
    const accessPayload: JwtPayload = {
      sub: userId,
      role,
      onboardingCompleted,
    };
    const refreshPayload: JwtRefreshPayload = { sub: userId };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiry,
    });
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiry,
    });

    return { accessToken, refreshToken };
  }

  // 리프레시 토큰을 bcrypt 해시로 저장
  private async persistRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(refreshToken, BCRYPT_COST);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  // 소셜 로그인 (AC-SOCIAL-01..03)
  // 지원: KAKAO, GOOGLE. Apple 등 기타 provider 는 400 Bad Request
  async socialLogin(
    provider: string,
    token: string,
  ): Promise<SocialLoginResult> {
    const normalized = provider?.toUpperCase();
    let socialProvider: SocialProvider;
    let fetcher: SocialUserInfoFetcher;

    if (normalized === SocialProvider.KAKAO) {
      socialProvider = SocialProvider.KAKAO;
      fetcher = this.kakaoFetcher;
    } else if (normalized === SocialProvider.GOOGLE) {
      socialProvider = SocialProvider.GOOGLE;
      fetcher = this.googleFetcher;
    } else {
      throw new BadRequestException('Unsupported provider');
    }

    // 외부 OAuth provider 에서 사용자 정보 조회
    const info = await fetcher(token);

    // 기존 사용자 조회 (socialProvider + socialId 복합 유니크)
    const user = await this.prisma.user.findUnique({
      where: {
        socialProvider_socialId: {
          socialProvider,
          socialId: info.socialId,
        },
      },
    });

    if (!user) {
      // 신규 가입 필요 (AC-SOCIAL-02)
      return {
        needSignup: true,
        socialProvider,
        socialId: info.socialId,
        email: info.email,
      };
    }

    // 기존 사용자: 토큰 발급
    const tokens = await this.generateTokens(
      user.id,
      user.role as UserRole,
      isOnboardingCompleted(user),
    );
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return { ...tokens, userId: user.id };
  }

  // 온보딩 완료 (AC-ONBOARD-01)
  // 소셜 가입 또는 미완료 사용자가 프로필을 채우고 토큰을 갱신
  async completeOnboarding(
    userId: string,
    dto: OnboardingDto,
  ): Promise<AuthTokens> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: dto.nickname,
        gender: dto.gender,
        birthDate: new Date(dto.birthDate),
        height: dto.height,
        experienceLevel: dto.experienceLevel,
      },
    });

    // 온보딩 완료 플래그를 포함한 새 토큰 발급
    const tokens = await this.generateTokens(
      updated.id,
      updated.role as UserRole,
      true,
    );
    await this.persistRefreshToken(updated.id, tokens.refreshToken);
    return tokens;
  }
}
