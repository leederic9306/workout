// 공통 타입 정의 (백엔드/모바일 공유)

export enum UserRole {
  ADMIN = 'ADMIN',
  PREMIUM = 'PREMIUM',
  USER = 'USER',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum ExperienceLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export enum SocialProvider {
  KAKAO = 'KAKAO',
  GOOGLE = 'GOOGLE',
}

// JWT 페이로드
export interface JwtPayload {
  sub: string;
  role: UserRole;
  onboardingCompleted: boolean;
  iat?: number;
  exp?: number;
}

// 리프레시 토큰 페이로드
export interface JwtRefreshPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

// 인증 토큰 쌍
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ============================================================
// Exercise Library (SPEC-EXERCISE-001)
// ============================================================

export type ExerciseLevel = 'beginner' | 'intermediate' | 'expert';
export type ExerciseForce = 'push' | 'pull' | 'static';
export type ExerciseMechanic = 'compound' | 'isolation';

export interface ExerciseListItem {
  id: string;
  name: string;
  primaryMuscles: string[];
  equipment: string | null;
  category: string;
  level: string;
  images: string[];
  isFavorite: boolean;
}

export interface ExerciseDetail {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
  isFavorite: boolean;
}

export interface ExerciseListQuery {
  page?: number;
  limit?: number;
  primaryMuscle?: string;
  equipment?: string;
}

export interface PaginatedExercisesResponse {
  items: ExerciseListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FavoriteToggleResponse {
  exerciseId: string;
  favoritedAt: string;
}

// ============================================================
// Workout Session (SPEC-WORKOUT-SESSION-001)
// ============================================================

export enum SessionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export interface WorkoutSetItem {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  duration: number | null;
  notes: string | null;
  recordedAt: string;
}

export interface WorkoutSessionSummary {
  id: string;
  name: string | null;
  notes: string | null;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  totalSets: number;
  totalVolume: number;
  totalExercises: number;
  totalDuration: number;
}

export interface WorkoutSessionDetail extends WorkoutSessionSummary {
  sets: WorkoutSetItem[];
}

export interface PaginatedSessionsResponse {
  items: WorkoutSessionSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActiveSessionResponse {
  active: WorkoutSessionDetail | null;
}

// ============================================================
// 1RM Management (SPEC-1RM-001)
// ============================================================

export enum CompoundType {
  SQUAT = 'SQUAT',
  DEADLIFT = 'DEADLIFT',
  BENCH_PRESS = 'BENCH_PRESS',
  BARBELL_ROW = 'BARBELL_ROW',
  OVERHEAD_PRESS = 'OVERHEAD_PRESS',
}

export enum OrmSource {
  DIRECT_INPUT = 'DIRECT_INPUT',
  ESTIMATED = 'ESTIMATED',
}

export interface OneRepMaxRecord {
  exerciseType: CompoundType;
  value: number;
  source: OrmSource;
  updatedAt: string; // ISO 8601
}

export type OneRepMaxCollection = {
  [K in CompoundType]: OneRepMaxRecord | null;
};

export interface UpsertOneRepMaxRequest {
  value: number;
}

export interface EstimateOneRepMaxRequest {
  weight: number;
  reps: number;
}

export interface OneRepMaxEstimateResponse {
  epley: number;
  brzycki: number;
  average: number;
}

// 한국어 표시 매핑 (모바일 UI 표시용)
export const COMPOUND_LABELS_KO: Record<CompoundType, string> = {
  [CompoundType.SQUAT]: '스쿼트',
  [CompoundType.DEADLIFT]: '데드리프트',
  [CompoundType.BENCH_PRESS]: '벤치프레스',
  [CompoundType.BARBELL_ROW]: '바벨 로우',
  [CompoundType.OVERHEAD_PRESS]: '오버헤드프레스',
};

// ============================================================
// 운동 프로그램 시스템 (SPEC-PROGRAM-001)
// ============================================================

export * from './program';

// ============================================================
// 사용자 프로필 (SPEC-USER-001)
// ============================================================

export * from './user';

// ============================================================
// 체성분 / 대시보드 (SPEC-DASHBOARD-001)
// ============================================================

export * from './body-composition';
export * from './dashboard';
