import { IsNotEmpty, IsString } from 'class-validator';

// 초대 코드 검증 DTO
export class VerifyInviteCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
