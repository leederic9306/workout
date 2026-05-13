import { ExerciseListItemDto } from './exercise-list-item.dto';

// 페이지네이션 응답
export class PaginatedExercisesResponseDto {
  items!: ExerciseListItemDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}
