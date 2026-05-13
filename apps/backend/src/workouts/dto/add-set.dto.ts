import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// 세트 추가 요청 DTO
export class AddSetDto {
  @IsString()
  exerciseId!: string;

  @IsInt()
  @Min(1)
  setNumber!: number;

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
