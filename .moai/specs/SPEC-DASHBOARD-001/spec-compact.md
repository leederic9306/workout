# SPEC-DASHBOARD-001 (Compact)

근력 운동 트래커 앱의 대시보드 시각화 및 체성분 관리 시스템. 본 문서는 spec.md의 EARS 요구사항, 인수 기준, 변경 파일 목록, 제외 사항만을 추출한 압축 버전이다. 상세 설명·근거는 spec.md를 참조한다.

---

## 1. EARS 요구사항

### 1.1 REQ-DASH-BODY (체성분 CRUD)

- **REQ-DASH-BODY-001** (Event-Driven): 인증된 사용자가 `POST /users/me/body-composition` 본문 `{ weight, muscleMass?, bodyFatPct?, recordedAt? }`를 보내면, 시스템은 `BodyComposition`을 생성하고 `201 Created`로 반환해야 한다. `userId`는 JWT `sub`로 설정, `recordedAt` 누락 시 `now()` 사용.
- **REQ-DASH-BODY-002** (Ubiquitous): 응답 필드 — `id`, `weight`, `muscleMass`(없으면 `null`), `bodyFatPct`(없으면 `null`), `recordedAt`, `createdAt`. `userId` 미포함.
- **REQ-DASH-BODY-003** (Event-Driven): `GET /users/me/body-composition?limit=&cursor=` 호출 시, `recordedAt` 내림차순 페이지네이션 `200 OK`. 기본 limit 20, 최대 100.
- **REQ-DASH-BODY-004** (Ubiquitous): 응답 구조 — `{ items: BodyComposition[], nextCursor: string | null }`.
- **REQ-DASH-BODY-005** (Event-Driven): `DELETE /users/me/body-composition/:id`로 본인 소유 레코드 삭제 시 `204 No Content`.
- **REQ-DASH-BODY-006** (Event-Driven): 본인 소유가 아니거나 존재하지 않는 `id`로 삭제 시 두 경우 모두 `404 Not Found` (존재 여부 노출 차단).
- **REQ-DASH-BODY-007** (Unwanted): 모든 체성분 엔드포인트는 JWT `sub`와 다른 `userId`의 데이터에 접근/노출하지 않아야 한다.
- **REQ-DASH-BODY-008** (Ubiquitous): 모든 체성분 엔드포인트는 `JwtAuthGuard` 보호, JWT 누락/만료 시 `401 Unauthorized`.
- **REQ-DASH-BODY-009** (Event-Driven, 검증): `weight`가 `40.0` 미만, `300.0` 초과, 또는 양수 아닐 때 `400 Bad Request`.
- **REQ-DASH-BODY-010** (Event-Driven, 검증): `muscleMass`가 양수 아니거나 `weight` 초과 시 `400 Bad Request`.
- **REQ-DASH-BODY-011** (Event-Driven, 검증): `bodyFatPct`가 `1.0` 미만 또는 `60.0` 초과 시 `400 Bad Request`.
- **REQ-DASH-BODY-012** (Event-Driven, 검증): `recordedAt`이 미래 시각이거나 ISO 8601 형식이 아닐 때 `400 Bad Request`. 과거 시각은 허용.
- **REQ-DASH-BODY-013** (Event-Driven, 정밀도): `weight`/`muscleMass` `Decimal(5,2)`, `bodyFatPct` `Decimal(4,1)` 정밀도로 저장. `weight`/`muscleMass` 소수점 2자리 초과 또는 `bodyFatPct` 소수점 1자리 초과 시 `400 Bad Request`. 절삭/반올림 없이 거부.

### 1.2 REQ-DASH-1RM (1RM 이력, WorkoutSet 계산)

- **REQ-DASH-1RM-001** (Event-Driven): `GET /dashboard/1rm-history?exerciseType=&period=` 호출 시, 완료된 `WorkoutSession` × 완료된 `WorkoutSet`(`weight IS NOT NULL`, `reps IS NOT NULL`) 중 `Exercise.slug ∈ COMPOUND_EXERCISE_SLUG_MAP`에 해당하는 세트로부터 Epley 추정 1RM 시계열 `200 OK` 반환.
- **REQ-DASH-1RM-002** (Ubiquitous): 세션 단위 1 point, 세션 내 best Epley 1RM(`weight * (1 + reps / 30)`) 채택.
- **REQ-DASH-1RM-003** (Ubiquitous): 응답 — `{ exerciseType, period, points: Array<{ sessionId, completedAt, estimated1RM }> }`. `points`는 `completedAt` 오름차순.
- **REQ-DASH-1RM-004** (Event-Driven): `period` 값 — `1m`/`3m`/`6m`/`1y`. 누락 시 `3m` 기본. 잘못된 값 `400`.
- **REQ-DASH-1RM-005** (Event-Driven): `exerciseType`이 `CompoundType` enum 외 또는 누락 시 `400`.
- **REQ-DASH-1RM-006** (Event-Driven): 해당 기간 내 세트 0건이면 `200 OK`와 `points: []`. `404` 미사용.
- **REQ-DASH-1RM-007** (Ubiquitous): Epley 계산은 `packages/utils/src/1rm.ts`의 `calculateEpley`와 동등 결과.
- **REQ-DASH-1RM-008** (Ubiquitous): `Exercise.slug ↔ CompoundType` 매핑은 SPEC-WORKOUT-001 `COMPOUND_EXERCISE_SLUG_MAP` 재사용 (중복 정의 금지).
- **REQ-DASH-1RM-009** (Unwanted): `reps < 1` 또는 `reps > 10` 세트는 계산 제외. 세션의 유효 세트가 0건이면 응답에 포함하지 않음.

### 1.3 REQ-DASH-VOL (주간 볼륨)

- **REQ-DASH-VOL-001** (Event-Driven): `GET /dashboard/weekly-volume?weeks=` 호출 시, 완료된 `WorkoutSet`의 `SUM(weight * reps)`를 주(week, 월요일 시작 UTC) 단위로 집계 `200 OK`.
- **REQ-DASH-VOL-002** (Ubiquitous): 응답 — `{ weeks, points: Array<{ weekStart, totalVolume, sessionCount }> }`. `weekStart` 오름차순. 0인 주도 포함.
- **REQ-DASH-VOL-003** (Event-Driven): `weeks` 정수 `4~52` 외, 정수 아님 시 `400`. 누락 시 기본 `12`.
- **REQ-DASH-VOL-004** (Unwanted): `weight IS NULL`인 세트(보디웨이트)는 합계에서 제외.
- **REQ-DASH-VOL-005** (Ubiquitous): `totalVolume` 소수 2자리 반올림.

### 1.4 REQ-DASH-FREQ (운동 빈도)

- **REQ-DASH-FREQ-001** (Event-Driven): `GET /dashboard/workout-frequency?weeks=` 호출 시, 완료된 `WorkoutSession` 개수를 주 단위 집계 `200 OK`.
- **REQ-DASH-FREQ-002** (Ubiquitous): 응답 — `{ weeks, points: Array<{ weekStart, sessionCount }> }`. 0인 주도 포함.
- **REQ-DASH-FREQ-003** (Event-Driven): `weeks` 검증. 누락 시 기본 `12`.
- **REQ-DASH-FREQ-004** (Unwanted): `CANCELLED`/`IN_PROGRESS` 세션은 카운트에서 제외. `COMPLETED` + `completedAt IS NOT NULL`만 카운트.

### 1.5 REQ-DASH-BTREND (체성분 추세)

- **REQ-DASH-BTREND-001** (Event-Driven): `GET /dashboard/body-composition?period=` 호출 시, period 내 `BodyComposition`을 `recordedAt` 오름차순 `200 OK`. 누락 시 `3m`.
- **REQ-DASH-BTREND-002** (Ubiquitous): 응답 — `{ period, points: Array<{ recordedAt, weight, muscleMass, bodyFatPct }> }`. 부분 측정은 `null`.
- **REQ-DASH-BTREND-003** (Event-Driven): `period`가 정의된 값 외 `400`.
- **REQ-DASH-BTREND-004** (Event-Driven): 데이터 0건이면 `200 OK`와 `points: []`.

### 1.6 REQ-DASH-MOBILE (모바일)

- **REQ-DASH-MOBILE-001**: `app/(tabs)/my/body.tsx` — 체성분 입력 폼 + 이력 리스트 + 삭제.
- **REQ-DASH-MOBILE-002**: `app/(tabs)/my/dashboard.tsx` — 4종 차트 + 기간 필터(`1m`/`3m`/`6m`/`1y`).
- **REQ-DASH-MOBILE-003**: 차트는 `react-native-gifted-charts` v1.4.x. Expo Managed 호환, 추가 네이티브 모듈 없음.
- **REQ-DASH-MOBILE-004**: 4종 차트 매핑 — 1RM 라인, 체성분 3선 라인(weight/muscleMass/bodyFatPct), 주간 볼륨 바, 운동 빈도 바.
- **REQ-DASH-MOBILE-005**: TanStack Query 캐싱 `staleTime: 5min`. `POST`/`DELETE` 성공 시 `['body-composition']` + `['dashboard', 'body-composition']` invalidate.
- **REQ-DASH-MOBILE-006**: `points: []`일 때 "기록된 데이터가 없습니다" 안내, 라이브러리 크래시 방어.

### 1.7 NFR-DASH (비기능)

#### NFR-DASH-PERF (성능)
- **NFR-DASH-PERF-001**: 4종 대시보드 GET P95 ≤ 500ms.
- **NFR-DASH-PERF-002**: `POST body-composition` P95 ≤ 150ms.
- **NFR-DASH-PERF-003**: `GET body-composition` P95 ≤ 200ms.
- **NFR-DASH-PERF-004**: `DELETE body-composition` P95 ≤ 150ms.
- **NFR-DASH-PERF-005**: 집계 쿼리는 단일 SQL, N+1 금지.

#### NFR-DASH-SEC (보안)
- **NFR-DASH-SEC-001**: 모든 엔드포인트 `JwtAuthGuard` 보호.
- **NFR-DASH-SEC-002**: 사용자 식별은 JWT `sub`만, 경로/쿼리로 다른 ID 미수용.
- **NFR-DASH-SEC-003**: 응답에 `userId` 컬럼 미노출.
- **NFR-DASH-SEC-004**: 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- **NFR-DASH-SEC-005**: `DELETE`에서 본인 소유 아님 + 미존재 모두 `404`(존재 노출 차단).

#### NFR-DASH-DATA (데이터 무결성)
- **NFR-DASH-DATA-001**: `BodyComposition` `@@index([userId, recordedAt(sort: Desc)])`.
- **NFR-DASH-DATA-002**: `BodyComposition.userId` FK + `onDelete: Cascade`. 소프트 삭제 능동 처리 없음.
- **NFR-DASH-DATA-003**: `weight`/`muscleMass` `Decimal(5,2)`, `bodyFatPct` `Decimal(4,1)`. 범위 검증은 앱 레이어.
- **NFR-DASH-DATA-004**: SPEC-WORKOUT-001의 `WorkoutSession`/`WorkoutSet` 인덱스 가정.

#### NFR-DASH-CONSISTENCY (일관성)
- **NFR-DASH-CONSISTENCY-001**: 1RM 계산은 `calculateEpley`와 일관.
- **NFR-DASH-CONSISTENCY-002**: 컴파운드 매핑은 `COMPOUND_EXERCISE_SLUG_MAP` 재사용.

#### NFR-DASH-MOBILE (모바일 호환)
- **NFR-DASH-MOBILE-001**: `react-native-gifted-charts` v1.4.x, Expo Managed 호환.
- **NFR-DASH-MOBILE-002**: Android, RN 0.74+, Expo SDK 51+.

---

## 2. 인수 기준 (Given/When/Then 요약)

| 시나리오 ID | 시나리오 | 검증 REQ |
|---|---|---|
| AC-DASH-BODY-CREATE-01 | weight만 입력 → 201, muscleMass/bodyFatPct null, userId 미노출 | REQ-DASH-BODY-001/002 |
| AC-DASH-BODY-CREATE-02 | 전체 필드 + recordedAt → 201, recordedAt 사용자 지정값 저장 | REQ-DASH-BODY-001 |
| AC-DASH-BODY-CREATE-INVALID-01 | weight 0/음수/30/350/"abc" → 모두 400 | REQ-DASH-BODY-009 |
| AC-DASH-BODY-CREATE-INVALID-02 | muscleMass 음수/0/weight 초과 → 400 | REQ-DASH-BODY-010 |
| AC-DASH-BODY-CREATE-INVALID-03 | bodyFatPct 0.5/70/음수 → 400 | REQ-DASH-BODY-011 |
| AC-DASH-BODY-CREATE-INVALID-04 | recordedAt 미래/잘못된 형식 → 400, 과거 → 201 | REQ-DASH-BODY-012 |
| AC-DASH-BODY-CREATE-INVALID-05 | weight 소수 3자리/bodyFatPct 소수 2자리/muscleMass 소수 3자리 → 400 | REQ-DASH-BODY-013 |
| AC-DASH-BODY-LIST-01 | 25건 시드, limit=20 → 20개 + nextCursor, recordedAt DESC, userId 미노출 | REQ-DASH-BODY-003/004 |
| AC-DASH-BODY-LIST-INVALID-01 | limit=0/101/abc → 400 | REQ-DASH-BODY-003 |
| AC-DASH-BODY-DELETE-01 | 본인 소유 삭제 → 204, DB 제거 | REQ-DASH-BODY-005 |
| AC-DASH-BODY-DELETE-NOTFOUND-01 | 타 사용자 소유 + 미존재 id → 모두 404 (동일 메시지) | REQ-DASH-BODY-006, NFR-DASH-SEC-005 |
| AC-DASH-BODY-SECURITY-01 | U1/U2 데이터 격리 | REQ-DASH-BODY-007, NFR-DASH-SEC-002/003 |
| AC-DASH-BODY-AUTH-01 | JWT 누락/만료 → 모든 엔드포인트 401 | REQ-DASH-BODY-008, NFR-DASH-SEC-001 |
| AC-DASH-1RM-HISTORY-01 | 3개 세션 스쿼트 → points 3개, Epley best, completedAt 오름차순 | REQ-DASH-1RM-001/002/003/007/008 |
| AC-DASH-1RM-BEST-SET-01 | 세션 3세트 중 max Epley 채택 (143.0) | REQ-DASH-1RM-002 |
| AC-DASH-1RM-HISTORY-EMPTY-01 | 세트 0건 → 200 + points: [] | REQ-DASH-1RM-006 |
| AC-DASH-1RM-REPS-RANGE-01 | reps>10/reps<1 세트 제외 | REQ-DASH-1RM-009 |
| AC-DASH-1RM-INVALID-01 | period 2m/invalid → 400, 누락 → 3m 기본 | REQ-DASH-1RM-004 |
| AC-DASH-1RM-INVALID-02 | exerciseType PULL_UP/squat/누락 → 400 | REQ-DASH-1RM-005 |
| AC-DASH-VOL-01 | 시드 W1=1660(2건)/W2=550(1)/W3=0/W4=0 → 정확한 4 points, 0주 포함 | REQ-DASH-VOL-001/002/005 |
| AC-DASH-VOL-EMPTY-WEEK-01 | 중간 빈 주 포함 확인 | REQ-DASH-VOL-002 |
| AC-DASH-VOL-BW-EXCLUDE-01 | 보디웨이트(weight NULL) 세트 SUM 제외 | REQ-DASH-VOL-004 |
| AC-DASH-VOL-INVALID-01 | weeks 3/53/abc/10.5 → 400, 누락 → 12 기본 | REQ-DASH-VOL-003 |
| AC-DASH-FREQ-01 | W1=3/W2=1/W3=0/W4=2 정확한 카운트 | REQ-DASH-FREQ-001/002 |
| AC-DASH-FREQ-CANCEL-EXCLUDE-01 | CANCELLED/IN_PROGRESS 제외 | REQ-DASH-FREQ-004 |
| AC-DASH-FREQ-INVALID-01 | weeks 검증 | REQ-DASH-FREQ-003 |
| AC-DASH-BTREND-01 | 90일 내 3건(부분 측정 null 포함), 90일 외 제외 | REQ-DASH-BTREND-001/002 |
| AC-DASH-BTREND-EMPTY-01 | 0건 → 200 + points: [] | REQ-DASH-BTREND-004 |
| AC-DASH-BTREND-INVALID-01 | period 검증 | REQ-DASH-BTREND-003 |
| AC-DASH-PERF-01 | 500 세션, 2500 세트, 50 체성분 → 4종 GET P95 ≤ 500ms | NFR-DASH-PERF-001~005 |
| AC-DASH-CONSISTENCY-EPLEY-01 | 백엔드 Epley 결과 = `calculateEpley` 결과 (소수 2자리) | REQ-DASH-1RM-007, NFR-DASH-CONSISTENCY-001 |
| AC-DASH-CONSISTENCY-MAP-01 | `COMPOUND_EXERCISE_SLUG_MAP` import 재사용 | REQ-DASH-1RM-008, NFR-DASH-CONSISTENCY-002 |

수동 검증:
- AC-DASH-MOBILE-MANUAL-01 ~ 05: 체성분 화면, 대시보드 4종 차트, 빈 데이터 처리, TanStack Query 캐싱, Expo 빌드.

---

## 3. 변경 영향 (Files to Modify)

### 3.1 [NEW] 신규 생성

- `apps/backend/src/body-composition/body-composition.module.ts`
- `apps/backend/src/body-composition/body-composition.controller.ts`
- `apps/backend/src/body-composition/body-composition.service.ts`
- `apps/backend/src/body-composition/dto/create-body-composition.dto.ts`
- `apps/backend/src/body-composition/dto/list-body-composition.dto.ts`
- `apps/backend/src/body-composition/dto/body-composition-response.dto.ts`
- `apps/backend/src/dashboard/dashboard.module.ts`
- `apps/backend/src/dashboard/dashboard.controller.ts`
- `apps/backend/src/dashboard/dashboard.service.ts`
- `apps/backend/src/dashboard/dto/dashboard-query.dto.ts`
- `apps/backend/src/dashboard/dto/dashboard-response.dto.ts`
- `apps/backend/prisma/migrations/{TIMESTAMP}_add_body_composition/migration.sql`
- `apps/mobile/app/(tabs)/my/dashboard.tsx`
- `apps/mobile/app/(tabs)/my/body.tsx`
- `apps/mobile/components/charts/OneRepMaxChart.tsx`
- `apps/mobile/components/charts/BodyCompositionChart.tsx`
- `apps/mobile/components/charts/WeeklyVolumeChart.tsx`
- `apps/mobile/components/charts/WorkoutFrequencyChart.tsx`
- `apps/mobile/services/body-composition.ts`
- `apps/mobile/services/dashboard.ts`
- `apps/mobile/hooks/useBodyComposition.ts`
- `apps/mobile/hooks/useDashboard.ts`
- `packages/types/src/body-composition.ts`
- `packages/types/src/dashboard.ts`

### 3.2 [MODIFY] 수정

- `apps/backend/prisma/schema.prisma` — `BodyComposition` 모델 추가, `User.bodyCompositions BodyComposition[]` 역참조 추가.
- `apps/backend/src/app.module.ts` — `BodyCompositionModule`, `DashboardModule` import.
- `apps/mobile/app/(tabs)/my/_layout.tsx` — `dashboard.tsx`, `body.tsx` 탭 라우터 등록.
- `apps/mobile/package.json` — `react-native-gifted-charts` v1.4.x 의존성 추가.

### 3.3 [DEPENDS-ON] 종속

- SPEC-AUTH-001 (JwtAuthGuard, @CurrentUser)
- SPEC-USER-001 (User 모델)
- SPEC-EXERCISE-001 (Exercise.slug)
- SPEC-1RM-001 (CompoundType enum, calculateEpley)
- SPEC-WORKOUT-001 (WorkoutSession, WorkoutSet + isCompleted/rpe, COMPOUND_EXERCISE_SLUG_MAP)

### 3.4 [BLOCKED-BY] 구현 순서

- SPEC-WORKOUT-001 RUN 완료 후 본 SPEC RUN 시작. 또는 Step A(체성분만, SPEC-WORKOUT-001 무관) / Step B(1RM 이력, 볼륨, 빈도, SPEC-WORKOUT-001 의존)로 분리.

---

## 4. 제외 사항 (Exclusions - What NOT to Build)

1. **`OneRepMaxHistory` 별도 이력 테이블 신설** — `WorkoutSet` 계산으로 대체.
2. **운동 기록 캘린더/리스트 뷰 (`records.tsx`)** — 후속 SPEC.
3. **데이터 내보내기 (CSV, JSON)**.
4. **WebSocket/SSE 실시간 차트 업데이트**.
5. **소셜 공유 / 친구 비교 / 공개 리더보드**.
6. **체성분 사진 첨부 (인바디 측정지)**.
7. **단위 변환 (lb/kg, in/cm)** — kg/% 통일.
8. **AI 기반 체성분 추세 분석·추천**.
9. **요일별/시간대별 운동 분석**.
10. **체성분 수정 (`PATCH`/`PUT`)** — 본 SPEC은 POST/GET/DELETE만.
11. **체성분 측정 알림/리마인더 푸시**.
12. **자동 체성분 추정 (BMI/체지방률 공식)**.
13. **보디웨이트 운동 환산 볼륨** (REQ-DASH-VOL-004 명시).
14. **차트 인터랙션 (확대/축소, 데이터 포인트 툴팁)**.

---

## 5. 핵심 결정 요약

- 1RM 이력은 `WorkoutSet`에서 계산 (NO history table).
- 컴파운드 매핑은 `COMPOUND_EXERCISE_SLUG_MAP` 재사용 (중복 정의 금지).
- 차트 라이브러리: `react-native-gifted-charts` v1.4.x (Expo Managed 호환, pure JS).
- 주의 시작: 월요일 UTC (`DATE_TRUNC('week', ...)`).
- 삭제 권한 위반은 `404` 반환 (NOT 403, OWASP A01).
- TanStack Query `staleTime: 5min`.
- 응답 시간 P95: 4종 대시보드 ≤ 500ms, body-composition CRUD ≤ 200ms.
