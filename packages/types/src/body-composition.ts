// 체성분 도메인 타입 (SPEC-DASHBOARD-001)

// 체성분 단일 레코드 응답
export interface BodyCompositionRecord {
  id: string;
  weight: number;
  muscleMass: number | null;
  bodyFatPct: number | null;
  recordedAt: string; // ISO 8601
  createdAt: string;  // ISO 8601
}

// 체성분 생성 요청 (recordedAt 미지정 시 서버에서 now() 적용)
export interface CreateBodyCompositionRequest {
  weight: number;
  muscleMass?: number;
  bodyFatPct?: number;
  recordedAt?: string;
}

// 커서 페이지네이션 응답 (recordedAt DESC)
export interface PaginatedBodyCompositionResponse {
  items: BodyCompositionRecord[];
  nextCursor: string | null;
}
