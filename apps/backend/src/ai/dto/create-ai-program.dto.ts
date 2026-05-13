import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAiProgramDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  goal!: string;

  @IsInt()
  @Min(1)
  @Max(7)
  daysPerWeek!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  availableEquipment!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  focusAreas?: string[];
}
