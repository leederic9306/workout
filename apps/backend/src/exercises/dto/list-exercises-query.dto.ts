import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// 운동 목록 조회 쿼리 (페이지네이션 + 필터)
export class ListExercisesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  primaryMuscle?: string;

  @IsOptional()
  @IsString()
  equipment?: string;
}
