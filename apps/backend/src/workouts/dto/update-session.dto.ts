import { IsOptional, IsString, MaxLength } from 'class-validator';

// 세션 메타데이터 업데이트 DTO
export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
