import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CompoundType } from '@prisma/client';

export enum DashboardPeriod {
  ONE_MONTH = '1m',
  THREE_MONTHS = '3m',
  SIX_MONTHS = '6m',
  ONE_YEAR = '1y',
}

// 기간 필터 (체성분/1RM 히스토리 공용)
export class PeriodQueryDto {
  @IsOptional()
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod = DashboardPeriod.THREE_MONTHS;
}

// 1RM 히스토리 쿼리 (exerciseType 필수 + period)
export class OneRepMaxHistoryQueryDto {
  @IsEnum(CompoundType)
  exerciseType!: CompoundType;

  @IsOptional()
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod = DashboardPeriod.THREE_MONTHS;
}

// 주간 단위 쿼리 (volume/frequency)
export class WeeksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(52)
  weeks?: number = 12;
}
