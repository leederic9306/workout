import { CompoundType, OrmSource } from '@prisma/client';

// 단일 1RM 응답 (보안: id, userId, createdAt 제외 - NFR-ORM-SEC-003)
export class OneRepMaxResponseDto {
  exerciseType!: CompoundType;
  value!: number;
  source!: OrmSource;
  updatedAt!: string; // ISO 8601
}

// 5종 컴파운드 조회 응답 (모든 키 항상 존재, 미설정은 null)
export class OneRepMaxCollectionDto {
  SQUAT!: OneRepMaxResponseDto | null;
  DEADLIFT!: OneRepMaxResponseDto | null;
  BENCH_PRESS!: OneRepMaxResponseDto | null;
  BARBELL_ROW!: OneRepMaxResponseDto | null;
  OVERHEAD_PRESS!: OneRepMaxResponseDto | null;
}

// 1RM 추정 응답
export class OneRepMaxEstimateResponseDto {
  epley!: number;
  brzycki!: number;
  average!: number;
}

// @MX:ANCHOR: [AUTO] OneRepMax 응답 변환 단일 지점 - id/userId/createdAt 제외 불변식 보장
// @MX:REASON: SPEC-1RM-001 REQ-ORM-READ-003, NFR-ORM-SEC-003 - 모든 응답이 이 함수를 통과해야 함
export function toOneRepMaxResponse(record: {
  exerciseType: CompoundType;
  value: number;
  source: OrmSource;
  updatedAt: Date;
}): OneRepMaxResponseDto {
  return {
    exerciseType: record.exerciseType,
    value: record.value,
    source: record.source,
    updatedAt: record.updatedAt.toISOString(),
  };
}
