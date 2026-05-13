import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Length,
  Matches,
  Max,
  MaxDate,
  Min,
  MinDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExperienceLevel, Gender } from '@workout/types';

// 비밀번호 정책: 최소 8자, 대문자 1개, 숫자 1개, 특수문자 1개
const PASSWORD_REGEX =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

// 100년 전 기준 날짜 계산 (validator 평가 시점)
const minBirthDate = (): Date => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 100);
  return d;
};

// 회원가입 DTO
export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(PASSWORD_REGEX, {
    message:
      '비밀번호는 최소 8자이며 대문자, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.',
  })
  password!: string;

  @IsString()
  @IsNotEmpty()
  inviteCode!: string;

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
