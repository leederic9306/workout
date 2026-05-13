import {
  IsDateString,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

// 체성분 생성 요청 DTO (REQ-DASH-BODY-009 ~ 013)
// 소수점 자릿수 제한은 컨트롤러/서비스 레이어에서 추가 검증
export class CreateBodyCompositionDto {
  // weight: 40.0 ≤ weight ≤ 300.0, 최대 소수점 2자리
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(40.0)
  @Max(300.0)
  weight!: number;

  // muscleMass: > 0, ≤ weight, 최대 소수점 2자리 (서비스에서 weight 비교 검증)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  muscleMass?: number;

  // bodyFatPct: 1.0 ≤ pct ≤ 60.0, 최대 소수점 1자리
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1.0)
  @Max(60.0)
  bodyFatPct?: number;

  // recordedAt: ISO 8601, 미래 시각 불가 (서비스에서 검증)
  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}
