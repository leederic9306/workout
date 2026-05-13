---
id: SPEC-DASHBOARD-001
version: "1.0.1"
status: draft
created_at: "2026-05-12"
updated_at: "2026-05-12"
author: leederic9306
priority: high
issue_number: 0
labels: ["dashboard", "body-composition", "charts", "backend", "mobile"]
---

# SPEC-DASHBOARD-001: 대시보드 및 체성분 관리 (Dashboard & Body Composition Management)

## HISTORY

- 2026-05-12 v1.0.1 (draft): Plan-audit review-1 피드백 반영 (leederic9306). 다음 결함을 수정: (D1/D4) REQ-DASH-BODY-013의 미결 정책을 "초과 자릿수 입력 시 400 Bad Request 반환, 절삭 금지"로 확정하고 tool name(`class-transformer`) 제거; (D2) REQ-DASH-BODY-012 및 §5.1 API 표의 `recordedAt` 허용 오차를 "`now()` 기준 1분 초과 미래 시 400, 1분 이내 미래 및 모든 과거 허용"으로 명확화; (D3) REQ-DASH-VOL-001에서 `DATE_TRUNC` 구현 디테일 제거, "월요일 00:00 UTC 기준" 행동 수준 기술로 대체; (D7) 트레이서빌리티 매트릭스에 REQ-DASH-1RM-007/008의 AC ID(`AC-DASH-CONSISTENCY-EPLEY-01`, `AC-DASH-CONSISTENCY-MAP-01`) 추가; (D8) REQ-DASH-FREQ-001에 "월요일 00:00 UTC" 주 시작 기준 명시; (D9) REQ-DASH-BODY-003에 `limit` 최솟값(`1`) 명시; (D11) 도메인 네임스페이스 REQ 번호 체계 표기 강화; (D12) REQ-DASH-VOL-003 / REQ-DASH-FREQ-003에 경계값 `weeks=4`, `weeks=52` inclusive 명시.
- 2026-05-12 v1.0.0 (draft): 초기 작성 (leederic9306). 근력 운동 트래커 앱의 Phase 5 마지막 SPEC으로, 체성분(weight/muscleMass/bodyFatPct) 입력·이력 관리와 4종 대시보드 차트(1RM 이력, 체성분 이력, 주간 볼륨, 운동 빈도)를 EARS 형식으로 정의한다. SPEC-AUTH-001(JWT/RBAC), SPEC-USER-001(User profile), SPEC-EXERCISE-001(Exercise 도감 + 5종 컴파운드 식별), SPEC-1RM-001(OneRepMax 테이블 + Epley/Brzycki 공식), SPEC-WORKOUT-001(WorkoutSession/WorkoutSet + `COMPOUND_EXERCISE_SLUG_MAP`) 위에서 동작한다. 신규 `BodyComposition` Prisma 모델을 추가하며, 1RM 이력 차트는 별도 history 테이블을 만들지 않고 완료된 `WorkoutSet` 데이터로부터 Epley 공식 기반 추정 1RM을 세션 단위로 산출한다. 모든 엔드포인트는 `JwtAuthGuard`로 보호된다.

---

## REQ 번호 체계 안내 (Numbering Convention)

본 SPEC은 다른 모든 프로젝트 SPEC(SPEC-AUTH-001, SPEC-USER-001, SPEC-EXERCISE-001, SPEC-1RM-001, SPEC-WORKOUT-001, SPEC-PROGRAM-001 등)과 **동일하게 도메인 네임스페이스 기반 REQ 번호 체계**를 사용한다. 이는 본 프로젝트 전반의 공식 표준이며, 각 네임스페이스 내에서 순차 번호가 보장된다. 단일 flat 시퀀스(`REQ-001`, `REQ-002` ...)로 재번호하지 않는다.

본 SPEC은 다음 네임스페이스를 사용한다:

- `REQ-DASH-BODY-NNN`: 체성분 CRUD (POST/GET/DELETE `/users/me/body-composition`)
- `REQ-DASH-1RM-NNN`: 1RM 이력 집계 (`GET /dashboard/1rm-history`)
- `REQ-DASH-VOL-NNN`: 주간 볼륨 집계 (`GET /dashboard/weekly-volume`)
- `REQ-DASH-FREQ-NNN`: 운동 빈도 집계 (`GET /dashboard/workout-frequency`)
- `REQ-DASH-BTREND-NNN`: 체성분 추세 집계 (`GET /dashboard/body-composition`)
- `REQ-DASH-MOBILE-NNN`: 모바일 화면·차트 UI
- `NFR-DASH-*`: 비기능 요구사항 (성능, 보안, 데이터 무결성, 모바일 호환성)

각 네임스페이스 내에서 번호는 순차적이고 빠짐없이 부여된다.

---

## 1. 개요 (Overview)

근력 운동 트래커 앱의 **대시보드 시각화 및 체성분 관리 시스템**을 정의한다. 본 SPEC은 Phase 5의 마지막 SPEC으로, 사용자가 자신의 신체 변화(체중, 골격근량, 체지방률)와 운동 진행도(1RM 변화, 주간 볼륨, 운동 빈도)를 시계열 차트로 한눈에 파악할 수 있게 한다.

본 SPEC은 다음 두 개의 독립된 도메인을 함께 다룬다:

1. **체성분 관리 (Body Composition CRUD)**: 사용자가 본인의 체성분 데이터를 직접 기록·조회·삭제할 수 있는 표준 CRUD 인터페이스를 제공한다. 신규 `BodyComposition` Prisma 모델을 추가하며, 한 사용자가 여러 측정 기록을 시계열로 누적할 수 있다(이력 테이블 패턴).
2. **대시보드 집계 엔드포인트 (Dashboard Aggregations)**: 4종 차트를 위한 읽기 전용 집계 엔드포인트를 별도 모듈(`DashboardModule`)로 제공한다. 데이터 소스는 기존 테이블(`WorkoutSession`, `WorkoutSet`, `BodyComposition`)이며 별도의 집계용 테이블·캐시는 도입하지 않는다.

### 핵심 가치

- **체성분 기록의 단순 CRUD**: 측정값이 비어 있어도(`muscleMass`/`bodyFatPct` 선택) 무게(`weight`)만으로 기록 가능. 과거 측정 시각(`recordedAt`)을 사용자가 지정할 수 있어 기기에서 측정한 데이터를 사후 입력하는 사용 패턴을 지원한다.
- **이력 테이블 없이 1RM 추세 시각화**: SPEC-1RM-001은 컴파운드별 최신 1RM 1건만 유지하며 이력을 가지지 않는다(SPEC-1RM-001 제외 사항 8). 본 SPEC은 완료된 `WorkoutSet`(`weight IS NOT NULL`, `reps IS NOT NULL`, `isCompleted = true`)에서 컴파운드 운동에 해당하는 세트의 best set(=세션 내 가장 높은 추정 1RM을 만드는 세트)을 골라 Epley 공식으로 추정 1RM을 산출하고, 세션 완료일(`WorkoutSession.completedAt`) 기준 시계열을 반환한다. 이로써 별도의 `OneRepMaxHistory` 테이블 없이 1RM 변화 그래프를 그릴 수 있다.
- **TanStack Query 캐싱**: 모바일은 4종 차트 데이터를 `staleTime: 5min`으로 캐싱하여 화면 전환 시 즉시 표시한다. 체성분 입력 후 관련 차트는 `invalidateQueries`로 자동 무효화된다.
- **Expo 호환 차트 라이브러리**: `react-native-gifted-charts`(pure JS, Expo 호환, 네이티브 모듈 설치 불필요)를 채택한다. Reanimated, Skia 같은 추가 네이티브 의존성을 도입하지 않는다.

### 범위

본 SPEC은 다음을 포괄한다:

- 백엔드: `BodyComposition` Prisma 모델 신설, `BodyCompositionModule` 신설(`POST` / `GET` / `DELETE /users/me/body-composition`), `DashboardModule` 신설(4종 집계 엔드포인트), 1RM 추정값 산출을 위한 `WorkoutSet` JOIN 쿼리.
- 모바일: 체성분 입력·이력 화면(`app/(tabs)/my/body.tsx`), 대시보드 화면(`app/(tabs)/my/dashboard.tsx`), 4종 차트 컴포넌트(`components/charts/*`), API 서비스 모듈(`services/body-composition.ts`, `services/dashboard.ts`), TanStack Query 훅(`hooks/useBodyComposition.ts`, `hooks/useDashboard.ts`).
- 공유: `packages/types`에 응답 타입 추가, `packages/utils/src/1rm.ts`의 기존 Epley 함수 재사용.

다음 항목은 명시적으로 제외된다 (Section 7 참조). 핵심 제외 사항은 다음과 같다:

- `OneRepMaxHistory` 별도 이력 테이블 신설 — `WorkoutSet` 계산으로 대체.
- 운동 기록 캘린더/리스트 뷰(`records.tsx`) — 후속 SPEC에서 검토.
- 데이터 내보내기(CSV/JSON 다운로드).
- WebSocket/SSE 기반 실시간 차트 업데이트.
- 소셜 공유(타 사용자와의 비교, 공개 프로필).

---

## 2. 목표와 비목표 (Goals & Non-Goals)

### 2.1 목표 (Goals)

1. 인증된 사용자가 `POST /users/me/body-composition`로 자신의 체성분 측정값(`weight`, 선택적 `muscleMass`/`bodyFatPct`, 선택적 `recordedAt`)을 기록할 수 있게 한다. 한 사용자가 동일 시점·다른 시점에 여러 건을 기록할 수 있다(이력 누적).
2. 인증된 사용자가 `GET /users/me/body-composition`로 자신의 체성분 이력을 `recordedAt` 내림차순(최신순)으로 페이지네이션 조회할 수 있게 한다.
3. 인증된 사용자가 `DELETE /users/me/body-composition/:id`로 자신이 기록한 특정 체성분 측정값을 삭제할 수 있게 한다. 다른 사용자의 데이터는 삭제할 수 없다.
4. 인증된 사용자가 `GET /dashboard/1rm-history?exerciseType=&period=`로 특정 컴파운드 운동의 시계열 추정 1RM을 조회할 수 있게 한다. 데이터 소스는 완료된 `WorkoutSet`이며, 별도의 1RM 이력 테이블은 만들지 않는다.
5. 인증된 사용자가 `GET /dashboard/body-composition?period=`로 자신의 체성분(`weight`, `muscleMass`, `bodyFatPct`) 시계열 추세를 조회할 수 있게 한다.
6. 인증된 사용자가 `GET /dashboard/weekly-volume?weeks=`로 주간 단위로 집계된 총 운동 볼륨(`SUM(weight * reps)`)을 조회할 수 있게 한다.
7. 인증된 사용자가 `GET /dashboard/workout-frequency?weeks=`로 주간 단위 완료된 운동 세션 수를 조회할 수 있게 한다.
8. 모든 대시보드·체성분 엔드포인트는 `JwtAuthGuard`로 보호되며, 사용자는 JWT의 `sub`(본인 ID)에 대해서만 작업할 수 있다(타 사용자 데이터 격리).
9. 모바일 클라이언트는 `react-native-gifted-charts`로 4종 차트(`OneRepMaxChart`, `BodyCompositionChart`, `WeeklyVolumeChart`, `WorkoutFrequencyChart`)를 렌더링하고, 대시보드 화면에서 기간 필터(`1m`/`3m`/`6m`/`1y`)를 제공한다.
10. 4종 대시보드 집계 응답 시간 P95 ≤ 500ms를 만족한다(단일 사용자, 1년치 데이터 기준).

### 2.2 비목표 (Non-Goals)

- `OneRepMaxHistory` 별도 이력 테이블 신설은 본 SPEC 범위 밖이다. 1RM 추세는 `WorkoutSet`에서 계산한다.
- 운동 기록 캘린더 뷰(`app/(tabs)/my/records.tsx`)는 본 SPEC 범위 밖이다. 후속 SPEC에서 검토.
- 데이터 내보내기(CSV, JSON 다운로드)는 본 SPEC 범위 밖이다.
- WebSocket/SSE 기반 실시간 차트 업데이트는 본 SPEC 범위 밖이다. 차트는 풀(pull) 기반 갱신만 지원한다.
- 소셜 공유, 친구와의 비교, 공개 리더보드는 본 SPEC 범위 밖이다.
- 체성분의 사진 첨부(인바디 측정지 이미지 업로드)는 본 SPEC 범위 밖이다.
- 단위 변환(파운드/lb, 인치/in)은 본 SPEC 범위 밖이다. 모든 체중은 kg, 체지방률은 % 단위로 통일한다.
- AI 기반 체성분 추세 분석·추천은 본 SPEC 범위 밖이다.
- 운동 빈도 외 시간대별 운동 분석(요일별, 시간대별 분포)은 본 SPEC 범위 밖이다.

---

## 3. EARS 요구사항 (Requirements)

### 3.1 REQ-DASH-BODY: 체성분 CRUD

**REQ-DASH-BODY-001** (Event-Driven)
인증된 사용자가 `POST /users/me/body-composition` 요청을 본문 `{ weight: <number>, muscleMass?: <number>, bodyFatPct?: <number>, recordedAt?: <ISO 8601 string> }`와 함께 보냈을 때, 시스템은 `BodyComposition` 레코드를 생성하고 `201 Created`로 생성된 레코드를 반환해야 한다. `userId`는 JWT의 `sub`로 설정되며, `recordedAt`이 본문에 없으면 `now()`를 사용한다.

**REQ-DASH-BODY-002** (Ubiquitous)
시스템은 `POST /users/me/body-composition` 응답으로 다음 필드를 포함하는 JSON을 반환해야 한다: `id`, `weight`, `muscleMass`(없으면 `null`), `bodyFatPct`(없으면 `null`), `recordedAt`(ISO 8601), `createdAt`(ISO 8601). `userId`는 응답에서 제외한다(사용자별 격리된 응답이므로 노출 불필요).

**REQ-DASH-BODY-003** (Event-Driven)
인증된 사용자가 `GET /users/me/body-composition?limit=<int>&cursor=<string>` 요청을 보냈을 때, 시스템은 해당 사용자의 `BodyComposition` 레코드를 `recordedAt` **내림차순**으로 페이지네이션하여 `200 OK`로 반환해야 한다. `limit`은 `1` 이상 `100` 이하 정수이며 기본값은 `20`이다. `limit=0`, 음수, `100`을 초과하는 값, 또는 정수가 아닌 값은 `400 Bad Request`를 반환한다. `cursor`는 직전 페이지 마지막 레코드의 `id`이다.

**REQ-DASH-BODY-004** (Ubiquitous)
시스템은 `GET /users/me/body-composition` 응답으로 다음 구조를 반환해야 한다: `{ items: BodyComposition[], nextCursor: string | null }`. `nextCursor`는 다음 페이지가 존재하지 않으면 `null`이다.

**REQ-DASH-BODY-005** (Event-Driven)
인증된 사용자가 `DELETE /users/me/body-composition/:id` 요청을 보냈을 때, 시스템은 본인 소유(`userId == JWT.sub`)인 `BodyComposition` 레코드를 삭제하고 `204 No Content`를 반환해야 한다.

**REQ-DASH-BODY-006** (Event-Driven)
사용자가 `DELETE /users/me/body-composition/:id`로 본인 소유가 아닌(`userId != JWT.sub`) 레코드 또는 존재하지 않는 `id`로 삭제 요청을 보냈을 때, 시스템은 두 경우 모두 `404 Not Found`를 반환해야 한다(존재 여부 노출 차단을 위해 403과 404를 통합한다).

**REQ-DASH-BODY-007** (Unwanted)
시스템이 `POST /users/me/body-composition`, `GET /users/me/body-composition`, `DELETE /users/me/body-composition/:id` 요청을 처리할 때, 시스템은 JWT `sub`와 다른 `userId`의 `BodyComposition` 데이터에 접근하거나 노출하지 않아야 한다. 대상 사용자는 JWT의 `sub`로만 결정되며, 다른 사용자 ID를 지정할 수 있는 쿼리/path parameter 분기를 제공하지 않는다.

**REQ-DASH-BODY-008** (Ubiquitous)
시스템은 모든 체성분 엔드포인트를 `JwtAuthGuard`로 보호하여 JWT가 없거나 만료된 경우 `401 Unauthorized`를 반환해야 한다.

**REQ-DASH-BODY-009** (Event-Driven, 입력 검증)
사용자가 `POST /users/me/body-composition`의 본문 `weight`에 `40.0` 미만 또는 `300.0` 초과 값을 지정했거나 양수가 아닌 값을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다. 허용 범위는 `40.0 <= weight <= 300.0` (kg)이다.

**REQ-DASH-BODY-010** (Event-Driven, 입력 검증)
사용자가 `POST /users/me/body-composition`의 본문 `muscleMass`에 양수가 아니거나 `weight`를 초과하는 값을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다. 허용 범위는 `0 < muscleMass <= weight`이다.

**REQ-DASH-BODY-011** (Event-Driven, 입력 검증)
사용자가 `POST /users/me/body-composition`의 본문 `bodyFatPct`에 `1.0` 미만 또는 `60.0` 초과 값을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다. 허용 범위는 `1.0 <= bodyFatPct <= 60.0` (%)이다.

**REQ-DASH-BODY-012** (Event-Driven, 입력 검증)
사용자가 `POST /users/me/body-composition`의 본문 `recordedAt`이 현재 시각(`now()`)보다 **1분을 초과하는 미래 시각**이거나 ISO 8601 형식이 아닌 값을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다. 현재 시각 기준 1분 이내의 미래 및 모든 과거 시각은 허용한다(클라이언트-서버 간 시계 편차 보정 및 사후 입력 패턴 지원).

**REQ-DASH-BODY-013** (Event-Driven, 소수점 자릿수)
시스템은 `weight`/`muscleMass`(`Decimal(5,2)`, 소수 2자리), `bodyFatPct`(`Decimal(4,1)`, 소수 1자리) 정밀도로 저장해야 한다. 사용자가 `POST /users/me/body-composition`의 본문에서 `weight` 또는 `muscleMass`의 소수점이 2자리를 초과하거나, `bodyFatPct`의 소수점이 1자리를 초과하는 값을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다. 시스템은 입력값을 절삭(truncation) 또는 반올림하여 저장하지 않는다(SPEC-1RM-001 REQ-ORM-VAL-008 거부 정책 패턴과 일관).

### 3.2 REQ-DASH-1RM: 1RM 이력 집계 (WorkoutSet 계산)

**REQ-DASH-1RM-001** (Event-Driven)
인증된 사용자가 `GET /dashboard/1rm-history?exerciseType=<CompoundType>&period=<period>` 요청을 보냈을 때, 시스템은 해당 사용자의 완료된 `WorkoutSession`(`status = COMPLETED`)에 속한 완료된 `WorkoutSet`(`isCompleted = true`, `weight IS NOT NULL`, `reps IS NOT NULL`) 중 `exerciseType`에 매핑된 컴파운드 운동(`Exercise.slug ∈ COMPOUND_EXERCISE_SLUG_MAP`)의 세트로부터 Epley 공식 추정 1RM을 계산하여 시계열로 `200 OK` 반환해야 한다.

**REQ-DASH-1RM-002** (Ubiquitous, 집계 단위)
시스템은 `GET /dashboard/1rm-history` 응답에서 **세션 단위**로 1건의 시계열 포인트를 만들어야 한다. 한 세션 내 해당 컴파운드의 여러 세트가 있을 때, 각 세트의 Epley 추정 1RM(`weight * (1 + reps / 30)`)을 계산하고 **최댓값(best set 기준)**을 그 세션의 추정 1RM으로 채택한다.

**REQ-DASH-1RM-003** (Ubiquitous, 응답 구조)
시스템은 `GET /dashboard/1rm-history` 응답으로 다음 구조를 반환해야 한다: `{ exerciseType: <CompoundType>, period: <period>, points: Array<{ sessionId: string, completedAt: ISO 8601, estimated1RM: number }> }`. `points`는 `completedAt` 오름차순(시간 순)으로 정렬한다.

**REQ-DASH-1RM-004** (Event-Driven, period 파라미터)
사용자가 `period` 쿼리 파라미터에 `1m` / `3m` / `6m` / `1y` 외의 값을 지정하거나 누락했을 때, 시스템은 누락 시 기본값 `3m`을 적용하고, 잘못된 값에 대해서는 `400 Bad Request`를 반환해야 한다. 각 값의 의미: `1m`=현재 시점으로부터 30일, `3m`=90일, `6m`=180일, `1y`=365일.

**REQ-DASH-1RM-005** (Event-Driven, exerciseType 검증)
사용자가 `exerciseType` 쿼리 파라미터에 `CompoundType` enum(`SQUAT` | `DEADLIFT` | `BENCH_PRESS` | `BARBELL_ROW` | `OVERHEAD_PRESS`)에 정의되지 않은 값을 지정하거나 누락했을 때, 시스템은 `400 Bad Request`를 반환해야 한다.

**REQ-DASH-1RM-006** (Event-Driven, 데이터 없음)
사용자가 `GET /dashboard/1rm-history?exerciseType=SQUAT&period=3m` 요청을 보냈을 때 해당 기간 내 완료된 컴파운드 세트가 0건이라면, 시스템은 `200 OK`와 `{ exerciseType: "SQUAT", period: "3m", points: [] }`를 반환해야 한다. `404`로 처리하지 않는다.

**REQ-DASH-1RM-007** (Ubiquitous, Epley 공식 일관성)
시스템은 본 엔드포인트의 1RM 추정 계산이 `packages/utils/src/1rm.ts`의 `calculateEpley(weight, reps)` 함수 또는 동등 알고리즘(`weight * (1 + reps / 30)`)을 따라야 한다. SPEC-1RM-001 REQ-ORM-CALC-005와 일관된 결과를 보장한다.

**REQ-DASH-1RM-008** (Ubiquitous, 컴파운드 식별)
시스템은 `Exercise.slug ↔ CompoundType` 매핑을 SPEC-WORKOUT-001 `apps/backend/src/workouts/compound-exercise.map.ts`의 `COMPOUND_EXERCISE_SLUG_MAP` 상수를 통해 수행해야 한다. 본 SPEC은 새로운 매핑 정의를 만들지 않고 SPEC-WORKOUT-001의 매핑을 import하여 재사용한다.

**REQ-DASH-1RM-009** (Unwanted, reps 범위 제약)
시스템이 추정 1RM 계산 시, `WorkoutSet.reps`가 `1` 미만이거나 `10` 초과인 세트는 계산에서 제외해야 한다(SPEC-1RM-001 REQ-ORM-VAL-004와 일관, Epley 공식이 10reps 이내에서 합리적 정확도). 결과적으로 해당 세션에 유효 세트가 없으면 그 세션은 응답 `points`에 포함하지 않는다.

### 3.3 REQ-DASH-VOL: 주간 볼륨 집계

**REQ-DASH-VOL-001** (Event-Driven)
인증된 사용자가 `GET /dashboard/weekly-volume?weeks=<int>` 요청을 보냈을 때, 시스템은 해당 사용자의 완료된 `WorkoutSession`에 속한 완료된 `WorkoutSet`(`isCompleted = true`, `weight IS NOT NULL`, `reps IS NOT NULL`)의 `SUM(weight * reps)`를 **월요일 00:00 UTC를 기준으로 주(week) 단위로 집계**하여 `200 OK`로 반환해야 한다.

**REQ-DASH-VOL-002** (Ubiquitous, 응답 구조)
시스템은 `GET /dashboard/weekly-volume` 응답으로 다음 구조를 반환해야 한다: `{ weeks: <int>, points: Array<{ weekStart: ISO 8601 date, totalVolume: number, sessionCount: int }> }`. `points`는 `weekStart` 오름차순으로 정렬하며, 데이터가 0인 주(week)도 결과에 포함하여 차트의 X축이 끊기지 않도록 보장한다.

**REQ-DASH-VOL-003** (Event-Driven, weeks 검증)
사용자가 `weeks` 쿼리 파라미터에 정수 `4` 미만, `52` 초과, 또는 정수가 아닌 값을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다. 누락 시 기본값 `12`를 적용한다. 허용 범위는 `4 ≤ weeks ≤ 52` 정수이며, 경계값인 `weeks=4`와 `weeks=52`는 **모두 허용된다(inclusive)**.

**REQ-DASH-VOL-004** (Unwanted, 보디웨이트 운동 제외)
시스템이 주간 볼륨을 집계할 때, `weight IS NULL`인 세트(예: 풀업, 딥스 등 보디웨이트 운동)는 합계 계산에서 제외해야 한다. 본 SPEC은 보디웨이트 운동의 환산 볼륨(체중 기반 추정) 산출을 다루지 않는다.

**REQ-DASH-VOL-005** (Ubiquitous)
시스템은 `totalVolume` 값을 소수 2자리로 반올림한 `number`로 반환해야 한다(`Math.round(x * 100) / 100`).

### 3.4 REQ-DASH-FREQ: 운동 빈도 집계

**REQ-DASH-FREQ-001** (Event-Driven)
인증된 사용자가 `GET /dashboard/workout-frequency?weeks=<int>` 요청을 보냈을 때, 시스템은 해당 사용자의 완료된 `WorkoutSession`(`status = COMPLETED`, `completedAt IS NOT NULL`) 개수를 **월요일 00:00 UTC를 기준으로 주(week) 단위로 집계**하여 `200 OK`로 반환해야 한다. 주(week)의 시작 기준은 REQ-DASH-VOL-001과 동일하다.

**REQ-DASH-FREQ-002** (Ubiquitous, 응답 구조)
시스템은 `GET /dashboard/workout-frequency` 응답으로 다음 구조를 반환해야 한다: `{ weeks: <int>, points: Array<{ weekStart: ISO 8601 date, sessionCount: int }> }`. `points`는 `weekStart` 오름차순으로 정렬하며, 데이터가 0인 주도 결과에 포함한다.

**REQ-DASH-FREQ-003** (Event-Driven, weeks 검증)
사용자가 `weeks` 쿼리 파라미터에 정수 `4` 미만, `52` 초과, 또는 정수가 아닌 값을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다. 누락 시 기본값 `12`를 적용한다. 허용 범위는 `4 ≤ weeks ≤ 52` 정수이며, 경계값인 `weeks=4`와 `weeks=52`는 **모두 허용된다(inclusive)**. REQ-DASH-VOL-003과 동일한 범위 규칙을 적용한다.

**REQ-DASH-FREQ-004** (Unwanted, 취소 세션 제외)
시스템이 운동 빈도를 집계할 때, `status = CANCELLED`인 세션과 `status = IN_PROGRESS`인 세션은 계산에서 제외해야 한다. 오직 `COMPLETED`이며 `completedAt IS NOT NULL`인 세션만 카운트한다.

### 3.5 REQ-DASH-BTREND: 체성분 추세 집계

**REQ-DASH-BTREND-001** (Event-Driven)
인증된 사용자가 `GET /dashboard/body-composition?period=<period>` 요청을 보냈을 때, 시스템은 해당 사용자의 `BodyComposition` 레코드 중 `recordedAt`이 지정된 기간(`1m`/`3m`/`6m`/`1y`) 내에 있는 모든 측정값을 `recordedAt` 오름차순으로 `200 OK` 반환해야 한다. 누락 시 기본값 `3m`을 적용한다.

**REQ-DASH-BTREND-002** (Ubiquitous, 응답 구조)
시스템은 `GET /dashboard/body-composition` 응답으로 다음 구조를 반환해야 한다: `{ period: <period>, points: Array<{ recordedAt: ISO 8601, weight: number, muscleMass: number | null, bodyFatPct: number | null }> }`. 측정 시 일부 필드만 기록된 경우 해당 필드는 `null`로 반환한다.

**REQ-DASH-BTREND-003** (Event-Driven, period 검증)
사용자가 `period` 쿼리 파라미터에 정의된 값(`1m` / `3m` / `6m` / `1y`) 외의 값을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다.

**REQ-DASH-BTREND-004** (Event-Driven, 데이터 없음)
사용자가 요청한 기간 내 `BodyComposition` 레코드가 0건이라면, 시스템은 `200 OK`와 `{ period: <period>, points: [] }`를 반환해야 한다. `404`로 처리하지 않는다.

### 3.6 REQ-DASH-MOBILE: 모바일 화면 및 차트

**REQ-DASH-MOBILE-001** (Ubiquitous, 체성분 화면)
모바일 클라이언트의 `app/(tabs)/my/body.tsx` 화면은 다음을 제공해야 한다: (a) 체성분 입력 폼(`weight` 필수, `muscleMass`/`bodyFatPct` 선택, `recordedAt` 기본 오늘), (b) 본인의 체성분 이력 리스트(`GET /users/me/body-composition`, 페이지네이션), (c) 각 이력 항목에 대한 삭제 버튼(`DELETE /users/me/body-composition/:id`).

**REQ-DASH-MOBILE-002** (Ubiquitous, 대시보드 화면)
모바일 클라이언트의 `app/(tabs)/my/dashboard.tsx` 화면은 4종 차트(`OneRepMaxChart`, `BodyCompositionChart`, `WeeklyVolumeChart`, `WorkoutFrequencyChart`)를 한 화면에 표시하고, 화면 상단에 기간 필터(`1m`/`3m`/`6m`/`1y` 토글)를 제공해야 한다. 기간 필터 변경 시 4종 차트 모두를 invalidate하여 새 데이터를 조회한다.

**REQ-DASH-MOBILE-003** (Ubiquitous, 차트 라이브러리)
모바일 클라이언트의 차트 컴포넌트는 `react-native-gifted-charts`(latest stable, v1.4.x 라인) 라이브러리로 구현해야 한다. Reanimated, Skia 같은 추가 네이티브 의존성을 도입하지 않으며, Expo Managed Workflow 환경에서 추가 네이티브 모듈 설치 없이 동작해야 한다.

**REQ-DASH-MOBILE-004** (Ubiquitous, 차트 매핑)
- `OneRepMaxChart` 컴포넌트는 `GET /dashboard/1rm-history` 응답을 **라인 차트**로 렌더링한다(컴파운드 종목 선택 토글 제공).
- `BodyCompositionChart` 컴포넌트는 `GET /dashboard/body-composition` 응답을 **3선 라인 차트**(weight/muscleMass/bodyFatPct)로 렌더링한다. `null` 데이터 포인트는 선을 끊지 않고 보간 처리한다.
- `WeeklyVolumeChart` 컴포넌트는 `GET /dashboard/weekly-volume` 응답을 **바 차트**로 렌더링한다.
- `WorkoutFrequencyChart` 컴포넌트는 `GET /dashboard/workout-frequency` 응답을 **바 차트**로 렌더링한다.

**REQ-DASH-MOBILE-005** (Ubiquitous, TanStack Query 캐싱)
모바일 클라이언트는 TanStack Query를 사용하여 4종 대시보드 엔드포인트와 `GET /users/me/body-composition`을 `staleTime: 5 * 60 * 1000` (5분)으로 캐싱해야 한다. `POST /users/me/body-composition` 성공 시 `queryClient.invalidateQueries(['body-composition'])` 및 `queryClient.invalidateQueries(['dashboard', 'body-composition'])`로 관련 캐시를 무효화한다.

**REQ-DASH-MOBILE-006** (Event-Driven, 빈 데이터 표시)
대시보드 차트에 표시할 데이터가 없을 때(`points: []`), 시스템은 차트 영역에 "기록된 데이터가 없습니다" 같은 안내 메시지를 표시해야 한다. 차트 라이브러리에 빈 배열을 그대로 전달하여 크래시가 발생하지 않도록 방어한다.

### 3.7 NFR-DASH: 비기능 요구사항

#### NFR-DASH-PERF: 성능

- **NFR-DASH-PERF-001**: 4종 대시보드 집계 엔드포인트(`GET /dashboard/*`)의 응답 시간 P95 ≤ 500ms (단일 사용자, 12주~52주 데이터, 사용자당 누적 세션 ≤ 500건 기준).
- **NFR-DASH-PERF-002**: `POST /users/me/body-composition` 응답 시간 P95 ≤ 150ms (단일 INSERT).
- **NFR-DASH-PERF-003**: `GET /users/me/body-composition` 응답 시간 P95 ≤ 200ms (cursor 페이지네이션, limit ≤ 100).
- **NFR-DASH-PERF-004**: `DELETE /users/me/body-composition/:id` 응답 시간 P95 ≤ 150ms.
- **NFR-DASH-PERF-005**: 대시보드 집계 쿼리는 단일 SQL(서브쿼리/JOIN/`DATE_TRUNC` 활용)로 수행하며, N+1 쿼리를 발생시키지 않아야 한다.

#### NFR-DASH-SEC: 보안

- **NFR-DASH-SEC-001**: 모든 체성분·대시보드 엔드포인트는 `JwtAuthGuard`로 보호되며, JWT 누락/만료 시 `401 Unauthorized`를 반환한다.
- **NFR-DASH-SEC-002**: 모든 엔드포인트는 JWT payload의 `sub`(userId)만 사용하며, URL 경로나 쿼리 파라미터로 다른 사용자 ID를 받지 않는다 (REQ-DASH-BODY-007).
- **NFR-DASH-SEC-003**: 응답 본문에 다른 사용자의 데이터, 내부 `userId` 컬럼은 포함하지 않는다(`BodyComposition` 응답에서 `userId` 제거).
- **NFR-DASH-SEC-004**: NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`로 알 수 없는 필드를 차단하고 타입 변환을 수행한다(SPEC-1RM-001 NFR-ORM-SEC-004과 일관). 본 SPEC의 모든 입력 DTO는 `class-validator` 데코레이터로 명시적 검증을 수행한다.
- **NFR-DASH-SEC-005**: `DELETE /users/me/body-composition/:id`는 본인 소유가 아닌 레코드와 존재하지 않는 `id`에 대해 모두 `404`를 반환하여, 존재 여부 노출(Information Disclosure)을 차단한다 (REQ-DASH-BODY-006).

#### NFR-DASH-DATA: 데이터 무결성

- **NFR-DASH-DATA-001**: `BodyComposition` 테이블에 `@@index([userId, recordedAt(sort: Desc)])` 복합 인덱스를 추가하여 페이지네이션 조회 성능을 보장한다.
- **NFR-DASH-DATA-002**: `BodyComposition.userId`의 외래키는 `User.id`를 참조하며 `onDelete: Cascade`로 설정한다(사용자 하드 삭제 시 체성분 데이터 자동 정리). 소프트 삭제(`User.deletedAt`)는 본 SPEC에서 능동적으로 처리하지 않는다.
- **NFR-DASH-DATA-003**: `BodyComposition.weight`는 `Decimal(5,2)`, `muscleMass`는 `Decimal(5,2)?`, `bodyFatPct`는 `Decimal(4,1)?` 타입으로 저장한다. 범위 제약(40~300, 1.0~60.0)은 애플리케이션 레이어(`class-validator`)에서 검증한다.
- **NFR-DASH-DATA-004**: `WorkoutSession(userId, completedAt)`와 `WorkoutSet(sessionId, exerciseId, isCompleted, weight)`에 대한 인덱스가 SPEC-WORKOUT-001에서 이미 정의되어 있다고 가정한다. 추가로 필요한 인덱스는 plan.md에서 식별한다.

#### NFR-DASH-CONSISTENCY: 공유 유틸 일관성

- **NFR-DASH-CONSISTENCY-001**: 본 SPEC의 1RM 추정 계산은 `packages/utils/src/1rm.ts`의 `calculateEpley`를 사용하거나 동일 알고리즘(`weight * (1 + reps / 30)`)을 재구현한다. SPEC-1RM-001 REQ-ORM-CALC-005, SPEC-WORKOUT-001 REQ-WO-1RM-004와 일관된 결과를 보장한다.
- **NFR-DASH-CONSISTENCY-002**: 컴파운드 운동 식별은 SPEC-WORKOUT-001의 `COMPOUND_EXERCISE_SLUG_MAP`을 재사용한다. 본 SPEC은 새로운 매핑 정의를 만들지 않는다.

#### NFR-DASH-MOBILE: 모바일 호환성

- **NFR-DASH-MOBILE-001**: 차트 라이브러리는 `react-native-gifted-charts` v1.4.x 라인을 사용하며, Expo Managed Workflow 환경에서 추가 네이티브 모듈 설치 없이 동작해야 한다.
- **NFR-DASH-MOBILE-002**: 모바일 차트 컴포넌트는 Android 한정 동작을 가정하며, RN 0.74 이상 + Expo SDK 51 이상에서 검증된 동작을 한다.

---

## 4. 데이터 모델 (Data Model)

본 절은 Prisma 스키마 변경 사항을 정의한다. 기존 `prisma/schema.prisma`에 `BodyComposition` 모델을 신규 추가하고, `User` 모델에 역참조를 추가한다. 그 외 기존 모델(`WorkoutSession`, `WorkoutSet`, `OneRepMax`, `Exercise`)은 본 SPEC에서 스키마를 수정하지 않는다.

### 4.1 BodyComposition 모델 (신규)

```prisma
model BodyComposition {
  id         String   @id @default(cuid())
  userId     String
  weight     Decimal  @db.Decimal(5, 2)   // kg, must be 40~300 (애플리케이션 레이어 검증)
  muscleMass Decimal? @db.Decimal(5, 2)   // kg, optional, must be 0 < muscleMass <= weight
  bodyFatPct Decimal? @db.Decimal(4, 1)   // %, optional, must be 1.0~60.0
  recordedAt DateTime @default(now())      // 측정 시각 (과거 시각 허용, 미래 차단)
  createdAt  DateTime @default(now())      // 레코드 생성 시각 (운영 디버깅용)

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, recordedAt(sort: Desc)])  // GET 페이지네이션 + 추세 조회 최적화
}
```

**설계 결정**:
- `id`: `cuid()` — SPEC-AUTH-001/USER-001/EXERCISE-001/1RM-001/WORKOUT-001 패턴과 일관.
- `weight`: `Decimal(5,2)` — 최대 `999.99`까지 표현 가능하지만 애플리케이션 레벨에서 `40~300`으로 제한 (NFR-DASH-DATA-003).
- `muscleMass`, `bodyFatPct`: nullable — 사용자가 일부 필드만 기록할 수 있음(체중계만 있는 사용자 케이스).
- `recordedAt`: 사용자가 본문에서 지정 가능. 누락 시 `now()`. 미래 시각은 REQ-DASH-BODY-012에서 차단.
- `createdAt`: 응답에 포함되지만 정렬/필터에는 사용하지 않음. 시계열 조회의 정렬 기준은 `recordedAt`이다.
- `@@index([userId, recordedAt(sort: Desc)])`: 페이지네이션(`ORDER BY recordedAt DESC`)과 추세 조회(`WHERE recordedAt >= :since`)의 인덱스 커버리지 보장 (NFR-DASH-DATA-001).
- `onDelete: Cascade`: 사용자 하드 삭제 시 자동 정리. 소프트 삭제는 본 SPEC에서 능동 처리하지 않음.

### 4.2 User 모델 (역참조 추가)

```prisma
model User {
  // ... (existing fields from SPEC-AUTH-001 / SPEC-USER-001)
  bodyCompositions  BodyComposition[]
}
```

`User`와 `BodyComposition`은 1:N 관계이며, 한 사용자가 여러 측정 기록을 시계열로 누적할 수 있다.

### 4.3 기존 모델 변경 없음

본 SPEC은 다음 기존 모델을 **참조만 하며 스키마를 변경하지 않는다**:

- `WorkoutSession`: SPEC-WORKOUT-001에서 정의된 그대로 사용. `status = COMPLETED` 및 `completedAt`을 시계열 기준으로 사용.
- `WorkoutSet`: SPEC-WORKOUT-001에서 정의된 그대로 사용. `isCompleted = true`, `weight IS NOT NULL`, `reps IS NOT NULL` 필터로 사용.
- `Exercise`: SPEC-EXERCISE-001에서 정의된 그대로 사용. `slug`로 `COMPOUND_EXERCISE_SLUG_MAP`과 매핑.
- `OneRepMax`, `CompoundType` enum: SPEC-1RM-001에서 정의된 그대로 사용. 1RM 이력은 본 테이블이 아니라 `WorkoutSet`에서 산출.

---

## 5. API 명세 (API Specification)

본 SPEC이 정의하는 7개 엔드포인트의 요청·응답 구조를 명시한다. 모든 엔드포인트는 `JwtAuthGuard`로 보호된다.

### 5.1 POST /users/me/body-composition

**용도**: 체성분 측정값 기록(이력 누적).

**Request Body**:
```json
{
  "weight": 75.2,
  "muscleMass": 32.5,
  "bodyFatPct": 18.3,
  "recordedAt": "2026-05-12T08:30:00.000Z"
}
```

| 필드 | 타입 | 검증 | 설명 |
|---|---|---|---|
| `weight` | number | `40.0 <= weight <= 300.0`, kg | 필수 |
| `muscleMass` | number? | `0 < muscleMass <= weight`, kg | 선택 |
| `bodyFatPct` | number? | `1.0 <= bodyFatPct <= 60.0`, % | 선택 |
| `recordedAt` | ISO 8601? | `now()` 기준 1분을 초과하는 미래 시각이면 400; 1분 이내 미래 및 모든 과거 시각 허용 | 선택, 누락 시 `now()` |

**Response 201 Created**:
```json
{
  "id": "ckxxx",
  "weight": 75.2,
  "muscleMass": 32.5,
  "bodyFatPct": 18.3,
  "recordedAt": "2026-05-12T08:30:00.000Z",
  "createdAt": "2026-05-12T08:30:01.000Z"
}
```

**Error Responses**: `400` (입력 검증 실패 — REQ-DASH-BODY-009/010/011/012), `401`.

### 5.2 GET /users/me/body-composition

**용도**: 본인 체성분 이력 페이지네이션 조회.

**Query Parameters**:

| 필드 | 타입 | 기본 | 설명 |
|---|---|---|---|
| `limit` | int | 20 | `1~100` |
| `cursor` | string? | null | 직전 페이지 마지막 `id` |

**Response 200 OK**:
```json
{
  "items": [
    {
      "id": "ckxxx",
      "weight": 75.2,
      "muscleMass": 32.5,
      "bodyFatPct": 18.3,
      "recordedAt": "2026-05-12T08:30:00.000Z",
      "createdAt": "2026-05-12T08:30:01.000Z"
    }
  ],
  "nextCursor": "ckyyy"
}
```

정렬: `recordedAt DESC`. 마지막 페이지에서는 `nextCursor: null`.

**Error Responses**: `400` (limit 범위 위반), `401`.

### 5.3 DELETE /users/me/body-composition/:id

**용도**: 본인 소유 체성분 레코드 삭제.

**Response 204 No Content**: 본인 소유 레코드 삭제 성공.

**Error Responses**:
- `404 Not Found`: 존재하지 않는 `id` 또는 본인 소유가 아닌 레코드(REQ-DASH-BODY-006, NFR-DASH-SEC-005).
- `401 Unauthorized`: JWT 누락/만료.

### 5.4 GET /dashboard/1rm-history

**용도**: 컴파운드 운동별 추정 1RM 시계열(`WorkoutSet`에서 계산).

**Query Parameters**:

| 필드 | 타입 | 기본 | 설명 |
|---|---|---|---|
| `exerciseType` | `CompoundType` | 필수 | `SQUAT` \| `DEADLIFT` \| `BENCH_PRESS` \| `BARBELL_ROW` \| `OVERHEAD_PRESS` |
| `period` | string | `3m` | `1m`(30일), `3m`(90일), `6m`(180일), `1y`(365일) |

**Response 200 OK**:
```json
{
  "exerciseType": "SQUAT",
  "period": "3m",
  "points": [
    { "sessionId": "csess1", "completedAt": "2026-03-15T19:30:00.000Z", "estimated1RM": 138.33 },
    { "sessionId": "csess2", "completedAt": "2026-04-10T20:15:00.000Z", "estimated1RM": 142.5 }
  ]
}
```

**Behavior**: 세션 단위로 한 점, 세션 내 best set의 Epley 추정 1RM을 채택(REQ-DASH-1RM-002). 1≤reps≤10 외 세트 제외(REQ-DASH-1RM-009). 데이터 없으면 `points: []` (REQ-DASH-1RM-006).

**Error Responses**: `400` (period/exerciseType 검증 실패), `401`.

### 5.5 GET /dashboard/body-composition

**용도**: 체성분 시계열 추세.

**Query Parameters**:

| 필드 | 타입 | 기본 | 설명 |
|---|---|---|---|
| `period` | string | `3m` | `1m` / `3m` / `6m` / `1y` |

**Response 200 OK**:
```json
{
  "period": "3m",
  "points": [
    { "recordedAt": "2026-03-01T08:00:00.000Z", "weight": 76.5, "muscleMass": 32.0, "bodyFatPct": 19.0 },
    { "recordedAt": "2026-04-01T08:00:00.000Z", "weight": 75.8, "muscleMass": 32.3, "bodyFatPct": 18.5 },
    { "recordedAt": "2026-05-01T08:00:00.000Z", "weight": 75.2, "muscleMass": null, "bodyFatPct": null }
  ]
}
```

`recordedAt` 오름차순. 부분 측정값은 `null`로 노출.

**Error Responses**: `400` (period 검증 실패), `401`.

### 5.6 GET /dashboard/weekly-volume

**용도**: 주간 총 운동 볼륨(`SUM(weight * reps)`) 집계.

**Query Parameters**:

| 필드 | 타입 | 기본 | 설명 |
|---|---|---|---|
| `weeks` | int | 12 | `4~52` |

**Response 200 OK**:
```json
{
  "weeks": 12,
  "points": [
    { "weekStart": "2026-02-23", "totalVolume": 5230.0, "sessionCount": 3 },
    { "weekStart": "2026-03-02", "totalVolume": 4810.5, "sessionCount": 2 },
    { "weekStart": "2026-03-09", "totalVolume": 0,      "sessionCount": 0 }
  ]
}
```

주의 시작: 월요일 00:00 UTC (`DATE_TRUNC('week', completedAt)`). 데이터 0인 주도 포함(REQ-DASH-VOL-002). 보디웨이트(`weight IS NULL`) 세트 제외(REQ-DASH-VOL-004).

**Error Responses**: `400` (weeks 범위 위반), `401`.

### 5.7 GET /dashboard/workout-frequency

**용도**: 주간 완료 세션 수 집계.

**Query Parameters**:

| 필드 | 타입 | 기본 | 설명 |
|---|---|---|---|
| `weeks` | int | 12 | `4~52` |

**Response 200 OK**:
```json
{
  "weeks": 12,
  "points": [
    { "weekStart": "2026-02-23", "sessionCount": 3 },
    { "weekStart": "2026-03-02", "sessionCount": 2 }
  ]
}
```

`status = COMPLETED` 세션만 카운트(REQ-DASH-FREQ-004).

**Error Responses**: `400` (weeks 범위 위반), `401`.

---

## 6. 차트 라이브러리 및 모바일 통합 (Chart Library & Mobile Integration)

본 SPEC은 모바일 차트 라이브러리로 **`react-native-gifted-charts`**(v1.4.x 라인)를 채택한다. 선정 이유는 다음과 같다.

### 6.1 선정 기준 평가

| 기준 | react-native-gifted-charts | victory-native | react-native-chart-kit | recharts (web only) |
|---|---|---|---|---|
| Expo Managed 호환 | YES (pure JS) | 부분(skia v40+ 필요) | YES (svg 기반) | NO (RN 미지원) |
| 네이티브 모듈 의존성 | 없음 | Skia 필요 | `react-native-svg` 1건 | — |
| 라인/바 차트 동시 지원 | YES | YES | YES | — |
| 빈 데이터 안전성 | YES (`data: []` 허용) | 부분 | 부분 | — |
| 한국어 라벨/축 커스터마이즈 | YES | YES | YES | — |
| 최근 메인테이너 활성도 | 활발 (v1.4.x) | 활발 | 보통 | 활발 |

**최종 선정**: `react-native-gifted-charts` v1.4.x. Pure JS 구현이어서 Expo Managed Workflow에서 추가 네이티브 모듈 설치(`expo prebuild`)가 필요하지 않다.

### 6.2 차트 컴포넌트 매핑

| 차트 컴포넌트 | gifted-charts API | 데이터 형태 |
|---|---|---|
| `OneRepMaxChart.tsx` | `<LineChart data={...} />` | `[{ value: number, label: string }]` (X=날짜, Y=추정 1RM) |
| `BodyCompositionChart.tsx` | `<LineChart data={...} data2={...} data3={...} />` 또는 세 개의 `<LineChart>` | weight/muscleMass/bodyFatPct 3개 시리즈 |
| `WeeklyVolumeChart.tsx` | `<BarChart data={...} />` | `[{ value: number, label: 'WW' }]` (X=주차, Y=총 볼륨) |
| `WorkoutFrequencyChart.tsx` | `<BarChart data={...} />` | `[{ value: int, label: 'WW' }]` (X=주차, Y=세션 수) |

### 6.3 TanStack Query 캐싱 전략

| Query Key | 데이터 소스 | staleTime | invalidate 트리거 |
|---|---|---|---|
| `['body-composition', { limit, cursor }]` | `GET /users/me/body-composition` | 5분 | `POST` 성공, `DELETE` 성공 |
| `['dashboard', 'body-composition', period]` | `GET /dashboard/body-composition` | 5분 | `POST /users/me/body-composition` 성공, `DELETE` 성공 |
| `['dashboard', '1rm-history', exerciseType, period]` | `GET /dashboard/1rm-history` | 5분 | 세션 완료 후(SPEC-WORKOUT-001의 mutation) |
| `['dashboard', 'weekly-volume', weeks]` | `GET /dashboard/weekly-volume` | 5분 | 세션 완료 후(SPEC-WORKOUT-001) |
| `['dashboard', 'workout-frequency', weeks]` | `GET /dashboard/workout-frequency` | 5분 | 세션 완료 후(SPEC-WORKOUT-001) |

세션 완료 mutation의 invalidate 호출은 본 SPEC의 책임이 아니며, 모바일 측 워크아웃 세션 화면(SPEC-WORKOUT-001 모바일 작업)에서 `['dashboard']` 프리픽스로 일괄 무효화한다(plan.md에서 상세 결정).

---

## 7. 제외 사항 (Exclusions - What NOT to Build)

본 SPEC에서 **명시적으로 제외하는 항목**은 다음과 같다. 이는 후속 SPEC 또는 영구 비목표로 분류된다.

1. **`OneRepMaxHistory` 별도 이력 테이블 신설**: 1RM 변화 추세는 `WorkoutSet`에서 계산하여 산출하며, 별도의 시계열 이력 테이블은 만들지 않는다. SPEC-1RM-001 제외 사항 #2와 일관된다.
2. **운동 기록 캘린더/리스트 뷰 (`records.tsx`)**: 일자별 운동 세션 목록·캘린더 뷰는 본 SPEC 범위 밖이다. 후속 SPEC-RECORDS-001 (가칭)에서 검토. 본 SPEC은 차트와 체성분 입력만 다룬다.
3. **데이터 내보내기 (CSV, JSON 다운로드)**: 사용자가 본인 데이터를 다운로드하는 기능은 본 SPEC 범위 밖이다. GDPR 데이터 이동권 관련 기능은 후속 운영 SPEC에서 검토.
4. **WebSocket/SSE 기반 실시간 차트 업데이트**: 차트는 풀(pull) 기반 갱신만 지원한다. 다중 디바이스 간 실시간 동기화는 본 SPEC 범위 밖이다.
5. **소셜 공유 / 친구와의 비교 / 공개 리더보드**: 다른 사용자와 1RM/체성분/볼륨을 비교하거나 공개 리더보드에 노출하는 기능은 본 SPEC 범위 밖이다.
6. **체성분 사진 첨부 (인바디 측정지 이미지 업로드)**: 측정지 OCR이나 이미지 첨부 기능은 본 SPEC 범위 밖이다.
7. **단위 변환 (lb/kg, in/cm)**: 모든 무게는 kg, 체지방률은 % 단위로 통일한다. 파운드 입력/표시는 본 SPEC 범위 밖이다.
8. **AI 기반 체성분 추세 분석·추천**: "최근 3주간 근손실 위험" 같은 AI 분석은 본 SPEC 범위 밖이다. 후속 SPEC-AI-ANALYSIS-XXX에서 검토.
9. **요일별/시간대별 운동 분석**: 운동 빈도 외 요일별 분포, 시간대별 분포 등 고급 분석은 본 SPEC 범위 밖이다. 본 SPEC은 주간 단위 집계만 제공한다.
10. **체성분 수정(`PATCH` / `PUT`)**: 본 SPEC은 `POST`(생성), `GET`(조회), `DELETE`(삭제)만 제공한다. 잘못 입력한 측정값은 삭제 후 재입력 패턴이다. 후속 SPEC에서 수정 엔드포인트 검토 가능.
11. **체성분 측정 알림/리마인더 푸시**: "이번 주 체성분을 기록하세요" 같은 푸시 알림은 본 SPEC 범위 밖이다.
12. **자동 체성분 추정 (인바디 미보유 사용자)**: BMI/체지방률 추정 공식은 본 SPEC 범위 밖이다.
13. **보디웨이트 운동 환산 볼륨**: 풀업, 딥스 등 보디웨이트 운동의 볼륨을 사용자 체중으로 환산하는 로직은 본 SPEC 범위 밖이다(REQ-DASH-VOL-004 명시).
14. **차트 인터랙션 (확대/축소, 데이터 포인트 툴팁)**: 본 SPEC은 정적 차트 렌더링만 정의한다. 핀치 줌, 데이터 포인트 상세 모달 같은 인터랙션은 후속 UX SPEC에서 검토.

---

## 8. mx_plan (MX Tag Annotation Targets)

### 8.1 @MX:ANCHOR 대상 (high fan_in 함수)

- `body-composition.service.ts :: create(userId, dto)`: 체성분 생성 단일 진입점, `POST /users/me/body-composition`이 의존.
- `body-composition.service.ts :: findManyByUser(userId, pagination)`: 체성분 이력 조회 단일 진입점, `GET /users/me/body-composition`이 의존.
- `body-composition.service.ts :: deleteByOwner(userId, id)`: 본인 소유 삭제 단일 진입점, 권한 격리 불변식 보장.
- `dashboard.service.ts :: get1RMHistory(userId, exerciseType, period)`: 1RM 이력 산출 단일 진입점, 컴파운드 매핑 + Epley 공식 + best-set 선택의 결합 지점.
- `dashboard.service.ts :: getWeeklyVolume(userId, weeks)`: 주간 볼륨 SQL 집계 단일 진입점, `DATE_TRUNC` + `SUM(weight * reps)` 결합.
- `dashboard.service.ts :: getWorkoutFrequency(userId, weeks)`: 주간 빈도 집계 단일 진입점.
- `dashboard.service.ts :: getBodyCompositionTrend(userId, period)`: 체성분 추세 조회 단일 진입점.

### 8.2 @MX:WARN 대상 (danger zone, requires @MX:REASON)

- `dashboard.service.ts :: get1RMHistory()`: best-set 선택 로직(세션 내 여러 세트 중 max Epley 채택)이 SPEC-WORKOUT-001 REQ-WO-1RM-002의 1RM 자동 갱신 로직과 다른 채택 기준일 수 있음 (REASON: 본 SPEC은 시각화용 추정, SPEC-WORKOUT-001은 OneRepMax 상향 갱신용 — 결과가 일관되는지 plan.md에서 명시 결정).
- `dashboard.service.ts :: getWeeklyVolume()`: PostgreSQL `DATE_TRUNC('week', ...)`는 ISO 8601 주(월요일 시작)를 따르나 사용자 로컬 타임존과의 차이로 주차 경계가 어긋날 수 있음 (REASON: 본 SPEC은 UTC 기준 통일 — REQ-DASH-VOL-001).
- `body-composition.controller.ts :: DELETE :id`: 본인 소유가 아닌 레코드에 대해 `403` 대신 `404`를 반환하여 존재 여부 노출 차단 (REASON: NFR-DASH-SEC-005, OWASP A01 Broken Access Control).
- `prisma/schema.prisma :: BodyComposition.bodyFatPct`: `Decimal(4,1)` 정밀도로 인해 `60.0` 입력 시 경계값 검증 필요 (REASON: REQ-DASH-BODY-011, `class-validator @Max(60.0)` 단독으로는 `60.05` 같은 입력이 round-trip으로 통과할 수 있음 — plan.md에서 자릿수 검증 명시).

### 8.3 @MX:NOTE 대상

- `dashboard.controller.ts`: 모든 라우트는 고정 경로(`/dashboard/1rm-history`, `/dashboard/body-composition`, ...)이므로 동적 path parameter 라우트와의 매칭 충돌이 없음 (SPEC-1RM-001 REQ-ORM-VAL-007 교훈 — 본 SPEC은 영향 없음).
- `body-composition.controller.ts`: `:id` 동적 경로 1개만 존재하며 컨트롤러 내 고정 경로는 없음. NestJS 라우트 매칭 충돌 없음.
- `dashboard.service.ts :: get1RMHistory()`: 컴파운드 식별을 `COMPOUND_EXERCISE_SLUG_MAP`(SPEC-WORKOUT-001) import로 수행하며 본 SPEC은 매핑을 재정의하지 않음(NFR-DASH-CONSISTENCY-002).
- `body-composition.dto.ts`: `weight`/`muscleMass`/`bodyFatPct` 범위 검증 데코레이터 모음 (`@Min`, `@Max`, `@IsPositive`, `@IsDecimal({ decimal_digits: '0,1' })`).
- `prisma/schema.prisma`: `BodyComposition` 모델이 신규 추가되며 기존 5개 모델(`User`, `WorkoutSession`, `WorkoutSet`, `Exercise`, `OneRepMax`)은 본 SPEC에서 변경하지 않음.

### 8.4 @MX:TODO 대상 (후속 SPEC에서 해소)

- 운동 기록 캘린더/리스트 뷰(`records.tsx`) — 후속 SPEC-RECORDS-001(가칭)에서 다룸.
- 체성분 수정(`PATCH /users/me/body-composition/:id`) — 후속 SPEC에서 검토.
- AI 기반 체성분 추세 분석 — SPEC-AI-ANALYSIS-XXX(가칭).
- 보디웨이트 운동 환산 볼륨 — 후속 SPEC.
- 데이터 내보내기(CSV/JSON) — 후속 운영 SPEC.
- 단위 변환(lb/kg) — localization SPEC.
- 차트 인터랙션(zoom, tooltip) — 후속 UX SPEC.

---

## 9. 추적성 매트릭스 (Traceability Matrix)

| REQ ID | acceptance.md 시나리오 | 출처 |
|---|---|---|
| REQ-DASH-BODY-001 | AC-DASH-BODY-CREATE-01, AC-DASH-BODY-CREATE-02 | Phase 5 요구사항 (체성분 입력) |
| REQ-DASH-BODY-002 | AC-DASH-BODY-CREATE-01 | API 응답 일관성 |
| REQ-DASH-BODY-003 | AC-DASH-BODY-LIST-01 | 페이지네이션 요구 |
| REQ-DASH-BODY-004 | AC-DASH-BODY-LIST-01 | API 응답 일관성 |
| REQ-DASH-BODY-005 | AC-DASH-BODY-DELETE-01 | 삭제 권한 |
| REQ-DASH-BODY-006 | AC-DASH-BODY-DELETE-NOTFOUND-01, AC-DASH-BODY-SECURITY-01 | OWASP A01 (정보 노출 차단) |
| REQ-DASH-BODY-007 | AC-DASH-BODY-SECURITY-01 | NFR-DASH-SEC-002 |
| REQ-DASH-BODY-008 | AC-DASH-BODY-AUTH-01 | NFR-DASH-SEC-001 |
| REQ-DASH-BODY-009 | AC-DASH-BODY-CREATE-INVALID-01 | 입력 검증 (weight 범위) |
| REQ-DASH-BODY-010 | AC-DASH-BODY-CREATE-INVALID-02 | 입력 검증 (muscleMass) |
| REQ-DASH-BODY-011 | AC-DASH-BODY-CREATE-INVALID-03 | 입력 검증 (bodyFatPct) |
| REQ-DASH-BODY-012 | AC-DASH-BODY-CREATE-INVALID-04 | 미래 시각 차단 |
| REQ-DASH-BODY-013 | AC-DASH-BODY-CREATE-INVALID-05 | 소수점 자릿수 |
| REQ-DASH-1RM-001 | AC-DASH-1RM-HISTORY-01 | Phase 5 (1RM 차트) |
| REQ-DASH-1RM-002 | AC-DASH-1RM-HISTORY-01, AC-DASH-1RM-BEST-SET-01 | best-set 채택 규약 |
| REQ-DASH-1RM-003 | AC-DASH-1RM-HISTORY-01 | API 응답 일관성 |
| REQ-DASH-1RM-004 | AC-DASH-1RM-INVALID-01 | period 검증 |
| REQ-DASH-1RM-005 | AC-DASH-1RM-INVALID-02 | exerciseType 검증 |
| REQ-DASH-1RM-006 | AC-DASH-1RM-HISTORY-EMPTY-01 | 빈 데이터 처리 |
| REQ-DASH-1RM-007 | AC-DASH-CONSISTENCY-EPLEY-01 (단위 테스트로 검증) | NFR-DASH-CONSISTENCY-001 |
| REQ-DASH-1RM-008 | AC-DASH-CONSISTENCY-MAP-01 (단위 테스트로 검증) | NFR-DASH-CONSISTENCY-002 |
| REQ-DASH-1RM-009 | AC-DASH-1RM-REPS-RANGE-01 | reps 범위 제약 |
| REQ-DASH-VOL-001 | AC-DASH-VOL-01 | Phase 5 (주간 볼륨) |
| REQ-DASH-VOL-002 | AC-DASH-VOL-01, AC-DASH-VOL-EMPTY-WEEK-01 | 0 데이터 주 포함 |
| REQ-DASH-VOL-003 | AC-DASH-VOL-INVALID-01 | weeks 검증 |
| REQ-DASH-VOL-004 | AC-DASH-VOL-BW-EXCLUDE-01 | 보디웨이트 제외 |
| REQ-DASH-VOL-005 | AC-DASH-VOL-01 | 반올림 정책 |
| REQ-DASH-FREQ-001 | AC-DASH-FREQ-01 | Phase 5 (빈도) |
| REQ-DASH-FREQ-002 | AC-DASH-FREQ-01 | 응답 구조 |
| REQ-DASH-FREQ-003 | AC-DASH-FREQ-INVALID-01 | weeks 검증 |
| REQ-DASH-FREQ-004 | AC-DASH-FREQ-CANCEL-EXCLUDE-01 | CANCELLED 제외 |
| REQ-DASH-BTREND-001 | AC-DASH-BTREND-01 | 체성분 추세 |
| REQ-DASH-BTREND-002 | AC-DASH-BTREND-01 | 응답 구조 |
| REQ-DASH-BTREND-003 | AC-DASH-BTREND-INVALID-01 | period 검증 |
| REQ-DASH-BTREND-004 | AC-DASH-BTREND-EMPTY-01 | 빈 데이터 |
| REQ-DASH-MOBILE-001 | (수동 검증, 모바일 UX) | Phase 5 모바일 화면 |
| REQ-DASH-MOBILE-002 | (수동 검증, 모바일 UX) | Phase 5 대시보드 |
| REQ-DASH-MOBILE-003 | (수동 검증, 모바일 UX) | 차트 라이브러리 |
| REQ-DASH-MOBILE-004 | (수동 검증, 모바일 UX) | 차트 매핑 |
| REQ-DASH-MOBILE-005 | (수동 검증, 모바일 UX) | TanStack Query 캐싱 |
| REQ-DASH-MOBILE-006 | (수동 검증, 모바일 UX) | 빈 데이터 표시 |
| NFR-DASH-PERF-001~005 | AC-DASH-PERF-01 | 성능 SLO |
| NFR-DASH-SEC-001~005 | AC-DASH-BODY-AUTH-01, AC-DASH-BODY-SECURITY-01, AC-DASH-BODY-DELETE-NOTFOUND-01 | OWASP A01 |
| NFR-DASH-DATA-001~004 | (인덱스 EXPLAIN, 마이그레이션 검증) | 데이터 무결성 |
| NFR-DASH-CONSISTENCY-001~002 | (단위 테스트로 검증) | 공유 유틸 일관성 |
| NFR-DASH-MOBILE-001~002 | (수동 검증) | 모바일 호환성 |

---

## 10. 변경 영향 분석 (Delta Analysis)

본 SPEC은 신규 도메인(체성분, 대시보드)을 추가하면서 기존 코드의 일부를 수정한다. 각 변경의 영향과 종류를 명시한다.

### 10.1 [NEW] 신규 생성 파일

- `apps/backend/src/body-composition/body-composition.module.ts`
- `apps/backend/src/body-composition/body-composition.controller.ts`
- `apps/backend/src/body-composition/body-composition.service.ts`
- `apps/backend/src/body-composition/dto/create-body-composition.dto.ts`
- `apps/backend/src/body-composition/dto/list-body-composition.dto.ts`
- `apps/backend/src/body-composition/dto/body-composition-response.dto.ts`
- `apps/backend/src/dashboard/dashboard.module.ts` (모듈이 미존재 시) 또는 기존 모듈 확장
- `apps/backend/src/dashboard/dashboard.controller.ts`
- `apps/backend/src/dashboard/dashboard.service.ts`
- `apps/backend/src/dashboard/dto/dashboard-query.dto.ts`
- `apps/backend/src/dashboard/dto/dashboard-response.dto.ts`
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
- `packages/types/src/body-composition.ts` (응답 타입)
- `packages/types/src/dashboard.ts` (응답 타입)
- `apps/backend/prisma/migrations/{TIMESTAMP}_add_body_composition/migration.sql` (Prisma 마이그레이션)

### 10.2 [MODIFY] 수정 파일

- `apps/backend/prisma/schema.prisma`: `BodyComposition` 모델 추가, `User` 모델에 `bodyCompositions BodyComposition[]` 역참조 추가.
- `apps/backend/src/app.module.ts`: `BodyCompositionModule`, `DashboardModule` import 추가.
- `apps/mobile/app/(tabs)/my/_layout.tsx` 또는 라우터 구성: `dashboard.tsx`, `body.tsx` 화면을 마이 페이지 탭 네비게이션에 등록.
- `apps/mobile/package.json`: `react-native-gifted-charts` v1.4.x 의존성 추가.

### 10.3 [DEPENDS-ON] 종속 SPEC

- SPEC-AUTH-001: `JwtAuthGuard`, `@CurrentUser()` 데코레이터, JWT payload `sub`.
- SPEC-USER-001: `User` 모델, `User.deletedAt`(소프트 삭제는 능동 처리하지 않음).
- SPEC-EXERCISE-001: `Exercise.slug` 필드.
- SPEC-1RM-001: `CompoundType` enum, `OneRepMax` 모델(읽기만), `packages/utils/src/1rm.ts`의 `calculateEpley`.
- SPEC-WORKOUT-001: `WorkoutSession`, `WorkoutSet`, `WorkoutSet.isCompleted`/`completedAt`/`orderIndex`/`rpe`, `apps/backend/src/workouts/compound-exercise.map.ts`의 `COMPOUND_EXERCISE_SLUG_MAP`.

### 10.4 [BLOCKED-BY] 구현 순서 제약

본 SPEC의 백엔드 구현은 다음을 전제로 한다:

- SPEC-WORKOUT-001의 구현 완료(특히 `WorkoutSession.status`, `WorkoutSet.isCompleted`, `compound-exercise.map.ts`). 현재 schema에는 `WorkoutSet.isCompleted` / `rpe` / `orderIndex` 필드가 아직 존재하지 않는다(현재는 SPEC-WORKOUT-001 plan 단계). 본 SPEC RUN 시점에는 SPEC-WORKOUT-001이 RUN 완료 상태여야 한다.
- SPEC-1RM-001의 `CompoundType` enum 마이그레이션 완료.
- 별도 옵션: SPEC-WORKOUT-001 RUN이 늦어지는 경우 본 SPEC의 백엔드 작업을 다음 두 단계로 분리할 수 있다(plan.md에서 결정):
  - Step A: `BodyComposition` 모듈 + 체성분 추세 엔드포인트만 먼저(SPEC-WORKOUT-001 무관).
  - Step B: 1RM 이력/주간 볼륨/운동 빈도 엔드포인트(SPEC-WORKOUT-001 의존).

---

본 SPEC은 SPEC-1RM-001, SPEC-WORKOUT-001을 비롯한 Phase 1~3 SPEC의 후속 작업이며, 모든 EARS 요구사항은 acceptance.md의 Given/When/Then 시나리오로 검증된다. 구현 세부 사항은 plan.md를, 검증 절차는 acceptance.md를 참조한다.
