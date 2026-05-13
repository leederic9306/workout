import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@workout/types';

// 역할 메타데이터 키
export const ROLES_KEY = 'roles';

// @Roles(...UserRole) 데코레이터: 핸들러에 허용 역할 목록을 메타데이터로 부착
// @MX:NOTE: [AUTO] RolesGuard가 Reflector로 해당 메타데이터를 읽어 접근 권한을 판정
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
