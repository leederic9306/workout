import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxDate,
  Min,
  MinDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExperienceLevel, Gender } from '@workout/types';

// 100년 전 기준 날짜 계산 (생년월일 검증용)
const minBirthDate = (): Date => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 100);
  return d;
};

// 프로필 부분 업데이트 DTO (PATCH /users/me/profile)
// 화이트리스트 외 필드는 ValidationPipe(forbidNonWhitelisted: true)에 의해 거부됨
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 20, { message: '닉네임은 2~20자여야 합니다.' })
  nickname?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString({}, { message: 'birthDate는 ISO 8601 형식이어야 합니다.' })
  @MinDate(minBirthDate(), { message: '생년월일은 최근 100년 이내여야 합니다.' })
  @MaxDate(new Date(), { message: '생년월일은 미래일 수 없습니다.' })
  @Type(() => Date)
  birthDate?: Date;

  @IsOptional()
  @IsNumber()
  @Min(100, { message: '신장은 100cm 이상이어야 합니다.' })
  @Max(250, { message: '신장은 250cm 이하여야 합니다.' })
  height?: number;

  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;
}
