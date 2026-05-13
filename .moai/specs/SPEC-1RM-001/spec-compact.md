---
id: SPEC-1RM-001
version: "1.0.1"
status: draft
created_at: "2026-05-11"
updated_at: "2026-05-11"
author: leederic9306
priority: high
issue_number: 0
labels: ["1rm", "workout", "backend", "mobile"]
---

# SPEC-1RM-001 (Compact)

1RM 관리 — 근력 운동 트래커 앱의 1RM(One Repetition Maximum) 직접 입력 저장 및 Epley/Brzycki 공식 기반 추정 계산. 5종 컴파운드(`SQUAT`, `DEADLIFT`, `BENCH_PRESS`, `BARBELL_ROW`, `OVERHEAD_PRESS`)에 대해 사용자당 컴파운드별 최신값 1건만 유지(upsert, no history table). SPEC-AUTH-001 위에서 동작하며 모든 엔드포인트는 `JwtAuthGuard`로 보호된다.

> **REQ 번호 체계**: 본 SPEC은 도메인 네임스페이스 기반 REQ 번호(`REQ-ORM-INPUT-001`, `REQ-ORM-CALC-001` ...)를 사용한다. 이는 SPEC-AUTH-001/USER-001/EXERCISE-001과 동일한 프로젝트 표준 컨벤션이다(예: SPEC-EXERCISE-001은 `REQ-EX-LIST-001`, `REQ-EX-DETAIL-001` 사용). 평탄 순차 번호로 재번호하지 않는다.

---

## EARS 요구사항

### REQ-ORM-INPUT: 1RM 직접 입력

- **REQ-ORM-INPUT-001** (Event-Driven): 인증된 사용자가 `PUT /users/me/1rm/:exerciseType` 본문 `{ value }`로 요청 시, 시스템은 `OneRepMax(userId, exerciseType)` 레코드를 upsert해야 한다. **신규 생성 시 `201 Created`, 기존 갱신 시 `200 OK`**.
- **REQ-ORM-INPUT-002** (Ubiquitous): 응답은 `{ exerciseType, value, source: "DIRECT_INPUT", updatedAt }`을 포함해야 한다.
- **REQ-ORM-INPUT-003** (Event-Driven): `:exerciseType`이 `CompoundType` enum 외 값일 때 `400 Bad Request`를 반환해야 한다.
- **REQ-ORM-INPUT-004** (Ubiquitous): 시스템은 사용자당 컴파운드별 1건만 보장(`@@unique([userId, exerciseType])`)해야 한다.
- **REQ-ORM-INPUT-005** (Ubiquitous): 본 엔드포인트는 `JwtAuthGuard`로 보호되어야 한다.
- **REQ-ORM-INPUT-006** (Event-Driven): 사용자가 요청 바디에 `userId`를 포함하여 `PUT /users/me/1rm/:exerciseType` 요청을 보낸 경우, 시스템은 해당 필드를 무시하고 JWT의 `sub`를 사용자 식별자로 사용해야 한다.
- **REQ-ORM-INPUT-006a** (Unwanted): 시스템이 `PUT /users/me/1rm/:exerciseType`을 처리할 때, 요청 바디/path의 `userId` 필드를 사용자 식별에 적용하지 않아야 한다.
- **REQ-ORM-INPUT-007** (Ubiquitous): 본 엔드포인트 저장 시 `source`는 항상 `OrmSource.DIRECT_INPUT`이어야 한다.

### REQ-ORM-CALC: 1RM 추정 계산

- **REQ-ORM-CALC-001** (Event-Driven): 인증된 사용자가 `POST /users/me/1rm/estimate` 본문 `{ weight, reps }`로 요청 시, 시스템은 Epley(`weight * (1 + reps/30)`)와 Brzycki(`weight * (36/(37-reps))`) 결과 및 산술 평균을 `200 OK`로 반환해야 한다.
- **REQ-ORM-CALC-002** (Ubiquitous): 응답은 `{ epley, brzycki, average }` (모두 소수 2자리 반올림 kg)를 포함해야 한다.
  - **반올림 규칙 (확정)**: `epley_raw`, `brzycki_raw`, `average_raw = (epley_raw + brzycki_raw) / 2`를 모두 반올림 전 값으로 계산한 후 각각 `Math.round(x * 100) / 100`을 적용한다. `average`는 **반올림된 epley/brzycki의 평균이 아니다**.
  - **예시 (weight=100, reps=5)**: `epley=116.67`, `brzycki=112.5`, `average=114.58` (NOT 114.59).
- **REQ-ORM-CALC-003** (Unwanted): 시스템이 `POST /users/me/1rm/estimate` 요청을 처리할 때, 시스템은 `OneRepMax` 테이블에 어떠한 레코드도 생성, 수정, 삭제하지 않아야 한다.
- **REQ-ORM-CALC-004** (Ubiquitous): 본 엔드포인트는 `JwtAuthGuard`로 보호되어야 한다.
- **REQ-ORM-CALC-005** (Ubiquitous): 백엔드 계산 결과는 `packages/utils/src/1rm.ts`의 결과와 수학적으로 동등해야 한다.

### REQ-ORM-READ: 1RM 조회

- **REQ-ORM-READ-001** (Event-Driven): 인증된 사용자가 `GET /users/me/1rm`을 호출했을 때, 시스템은 5종 컴파운드 모두를 키로 가지는 객체를 `200 OK`로 반환해야 한다.
- **REQ-ORM-READ-002** (Ubiquitous): 설정되지 않은 컴파운드는 `null`을 반환해야 한다 (404 아님). 5종 키는 항상 응답 객체에 존재한다.
- **REQ-ORM-READ-003** (Ubiquitous): 각 레코드는 `{ exerciseType, value, source, updatedAt }`을 포함해야 한다. `id`, `userId`는 노출하지 않는다.
- **REQ-ORM-READ-004** (Ubiquitous): 본 엔드포인트는 `JwtAuthGuard`로 보호되어야 한다.
- **REQ-ORM-READ-005** (Unwanted): 시스템이 `GET /users/me/1rm`을 처리할 때, JWT `sub`와 다른 `userId`의 `OneRepMax` 데이터를 응답에 포함하지 않아야 한다. 다른 사용자 ID를 받는 query/path parameter 분기는 제공하지 않는다.

### REQ-ORM-VAL: 입력 검증

- **REQ-ORM-VAL-001** (Event-Driven): `value`가 양수가 아니면 `400`을 반환해야 한다 (`0 < value`).
- **REQ-ORM-VAL-002** (Event-Driven): `value > 500` (kg)이면 `400`을 반환해야 한다.
- **REQ-ORM-VAL-003** (Event-Driven): `weight`가 양수가 아니거나 500 초과면 `400`을 반환하고 계산하지 않아야 한다.
- **REQ-ORM-VAL-004** (Event-Driven): `reps`가 1 미만 또는 10 초과면 `400`을 반환해야 한다 (`1 ≤ reps ≤ 10`).
- **REQ-ORM-VAL-005** (Event-Driven): `reps`가 정수가 아니면 `400`을 반환해야 한다.
- **REQ-ORM-VAL-006** (Ubiquitous): 검증은 `ValidationPipe` + `class-validator`로 일관 수행하며 에러 응답에 실패 필드를 명시해야 한다.
  - **숫자 문자열 변환 정책 (확정)**: `transform: true` 전역 설정에 따라 정수로 변환 가능한 문자열(예: `reps="5"`)은 자동으로 정수로 변환되어 유효 요청으로 처리된다.
- **REQ-ORM-VAL-007** (Event-Driven, 라우트 매칭 검증): 사용자가 `POST /users/me/1rm/estimate` 요청을 보냈을 때, 시스템은 `200 OK`와 추정 결과를 반환해야 하며, `PUT /users/me/1rm/:exerciseType` 형식의 라우트와 충돌 없이 올바르게 라우팅되어야 한다. 컨트롤러 메서드 정의 순서 등 구체적 구현 가이드는 plan.md에 위임 (SPEC-EXERCISE-001 REQ-EX-FAV-012 교훈 적용).
- **REQ-ORM-VAL-008** (Event-Driven): `value`(PUT) 또는 `weight`(POST estimate)가 소수점 2자리를 초과하면 `400 Bad Request`를 반환해야 한다.

### NFR-ORM: 비기능 요구사항

- **NFR-ORM-PERF-001~003**: P95 — `GET ≤ 100ms`, `PUT ≤ 150ms`, `POST estimate ≤ 50ms`.
- **NFR-ORM-SEC-001~004**: 모든 엔드포인트 `JwtAuthGuard` 보호, JWT `sub`만 사용, `id`/`userId` 미노출, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- **NFR-ORM-DATA-001~003**: `@@unique([userId, exerciseType])`, `onDelete: Cascade`, `value > 0` 애플리케이션 레벨 검증.
- **NFR-ORM-CONSISTENCY-001~002**: 백엔드와 `packages/utils/src/1rm.ts`가 동일 결과 산출. 공유 유틸은 `calculateEpley/calculateBrzycki/calculateAverage1RM` 3함수 export.
- **NFR-ORM-MOBILE-001~003**: 5종 컴파운드 한 화면 표시, 추정 보조 UI는 클라이언트 로컬 계산, TanStack Query 캐싱.

---

## 인수 시나리오 요약 (Given-When-Then)

### AC-ORM-INPUT-01: 신규 입력 (201 Created)
- Given: U1이 SQUAT 미설정
- When: `PUT /users/me/1rm/SQUAT` 본문 `{ value: 140 }`
- Then: **201 Created**, `{ exerciseType: "SQUAT", value: 140, source: "DIRECT_INPUT", updatedAt }`, DB에 신규 레코드, `id`/`userId` 미노출

### AC-ORM-INPUT-02: 잘못된 enum 값
- When: `PUT /users/me/1rm/PULL_UP` 또는 `/squat`(소문자) 또는 `/INVALID`
- Then: 400, DB 변경 없음

### AC-ORM-UPSERT-01: 기존 값 갱신 (200 OK, 멱등 upsert)
- Given: AC-ORM-INPUT-01 직후 (SQUAT=140 존재)
- When: 같은 `PUT /users/me/1rm/SQUAT` 본문 `{ value: 145.5 }`
- Then: **200 OK** (201 아님), `value=145.5`, `updatedAt` 갱신, DB 레코드 1건 유지 (id 보존)

### AC-ORM-CALC-01: 정상 추정 계산 (확정값)
- Given: U1 토큰
- When: `POST /users/me/1rm/estimate` 본문 `{ weight: 100, reps: 5 }`
- Then: 200, 정확히 `{ epley: 116.67, brzycki: 112.5, average: 114.58 }`. `average=114.59`는 허용되지 않음.

### AC-ORM-CALC-02: DB 쓰기 없음 (순수 계산)
- Given: DB에 N건 레코드 존재
- When: `POST estimate` 100회 반복 호출
- Then: 모두 200, 동일 결과, `oneRepMax.count()` 호출 전후 동일, Prisma 쓰기 호출 0건

### AC-ORM-CALC-INVALID-01: 잘못된 weight
- When: `weight=0`, `-10`, `501`, `"abc"`, 누락
- Then: 모두 400, 계산 미수행

### AC-ORM-CALC-INVALID-02: 잘못된 reps 범위
- When: `reps=0`, `-1`, `11`, `100`, 누락
- Then: 모두 400

### AC-ORM-CALC-INVALID-03: reps 타입 검증 (확정 정책)
- 케이스 1 `reps=5.5` (실수): **400** (`@IsInt` 위반)
- 케이스 2 `reps="5"` (정수 문자열): **200 OK** (NestJS `transform: true`로 정수 변환, NFR-ORM-SEC-004)
- 케이스 3 `reps="abc"` (비숫자 문자열): **400**
- 케이스 4 `reps=null`: **400**

### AC-ORM-READ-01: 일부 설정 상태
- Given: U1이 SQUAT/DEADLIFT/BENCH_PRESS 설정, BARBELL_ROW/OVERHEAD_PRESS 미설정
- When: `GET /users/me/1rm`
- Then: 200, 5개 키 모두 존재, 3건은 객체, 2건은 `null`, `id`/`userId` 미포함

### AC-ORM-EMPTY-01: 전무 상태
- Given: 신규 사용자, 1RM 0건
- When: `GET /users/me/1rm`
- Then: **200 OK** (404 아님), 5개 키 모두 `null`

### AC-ORM-SECURITY-01: 인증 누락/만료 401
- When: GET/PUT/POST를 토큰 없이/만료/변조로 호출
- Then: 모두 401, 데이터 미노출, DB 변경 없음

### AC-ORM-SECURITY-02: 사용자 격리
- Given: U1: SQUAT=140, U2: SQUAT=120
- When: U2 토큰으로 GET/PUT 호출
- Then: GET은 120만 반환 (U1 데이터 노출 없음), PUT은 U2의 레코드만 영향, U1.SQUAT=140 변경 없음

### AC-ORM-SECURITY-03: 요청 바디의 userId 무시 (whitelist 동작)
- Given: U2 토큰, 본문 `{ value: 200, userId: "<다른 사용자 또는 본인 ID>" }`
- When: `PUT /users/me/1rm/SQUAT` 호출
- Then: `400 Bad Request` (`property userId should not exist`, `forbidNonWhitelisted: true` 동작). DB 변경 없음. 대상 사용자는 JWT `sub`로만 결정됨.

### AC-ORM-VALIDATION-01: 잘못된 value (양수가 아님)
- When: `value=0`, `-10`, `"abc"`, `null`, 누락
- Then: 모두 400, DB 변경 없음

### AC-ORM-VALIDATION-02: value 상한 초과
- When: `value=501`, `999`, `1000000`
- Then: 모두 400 (`@Max(500)` 위반)

### AC-ORM-VALIDATION-03: 소수점 자릿수 제한 (REQ-ORM-VAL-008)
- 케이스 1~3 (소수점 3자리 이상): `value=142.567`, `value=100.1234`, `weight=100.123` → **400**
- 케이스 4~6 (소수점 2자리 이하, 대조군): `weight=100.5`, `value=142.5`, `value=142.56` → **200/201**

### AC-ORM-CONSISTENCY-01: 백엔드 vs 공유 유틸
- Given: 20개 입력 조합 (weight ∈ {50,100,150,200}, reps ∈ {1,3,5,8,10})
- Then: 백엔드 `service.estimate()` 결과 = `packages/utils/src/1rm.ts` 결과 (소수 2자리 반올림 후 정확 일치)

### AC-ORM-CONSISTENCY-02: 100×5 확정값
- When: `POST /estimate { weight:100, reps:5 }` 및 `calculateAverage1RM(100, 5)`
- Then: 정확히 `{ epley:116.67, brzycki:112.5, average:114.58 }` (NOT 114.59)

### AC-ORM-ROUTE-01: estimate 라우트 정합성 (REQ-ORM-VAL-007)
- When: `POST /estimate`, `PUT /SQUAT`, `PUT /estimate` 순차 호출
- Then:
  - POST /estimate → 200, 추정 결과 반환
  - PUT /SQUAT → 201/200, 정상 upsert
  - PUT /estimate → **400** (CompoundType enum 외 값으로 거부, REQ-ORM-INPUT-003). `estimate`라는 exerciseType으로 레코드 생성/갱신 없음.
  - 컨트롤러 코드에서 `POST /estimate`가 `PUT /:exerciseType`보다 먼저 정의됨이 정적 검사로 확인.

### AC-ORM-PERF-01: 성능 기준선
- Then: P95 — GET ≤ 100ms, PUT ≤ 150ms, POST estimate ≤ 50ms

### MV-ORM-MOBILE-01~04: 수동 검증 (DoD 자동화 요구에서 제외)
- 5종 카드 표시 / 편집 흐름 / 추정 보조 UI / 잘못된 입력 처리

---

## 변경 대상 파일 요약

### 백엔드 (apps/backend/)

- `prisma/schema.prisma` — `CompoundType` enum, `OrmSource` enum, `OneRepMax` 모델, `User.oneRepMaxes` 역참조, `@@unique([userId, exerciseType])`, `@@index([userId])`
- `prisma/migrations/` — `add_one_rep_max` 마이그레이션
- `src/one-rep-max/one-rep-max.module.ts` — 모듈 정의
- `src/one-rep-max/one-rep-max.controller.ts` — 3개 라우트 (`@Post('estimate')` 반드시 `@Put(':exerciseType')`보다 먼저 등록, REQ-ORM-VAL-007)
- `src/one-rep-max/one-rep-max.service.ts` — `getAll`, `upsert`(신규/기존 분기), `estimate`(DB 쓰기 없음, 반올림 규칙 REQ-ORM-CALC-002 적용)
- `src/one-rep-max/dto/upsert-one-rep-max.dto.ts` — `value` 검증 (`@IsNumber({ maxDecimalPlaces: 2 })`, `@Min(>0)`, `@Max(500)`)
- `src/one-rep-max/dto/estimate-one-rep-max.dto.ts` — `weight` (`maxDecimalPlaces: 2`), `reps` (`@IsInt`, 1~10) 검증
- `src/one-rep-max/dto/one-rep-max-response.dto.ts` — 단일 레코드 응답
- `src/one-rep-max/dto/one-rep-max-collection.dto.ts` — 5종 키 응답
- `src/one-rep-max/dto/one-rep-max-estimate-response.dto.ts` — `{ epley, brzycki, average }`
- `src/app.module.ts` — `OneRepMaxModule` 등록
- `src/main.ts` — `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` 전역 (NFR-ORM-SEC-004)
- 테스트 3종 (`one-rep-max.service.spec.ts`, `one-rep-max.controller.spec.ts`, `one-rep-max.e2e-spec.ts`)

### 모바일 (apps/mobile/)

- `app/(tabs)/my/1rm.tsx` — 1RM 관리 화면 (5종 카드)
- `components/my/OneRepMaxList.tsx` (신규)
- `components/my/OneRepMaxCard.tsx` (신규) — 단일 컴파운드 카드
- `components/my/OneRepMaxEditModal.tsx` (신규) — 입력 모달
- `components/my/OneRepMaxEstimateForm.tsx` (신규) — 추정 보조 UI
- `services/one-rep-max.ts` — API 호출 함수
- `hooks/useOneRepMax.ts` — TanStack Query 훅 (`useOneRepMaxes`, `useUpsertOneRepMax`, `useEstimate1RMLocal`)

### 공유 유틸·타입 (packages/)

- `packages/utils/src/1rm.ts` — 기존 (재사용, 변경 없음 권장). 반올림 규칙 REQ-ORM-CALC-002와 동일해야 함.
- `packages/types/src/one-rep-max.ts` — `CompoundType`, `OrmSource`, `OneRepMaxRecord`, `OneRepMaxCollection`, `UpsertOneRepMaxRequest`, `EstimateOneRepMaxRequest`, `OneRepMaxEstimateResponse`, `COMPOUND_LABELS_KO`
- `packages/types/src/index.ts` — export 추가

---

## 제외 사항 (Exclusions)

1. **운동 세션 기록 및 RPE 기반 자동 1RM 추정** — SPEC-WORKOUT-001(후속). `OrmSource` enum의 `EPLEY_ESTIMATE`/`BRZYCKI_ESTIMATE`/`AVERAGE_ESTIMATE`는 정의만 하고 본 SPEC에서는 저장하지 않음.
2. **1RM 이력 타임라인** — `OneRepMaxHistory` 테이블 미생성. 컴파운드별 최신값 1건만 유지.
3. **5종 컴파운드 외 운동의 1RM** — 풀업/컬/레그프레스 등은 본 SPEC 범위 밖.
4. **추가 추정 공식** — Lombardi/Mayhew/O'Conner 등은 본 SPEC 범위 밖. Epley + Brzycki + Average만 제공.
5. **Admin 다른 사용자 1RM 조회/수정** — 운영 엔드포인트는 본 SPEC 범위 밖.
6. **단위 변환 (lb ↔ kg)** — 모두 kg 통일. localization은 후속 SPEC.
7. **1RM 기반 운동 강도 추천** — SPEC-AI-RECOMMEND-XXX 또는 SPEC-WORKOUT-001.
8. **1RM 그래프/차트** — 이력 없으므로 본 SPEC 범위 밖.
9. **1RM 변경 알림/푸시** — 본 SPEC 범위 밖.
10. **1RM 데이터 export (CSV/JSON 다운로드)** — 본 SPEC 범위 밖. GDPR 관련은 후속 운영 SPEC.
11. **운동 도감과 외래키 연결** — `OneRepMax.exerciseType`(enum)과 `Exercise.id`(SPEC-EXERCISE-001) 사이 FK 미생성. SPEC-WORKOUT-001에서 검토.
12. **소프트 삭제 사용자의 1RM 정리** — `User.deletedAt` 능동 처리 없음. `onDelete: Cascade`로 향후 하드 삭제 시 정리.
13. **1RM 소셜 공유** — 본 SPEC 범위 밖.
