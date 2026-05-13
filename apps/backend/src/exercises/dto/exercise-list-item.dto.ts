// 운동 목록 아이템 (썸네일 1장만 포함)
export class ExerciseListItemDto {
  id!: string;
  name!: string;
  primaryMuscles!: string[];
  equipment!: string | null;
  category!: string;
  level!: string;
  images!: string[];
  isFavorite!: boolean;
}
