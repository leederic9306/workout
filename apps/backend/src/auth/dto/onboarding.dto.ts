import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsString,
  Length,
  Max,
  MaxDate,
  Min,
  MinDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExperienceLevel, Gender } from '@workout/types';

// 100년 전 기준 날짜 계산
const minBirthDate = (): Date => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 100);
  return d;
};

// 온보딩 완료 DTO (소셜 로그인 신규 가입 또는 미완료 사용자용)
export class OnboardingDto {
  @IsString()
  @Length(2, 20, { message: '닉네임은 2~20자여야 합니다.' })
  nickname!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsDateString({}, { message: 'birthDate는 ISO 8601 형식이어야 합니다.' })
  @MinDate(minBirthDate(), { message: '생년월일은 최근 100년 이내여야 합니다.' })
  @MaxDate(new Date(), { message: '생년월일은 미래일 수 없습니다.' })
  @Type(() => Date)
  birthDate!: Date;

  @IsNumber()
  @Min(100, { message: '신장은 100cm 이상이어야 합니다.' })
  @Max(250, { message: '신장은 250cm 이하여야 합니다.' })
  height!: number;

  @IsEnum(ExperienceLevel)
  experienceLevel!: ExperienceLevel;
}
