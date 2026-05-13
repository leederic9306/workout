# SPEC-1RM-001 인수 기준 (Acceptance Criteria)

본 문서는 SPEC-1RM-001의 모든 EARS 요구사항에 대한 검증 가능한 Given-When-Then 시나리오를 정의한다. 모든 자동화 시나리오는 단위 테스트, 통합 테스트, E2E 테스트 중 하나 이상으로 자동화되어야 한다. 수동 검증 시나리오는 Section 11에 별도 정리되며 DoD의 자동화 요구에서 명시적으로 제외된다.

전제:
- SPEC-AUTH-001 v1.0.1이 이미 구현되어 있다 (`JwtAuthGuard`, `JwtStrategy`, `@CurrentUser()` 데코레이터 존재).
- SPEC-USER-001 v1.0.1이 구현되어 있다 (`User.deletedAt` 컬럼 존재).
- Prisma 마이그레이션이 완료된 PostgreSQL DB가 존재한다 (`OneRepMax` 테이블, `CompoundType`/`OrmSource` enum).
- `packages/utils/src/1rm.ts`의 `calculateEpley`, `calculateBrzycki`, `calculateAverage1RM` 함수가 구현되어 있다.
- 테스트 환경의 사용자 `U1`, `U2` (둘 다 일반 USER 권한, 온보딩 완료)가 존재하며 각자 유효한 Access Token `T1`, `T2`를 보유한다.

---

## 1. 1RM 직접 입력 (AC-ORM-INPUT)

### AC-ORM-INPUT-01: PUT /users/me/1rm/:exerciseType — 신규 입력 (201 Created)

**Given**:
- 사용자 `U1`이 `SQUAT` 컴파운드에 대한 1RM을 아직 설정하지 않은 상태 (`OneRepMax(userId=U1.id, exerciseType=SQUAT)` 미존재).
- `U1`의 유효한 Access Token `T1`.

**When**:
- 클라이언트가 `PUT /users/me/1rm/SQUAT`를 다음 요청으로 전송:
  - 헤더: `Authorization: Bearer T1`, `Content-Type: application/json`
  - 본문: `{ "value": 140.0 }`

**Then**:
- 응답 상태 코드는 **`201 Created`** (신규 레코드 생성).
- 응답 본문은 다음 필드를 포함:
  - `exerciseType: "SQUAT"`
  - `value: 140.0`
  - `source: "DIRECT_INPUT"`
  - `updatedAt`: 유효한 ISO 8601 타임스탬프
- 응답 본문에 `id`, `userId`, `createdAt`은 포함되지 않음 (REQ-ORM-READ-003, NFR-ORM-SEC-003).
- DB에 `OneRepMax(userId=U1.id, exerciseType=SQUAT, value=140.0, source=DIRECT_INPUT)` 레코드가 생성됨.
- 후속 `GET /users/me/1rm` 호출 시 응답의 `SQUAT` 키 값이 위 레코드를 반영한다.

**검증 매핑**: REQ-ORM-INPUT-001, REQ-ORM-INPUT-002, REQ-ORM-INPUT-007, NFR-ORM-SEC-003

### AC-ORM-INPUT-02: PUT /users/me/1rm/:exerciseType — 잘못된 enum 값

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 path parameter로 `PUT /users/me/1rm/:exerciseType` 호출 (본문 `{ value: 100 }`):
  1. `/PULL_UP` (CompoundType에 없는 값)
  2. `/squat` (소문자, enum 대소문자 위반)
  3. `/INVALID`
  4. `/SQUAT2`
  5. `/` (빈 값, NestJS 라우트 매칭 실패 가능)

**Then**:
- 케이스 1~4: 응답 상태 코드는 `400 Bad Request` (NestJS `ParseEnumPipe`에 의한 enum 검증 실패).
- 케이스 5: 응답 상태 코드는 `404 Not Found` 또는 `400` (라우트 매칭 자체 실패, NestJS 기본 동작).
- 모든 경우 DB에 `OneRepMax` 레코드가 생성되지 않음.

**검증 매핑**: REQ-ORM-INPUT-003

---

## 2. 1RM 갱신 (AC-ORM-UPSERT)

### AC-ORM-UPSERT-01: PUT /users/me/1rm/:exerciseType — 기존 값 갱신 (200 OK, upsert 멱등성)

**Given**:
- AC-ORM-INPUT-01 직후 상태: `OneRepMax(userId=U1.id, exerciseType=SQUAT, value=140.0, source=DIRECT_INPUT, updatedAt=t1)` 존재.
- `U1`의 유효한 Access Token `T1`.

**When**:
- 같은 컴파운드에 대해 `PUT /users/me/1rm/SQUAT`를 다음 본문으로 호출 (시각 `t2 > t1`):
  - 본문: `{ "value": 145.5 }`

**Then**:
- 응답 상태 코드는 **`200 OK`** (기존 레코드 업데이트, REQ-ORM-INPUT-001의 분기).
- 응답 본문:
  - `exerciseType: "SQUAT"`
  - `value: 145.5` (갱신된 값)
  - `source: "DIRECT_INPUT"`
  - `updatedAt`: `t1`보다 큰 새로운 ISO 8601 타임스탬프
- DB에 `OneRepMax` 레코드는 여전히 1건만 존재 (`@@unique([userId, exerciseType])` 제약, NFR-ORM-DATA-001).
- `value`는 140.0 → 145.5로 갱신되었으며, `updatedAt`이 새 값으로 변경됨.
- `id`(cuid)는 변경되지 않음 (upsert는 기존 레코드를 업데이트).

**검증 매핑**: REQ-ORM-INPUT-001, REQ-ORM-INPUT-004, NFR-ORM-DATA-001

---

## 3. 1RM 추정 계산 (AC-ORM-CALC)

### AC-ORM-CALC-01: POST /users/me/1rm/estimate — 정상 계산

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- `POST /users/me/1rm/estimate`를 다음 본문으로 호출:
  - 본문: `{ "weight": 100, "reps": 5 }`

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문은 다음 3개 필드 외 다른 필드를 포함하지 않으며 값은 **정확히** 다음과 같다 (REQ-ORM-CALC-002 반올림 규칙 적용):
  - `epley`: **`116.67`** (수학값 `116.66666...` → `round2`로 반올림)
  - `brzycki`: **`112.5`** (수학값 `112.5` 그대로, JSON 직렬화 시 `112.5` 또는 `112.50`)
  - `average`: **`114.58`** (수학값 `(116.66666... + 112.5) / 2 = 114.58333...` → `round2`로 반올림)

**검증 참고 (확정 정책)**: 본 SPEC은 spec.md REQ-ORM-CALC-002에서 `average` 산출 순서를 다음과 같이 확정한다.

```
epley_raw    = weight * (1 + reps / 30)         // 반올림 전
brzycki_raw  = weight * (36 / (37 - reps))      // 반올림 전
average_raw  = (epley_raw + brzycki_raw) / 2    // 반올림 전 값들의 평균
average      = Math.round(average_raw * 100) / 100   // round half away from zero, 소수점 2자리
```

따라서 `weight=100, reps=5`인 경우 `average = 114.58`이며 `114.59`는 허용되지 않는다(반올림된 `epley`와 `brzycki`를 다시 평균내는 방식은 사용하지 않는다). 백엔드 결과는 `packages/utils/src/1rm.ts`의 결과와 정확히 일치해야 한다 (AC-ORM-CONSISTENCY-01).

**검증 매핑**: REQ-ORM-CALC-001, REQ-ORM-CALC-002

### AC-ORM-CALC-02: POST /users/me/1rm/estimate — DB 쓰기 없음 (순수 계산)

**Given**:
- DB에 임의의 1RM 레코드 N건 존재 (`prisma.oneRepMax.count() = N`, 임의의 N ≥ 0).
- `U1`의 유효한 Access Token `T1`.

**When**:
- `POST /users/me/1rm/estimate`를 본문 `{ weight: 100, reps: 5 }`로 100회 반복 호출.

**Then**:
- 모든 응답이 `200 OK`.
- 모든 응답이 동일한 결과를 반환 (같은 입력 → 같은 출력, stateless).
- `prisma.oneRepMax.count()`가 호출 전후 동일 (`= N`).
- 어떠한 `OneRepMax` 레코드도 생성/수정/삭제되지 않음.
- 백엔드 로그에 `oneRepMax.upsert`, `oneRepMax.create`, `oneRepMax.update`, `oneRepMax.delete` 호출이 발생하지 않음 (테스트에서는 Prisma 모킹 또는 SQL 로깅으로 검증).

**검증 매핑**: REQ-ORM-CALC-003

---

## 4. 추정 계산 입력 검증 (AC-ORM-CALC-INVALID)

### AC-ORM-CALC-INVALID-01: POST /users/me/1rm/estimate — 잘못된 weight

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 본문으로 `POST /users/me/1rm/estimate` 호출:
  1. `{ "weight": 0, "reps": 5 }` (0)
  2. `{ "weight": -10, "reps": 5 }` (음수)
  3. `{ "weight": 501, "reps": 5 }` (상한 초과)
  4. `{ "weight": "abc", "reps": 5 }` (비숫자)
  5. `{ "reps": 5 }` (weight 누락)

**Then**:
- 모든 경우 응답 상태 코드는 `400 Bad Request`.
- 응답 본문에 `class-validator` 에러 메시지 포함 (`weight` 필드 명시).
- 계산이 수행되지 않으며 응답에 `epley`, `brzycki`, `average` 필드가 포함되지 않음.

**검증 매핑**: REQ-ORM-VAL-003, REQ-ORM-VAL-006

### AC-ORM-CALC-INVALID-02: POST /users/me/1rm/estimate — 잘못된 reps 범위

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 본문으로 `POST /users/me/1rm/estimate` 호출:
  1. `{ "weight": 100, "reps": 0 }` (0)
  2. `{ "weight": 100, "reps": -1 }` (음수)
  3. `{ "weight": 100, "reps": 11 }` (10 초과)
  4. `{ "weight": 100, "reps": 100 }` (대폭 초과)
  5. `{ "weight": 100 }` (reps 누락)

**Then**:
- 모든 경우 응답 상태 코드는 `400 Bad Request`.
- 응답 본문에 `reps` 필드의 범위 위반 메시지 포함.
- 계산이 수행되지 않으며 응답에 `epley`, `brzycki`, `average` 필드가 포함되지 않음.

**검증 매핑**: REQ-ORM-VAL-004, REQ-ORM-VAL-006

### AC-ORM-CALC-INVALID-03: POST /users/me/1rm/estimate — reps가 정수가 아님

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 본문으로 `POST /users/me/1rm/estimate` 호출:
  1. `{ "weight": 100, "reps": 5.5 }` (실수)
  2. `{ "weight": 100, "reps": "5" }` (정수 문자열)
  3. `{ "weight": 100, "reps": "abc" }` (비숫자 문자열)
  4. `{ "weight": 100, "reps": null }`

**Then (확정 정책)**:
- **케이스 1**: 응답 `400 Bad Request`. `reps` 필드의 `@IsInt()` 검증 위반.
- **케이스 2**: 응답 **`200 OK`**, 추정 결과(`epley`, `brzycki`, `average`) 반환. NestJS 전역 `ValidationPipe({ transform: true })` 설정(NFR-ORM-SEC-004)에 따라 `class-transformer`가 정수로 변환 가능한 문자열을 자동으로 정수로 변환하여 `5`로 처리한다. `weight="100", reps="5"`의 경우 `weight=100, reps=5`와 동일한 응답을 반환한다.
- **케이스 3**: 응답 `400 Bad Request`. `reps`가 정수로 변환될 수 없으므로 검증 단계에서 거부.
- **케이스 4**: 응답 `400 Bad Request`. `reps=null`은 필수 필드 누락 또는 타입 위반.
- 실패한 경우(케이스 1, 3, 4)는 계산이 수행되지 않으며 응답에 `epley`, `brzycki`, `average` 필드가 포함되지 않는다.

**확정 정책 근거**: spec.md REQ-ORM-VAL-006 숫자 문자열 변환 정책 및 NFR-ORM-SEC-004 `ValidationPipe({ transform: true })` 전역 설정에 따른다.

**검증 매핑**: REQ-ORM-VAL-005, REQ-ORM-VAL-006

---

## 5. 1RM 조회 (AC-ORM-READ)

### AC-ORM-READ-01: GET /users/me/1rm — 일부 설정된 상태

**Given**:
- `U1`이 다음 1RM을 설정한 상태:
  - `SQUAT`: 140 kg, `source=DIRECT_INPUT`, `updatedAt=2026-05-11T09:30:00.000Z`
  - `DEADLIFT`: 180 kg, `source=DIRECT_INPUT`, `updatedAt=2026-05-10T14:00:00.000Z`
  - `BENCH_PRESS`: 100 kg, `source=DIRECT_INPUT`, `updatedAt=2026-05-11T09:45:00.000Z`
- `U1`은 `BARBELL_ROW`, `OVERHEAD_PRESS`는 설정하지 않음.
- `U1`의 유효한 Access Token `T1`.

**When**:
- `GET /users/me/1rm`을 `Authorization: Bearer T1` 헤더와 함께 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문은 정확히 5개 키 `SQUAT`, `DEADLIFT`, `BENCH_PRESS`, `BARBELL_ROW`, `OVERHEAD_PRESS`를 포함하며 누락된 키가 없다.
- 각 키의 값:
  - `SQUAT`, `DEADLIFT`, `BENCH_PRESS`: `{ exerciseType, value, source: "DIRECT_INPUT", updatedAt }` 객체. `value`와 `updatedAt`은 Given의 값을 반영한다.
  - `BARBELL_ROW`, `OVERHEAD_PRESS`: `null`.
- 응답 본문 어디에도 `id`, `userId`, `createdAt`은 포함되지 않음 (REQ-ORM-READ-003).

**참고**: 본 시나리오는 픽스처 값(`SQUAT=140`, `updatedAt` 등)을 명시적으로 검증하나, 운영 환경에서는 픽스처 의존을 줄이기 위해 `value > 0` 및 `updatedAt`이 유효한 ISO 8601 형식임을 검증하는 유연한 단위 테스트도 함께 작성한다.

**검증 매핑**: REQ-ORM-READ-001, REQ-ORM-READ-003

### AC-ORM-EMPTY-01: GET /users/me/1rm — 전무 상태 (모든 컴파운드 null)

**Given**:
- 신규 사용자 `U_NEW`가 어떤 1RM도 설정하지 않은 상태 (`OneRepMax WHERE userId=U_NEW.id`이 0건).
- `U_NEW`의 유효한 Access Token `T_NEW`.

**When**:
- `GET /users/me/1rm`을 호출.

**Then**:
- 응답 상태 코드는 **`200 OK`** (`404 Not Found` 아님).
- 응답 본문:
  ```json
  {
    "SQUAT": null,
    "DEADLIFT": null,
    "BENCH_PRESS": null,
    "BARBELL_ROW": null,
    "OVERHEAD_PRESS": null
  }
  ```
- 5개 키가 모두 존재하며 값은 모두 `null`.
- 어떠한 에러도 발생하지 않음.

**검증 매핑**: REQ-ORM-READ-002

---

## 6. 사용자 격리 및 보안 (AC-ORM-SECURITY)

### AC-ORM-SECURITY-01: 인증 누락/만료 시 401

**Given**:
- DB에 임의의 1RM 데이터 존재.

**When**:
- 다음 케이스로 1RM 엔드포인트 호출:
  1. `GET /users/me/1rm`을 `Authorization` 헤더 없이 호출.
  2. `PUT /users/me/1rm/SQUAT` (본문 `{ value: 100 }`)을 `Authorization: Bearer T_expired`로 호출.
  3. `POST /users/me/1rm/estimate` (본문 `{ weight: 100, reps: 5 }`)을 `Authorization: Bearer T_tampered`로 호출.

**Then**:
- 모든 경우 응답 상태 코드는 `401 Unauthorized`.
- 응답 본문에 1RM 데이터, 계산 결과, 사용자 정보가 포함되지 않음.
- DB 상태 변경 없음 (PUT 케이스에서도 레코드 미생성).

**검증 매핑**: REQ-ORM-INPUT-005, REQ-ORM-CALC-004, REQ-ORM-READ-004, NFR-ORM-SEC-001

### AC-ORM-SECURITY-02: 사용자 격리 — 본인 데이터만 접근

**Given**:
- 사용자 `U1`이 `SQUAT=140 kg`을 설정한 상태.
- 사용자 `U2`가 `SQUAT=120 kg`을 설정한 상태.
- 두 사용자의 유효한 Access Token `T1`, `T2`.

**When**:
- 두 가지 시나리오를 실행:
  1. `GET /users/me/1rm`을 `T2`(U2의 토큰)로 호출.
  2. `PUT /users/me/1rm/SQUAT` 본문 `{ value: 200 }`을 `T2`로 호출.

**Then**:
- 시나리오 1:
  - 응답 `200 OK`, `SQUAT.value = 120` (U2의 값).
  - 응답에 U1의 데이터(`value=140`)는 포함되지 않음.
- 시나리오 2:
  - 응답 `200 OK` (U2의 기존 `SQUAT` 레코드가 갱신됨).
  - 응답의 `value = 200`.
  - DB의 `OneRepMax(userId=U2.id, exerciseType=SQUAT).value = 200`.
  - **U1의 데이터는 변경되지 않음**: `OneRepMax(userId=U1.id, exerciseType=SQUAT).value`는 여전히 `140`.
- 요청 경로/본문 어디에도 `userId`를 지정할 수 있는 분기가 없음 (REQ-ORM-INPUT-006, REQ-ORM-READ-005).

**검증 매핑**: REQ-ORM-INPUT-006, REQ-ORM-READ-005, NFR-ORM-SEC-002

### AC-ORM-SECURITY-03: 요청 바디의 userId 무시 (whitelist 동작)

**Given**:
- 사용자 `U1`이 `SQUAT=140 kg`을 설정한 상태 (`OneRepMax(userId=U1.id, exerciseType=SQUAT)` 존재).
- 사용자 `U2`가 `SQUAT=120 kg`을 설정한 상태.
- `U2`의 유효한 Access Token `T2`.

**When**:
- 클라이언트가 `T2`로 다음 요청을 보냄:
  - 시나리오 A: `PUT /users/me/1rm/SQUAT` 본문 `{ "value": 200, "userId": "<U1.id>" }` (다른 사용자 ID 주입 시도).
  - 시나리오 B: `PUT /users/me/1rm/SQUAT` 본문 `{ "value": 200, "userId": "<U2.id>" }` (본인 ID 명시 시도).

**Then**:
- **시나리오 A**: NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` 설정(NFR-ORM-SEC-004)에 따라 응답 상태는 `400 Bad Request`이며, 에러 메시지에 `property userId should not exist`가 포함된다. DB 변경 없음. U1.SQUAT=140, U2.SQUAT=120 그대로.
- **시나리오 B**: 시나리오 A와 동일하게 `400 Bad Request`. DTO에 정의되지 않은 필드(`userId`)가 차단된다.
- 어떤 경우에도 시스템은 요청 바디의 `userId`를 사용자 식별에 적용하지 않으며, 대상 사용자는 JWT `sub`(=U2)로만 결정된다 (REQ-ORM-INPUT-006, REQ-ORM-INPUT-006a).

**검증 매핑**: REQ-ORM-INPUT-006, REQ-ORM-INPUT-006a, NFR-ORM-SEC-002, NFR-ORM-SEC-004

---

## 7. 입력 검증 (AC-ORM-VALIDATION)

### AC-ORM-VALIDATION-01: PUT /users/me/1rm/:exerciseType — 잘못된 value (양수가 아님)

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 본문으로 `PUT /users/me/1rm/SQUAT` 호출:
  1. `{ "value": 0 }` (0)
  2. `{ "value": -10 }` (음수)
  3. `{ "value": "abc" }` (비숫자)
  4. `{ "value": null }`
  5. `{}` (필드 누락)

**Then**:
- 모든 경우 응답 상태 코드는 `400 Bad Request`.
- 응답 본문에 `value` 필드의 검증 에러 메시지 포함.
- DB에 `OneRepMax(userId=U1.id, exerciseType=SQUAT)` 레코드가 생성/갱신되지 않음.

**검증 매핑**: REQ-ORM-VAL-001, REQ-ORM-VAL-006

### AC-ORM-VALIDATION-02: PUT /users/me/1rm/:exerciseType — value 상한 초과 (500kg 초과)

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 본문으로 `PUT /users/me/1rm/DEADLIFT` 호출:
  1. `{ "value": 501 }` (상한 초과 1)
  2. `{ "value": 999 }` (대폭 초과)
  3. `{ "value": 1000000 }` (비현실적 큰 값)

**Then**:
- 모든 경우 응답 상태 코드는 `400 Bad Request`.
- 응답 본문에 `value` 필드의 `@Max(500)` 위반 메시지 포함.
- DB에 레코드 생성/갱신 없음.

**참고**: 상한 500kg은 비현실적 입력에 대한 방어이며, 현실의 1RM 세계기록(데드리프트 ~500kg)을 약간 초과하는 마진을 두었다. 향후 운영 데이터 분석을 통해 상한 조정 가능 (본 SPEC에서는 500 고정).

**검증 매핑**: REQ-ORM-VAL-002

### AC-ORM-VALIDATION-03: 소수점 자릿수 제한 (2자리 초과 시 400)

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 본문으로 1RM 엔드포인트를 호출:
  1. `PUT /users/me/1rm/SQUAT` 본문 `{ "value": 142.567 }` (소수점 3자리)
  2. `PUT /users/me/1rm/SQUAT` 본문 `{ "value": 100.1234 }` (소수점 4자리)
  3. `POST /users/me/1rm/estimate` 본문 `{ "weight": 100.123, "reps": 5 }` (소수점 3자리)
  4. `POST /users/me/1rm/estimate` 본문 `{ "weight": 100.5, "reps": 5 }` (소수점 1자리 — 유효, 대조군)
  5. `PUT /users/me/1rm/SQUAT` 본문 `{ "value": 142.5 }` (소수점 1자리 — 유효, 대조군)
  6. `PUT /users/me/1rm/SQUAT` 본문 `{ "value": 142.56 }` (소수점 2자리 — 유효, 경계값)

**Then**:
- **케이스 1~3**: 응답 상태 코드는 `400 Bad Request`. 응답 본문에 `value`(케이스 1, 2) 또는 `weight`(케이스 3) 필드의 `maxDecimalPlaces` 위반 메시지 포함. DB 변경 없음 (PUT 케이스).
- **케이스 4~6**: 응답 상태 코드는 `200 OK`(POST) 또는 `200/201`(PUT). 정상 처리됨.

**검증 매핑**: REQ-ORM-VAL-008, REQ-ORM-VAL-006

---

## 8. 백엔드/공유 유틸 일관성 (AC-ORM-CONSISTENCY)

### AC-ORM-CONSISTENCY-01: 백엔드 추정 결과가 공유 유틸과 동일

**Given**:
- `packages/utils/src/1rm.ts`의 `calculateEpley`, `calculateBrzycki`, `calculateAverage1RM` 함수가 구현되어 있음.
- 백엔드 `OneRepMaxService.estimate(weight, reps)`가 구현되어 있음.
- 입력 매트릭스: `weight ∈ {50, 100, 150, 200}`, `reps ∈ {1, 3, 5, 8, 10}` → 20개 조합.

**When**:
- 각 조합에 대해 두 가지 호출 수행:
  1. 백엔드 단위 테스트에서 `service.estimate(weight, reps)` 호출.
  2. 동일 조합으로 `packages/utils/src/1rm.ts`의 함수 직접 호출:
     - `calculateEpley(weight, reps)`
     - `calculateBrzycki(weight, reps)`
     - `calculateAverage1RM(weight, reps)`
  - 양쪽 결과를 모두 `Math.round(n * 100) / 100`으로 반올림.

**Then**:
- 모든 20개 조합에 대해 백엔드 결과 `(epley, brzycki, average)`가 공유 유틸 결과와 정확히 일치한다 (소수 2자리 반올림 후 비교).
- 어느 한 조합에서도 차이가 발생하지 않는다.

**검증 매핑**: REQ-ORM-CALC-005, NFR-ORM-CONSISTENCY-001, NFR-ORM-CONSISTENCY-002

### AC-ORM-CONSISTENCY-02: 100kg × 5reps 공식 결과 확정 검증

**Given**:
- 백엔드 `OneRepMaxService.estimate(weight, reps)`와 `packages/utils/src/1rm.ts`가 동일 반올림 규칙(REQ-ORM-CALC-002)을 구현하고 있음.

**When**:
- `POST /users/me/1rm/estimate` 본문 `{ "weight": 100, "reps": 5 }` 호출.

**Then**:
- 응답: 정확히 `{ "epley": 116.67, "brzycki": 112.5, "average": 114.58 }`.
- `average` 값으로 `114.59`는 허용되지 않는다 (반올림된 epley/brzycki를 다시 평균내는 방식 금지).
- `packages/utils/src/1rm.ts`의 `calculateAverage1RM(100, 5)` 호출 결과도 동일하게 `114.58`이어야 한다.

**검증 매핑**: REQ-ORM-CALC-002, NFR-ORM-CONSISTENCY-001

---

## 8.5 라우트 정합성 (AC-ORM-ROUTE)

### AC-ORM-ROUTE-01: estimate 라우트 정합성 (REQ-ORM-VAL-007)

**Given**:
- 백엔드가 실행 중이며 `OneRepMaxController`에 `POST /estimate`(고정 경로)와 `PUT /:exerciseType`(동적 경로)가 모두 등록되어 있다.
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 요청을 순차적으로 호출:
  1. `POST /users/me/1rm/estimate` 본문 `{ "weight": 100, "reps": 5 }`
  2. `PUT /users/me/1rm/SQUAT` 본문 `{ "value": 140 }`
  3. `PUT /users/me/1rm/estimate` 본문 `{ "value": 140 }` (라우트 혼동 검증 — `:exerciseType=estimate`로 잘못 라우팅되는지 확인)

**Then**:
- **케이스 1**: 응답 `200 OK`, 본문에 `{ epley, brzycki, average }` 포함. `OneRepMax` 테이블에 어떠한 쓰기도 발생하지 않음 (AC-ORM-CALC-02와 교차 검증).
- **케이스 2**: 응답 `201 Created` 또는 `200 OK` (REQ-ORM-INPUT-001), `OneRepMax(userId=U1.id, exerciseType=SQUAT).value=140` 저장됨.
- **케이스 3**: `:exerciseType="estimate"`는 `CompoundType` enum에 정의되지 않은 값이므로 응답 `400 Bad Request`를 반환해야 한다 (REQ-ORM-INPUT-003). 어떤 경우에도 `estimate`라는 exerciseType으로 1RM 레코드가 생성되거나 갱신되지 않는다.
- 컨트롤러 코드 정적 검사(또는 라우트 dump 검증)에서 `POST /estimate`가 `PUT /:exerciseType`보다 먼저 정의되어 있음이 확인된다.

**검증 매핑**: REQ-ORM-VAL-007, REQ-ORM-INPUT-003

---

## 9. 성능 시나리오 (AC-ORM-PERF)

### AC-ORM-PERF-01: 성능 기준선

**Given**:
- 로컬 또는 staging 환경.
- 시드 또는 픽스처로 사용자 1명이 5종 컴파운드 모두에 1RM 설정.
- DB에 다른 사용자 100명, 각자 5종 1RM 설정 (총 500건 1RM 레코드, 인덱스 효과 검증).
- 인증된 사용자 토큰.

**When**:
- 각 엔드포인트를 100회 반복 호출하고 응답 시간 측정:
  1. `GET /users/me/1rm`
  2. `PUT /users/me/1rm/SQUAT` (본문 `{ value: 145 }`, 동일 컴파운드 반복 update)
  3. `POST /users/me/1rm/estimate` (본문 `{ weight: 100, reps: 5 }`)

**Then**:
- P95 응답 시간:
  - `GET /users/me/1rm` ≤ 100ms
  - `PUT /users/me/1rm/SQUAT` ≤ 150ms
  - `POST /users/me/1rm/estimate` ≤ 50ms (DB 호출 없음, 순수 계산)

**검증 매핑**: NFR-ORM-PERF-001 ~ NFR-ORM-PERF-003

---

## 10. 품질 게이트 (Quality Gate Criteria)

### 10.1 테스트 커버리지

- `apps/backend/src/one-rep-max/` 라인 커버리지 ≥ 85%.
- 다음 함수는 100% 분기 커버리지 필수:
  - `one-rep-max.service.ts :: getAll()` (5종 키 채우기 분기 포함)
  - `one-rep-max.service.ts :: upsert()` (신규/기존 분기 포함)
  - `one-rep-max.service.ts :: estimate()` (DB 호출 없음 보장 포함)
  - `one-rep-max.controller.ts :: upsert()` (201 vs 200 응답 코드 분기)

### 10.2 TRUST 5 게이트

- **Tested**: 위 10.1 충족, Section 1~9의 모든 자동화 AC가 자동화된 테스트로 통과. Section 11의 수동 검증 시나리오는 QA 체크리스트로 별도 처리.
- **Readable**: ESLint(@typescript-eslint) 0 error, Prettier 통과. 함수명·변수명이 도메인 용어와 일치 (`oneRepMax`, `compound`, `estimate`).
- **Unified**: NestJS 공식 컨벤션(모듈/컨트롤러/서비스 분리), Prisma 스키마 일관성, DTO 네이밍 일관성.
- **Secured**: AC-ORM-SECURITY-01, AC-ORM-SECURITY-02 통과, 사용자 격리 검증.
- **Trackable**: 본 SPEC ID(SPEC-1RM-001)를 모든 커밋 메시지에 포함, MX tag(`@MX:ANCHOR`, `@MX:WARN`) 적용 (plan.md Section 10).

### 10.3 LSP 게이트 (Run Phase)

- TypeScript `tsc --noEmit` 0 error (백엔드 + 모바일 + packages/types).
- `pnpm lint` 0 error, 0 warning.
- Prisma `prisma validate` 통과.

### 10.4 마이그레이션 게이트

- `pnpm prisma migrate status` 클린 (drift 없음).
- 마이그레이션 reverse가 정의되어 있어 롤백 가능.

---

## 11. 수동 검증 시나리오 (Manual Verification Scenarios)

본 절의 시나리오는 자동화 테스트로 검증이 어렵거나 비효율적이며, 모바일 클라이언트의 시각적/체험적 동작을 사람이 확인해야 한다. **Definition of Done의 자동화 검증 요구(Section 12 항목 5)에서 명시적으로 제외된다**. QA 체크리스트로 별도 관리되며 출시 전 1회 이상 수행되어야 한다.

### MV-ORM-MOBILE-01: 모바일 1RM 관리 화면 표시 (수동 검증)

**Given**:
- 모바일 앱이 사용자 `U_TEST`로 로그인된 상태.
- `U_TEST`가 `SQUAT=100, DEADLIFT=150`을 설정, 나머지는 미설정.

**When**:
- 사용자가 마이페이지 → 1RM 관리 화면(`/(tabs)/my/1rm`) 진입.

**Then** (수동 검증):
- 5종 컴파운드 카드가 한국어 라벨과 함께 표시:
  - 스쿼트(SQUAT): `100 kg` 표시 + "편집" 버튼.
  - 데드리프트(DEADLIFT): `150 kg` 표시 + "편집" 버튼.
  - 벤치프레스(BENCH_PRESS): "미설정" 표시 + "+ 추가" 버튼.
  - 바벨 로우(BARBELL_ROW): "미설정" + "+ 추가".
  - 오버헤드프레스(OVERHEAD_PRESS): "미설정" + "+ 추가".
- 화면 진입 시 로딩 인디케이터 표시 → 데이터 로드 후 카드 렌더.
- 네트워크 오프라인 시 캐시된 데이터 표시 또는 적절한 에러 UI.

**검증 매핑**: NFR-ORM-MOBILE-001, NFR-ORM-MOBILE-003

### MV-ORM-MOBILE-02: 모바일 1RM 편집 흐름 (수동 검증)

**Given**:
- MV-ORM-MOBILE-01 상태.

**When**:
- 사용자가 "스쿼트" 카드의 "편집" 버튼을 탭.
- 편집 모달에서 `value` 필드를 `105`로 변경.
- "저장" 버튼 탭.

**Then** (수동 검증):
- 편집 모달이 정상 표시되며 기존 값 `100`이 입력 필드에 pre-fill됨.
- "저장" 탭 시 모달이 닫히고 카드 목록의 "스쿼트" 값이 `105 kg`으로 즉시 갱신됨 (Optimistic Update 또는 invalidate 후 refetch).
- 백엔드 `PUT /users/me/1rm/SQUAT`이 호출되며 `200 OK` 응답.
- 화면 새로고침 또는 앱 재시작 후에도 `105`가 유지됨.

**검증 매핑**: NFR-ORM-MOBILE-001, NFR-ORM-MOBILE-003

### MV-ORM-MOBILE-03: 모바일 추정 보조 UI (수동 검증)

**Given**:
- 사용자가 "벤치프레스" 카드의 "+ 추가" 버튼을 탭하여 편집 모달 진입.

**When**:
- 사용자가 "추정 계산 도구" 토글을 활성화.
- `weight=80`, `reps=5` 입력.

**Then** (수동 검증):
- 추정값 영역에 실시간으로 다음 값이 표시:
  - Epley: ≈ 93.33 kg
  - Brzycki: ≈ 90.00 kg
  - Average: ≈ 91.67 kg
- 사용자가 "이 값을 1RM으로 저장 (Average)" 또는 유사한 선택을 탭하면 `value` 입력 필드에 `91.67`이 자동 입력됨.
- "저장" 시 `PUT /users/me/1rm/BENCH_PRESS` 본문 `{ value: 91.67 }`로 호출되며 `source: DIRECT_INPUT`으로 저장 (추정 출처 enum은 사용하지 않음, REQ-ORM-INPUT-007).
- 네트워크 오프라인 상태에서도 추정값 계산은 클라이언트 로컬에서 즉시 동작 (저장만 실패하고 사용자 알림).

**검증 매핑**: NFR-ORM-MOBILE-002, NFR-ORM-CONSISTENCY-001

### MV-ORM-MOBILE-04: 모바일 잘못된 입력 처리 (수동 검증)

**Given**:
- 편집 모달이 열린 상태.

**When**:
- 사용자가 `value` 필드에 다음을 시도:
  1. `0` 입력 → "저장" 탭.
  2. `-10` 입력 → "저장" 탭.
  3. 빈 값 → "저장" 탭.
  4. `1000` 입력 → "저장" 탭.

**Then** (수동 검증):
- 케이스 1~4 모두 "저장" 버튼이 비활성화 또는 탭 시 에러 메시지("0보다 큰 값 입력", "최대 500 kg" 등) 표시.
- 백엔드 호출이 발생하지 않거나, 발생하더라도 `400 Bad Request` 응답을 받아 사용자에게 적절한 에러 토스트 표시.
- 모달이 자동으로 닫히지 않으며 사용자가 값을 수정할 수 있음.

**검증 매핑**: REQ-ORM-VAL-001, REQ-ORM-VAL-002, NFR-ORM-MOBILE-001

---

## 12. Definition of Done (완료 정의)

본 SPEC은 다음 모든 조건을 만족할 때 완료된 것으로 간주한다:

1. **DB 마이그레이션**: `OneRepMax` 모델, `CompoundType` enum, `OrmSource` enum이 추가되고 Prisma migration이 commit된다. `@@unique([userId, exerciseType])` 제약과 `User.oneRepMaxes` 역참조가 적용된다.
2. **API 구현**: 3개 엔드포인트(`GET /users/me/1rm`, `PUT /users/me/1rm/:exerciseType`, `POST /users/me/1rm/estimate`)가 모두 구현되고 동작한다. `OneRepMaxModule`이 `AppModule`에 등록된다.
3. **응답 코드 분기**: `PUT /users/me/1rm/:exerciseType`이 신규 생성 시 `201 Created`, 기존 갱신 시 `200 OK`를 정확히 반환한다 (AC-ORM-INPUT-01, AC-ORM-UPSERT-01).
4. **순수 계산 보장**: `POST /users/me/1rm/estimate`가 DB 쓰기 작업을 발생시키지 않음이 자동화 테스트로 검증된다 (AC-ORM-CALC-02).
5. **검증 통과**: Section 1~9의 모든 자동화 시나리오(AC-ORM-INPUT-01 ~ AC-ORM-INPUT-02, AC-ORM-UPSERT-01, AC-ORM-CALC-01 ~ AC-ORM-CALC-02, AC-ORM-CALC-INVALID-01 ~ AC-ORM-CALC-INVALID-03, AC-ORM-READ-01, AC-ORM-EMPTY-01, AC-ORM-SECURITY-01 ~ AC-ORM-SECURITY-03, AC-ORM-VALIDATION-01 ~ AC-ORM-VALIDATION-03, AC-ORM-CONSISTENCY-01 ~ AC-ORM-CONSISTENCY-02, AC-ORM-ROUTE-01, AC-ORM-PERF-01)가 자동화된 테스트로 검증되고 통과한다. **Section 11의 수동 검증 시나리오(MV-ORM-MOBILE-01 ~ MV-ORM-MOBILE-04)는 본 자동화 요구에서 제외되며, 출시 전 QA 체크리스트로 별도 검증된다**.
6. **모바일 화면**: `app/(tabs)/my/1rm.tsx`가 구현되어 5종 컴파운드의 1RM을 표시·입력할 수 있다 (Phase 7). 추정 보조 UI가 동작한다.
7. **공유 타입**: `packages/types/src/one-rep-max.ts`에 `CompoundType`, `OrmSource`, `OneRepMaxRecord`, `OneRepMaxCollection`, `UpsertOneRepMaxRequest`, `EstimateOneRepMaxRequest`, `OneRepMaxEstimateResponse` 타입이 export되며 모바일이 이를 참조한다.
8. **계산 일관성**: 백엔드 측 추정 결과가 `packages/utils/src/1rm.ts`의 결과와 일치함이 단위 테스트로 검증된다 (AC-ORM-CONSISTENCY-01).
9. **품질 게이트**: 위 Section 10의 모든 기준 통과.
10. **MX tag**: `mx_plan` (spec.md Section 8 및 plan.md Section 10)에 정의된 모든 `@MX:ANCHOR`, `@MX:WARN`, `@MX:NOTE` 대상이 실제 코드에 적용된다.
11. **추적성**: 모든 REQ-ORM-* 항목이 본 acceptance.md의 시나리오로 1:1 또는 1:N 매핑되며 추적성 매트릭스(spec.md Section 9)가 최신 상태로 유지된다.
12. **문서 동기화**: `/moai sync SPEC-1RM-001`로 API 문서, README, CHANGELOG가 갱신된다.
