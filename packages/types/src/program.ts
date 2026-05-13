// 운동 프로그램 시스템 공유 타입 (SPEC-PROGRAM-001)

export enum ProgramType {
  CATALOG = 'CATALOG',
  AI_GENERATED = 'AI_GENERATED',
}

export type ProgramLevel = 'beginner' | 'intermediate' | 'advanced';

// 카탈로그 아이템 (목록용)
export interface CatalogItemDto {
  id: string;
  title: string;
  description: string;
  type: ProgramType;
  level: string;
  frequency: number;
  dayCount: number;
  exerciseSummary: string;
  createdAt: string;
}

export interface CatalogResponseDto {
  items: CatalogItemDto[];
}

// 프로그램 내 운동
export interface ProgramExerciseDto {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  sets: number;
  reps: string;
  weightNote: string | null;
}

// 프로그램 일 (day)
export interface ProgramDayDto {
  id: string;
  dayNumber: number;
  name: string;
  exercises: ProgramExerciseDto[];
}

// 프로그램 상세
export interface ProgramDetailDto {
  id: string;
  title: string;
  description: string;
  type: ProgramType;
  level: string;
  frequency: number;
  createdBy: string | null;
  isPublic: boolean;
  days: ProgramDayDto[];
  createdAt: string;
  updatedAt: string;
}

// 활성 프로그램 응답
export interface ActiveProgramResponseDto {
  active: ProgramDetailDto | null;
}

// 활성화 응답
export interface ActivateProgramResponseDto {
  id: string;
  userId: string;
  programId: string;
  startedAt: string;
  program: ProgramDetailDto;
}

// AI 프로그램 생성 요청
export interface CreateAiProgramRequest {
  goal: string;
  daysPerWeek: number;
  availableEquipment: string[];
  focusAreas?: string[];
}
