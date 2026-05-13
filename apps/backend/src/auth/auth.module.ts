import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { RolesGuard } from './guards/roles.guard';
import { OnboardingCompleteGuard } from './guards/onboarding-complete.guard';
import { ResendService } from '../common/services/resend.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    RolesGuard,
    OnboardingCompleteGuard,
    ResendService,
  ],
  exports: [AuthService, RolesGuard, OnboardingCompleteGuard],
})
export class AuthModule {}
