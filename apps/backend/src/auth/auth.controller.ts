import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerifyInviteCodeDto } from './dto/verify-invite-code.dto';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { Request } from 'express';
import type { JwtPayload } from '@workout/types';

// 인증 컨트롤러
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 초대 코드 검증
  @Post('invite-codes/verify')
  @HttpCode(HttpStatus.OK)
  async verifyInviteCode(@Body() dto: VerifyInviteCodeDto) {
    return this.authService.verifyInviteCode(dto.code);
  }

  // 회원가입 (one-step)
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  // 로그인
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // 토큰 회전
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(@Req() req: Request, @Body() _dto: RefreshTokenDto) {
    const payload = req.user as { sub: string; refreshToken: string };
    return this.authService.rotateRefreshToken(payload.sub, payload.refreshToken);
  }

  // 로그아웃
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request): Promise<void> {
    const user = req.user as JwtPayload;
    await this.authService.invalidateRefreshToken(user.sub);
  }

  // 소셜 로그인 (AC-SOCIAL-01..03)
  @Post('social/:provider')
  @HttpCode(HttpStatus.OK)
  async socialLogin(
    @Param('provider') provider: string,
    @Body() dto: SocialLoginDto,
  ) {
    return this.authService.socialLogin(provider, dto.token);
  }

  // 온보딩 완료 (AC-ONBOARD-01)
  @Patch('onboarding')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async completeOnboarding(
    @CurrentUser() user: JwtPayload,
    @Body() dto: OnboardingDto,
  ) {
    return this.authService.completeOnboarding(user.sub, dto);
  }
}
