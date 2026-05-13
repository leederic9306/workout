import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// 리프레시 토큰 가드
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
