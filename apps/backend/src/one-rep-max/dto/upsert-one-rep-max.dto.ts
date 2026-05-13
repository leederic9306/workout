import { IsNumber, IsPositive, Max } from 'class-validator';

export class UpsertOneRepMaxDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(500)
  value!: number;
}
