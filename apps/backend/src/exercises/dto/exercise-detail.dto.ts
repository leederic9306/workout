// 운동 상세 정보 (전체 이미지/지시사항 포함)
export class ExerciseDetailDto {
  id!: string;
  name!: string;
  force!: string | null;
  level!: string;
  mechanic!: string | null;
  equipment!: string | null;
  primaryMuscles!: string[];
  secondaryMuscles!: string[];
  instructions!: string[];
  category!: string;
  images!: string[];
  isFavorite!: boolean;
}
