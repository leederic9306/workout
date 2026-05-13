import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@workout/types';

// 현재 인증된 사용자(JWT payload)를 핸들러 파라미터로 주입
// 사용 예: handler(@CurrentUser() user: JwtPayload)
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
