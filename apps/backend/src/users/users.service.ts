import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { PaginatedUsersResponse, UserProfile } from '@workout/types';
import { UserRole } from '@workout/types';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import {
  toUserResponse,
  UserForResponse,
} from './dto/user-response.dto';

// bcrypt 비용 계수 (AuthService와 동일)
const BCRYPT_COST = 10;

// 사용자 도메인 서비스
// @MX:ANCHOR: [AUTO] 사용자 조회/프로필/역할/소프트삭제의 핵심 경계 (fan_in: AuthService, UsersController, JwtStrategy, RolesGuard)
// @MX:REASON: 비밀 필드 노출 금지, deletedAt 일관 필터, 비밀번호/토큰 회전 정책을 단일 위치에서 강제
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // 이메일로 사용자 조회 (인증 흐름에서 사용)
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // ID로 사용자 조회 (소프트 삭제 필터 없음, 인증 흐름 호환 유지)
  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // 관리자에 의한 역할 변경 (RoleChangeLog 동시 생성)
  // @MX:WARN: [AUTO] 사용자 역할 변경과 감사 로그 생성은 트랜잭션으로 묶여야 함
  // @MX:REASON: 부분 실패 시 권한 상승만 발생하고 감사 기록이 누락되는 보안 사고를 방지
  async updateRole(
    targetUserId: string,
    newRole: UserRole,
    adminUserId: string,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: targetUserId } });
      if (!target) {
        throw new NotFoundException('대상 사용자를 찾을 수 없습니다.');
      }

      const fromRole = target.role as UserRole;

      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { role: newRole },
      });

      await tx.roleChangeLog.create({
        data: {
          targetUserId,
          changedByUserId: adminUserId,
          fromRole,
          toRole: newRole,
          reason,
        },
      });

      return updated;
    });
  }

  // GET /users/me — 자신의 프로필 조회 (AC-PROFILE-01)
  async getMe(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    return toUserResponse(user as UserForResponse);
  }

  // PATCH /users/me/profile — 프로필 부분 업데이트 (AC-UPDATE-01)
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // undefined 필드는 제외하여 Prisma 부분 업데이트 수행
    const data: Record<string, unknown> = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.birthDate !== undefined) data.birthDate = new Date(dto.birthDate);
    if (dto.height !== undefined) data.height = dto.height;
    if (dto.experienceLevel !== undefined)
      data.experienceLevel = dto.experienceLevel;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return toUserResponse(updated as UserForResponse);
  }

  // PATCH /users/me/password — 비밀번호 변경 (AC-PASSWORD-01..03)
  // @MX:WARN: [AUTO] 비밀번호 변경 성공 시 모든 활성 refresh token 을 즉시 무효화해야 함
  // @MX:REASON: 비밀번호 노출/변경 시 기존 세션을 강제 종료하여 탈취 토큰 재사용을 차단
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    // 소셜 전용 계정 (passwordHash IS NULL) 은 비밀번호 변경 불가
    if (!user.passwordHash) {
      throw new BadRequestException(
        '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.',
      );
    }

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('현재 비밀번호가 올바르지 않습니다.');
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        // 모든 세션 강제 로그아웃
        refreshTokenHash: null,
      },
    });
  }

  // DELETE /users/me — 소프트 삭제 (AC-DELETE-01, AC-DELETE-05)
  async softDelete(userId: string, currentRole: UserRole): Promise<void> {
    // 관리자(ADMIN) 는 자기 자신을 삭제할 수 없다 (AC-DELETE-05)
    if (currentRole === UserRole.ADMIN) {
      throw new ForbiddenException(
        '관리자는 자신의 계정을 삭제할 수 없습니다.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        refreshTokenHash: null,
      },
    });
  }

  // GET /users — 관리자: 페이지네이션 사용자 목록 (AC-ADMIN-01, AC-ADMIN-04)
  async findAll(
    query: ListUsersQueryDto,
  ): Promise<PaginatedUsersResponse<UserProfile>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return {
      items: items.map((u) => toUserResponse(u as UserForResponse)),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  // GET /users/:id — 관리자: 사용자 단건 조회
  async findUserById(id: string): Promise<UserProfile> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    return toUserResponse(user as UserForResponse);
  }
}
