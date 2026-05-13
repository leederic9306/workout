import { IsNotEmpty, IsString } from 'class-validator';

// 소셜 로그인 DTO
// provider 는 URL 경로 파라미터로 전달되고, token 은 본문으로 전달됨
export class SocialLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'OAuth access token이 필요합니다.' })
  token!: string;
}
