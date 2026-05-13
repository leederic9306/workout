import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

// 로그인 DTO
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
