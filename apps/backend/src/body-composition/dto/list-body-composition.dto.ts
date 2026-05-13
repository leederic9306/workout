import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// 체성분 목록 조회 쿼리 DTO (커서 페이지네이션)
export class ListBodyCompositionDto {
  // 기본 20, 최대 100
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // 커서: 이전 페이지 마지막 항목의 recordedAt (ISO 8601)
  @IsOptional()
  @IsDateString()
  cursor?: string;
}
