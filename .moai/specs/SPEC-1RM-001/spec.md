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

# SPEC-1RM-001: 1RM 관리 (One Rep Max Management)

## HISTORY

- 2026-05-11 v1.0.1 (draft): plan-auditor 1차 감사 결과 반영. 4개 Unwanted EARS 패턴 수정(REQ-ORM-CALC-003/INPUT-006/READ-005/VAL-007), 1RM 추정 반올림 정책 명확화(average = 반올림 전 평균 후 반올림, 100×5 예시: 114.58), AC reps 문자열 변환 정책 명시, 소수점 자릿수 제한 명시.
- 2026-05-11 v1.0.0 (draft): 초기 작성 (leederic9306). 근력 운동 트래커 앱의 1RM(One Repetition Maximum) 관리 기능을 EARS 형식으로 정의. 5종 컴파운드 운동(Squat, Deadlift, Bench Press, Barbell Row, Overhead Press)에 대한 직접 입력 저장 및 Epley/Brzycki 공식 기반 1RM 추정 계산 엔드포인트를 제공한다. SPEC-AUTH-001(인증) 위에서 동작하며 모든 엔드포인트는 `JwtAuthGuard`로 보호된다. 컴파운드별 최신 1RM 1건만 유지(upsert 패턴, no history table). 1RM 이력 조회 및 RPE 기반 자동 추정은 후속 SPEC(SPEC-WORKOUT-001 이후)에서 다룸.

---

## REQ 번호 체계 안내 (Numbering Convention)

본 SPEC은 도메인 네임스페이스 기반 REQ 번호 체계(`REQ-ORM-INPUT-001`, `REQ-ORM-CALC-001`, `REQ-ORM-READ-001`, `REQ-ORM-VAL-001`)를 사용한다. 이는 본 프로젝트의 표준 컨벤션이며 SPEC-AUTH-001, SPEC-USER-001, SPEC-EXERCISE-001과 동일한 패턴이다(예: SPEC-EXERCISE-001은 `REQ-EX-LIST-001`, `REQ-EX-DETAIL-001`을 사용). 각 네임스페이스 내에서 번호는 순차적이고 빠짐없이 부여되며, 네임스페이스 분리로 도메인 단위의 추적성과 가독성을 확보한다. 평탄한 순차 번호(`REQ-001`, `REQ-002` ...)로 재번호하지 않는다.

---

## 1. 개요 (Overview)

근력 운동 트래커 앱의 **1RM(One Repetition Maximum) 관리 시스템**을 정의한다. 본 SPEC은 SPEC-AUTH-001(인증 및 권한 관리 시스템) 위에서 동작하는 **1RM 데이터 레이어**로서, 인증된 사용자가 5종 컴파운드 운동(Squat, Deadlift, Bench Press, Barbell Row, Overhead Press)에 대한 본인의 1RM을 직접 입력하여 저장하고, 세트의 무게(weight)와 횟수(reps)로부터 Epley/Brzycki 공식에 따른 1RM 추정값을 계산할 수 있게 한다.

### 핵심 가치

- **운동 강도 기준치 관리**: 사용자가 5종 컴파운드 운동의 최대 능력치(1RM)를 한 곳에서 관리하여 운동 강도 설정의 기준선으로 활용할 수 있다.
- **검증된 추정 공식**: 운동 과학에서 널리 사용되는 Epley(`weight * (1 + reps / 30)`)와 Brzycki(`weight * (36 / (37 - reps))`) 공식을 동시 제공하여 사용자가 단일 공식의 편향 없이 합리적인 추정값을 얻을 수 있다.
- **간결한 데이터 모델**: 컴파운드 운동별 최신 1RM 1건만 유지(upsert)하여 이력 테이블의 운영 비용을 제거한다. 이력 추적은 후속 SPEC(SPEC-WORKOUT-001)의 운동 세션 기록과 연계하여 자연스럽게 확보된다.
- **공유 유틸 일관성**: `packages/utils/src/1rm.ts`의 Epley/Brzycki 공식 구현을 백엔드와 모바일이 동일하게 참조하여 계산 결과의 일관성을 보장한다.

### 범위

본 SPEC은 백엔드(NestJS 10) 측 1RM 도메인 모듈의 구현(`UsersModule` 확장 또는 `OrmModule` 신설 — plan.md에서 결정), Prisma 스키마의 `OneRepMax` 엔티티 및 `CompoundType`/`OrmSource` enum 신설, 3개 엔드포인트(`GET /users/me/1rm`, `PUT /users/me/1rm/:exerciseType`, `POST /users/me/1rm/estimate`), 모바일 클라이언트의 1RM 관리 화면(`app/(tabs)/my/1rm.tsx` — 5종 컴파운드 입력 폼)을 포괄한다.

다음 항목은 본 SPEC 범위에서 명시적으로 제외된다 (Section 7 참조):
- 운동 세션 기록(`Workout`, `WorkoutSet`)과 RPE 기반 1RM 자동 추정 — SPEC-WORKOUT-001(후속).
- 1RM 이력 타임라인 조회 (history table 미생성).
- 5종 컴파운드 이외의 운동(예: 풀업, 컬, 레그프레스)의 1RM.
- Admin에 의한 다른 사용자 1RM 조회/수정.

---

## 2. 목표와 비목표 (Goals & Non-Goals)

### 2.1 목표 (Goals)

1. 인증된 사용자가 `GET /users/me/1rm`로 본인의 5종 컴파운드 1RM 데이터를 한 번에 조회할 수 있게 한다. 1RM이 설정되지 않은 컴파운드는 `null`로 반환한다 (404 아님).
2. 인증된 사용자가 `PUT /users/me/1rm/:exerciseType`로 특정 컴파운드의 1RM 값을 직접 입력하여 저장할 수 있게 한다. 기존 값이 있으면 덮어쓰고(upsert), 없으면 신규 생성한다.
3. 인증된 사용자가 `POST /users/me/1rm/estimate`로 세트의 무게(weight)와 횟수(reps)를 입력하여 Epley/Brzycki 공식 기반 1RM 추정값을 계산할 수 있게 한다. 본 엔드포인트는 순수 계산이며 DB에 저장되지 않는다.
4. 컴파운드 운동별로 사용자당 1RM 레코드 1건만 유지하여(`@@unique([userId, exerciseType])`) 데이터 모델을 단순화한다.
5. 1RM 값은 kg 단위의 양의 실수(`Float`)로 저장하며, 5종 컴파운드는 `CompoundType` enum(`SQUAT`, `DEADLIFT`, `BENCH_PRESS`, `BARBELL_ROW`, `OVERHEAD_PRESS`)으로 식별한다.
6. 1RM의 출처(`source`)를 명시적으로 기록한다: 직접 입력(`DIRECT_INPUT`) 외에 후속 SPEC에서 사용할 추정 출처(`EPLEY_ESTIMATE`, `BRZYCKI_ESTIMATE`, `AVERAGE_ESTIMATE`)를 enum으로 정의해 둔다. 본 SPEC에서는 `DIRECT_INPUT`만 실제 사용한다.
7. `POST /users/me/1rm/estimate`는 Epley, Brzycki, Average(두 공식의 평균) 세 값을 동시에 반환하여 사용자가 비교 후 선택할 수 있게 한다.
8. 모든 엔드포인트는 `JwtAuthGuard`로 보호되며, 사용자는 JWT의 `sub`(본인 ID)에 대해서만 작업할 수 있다 (다른 사용자의 1RM 데이터 접근 차단).
9. 모바일 클라이언트(`app/(tabs)/my/1rm.tsx`)는 5종 컴파운드의 1RM을 한 화면에서 입력·표시할 수 있는 폼 UI를 제공한다. 입력 보조로 weight/reps 입력 시 추정값을 미리 보여주는 옵션을 제공한다.
10. 백엔드와 모바일은 `packages/utils/src/1rm.ts`의 동일한 Epley/Brzycki 구현을 공유하여 계산 결과의 일관성을 보장한다.

### 2.2 비목표 (Non-Goals)

- 1RM 이력 타임라인(`OneRepMaxHistory` 테이블 등)은 본 SPEC 범위 밖이다. 본 SPEC은 컴파운드별 최신값 1건만 유지한다.
- 운동 세션 기록(`Workout`, `WorkoutSet`, RPE 기반 자동 1RM 갱신)은 SPEC-WORKOUT-001(후속)에서 다룬다.
- 5종 컴파운드 이외의 운동(풀업, 바이셉 컬, 레그프레스 등)에 대한 1RM 관리는 본 SPEC 범위 밖이다.
- 1RM 추정의 추가 공식(Lombardi, Mayhew, O'Conner 등)은 본 SPEC 범위 밖이다. Epley + Brzycki + Average만 제공한다.
- Admin이 다른 사용자의 1RM 데이터를 조회·수정할 수 있는 운영 엔드포인트는 본 SPEC 범위 밖이다.
- 1RM 단위 변환(파운드 ↔ kg)은 본 SPEC 범위 밖이다. 모든 값은 kg로 통일한다.
- 1RM 기반 운동 강도 추천(`1RM의 70%로 8reps 권장` 등)은 본 SPEC 범위 밖이다. 후속 SPEC-AI-RECOMMEND-XXX 또는 SPEC-WORKOUT-001에서 검토.
- 1RM 그래프/차트 시각화는 이력이 존재하지 않으므로 본 SPEC 범위 밖이다.

---

## 3. EARS 요구사항 (Requirements)

### 3.1 REQ-ORM-INPUT: 1RM 직접 입력

**REQ-ORM-INPUT-001** (Event-Driven)
인증된 사용자가 `PUT /users/me/1rm/:exerciseType` 요청을 본문 `{ value: <number> }`와 함께 보냈을 때, 시스템은 해당 사용자(`userId`)와 해당 컴파운드(`exerciseType`)의 `OneRepMax` 레코드를 upsert해야 한다. 기존 레코드가 있으면 `value`와 `updatedAt`을 갱신하고, 없으면 신규 생성한다. 응답 코드는 신규 생성 시 `201 Created`, 기존 레코드 갱신 시 `200 OK`로 구분한다.

**REQ-ORM-INPUT-002** (Ubiquitous)
시스템은 `PUT /users/me/1rm/:exerciseType` 응답으로 다음 필드를 포함하는 JSON을 반환해야 한다: `exerciseType` (입력된 컴파운드 enum 값), `value` (저장된 kg 값), `source` (항상 `"DIRECT_INPUT"`), `updatedAt` (ISO 8601 타임스탬프).

**REQ-ORM-INPUT-003** (Event-Driven)
사용자가 `PUT /users/me/1rm/:exerciseType`의 `:exerciseType` path parameter에 `CompoundType` enum에 정의되지 않은 값(예: `PULL_UP`, `squat`(소문자), `INVALID`)을 지정했을 때, 시스템은 `400 Bad Request`를 반환하고 DB에 어떤 레코드도 생성/수정하지 않아야 한다.

**REQ-ORM-INPUT-004** (Ubiquitous)
시스템은 동일 사용자의 동일 컴파운드에 대해 `OneRepMax` 레코드가 최대 1건만 존재하도록 보장해야 한다 (Prisma `@@unique([userId, exerciseType])` 제약). 동시 요청 시 race condition은 Prisma `upsert` 또는 PostgreSQL의 `ON CONFLICT` 처리로 해결한다.

**REQ-ORM-INPUT-005** (Ubiquitous)
시스템은 `PUT /users/me/1rm/:exerciseType` 엔드포인트를 `JwtAuthGuard`로 보호하여 JWT가 없거나 만료된 경우 `401 Unauthorized`를 반환해야 한다.

**REQ-ORM-INPUT-006** (Event-Driven)
인증된 사용자가 요청 바디에 `userId`를 포함하여 `PUT /users/me/1rm/:exerciseType` 요청을 보낸 경우, 시스템은 해당 필드를 무시하고 JWT의 `sub`를 사용자 식별자로 사용해야 한다.

**REQ-ORM-INPUT-006a** (Unwanted)
시스템이 `PUT /users/me/1rm/:exerciseType` 요청을 처리할 때, 시스템은 요청 바디나 path parameter의 `userId` 필드를 사용자 식별에 적용하지 않아야 한다. 사용자 식별은 JWT payload `sub` 클레임으로만 수행된다 (사용자 격리, 본인 외 데이터 수정 차단).

**REQ-ORM-INPUT-007** (Ubiquitous)
저장되는 `OneRepMax.source` 값은 본 엔드포인트(`PUT /users/me/1rm/:exerciseType`)를 통한 입력에 대해 항상 `OrmSource.DIRECT_INPUT`이어야 한다. 추정 출처(`EPLEY_ESTIMATE`, `BRZYCKI_ESTIMATE`, `AVERAGE_ESTIMATE`)는 enum에 정의되어 있으나 본 SPEC에서는 저장되지 않는다 (후속 SPEC-WORKOUT-001 사용 예약).

### 3.2 REQ-ORM-CALC: 1RM 추정 계산

**REQ-ORM-CALC-001** (Event-Driven)
인증된 사용자가 `POST /users/me/1rm/estimate` 요청을 본문 `{ weight: <number>, reps: <integer> }`와 함께 보냈을 때, 시스템은 Epley 공식(`weight * (1 + reps / 30)`)과 Brzycki 공식(`weight * (36 / (37 - reps))`)으로 각각 1RM을 계산하고, 두 값의 산술 평균을 함께 `200 OK`로 반환해야 한다.

**REQ-ORM-CALC-002** (Ubiquitous)
시스템은 `POST /users/me/1rm/estimate` 응답으로 다음 필드를 포함하는 JSON을 반환해야 한다: `epley` (Epley 공식 결과, kg, 소수 2자리 반올림), `brzycki` (Brzycki 공식 결과, kg, 소수 2자리 반올림), `average` (두 값의 산술 평균, kg, 소수 2자리 반올림).

**반올림 규칙 (확정)**: 시스템은 `epley` 값과 `brzycki` 값을 각각 반올림되지 않은 중간 계산값으로 산출한 후, `Math.round(value * 100) / 100`(round half away from zero, 소수점 2자리 반올림)을 적용하여 응답에 사용한다. `average`는 **반올림 전 Epley 값과 Brzycki 값의 산술 평균을 먼저 계산한 후** 동일한 방식으로 소수점 2자리 반올림한다. 즉:

```
epley_raw    = weight * (1 + reps / 30)
brzycki_raw  = weight * (36 / (37 - reps))
average_raw  = (epley_raw + brzycki_raw) / 2

epley        = round2(epley_raw)
brzycki      = round2(brzycki_raw)
average      = round2(average_raw)   // 반올림 전 값 평균을 반올림 (NOT epley + brzycki 의 평균)
```

**예시 (weight=100, reps=5)**:
- `epley_raw   = 100 × (1 + 5/30)   = 116.66666...`
- `brzycki_raw = 100 × (36/(37-5)) = 100 × 1.125 = 112.5`
- `average_raw = (116.66666... + 112.5) / 2 = 114.58333...`
- 응답: `{ "epley": 116.67, "brzycki": 112.50, "average": 114.58 }`

이 정의는 본 SPEC, plan.md, acceptance.md에 걸쳐 단일한 결과(`average = 114.58`)를 보장한다. 반올림된 `epley`와 `brzycki`를 평균내는 방식(결과 `114.59`)은 사용하지 않는다.

**REQ-ORM-CALC-003** (Unwanted)
시스템이 `POST /users/me/1rm/estimate` 요청을 처리할 때, 시스템은 `OneRepMax` 테이블에 어떠한 레코드도 생성, 수정, 삭제하지 않아야 한다. 본 엔드포인트는 순수 계산(stateless) 엔드포인트이다.

**REQ-ORM-CALC-004** (Ubiquitous)
시스템은 `POST /users/me/1rm/estimate` 엔드포인트를 `JwtAuthGuard`로 보호하여 JWT가 없거나 만료된 경우 `401 Unauthorized`를 반환해야 한다.

**REQ-ORM-CALC-005** (Ubiquitous)
시스템은 백엔드의 1RM 추정 계산 로직을 `packages/utils/src/1rm.ts`의 함수와 수학적으로 동등한 결과를 산출하도록 구현해야 한다. 직접 import가 가능하면 import하여 사용하고, 모노레포 빌드 제약으로 import가 불가하면 동일한 알고리즘을 백엔드 내부에 재구현하되 단위 테스트로 모바일 측 결과와의 동등성을 검증한다.

### 3.3 REQ-ORM-READ: 1RM 조회

**REQ-ORM-READ-001** (Event-Driven)
인증된 사용자가 `GET /users/me/1rm` 요청을 보냈을 때, 시스템은 해당 사용자의 5종 컴파운드 모두에 대한 1RM 상태를 `200 OK`로 반환해야 한다. 응답 구조는 컴파운드 enum 5종을 키로 하는 객체이며, 각 키의 값은 `OneRepMax` 레코드(있을 때) 또는 `null`(설정되지 않은 컴파운드)이다.

**REQ-ORM-READ-002** (Ubiquitous)
시스템은 `GET /users/me/1rm` 응답에서 사용자가 1RM을 설정하지 않은 컴파운드에 대해 `null`을 반환해야 한다. `404 Not Found`로 처리하지 않으며, 5종 컴파운드 키는 항상 응답 객체에 존재해야 한다 (누락 키 없음).

**REQ-ORM-READ-003** (Ubiquitous)
시스템은 `GET /users/me/1rm` 응답의 각 레코드에 다음 필드를 포함해야 한다: `exerciseType` (컴파운드 enum), `value` (kg), `source` (OrmSource enum), `updatedAt` (ISO 8601). 내부 ID(`id`), `userId`는 응답에서 제외한다 (사용자별 격리된 응답이므로 노출 불필요).

**REQ-ORM-READ-004** (Ubiquitous)
시스템은 `GET /users/me/1rm` 엔드포인트를 `JwtAuthGuard`로 보호하여 JWT가 없거나 만료된 경우 `401 Unauthorized`를 반환해야 한다.

**REQ-ORM-READ-005** (Unwanted)
시스템이 `GET /users/me/1rm` 요청을 처리할 때, 시스템은 JWT `sub`와 다른 `userId`의 `OneRepMax` 데이터를 응답에 포함하지 않아야 한다. 대상 사용자는 JWT의 `sub`로만 결정되며, 다른 사용자 ID를 지정할 수 있는 쿼리/path parameter 분기를 제공하지 않는다 (사용자 격리).

### 3.4 REQ-ORM-VAL: 입력 검증

**REQ-ORM-VAL-001** (Event-Driven)
사용자가 `PUT /users/me/1rm/:exerciseType`의 본문 `value`에 양수가 아닌 값(0, 음수, 비숫자)을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다. 허용 범위는 `0 < value <= 500` (kg)이다.

**REQ-ORM-VAL-002** (Event-Driven)
사용자가 `PUT /users/me/1rm/:exerciseType`의 본문 `value`에 `500`(kg)을 초과하는 값을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다 (비현실적인 값에 대한 방어).

**REQ-ORM-VAL-003** (Event-Driven)
사용자가 `POST /users/me/1rm/estimate`의 본문 `weight`에 양수가 아닌 값(0, 음수, 비숫자) 또는 `500` 초과 값을 지정했을 때, 시스템은 `400 Bad Request`를 반환하고 계산을 수행하지 않아야 한다.

**REQ-ORM-VAL-004** (Event-Driven)
사용자가 `POST /users/me/1rm/estimate`의 본문 `reps`에 정수 `1` 미만 또는 `10` 초과 값을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다. 허용 범위는 `1 <= reps <= 10`이며, 이는 1RM 추정 공식이 10reps 이내에서 합리적인 정확도를 가지는 한계 때문이다.

**REQ-ORM-VAL-005** (Event-Driven)
사용자가 `POST /users/me/1rm/estimate`의 본문 `reps`에 정수가 아닌 값(예: `5.5`, `"abc"`)을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다.

**REQ-ORM-VAL-006** (Ubiquitous)
시스템은 두 엔드포인트(`PUT`, `POST estimate`)의 본문 검증을 NestJS `ValidationPipe` + `class-validator`(`@IsNumber`, `@IsInt`, `@Min`, `@Max`, `@IsPositive`)로 일관되게 수행해야 한다. 검증 실패 시 응답 본문에 어떤 필드가 실패했는지 명시한다.

**숫자 문자열 변환 정책 (확정)**: 본 SPEC은 NestJS 전역 `ValidationPipe({ transform: true })`(NFR-ORM-SEC-004)를 표준으로 채택하므로, 정수로 변환 가능한 숫자 문자열(예: `reps="5"`, `weight="100"`)은 `class-transformer`에 의해 자동으로 해당 타입(정수/실수)으로 변환되어 유효한 요청으로 처리된다. 변환에 실패한 문자열(예: `reps="abc"`, `reps="5.5"`)은 `@IsInt` 등 검증 단계에서 거부되어 `400 Bad Request`를 반환한다.

**REQ-ORM-VAL-007** (Event-Driven, 라우트 매칭 검증)
사용자가 `POST /users/me/1rm/estimate` 요청을 보냈을 때, 시스템은 `200 OK`와 추정 결과를 반환해야 하며, `PUT /users/me/1rm/:exerciseType` 형식의 라우트와 충돌 없이 올바르게 라우팅되어야 한다. 동일 메서드의 추가 라우트가 후속 SPEC에서 도입될 가능성에 대비해 컨트롤러 메서드 정의 순서 등 구체적인 구현 가이드는 plan.md에 위임한다(SPEC-EXERCISE-001 REQ-EX-FAV-012의 교훈 적용).

**REQ-ORM-VAL-008** (Event-Driven, 소수점 자릿수 제한)
사용자가 `PUT /users/me/1rm/:exerciseType`의 본문 `value` 또는 `POST /users/me/1rm/estimate`의 본문 `weight`에 소수점 2자리를 초과하는 값(예: `142.567`, `100.123`)을 지정했을 때, 시스템은 `400 Bad Request`를 반환해야 한다. 1RM 값은 운동 환경에서 0.01 kg 단위 이하의 정밀도가 의미가 없으므로 입력 단계에서 소수점 자릿수를 제한한다.

### 3.5 NFR-ORM: 비기능 요구사항

#### NFR-ORM-PERF: 성능

- **NFR-ORM-PERF-001**: `GET /users/me/1rm` 응답 시간 P95 ≤ 100ms (단일 사용자의 최대 5건 조회).
- **NFR-ORM-PERF-002**: `PUT /users/me/1rm/:exerciseType` 응답 시간 P95 ≤ 150ms (upsert 1건).
- **NFR-ORM-PERF-003**: `POST /users/me/1rm/estimate` 응답 시간 P95 ≤ 50ms (DB 조회 없는 순수 계산).

#### NFR-ORM-SEC: 보안

- **NFR-ORM-SEC-001**: 모든 1RM 엔드포인트는 `JwtAuthGuard`로 보호되며, JWT 누락/만료 시 `401 Unauthorized`를 반환한다.
- **NFR-ORM-SEC-002**: 1RM 엔드포인트는 JWT payload의 `sub`(userId)만 사용하며, URL 경로나 쿼리 파라미터로 다른 사용자 ID를 받지 않는다 (REQ-ORM-INPUT-006, REQ-ORM-READ-005).
- **NFR-ORM-SEC-003**: 응답 본문에 다른 사용자의 1RM 데이터, 내부 ID(`id`), `userId`는 포함하지 않는다.
- **NFR-ORM-SEC-004**: NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`로 알 수 없는 필드를 차단하고 타입 변환을 수행한다. 본 SPEC의 모든 입력 DTO는 `class-validator` 데코레이터로 명시적 검증을 수행한다.

#### NFR-ORM-DATA: 데이터 무결성

- **NFR-ORM-DATA-001**: `OneRepMax(userId, exerciseType)`는 복합 UNIQUE 제약을 가져야 한다 (REQ-ORM-INPUT-004).
- **NFR-ORM-DATA-002**: `OneRepMax.userId`의 외래키는 `User.id`를 참조하며 `onDelete: Cascade`로 설정한다 (사용자 하드 삭제 시 1RM 데이터 자동 정리). 소프트 삭제(`User.deletedAt`, SPEC-USER-001)는 본 SPEC에서 능동적으로 처리하지 않는다.
- **NFR-ORM-DATA-003**: `OneRepMax.value`는 `Float` 타입이며 양수 조건(`value > 0`)을 DB 레벨 CHECK constraint로 보장하는 것이 이상적이나, Prisma의 제약 표현 한계로 인해 본 SPEC에서는 애플리케이션 레이어(`class-validator`)에서만 검증한다. DB 레벨 제약은 후속 운영 SPEC에서 raw migration으로 검토.

#### NFR-ORM-CONSISTENCY: 공유 유틸 일관성

- **NFR-ORM-CONSISTENCY-001**: `packages/utils/src/1rm.ts`와 `apps/mobile/utils/1rm.ts`(있을 경우)는 동일한 Epley/Brzycki 공식 구현을 사용해야 한다. 백엔드 측 추정 계산 결과와 모바일 측 사전 계산 결과가 동일 입력에 대해 일치해야 한다 (소수 둘째 자리 반올림 후 비교).
- **NFR-ORM-CONSISTENCY-002**: `packages/utils/src/1rm.ts`의 함수는 `calculateEpley(weight: number, reps: number): number`, `calculateBrzycki(weight: number, reps: number): number`, `calculateAverage1RM(weight: number, reps: number): number` 세 함수를 export하며, 입력 유효성 검증(reps 범위 1~10, weight > 0)은 호출 측에서 수행한다는 계약을 따른다.

#### NFR-ORM-MOBILE: 모바일 호환성

- **NFR-ORM-MOBILE-001**: 모바일 클라이언트(`app/(tabs)/my/1rm.tsx`)는 5종 컴파운드를 한 화면에 나열하며, 각 컴파운드에 대해 현재 1RM 값(또는 "미설정")과 입력 폼을 제공한다.
- **NFR-ORM-MOBILE-002**: 모바일 클라이언트는 추정 계산 입력 보조 UI에서 weight/reps 입력 시 `packages/utils/src/1rm.ts`를 사용하여 사전 계산값을 표시할 수 있으며, 사용자가 "이 값을 1RM으로 저장" 선택 시 `PUT /users/me/1rm/:exerciseType`을 호출한다 (`source`는 `DIRECT_INPUT`으로 기록되며 출처 추적은 본 SPEC 범위 밖이다).
- **NFR-ORM-MOBILE-003**: 모바일 클라이언트는 TanStack Query를 사용하여 `GET /users/me/1rm`을 캐싱하며, `PUT` 성공 시 `queryClient.invalidateQueries(['1rm'])`로 캐시를 무효화한다.

---

## 4. 데이터 모델 (Data Model)

본 절은 Prisma 스키마 변경 사항을 정의한다. 기존 `prisma/schema.prisma`의 `User` 모델에 역참조를 추가하고, `OneRepMax` 모델 및 두 enum(`CompoundType`, `OrmSource`)을 신설한다.

### 4.1 OneRepMax 모델 (신규)

```prisma
model OneRepMax {
  id           String       @id @default(cuid())
  userId       String
  exerciseType CompoundType
  value        Float                        // kg, must be > 0 (애플리케이션 레이어 검증)
  source       OrmSource                    // 출처 (직접 입력 / 추정 공식)
  updatedAt    DateTime     @updatedAt
  createdAt    DateTime     @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, exerciseType])          // 사용자당 컴파운드별 1건만 보장
  @@index([userId])                          // GET /users/me/1rm 조회 최적화
}
```

**설계 결정**:
- `(userId, exerciseType)` 복합 UNIQUE: 컴파운드별 최신값 1건만 유지 (NFR-ORM-DATA-001, REQ-ORM-INPUT-004).
- `onDelete: Cascade`: 사용자 하드 삭제 시 자동 정리 (NFR-ORM-DATA-002). 소프트 삭제는 본 SPEC에서 능동 처리하지 않음.
- `value` 타입은 `Float`: kg 단위, 양수 (애플리케이션 레이어에서 `0 < value <= 500` 검증).
- `source` 필드: `DIRECT_INPUT` 외 추정 출처를 enum으로 정의해 두어 후속 SPEC에서 사용 (본 SPEC에서는 `DIRECT_INPUT`만 저장).
- `updatedAt`: Prisma `@updatedAt`으로 자동 갱신.
- `createdAt`: 최초 생성 시각(응답에서 노출하지 않음, 운영 디버깅용).

### 4.2 CompoundType enum (신규)

```prisma
enum CompoundType {
  SQUAT
  DEADLIFT
  BENCH_PRESS
  BARBELL_ROW
  OVERHEAD_PRESS
}
```

**한국어 매핑** (모바일 UI 표시용, 백엔드 enum은 영문):

| enum 값 | 한국어 표시 | Free Exercise DB 매핑 (SPEC-EXERCISE-001 참고) |
|---|---|---|
| `SQUAT` | 스쿼트 | Barbell Squat |
| `DEADLIFT` | 데드리프트 | Barbell Deadlift |
| `BENCH_PRESS` | 벤치프레스 | Barbell Bench Press |
| `BARBELL_ROW` | 바벨 로우 | Bent Over Barbell Row |
| `OVERHEAD_PRESS` | 오버헤드프레스 | Barbell Shoulder Press |

본 SPEC에서는 `OneRepMax.exerciseType`과 `Exercise.id`(SPEC-EXERCISE-001)를 직접 외래키로 연결하지 않는다. 컴파운드 식별은 enum으로 충분하며, 운동 도감과의 연결은 후속 SPEC(SPEC-WORKOUT-001)에서 검토.

### 4.3 OrmSource enum (신규)

```prisma
enum OrmSource {
  DIRECT_INPUT
  EPLEY_ESTIMATE
  BRZYCKI_ESTIMATE
  AVERAGE_ESTIMATE
}
```

**설계 결정**:
- `DIRECT_INPUT`: 사용자가 `PUT /users/me/1rm/:exerciseType`로 직접 입력한 값 (본 SPEC에서 유일하게 저장되는 값).
- `EPLEY_ESTIMATE`, `BRZYCKI_ESTIMATE`, `AVERAGE_ESTIMATE`: 후속 SPEC-WORKOUT-001에서 운동 세션 기록 시 자동 계산되는 1RM의 출처. 본 SPEC에서는 enum에 정의만 해 두고 실제로는 저장하지 않는다.
- enum을 미리 정의하는 이유: 후속 SPEC에서 마이그레이션을 다시 만들지 않고 즉시 사용할 수 있도록 데이터 모델을 안정화한다.

### 4.4 User 모델 (역참조 추가)

```prisma
model User {
  // ... (existing fields from SPEC-AUTH-001 / SPEC-USER-001)
  oneRepMaxes  OneRepMax[]
}
```

`User`와 `OneRepMax`는 1:N 관계(`User --< OneRepMax`)이며, 본 SPEC 범위에서 한 사용자는 최대 5건(`CompoundType` 5종)만 가진다.

---

## 5. API 명세 (API Specification)

본 절은 본 SPEC이 정의하는 3개 엔드포인트의 요청·응답 구조를 명시한다. 모든 엔드포인트는 `JwtAuthGuard`로 보호된다.

### 5.1 GET /users/me/1rm

**용도**: 현재 사용자의 5종 컴파운드 1RM 상태 조회.

**Path Parameters**: 없음

**Query Parameters**: 없음

**Response 200 OK**:
```json
{
  "SQUAT": {
    "exerciseType": "SQUAT",
    "value": 140.0,
    "source": "DIRECT_INPUT",
    "updatedAt": "2026-05-11T09:30:00.000Z"
  },
  "DEADLIFT": {
    "exerciseType": "DEADLIFT",
    "value": 180.0,
    "source": "DIRECT_INPUT",
    "updatedAt": "2026-05-10T14:00:00.000Z"
  },
  "BENCH_PRESS": {
    "exerciseType": "BENCH_PRESS",
    "value": 100.0,
    "source": "DIRECT_INPUT",
    "updatedAt": "2026-05-11T09:45:00.000Z"
  },
  "BARBELL_ROW": null,
  "OVERHEAD_PRESS": null
}
```

**Behavior**:
- 5종 컴파운드 키는 항상 응답 객체에 존재한다 (REQ-ORM-READ-002).
- 사용자가 1RM을 설정하지 않은 컴파운드는 값이 `null`이다.
- 1RM 레코드가 있는 컴파운드는 `exerciseType`, `value`, `source`, `updatedAt`을 포함한 객체로 반환된다.

**Error Responses**:
- `401 Unauthorized`: JWT 누락/만료

### 5.2 PUT /users/me/1rm/:exerciseType

**용도**: 특정 컴파운드의 1RM을 직접 입력하여 저장(upsert).

**Path Parameters**:
- `exerciseType`: `CompoundType` enum 값 중 하나 (`SQUAT` | `DEADLIFT` | `BENCH_PRESS` | `BARBELL_ROW` | `OVERHEAD_PRESS`)

**Request Body**:
```json
{
  "value": 142.5
}
```

| 필드 | 타입 | 검증 | 설명 |
|---|---|---|---|
| `value` | number | `> 0` AND `<= 500`, kg | 1RM 값 |

**Response Codes** (REQ-ORM-INPUT-001):
- **`201 Created`**: 신규 1RM 레코드를 생성한 경우 (사용자가 해당 컴파운드에 대해 처음 입력).
- **`200 OK`**: 기존 레코드를 업데이트한 경우.

**Response Body** (두 코드 동일):
```json
{
  "exerciseType": "SQUAT",
  "value": 142.5,
  "source": "DIRECT_INPUT",
  "updatedAt": "2026-05-11T10:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`:
  - `:exerciseType`가 `CompoundType` enum에 정의되지 않은 값 (REQ-ORM-INPUT-003)
  - `value`가 양수가 아니거나 500 초과 (REQ-ORM-VAL-001, REQ-ORM-VAL-002)
  - `value`가 비숫자
- `401 Unauthorized`: JWT 누락/만료

### 5.3 POST /users/me/1rm/estimate

**용도**: weight + reps로부터 Epley/Brzycki 공식 기반 1RM 추정값 계산 (DB 저장 없음).

**Path Parameters**: 없음

**Request Body**:
```json
{
  "weight": 100,
  "reps": 5
}
```

| 필드 | 타입 | 검증 | 설명 |
|---|---|---|---|
| `weight` | number | `> 0` AND `<= 500`, kg | 들었던 무게 |
| `reps` | integer | `>= 1` AND `<= 10` | 반복 횟수 |

**Response 200 OK**:
```json
{
  "epley": 116.67,
  "brzycki": 112.5,
  "average": 114.58
}
```

| 필드 | 설명 | 계산 |
|---|---|---|
| `epley` | Epley 공식 결과 (kg, 소수 2자리 반올림) | `round2(weight * (1 + reps / 30))` |
| `brzycki` | Brzycki 공식 결과 (kg, 소수 2자리 반올림) | `round2(weight * (36 / (37 - reps)))` |
| `average` | 두 공식의 산술 평균 (kg, 소수 2자리 반올림) | `round2((epley_raw + brzycki_raw) / 2)` — 반올림 전 값의 평균을 반올림한다 (REQ-ORM-CALC-002 반올림 규칙 참조). 결과: `114.58` (NOT `114.59`). |

**Behavior**:
- 본 엔드포인트는 순수 계산(stateless)이다. 어떠한 DB 쓰기 작업도 수행하지 않는다 (REQ-ORM-CALC-003).
- 결과는 응답으로만 반환되며 클라이언트가 `PUT /users/me/1rm/:exerciseType`을 별도로 호출하여 저장 여부를 결정한다.

**Error Responses**:
- `400 Bad Request`:
  - `weight`가 양수가 아니거나 500 초과 (REQ-ORM-VAL-003)
  - `reps`가 1 미만 또는 10 초과 (REQ-ORM-VAL-004)
  - `reps`가 정수가 아님 (REQ-ORM-VAL-005)
- `401 Unauthorized`: JWT 누락/만료

**참고 (라우트 정합성)**: `POST /users/me/1rm/estimate`는 HTTP 메서드가 `POST`로 `PUT /users/me/1rm/:exerciseType`와 다르므로 NestJS 라우트 매칭에서 자체적 충돌은 없다. REQ-ORM-VAL-007은 본 엔드포인트가 `200 OK`와 추정 결과를 반환하며 `:exerciseType` 동적 경로와 혼동되지 않고 올바르게 라우팅되어야 한다는 행위 요구사항이다. 컨트롤러 메서드 정의 순서(고정 경로 우선) 등 구체적인 구현 가이드는 plan.md에 정의한다 (SPEC-EXERCISE-001 REQ-EX-FAV-012의 교훈 적용).

---

## 6. 1RM 추정 공식 (Estimation Formulas)

본 SPEC에서 사용하는 1RM 추정 공식은 운동 과학 분야에서 널리 검증된 두 공식이며, `packages/utils/src/1rm.ts`에 구현되어 있다 (기 작성).

### 6.1 Epley 공식

```
1RM_epley = weight * (1 + reps / 30)
```

- 출처: Boyd Epley (1985).
- 특징: 단순한 선형 모델. reps가 작을수록 보수적인 추정.
- 권장 적용 범위: 1~10 reps.

### 6.2 Brzycki 공식

```
1RM_brzycki = weight * (36 / (37 - reps))
```

- 출처: Matt Brzycki (1993).
- 특징: 비선형 모델. reps가 클수록 Epley보다 작은 값을 반환하는 경향.
- 권장 적용 범위: 1~10 reps (reps가 37 이상이면 분모가 0이 되어 정의되지 않음; 본 SPEC은 reps ≤ 10으로 제한).

### 6.3 Average (산술 평균)

```
1RM_average = round2((1RM_epley_raw + 1RM_brzycki_raw) / 2)
```

- 두 공식의 편향을 상쇄하여 단일 추정값을 제공.
- 본 SPEC의 `POST /users/me/1rm/estimate` 응답의 `average` 필드.
- **반올림 정책 (REQ-ORM-CALC-002)**: 반올림 전 Epley/Brzycki 값의 산술 평균을 먼저 계산하고, 그 결과만 소수점 2자리로 반올림한다. 응답의 `epley`/`brzycki`(반올림된 값)를 다시 평균내지 않는다.

### 6.4 reps 범위 제약 (1~10)

본 SPEC은 `reps` 범위를 `1 <= reps <= 10`으로 제한한다 (REQ-ORM-VAL-004). 사유:
- 10reps를 초과하면 두 공식의 추정 정확도가 급격히 떨어진다 (체력적 한계, 폼 붕괴, 신경계 피로 등).
- Brzycki 공식은 수학적으로 reps < 37에서만 정의되며, 실용적으로는 10 이내가 권장된다.
- 1RM 자체는 reps=1을 의미하므로 reps=1 입력 시 weight = 1RM이며 추정 결과는 weight와 동일.

---

## 7. 제외 사항 (Exclusions - What NOT to Build)

본 SPEC에서 **명시적으로 제외하는 항목**은 다음과 같다. 이는 후속 SPEC 또는 영구 비목표로 분류된다.

1. **운동 세션 기록 및 RPE 기반 자동 1RM 추정**: `Workout`, `WorkoutSet` 모델 및 세션 기록 시 자동으로 1RM을 갱신하는 로직은 SPEC-WORKOUT-001(후속)에서 다룬다. 본 SPEC의 `OrmSource` enum에 `EPLEY_ESTIMATE`, `BRZYCKI_ESTIMATE`, `AVERAGE_ESTIMATE`는 정의되지만 본 SPEC에서는 저장되지 않는다.
2. **1RM 이력 타임라인 (history table)**: `OneRepMaxHistory` 테이블 등 시계열 이력 추적은 본 SPEC 범위 밖이다. 컴파운드별 최신값 1건만 유지한다 (upsert 패턴).
3. **5종 컴파운드 이외의 운동의 1RM**: 풀업, 바이셉 컬, 레그프레스, 케이블 등 컴파운드 운동 5종 외의 운동에 대한 1RM 관리는 본 SPEC 범위 밖이다. `CompoundType` enum 확장은 후속 SPEC에서 검토.
4. **추가 1RM 추정 공식**: Lombardi(`weight * reps^0.1`), Mayhew, O'Conner 등의 공식은 본 SPEC 범위 밖이다. Epley + Brzycki + Average만 제공.
5. **Admin 다른 사용자 1RM 조회/수정**: `GET /admin/users/:id/1rm` 등 운영 엔드포인트는 본 SPEC 범위 밖이다.
6. **1RM 단위 변환 (lb ↔ kg)**: 모든 값은 kg로 통일한다. 파운드 입력/표시는 본 SPEC 범위 밖이며, 후속 localization SPEC에서 검토.
7. **1RM 기반 운동 강도 추천**: `1RM의 70%로 8reps 권장` 등의 자동 추천은 본 SPEC 범위 밖이다. 후속 SPEC-AI-RECOMMEND-XXX 또는 SPEC-WORKOUT-001에서 다룸.
8. **1RM 그래프/차트 시각화**: 이력 데이터가 없으므로 시각화는 본 SPEC 범위 밖이다. SPEC-WORKOUT-001 완료 후 운동 세션 기반 1RM 변화 그래프를 후속 SPEC에서 검토.
9. **1RM 변경 알림/푸시**: 사용자의 1RM이 갱신될 때 푸시 알림을 보내는 기능은 본 SPEC 범위 밖이다.
10. **1RM 데이터 export (CSV, JSON 다운로드)**: 사용자가 자기 1RM 데이터를 다운로드하는 기능은 본 SPEC 범위 밖이다. GDPR 데이터 이동권 관련은 후속 운영 SPEC에서 검토.
11. **운동 도감과의 외래키 연결**: `OneRepMax.exerciseType`(enum)과 `Exercise.id`(SPEC-EXERCISE-001) 사이의 외래키는 본 SPEC에서 생성하지 않는다. 컴파운드 enum으로 식별이 충분하며, 운동 도감 연결은 SPEC-WORKOUT-001에서 검토.
12. **소프트 삭제 사용자의 1RM 정리**: `User.deletedAt`이 설정된 사용자의 1RM 데이터를 능동적으로 삭제하지 않는다. `onDelete: Cascade`로 향후 하드 삭제 시점에 정리된다.
13. **1RM 기록 공유 (소셜)**: 다른 사용자와 1RM을 공유하거나 비교하는 소셜 기능은 본 SPEC 범위 밖이다.

---

## 8. mx_plan (MX Tag Annotation Targets)

### 8.1 @MX:ANCHOR 대상 (high fan_in 함수)

- `one-rep-max.service.ts :: getAll(userId)`: 5종 컴파운드 1RM 조회 단일 진입점, `GET /users/me/1rm`이 의존.
- `one-rep-max.service.ts :: upsert(userId, exerciseType, value)`: 1RM 입력 단일 진입점, `PUT /users/me/1rm/:exerciseType`이 의존. upsert 멱등성 보장 지점.
- `one-rep-max.service.ts :: estimate(weight, reps)`: 1RM 추정 계산 단일 진입점, `POST /users/me/1rm/estimate`가 의존. `packages/utils/src/1rm.ts`의 unique caller.
- `packages/utils/src/1rm.ts :: calculateEpley/calculateBrzycki/calculateAverage1RM`: 백엔드와 모바일 양쪽이 의존하는 공식 구현 지점.
- `one-rep-max-response.dto.ts :: toResponse(record)`: 응답 변환 단일 지점, `id`/`userId` 제외 불변식.

### 8.2 @MX:WARN 대상 (danger zone, requires @MX:REASON)

- `one-rep-max.service.ts :: upsert()`: 동일 사용자가 같은 컴파운드를 동시에 PUT 요청 시 race condition으로 unique constraint 위반 가능 (REASON: REQ-ORM-INPUT-004 멱등성 — Prisma `upsert` 또는 PostgreSQL `ON CONFLICT` 사용 필수).
- `one-rep-max.controller.ts :: estimate vs :exerciseType`: HTTP 메서드가 달라 자체 충돌은 없으나, 향후 동일 메서드 추가 라우트 대비 명시적 메서드 순서 제어 (REASON: REQ-ORM-VAL-007, SPEC-EXERCISE-001의 라우트 충돌 교훈 적용).
- `packages/utils/src/1rm.ts :: calculateBrzycki()`: `reps >= 37`이면 분모가 0이 되어 `Infinity` 반환 (REASON: 호출 측에서 reps ≤ 10 검증 필수 — REQ-ORM-VAL-004).

### 8.3 @MX:NOTE 대상

- `one-rep-max.service.ts :: getAll(userId)`: 5종 컴파운드 모두를 keys로 가지는 응답 객체 빌드 로직 명시. DB에 없는 컴파운드는 `null` 채움 (REQ-ORM-READ-002).
- `one-rep-max.controller.ts`: 라우트 메서드 정의 순서 — `estimate` 고정 경로를 `:exerciseType` 동적 경로보다 먼저 등록 (REQ-ORM-VAL-007).
- `one-rep-max-input.dto.ts`: `value` 범위(0 < value <= 500), `reps` 범위(1 ≤ reps ≤ 10), `weight` 범위 검증 데코레이터 모음.
- `prisma/schema.prisma`: `OneRepMax.source` 필드가 `OrmSource` enum 중 `DIRECT_INPUT`만 본 SPEC에서 저장됨을 주석으로 명시.

### 8.4 @MX:TODO 대상 (후속 SPEC에서 해소)

- RPE 기반 자동 1RM 추정 (`EPLEY_ESTIMATE`, `BRZYCKI_ESTIMATE`, `AVERAGE_ESTIMATE` 출처) — SPEC-WORKOUT-001로 이관.
- 1RM 이력 타임라인 (`OneRepMaxHistory` 모델) — 후속 SPEC.
- 컴파운드 외 운동의 1RM (`CompoundType` enum 확장) — 후속 SPEC.
- 1RM 그래프 시각화 — SPEC-WORKOUT-001 완료 후 검토.
- 1RM 단위 변환 (lb/kg) — localization SPEC.

---

## 9. 추적성 매트릭스 (Traceability Matrix)

| REQ ID | acceptance.md 시나리오 | 출처 |
|--------|------------------------|------|
| REQ-ORM-INPUT-001 | AC-ORM-INPUT-01, AC-ORM-UPSERT-01 | 사용자 인터뷰 (직접 입력 + 5종 컴파운드) |
| REQ-ORM-INPUT-002 | AC-ORM-INPUT-01 | API 응답 일관성 |
| REQ-ORM-INPUT-003 | AC-ORM-INPUT-02 | 입력 검증 |
| REQ-ORM-INPUT-004 | AC-ORM-UPSERT-01 | 데이터 모델 결정 (no history table) |
| REQ-ORM-INPUT-005 | AC-ORM-SECURITY-01 | NFR-ORM-SEC-001 |
| REQ-ORM-INPUT-006 | AC-ORM-SECURITY-02, AC-ORM-SECURITY-03 | NFR-ORM-SEC-002 (권한 격리) |
| REQ-ORM-INPUT-006a | AC-ORM-SECURITY-02, AC-ORM-SECURITY-03 | NFR-ORM-SEC-002 (권한 격리) |
| REQ-ORM-INPUT-007 | AC-ORM-INPUT-01 | OrmSource enum 사용 규약 |
| REQ-ORM-CALC-001 | AC-ORM-CALC-01 | 사용자 인터뷰 (Epley/Brzycki 추정) |
| REQ-ORM-CALC-002 | AC-ORM-CALC-01 | API 응답 일관성 |
| REQ-ORM-CALC-003 | AC-ORM-CALC-02 | 사용자 인터뷰 (계산만, 저장 안 함) |
| REQ-ORM-CALC-004 | AC-ORM-SECURITY-01 | NFR-ORM-SEC-001 |
| REQ-ORM-CALC-005 | AC-ORM-CONSISTENCY-01 | NFR-ORM-CONSISTENCY-001 |
| REQ-ORM-READ-001 | AC-ORM-READ-01 | 사용자 인터뷰 (5종 한 번에) |
| REQ-ORM-READ-002 | AC-ORM-EMPTY-01 | 사용자 인터뷰 (미설정 시 null, 404 아님) |
| REQ-ORM-READ-003 | AC-ORM-READ-01 | NFR-ORM-SEC-003 |
| REQ-ORM-READ-004 | AC-ORM-SECURITY-01 | NFR-ORM-SEC-001 |
| REQ-ORM-READ-005 | AC-ORM-SECURITY-02 | NFR-ORM-SEC-002 |
| REQ-ORM-VAL-001 | AC-ORM-VALIDATION-01 | 입력 검증 (양수) |
| REQ-ORM-VAL-002 | AC-ORM-VALIDATION-02 | 입력 검증 (500kg 상한) |
| REQ-ORM-VAL-003 | AC-ORM-CALC-INVALID-01 | 입력 검증 |
| REQ-ORM-VAL-004 | AC-ORM-CALC-INVALID-02 | Brzycki 분모 안전성, 추정 정확도 |
| REQ-ORM-VAL-005 | AC-ORM-CALC-INVALID-03 | 입력 검증 (정수) |
| REQ-ORM-VAL-006 | AC-ORM-VALIDATION-01, AC-ORM-CALC-INVALID-01 | ValidationPipe 표준 |
| REQ-ORM-VAL-007 | AC-ORM-ROUTE-01 | SPEC-EXERCISE-001 REQ-EX-FAV-012 교훈 |
| REQ-ORM-VAL-008 | AC-ORM-VALIDATION-03 | 입력 정밀도 제한 (소수점 2자리) |
| NFR-ORM-PERF-001~003 | AC-ORM-PERF-01 | 성능 SLO |
| NFR-ORM-SEC-001~004 | AC-ORM-SECURITY-01, AC-ORM-SECURITY-02 | OWASP A01 |
| NFR-ORM-DATA-001~003 | AC-ORM-UPSERT-01 | 데이터 무결성 |
| NFR-ORM-CONSISTENCY-001~002 | AC-ORM-CONSISTENCY-01 | 공유 유틸 일관성 |
| NFR-ORM-MOBILE-001~003 | (모바일 수동 검증) | 모바일 UX |
