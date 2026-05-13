import { IsOptional, IsString, MaxLength } from 'class-validator';

// 세션 생성 요청 DTO
export class CreateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
