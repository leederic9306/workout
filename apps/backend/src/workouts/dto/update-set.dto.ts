import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// 세트 수정 DTO (모든 필드 optional)
export class UpdateSetDto {
  @IsOptional()
  @IsString()
  exerciseId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  setNumber?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  reps?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  weight?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  duration?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
