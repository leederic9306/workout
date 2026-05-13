import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@workout/types';
import type { JwtPayload } from '@workout/types';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

// 역할 변경 요청 DTO
class UpdateRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;

  @IsString()
  @IsNotEmpty({ message: '역할 변경 사유는 필수입니다.' })
  reason!: string;
}

// 사용자 컨트롤러 (SPEC-USER-001 + SPEC-AUTH-001)
// @MX:ANCHOR: [AUTO] /users API 경계 — JWT 인증 + 역할 가드 + 프로필 응답 필터링 단일 진입점
// @MX:REASON: 비밀 필드 비노출, 소프트 삭제 의미론, 관리자 권한 분리를 컨트롤러 레벨에서 일관 강제
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/me — 자신의 프로필 조회 (REQ-USER-PROFILE-*, AC-PROFILE-01..02)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMe(user.sub);
  }

  // PATCH /users/me/profile — 프로필 부분 업데이트 (REQ-USER-UPDATE-*, AC-UPDATE-01, AC-UPDATE-03)
  // forbidNonWhitelisted: 화이트리스트 외 필드 (role, email, passwordHash 등) 는 400 으로 거부
  @Patch('me/profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  // PATCH /users/me/password — 비밀번호 변경 (REQ-USER-PASSWORD-*, AC-PASSWORD-01..03)
  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.usersService.changePassword(user.sub, dto);
  }

  // DELETE /users/me — 계정 소프트 삭제 (REQ-USER-DELETE-*, AC-DELETE-01..05)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async deleteMe(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.usersService.softDelete(user.sub, user.role);
  }

  // GET /users — 관리자: 페이지네이션 사용자 목록 (REQ-USER-ADMIN-*, AC-ADMIN-01, AC-ADMIN-04)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )
  async findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  // GET /users/:id — 관리자: 사용자 단건 조회
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findUserById(@Param('id') id: string) {
    return this.usersService.findUserById(id);
  }

  // PATCH /users/:id/role — 관리자에 의한 역할 변경 (AC-ROLE-CHANGE-01..02, SPEC-AUTH-001)
  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateRole(
    @Param('id') targetUserId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.usersService.updateRole(
      targetUserId,
      dto.role,
      admin.sub,
      dto.reason,
    );
  }
}
