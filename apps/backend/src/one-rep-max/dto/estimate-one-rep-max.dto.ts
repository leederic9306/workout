import { IsInt, IsNumber, IsPositive, Max, Min } from 'class-validator';

export class EstimateOneRepMaxDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(500)
  weight!: number;

  @IsInt()
  @Min(1)
  @Max(30)
  reps!: number;
}
