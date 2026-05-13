import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

// 리프레시 토큰 DTO
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @IsJWT()
  refreshToken!: string;
}
