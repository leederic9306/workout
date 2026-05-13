// @MX:ANCHOR: [AUTO] CompoundType → Exercise.externalId 매핑 (단일 소스)
// @MX:REASON: SPEC-DASHBOARD-001 - 대시보드 1RM 히스토리에서 컴파운드 종목 식별을 위해 사용 (fan_in >= 2)
// 중복 정의 금지 — 대시보드 모듈은 이 상수만 import 해야 함
import { CompoundType } from '@prisma/client';

// free-exercise-db seed의 externalId(snake_case) 기준
export const COMPOUND_EXERCISE_SLUG_MAP: Record<CompoundType, string> = {
  [CompoundType.SQUAT]: 'Barbell_Squat',
  [CompoundType.DEADLIFT]: 'Barbell_Deadlift',
  [CompoundType.BENCH_PRESS]: 'Barbell_Bench_Press_-_Medium_Grip',
  [CompoundType.BARBELL_ROW]: 'Bent_Over_Barbell_Row',
  [CompoundType.OVERHEAD_PRESS]: 'Standing_Military_Press',
};
