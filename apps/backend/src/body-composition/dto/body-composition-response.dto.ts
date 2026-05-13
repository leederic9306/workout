import { Decimal } from '@prisma/client/runtime/library';

// 체성분 응답 DTO (Decimal → number 변환, userId 노출 금지)
export class BodyCompositionResponseDto {
  id!: string;
  weight!: number;
  muscleMass!: number | null;
  bodyFatPct!: number | null;
  recordedAt!: string; // ISO 8601
  createdAt!: string;  // ISO 8601
}

export class PaginatedBodyCompositionDto {
  items!: BodyCompositionResponseDto[];
  nextCursor!: string | null; // 다음 페이지 cursor (없으면 null)
}

// @MX:ANCHOR: [AUTO] BodyComposition 응답 변환 단일 지점 — userId 제외 불변식 보장
// @MX:REASON: NFR-DASH-SEC-* / SPEC-DASHBOARD-001 - 모든 응답이 이 함수를 통과해야 함
export function toBodyCompositionResponse(record: {
  id: string;
  weight: Decimal;
  muscleMass: Decimal | null;
  bodyFatPct: Decimal | null;
  recordedAt: Date;
  createdAt: Date;
}): BodyCompositionResponseDto {
  return {
    id: record.id,
    weight: Number(record.weight),
    muscleMass: record.muscleMass != null ? Number(record.muscleMass) : null,
    bodyFatPct: record.bodyFatPct != null ? Number(record.bodyFatPct) : null,
    recordedAt: record.recordedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}
