import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// 관리자 사용자 목록 페이지네이션 쿼리 DTO (GET /users)
// limit 0 또는 음수는 IsInt + Min(1)에서 거부됨, 101 이상은 Max(100)에서 거부됨
export class ListUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page는 정수여야 합니다.' })
  @Min(1, { message: 'page는 1 이상이어야 합니다.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit은 정수여야 합니다.' })
  @Min(1, { message: 'limit은 1 이상이어야 합니다.' })
  @Max(100, { message: 'limit은 100 이하여야 합니다.' })
  limit?: number = 20;
}
