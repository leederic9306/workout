import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// 액세스 토큰 가드
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
