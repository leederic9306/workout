# SPEC-PROGRAM-001 인수 기준 (Acceptance Criteria)

본 문서는 SPEC-PROGRAM-001의 모든 EARS 요구사항에 대한 검증 가능한 Given-When-Then 시나리오를 정의한다. 모든 자동화 시나리오는 단위 테스트, 통합 테스트, E2E 테스트 중 하나 이상으로 자동화되어야 한다. 수동 검증 시나리오는 Section 11에 별도 정리되며 DoD의 자동화 요구에서 명시적으로 제외된다.

전제:
- SPEC-AUTH-001 v1.0.1이 구현되어 있다 (`JwtAuthGuard`, `RolesGuard`, `UserRole` enum(`USER`/`PREMIUM`/`ADMIN`), `@CurrentUser()` 데코레이터 존재).
- SPEC-USER-001 v1.0.1이 구현되어 있다.
- SPEC-EXERCISE-001 v1.0.1이 구현되어 있다 (`Exercise` 모델 + 800+ 운동 시드 완료).
- SPEC-1RM-001 v1.0.1이 구현되어 있다 (본 SPEC과 직접 의존성 없음).
- Prisma 마이그레이션이 완료된 PostgreSQL DB가 존재한다 (`Program`, `ProgramDay`, `ProgramExercise`, `UserProgram`, `AiUsageLog` 테이블, `ProgramType` enum).
- 카탈로그 시드(`prisma db seed`)가 완료되어 `Program.type = CATALOG` 레코드가 정확히 6건 존재한다.
- 환경 변수 `ANTHROPIC_API_KEY`가 설정되어 있다. 자동화 테스트에서는 Anthropic 클라이언트를 모킹한다.
- 테스트 환경의 사용자 `U1`(role: `USER`), `U2`(role: `USER`), `UP`(role: `PREMIUM`), `UA`(role: `ADMIN`)가 존재하며 각자 유효한 Access Token `T1`, `T2`, `TP`, `TA`를 보유한다.

---

## 1. 카탈로그 조회 (AC-PROG-CATALOG)

### AC-PROG-CATALOG-01: GET /programs/catalog — 6종 카탈로그 응답

**Given**:
- `prisma db seed`가 완료되어 `Program.type = CATALOG` 레코드가 정확히 6건 존재.
- 다른 사용자가 임의의 수(≥0)의 `Program.type = AI_GENERATED` 레코드를 가지고 있을 수 있음.
- 인증된 사용자 `U1`의 유효한 Access Token `T1`.

**When**:
- 클라이언트가 `GET /programs/catalog`를 `Authorization: Bearer T1` 헤더와 함께 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문은 `{ programs: [...] }` 형식이며 `programs` 배열의 길이는 정확히 6.
- 각 항목은 다음 필드를 포함:
  - `id`(cuid), `title`(string), `description`(string), `type`(`"CATALOG"`), `level`(`"beginner"|"intermediate"|"advanced"`), `frequency`(integer, 3~6), `dayCount`(integer ≥ 1), `exerciseSummary`(객체), `createdAt`(ISO 8601).
- 응답 항목 중 `type`이 `"AI_GENERATED"`인 것은 없음.
- 응답 본문에 페이지네이션 메타(`page`, `limit`, `total`)는 포함되지 않음.
- 6개 항목의 `title`에 다음이 모두 포함됨(순서 무관): `"StrongLifts 5x5"`, `"Starting Strength"`, `"Beginner PPL"`, `"Intermediate PPL"`, `"Arnold Split"`, `"Upper/Lower Split"`(영문 원본 명칭, REQ-PROG-SEED-002, REQ-PROG-SEED-004).
- 6개 항목의 `description`은 모두 한국어를 포함(`/[가-힣]/` 매치, REQ-PROG-SEED-004).
- 모든 항목의 `isPublic`은 응답에서 노출되지 않거나(권장), 노출되어도 `false`(REQ-PROG-VAL-005).

**참고**: 본 시나리오는 시드된 6종이 정확히 응답에 포함됨을 검증한다. 카탈로그가 6건이 아니면 시드 누락 또는 비정상 데이터 상태 → 즉시 실패.

**검증 매핑**: REQ-PROG-CATALOG-001, REQ-PROG-CATALOG-002, REQ-PROG-CATALOG-003, REQ-PROG-CATALOG-005, REQ-PROG-SEED-002, REQ-PROG-SEED-004, REQ-PROG-VAL-004, REQ-PROG-VAL-005

---

## 2. 프로그램 상세 조회 (AC-PROG-DETAIL)

### AC-PROG-DETAIL-01: GET /programs/:id — 카탈로그 프로그램 상세

**Given**:
- 시드된 카탈로그 프로그램 `P_CATALOG`(예: `title = "StrongLifts 5x5"`)가 존재. `P_CATALOG`는 최소 1개 이상의 `ProgramDay`와 각 `ProgramDay`는 최소 1개 이상의 `ProgramExercise`를 포함.
- 인증된 사용자 `U1`의 유효한 Access Token `T1`.

**When**:
- `GET /programs/{P_CATALOG.id}`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문은 다음 필드를 포함:
  - 프로그램 메타: `id`, `title`, `description`, `type` (`"CATALOG"`), `level`, `frequency`, `createdAt`.
  - `days` 배열: 각 항목은 `id`, `dayNumber`, `name`, `exercises` 포함. `dayNumber` 오름차순 정렬.
  - `days[*].exercises` 배열: 각 항목은 `id`, `exerciseId`, `orderIndex`, `sets`, `reps`, `weightNote`(또는 `null`), `exercise`(중첩 객체: `name`, `primaryMuscles`, `image`)를 포함. `orderIndex` 오름차순 정렬.
- 모든 `exerciseId`는 `Exercise` 테이블에 실존(외래키 무결성).
- `exercise.name`은 영문 운동명, `exercise.primaryMuscles`는 배열, `exercise.image`는 URL 문자열 또는 `null`.

**검증 매핑**: REQ-PROG-DETAIL-001, REQ-PROG-DETAIL-002, REQ-PROG-DETAIL-003, REQ-PROG-DETAIL-007

### AC-PROG-DETAIL-NOTFOUND-01: GET /programs/:id — 존재하지 않거나 잘못된 형식

**Given**:
- 인증된 사용자 `U1`의 유효한 Access Token `T1`.
- DB에 `id = "non-existent-cuid-xxxxxxxxxxxxxxxxxxxxxx"`인 프로그램이 존재하지 않음.

**When**:
- 다음 경로로 `GET /programs/:id` 호출:
  1. `/programs/non-existent-cuid-xxxxxxxxxxxxxxxxxxxxxx` (존재하지 않는 cuid)
  2. `/programs/invalid-format` (cuid 형식 위반)
  3. `/programs/12345` (짧은 문자열, cuid 형식 위반)

**Then**:
- 케이스 1, 2, 3 모두 응답 상태 코드는 `404 Not Found`.
- 응답 본문에 프로그램 상세가 포함되지 않음.

**검증 매핑**: REQ-PROG-DETAIL-005, REQ-PROG-VAL-002

---

## 3. 활성 프로그램 관리 (AC-PROG-ACTIVATE)

### AC-PROG-ACTIVATE-01: POST /programs/:id/activate — 신규 활성화 (201 Created)

**Given**:
- 사용자 `U1`이 활성 프로그램을 가지지 않음 (`UserProgram WHERE userId = U1.id`이 0건).
- 시드된 카탈로그 프로그램 `P_CATALOG`가 존재.
- `U1`의 유효한 Access Token `T1`.

**When**:
- `POST /programs/{P_CATALOG.id}/activate`를 `T1`로 호출(본문 없음).

**Then**:
- 응답 상태 코드는 **`201 Created`** (신규 활성화).
- 응답 본문:
  - `userProgramId`: cuid 형식 문자열.
  - `programId`: `P_CATALOG.id`와 일치.
  - `startedAt`: 유효한 ISO 8601 타임스탬프.
- DB에 `UserProgram(userId = U1.id, programId = P_CATALOG.id)` 레코드 1건 생성됨.
- 후속 `GET /programs/active` 호출 시 `active.programId === P_CATALOG.id` 반환.

**검증 매핑**: REQ-PROG-ACTIVE-001

### AC-PROG-ACTIVATE-02: POST /programs/:id/activate — 기존 활성 교체 (200 OK)

**Given**:
- AC-PROG-ACTIVATE-01 직후 상태: `U1`이 `P_CATALOG`(예: StrongLifts 5x5)를 활성화한 상태.
- 다른 시드된 카탈로그 프로그램 `P_CATALOG2`(예: Starting Strength)가 존재.
- `U1`의 유효한 Access Token `T1`.

**When**:
- `POST /programs/{P_CATALOG2.id}/activate`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 **`200 OK`** (기존 활성 교체, REQ-PROG-ACTIVE-001).
- 응답 본문의 `programId`는 `P_CATALOG2.id`와 일치.
- DB의 `UserProgram(userId = U1.id)` 레코드는 여전히 정확히 1건만 존재(`@@unique([userId])`, NFR-PROG-DATA-001).
- 해당 레코드의 `programId`는 `P_CATALOG2.id`로 갱신됨.
- 이전 레코드의 `id`(`userProgramId`)는 upsert 동작에 따라 보존될 수 있음(Prisma upsert 시 동일 unique key에 대해 update 발생).

**검증 매핑**: REQ-PROG-ACTIVE-001, REQ-PROG-ACTIVE-002, NFR-PROG-DATA-001

### AC-PROG-ACTIVATE-NOTFOUND-01: POST /programs/:id/activate — 존재하지 않는 ID

**Given**:
- 사용자 `U1`의 유효한 Access Token `T1`.
- DB에 `id = "non-existent-cuid-xxxxxxxxxxxxxxxxxxxxxx"`인 프로그램이 존재하지 않음.

**When**:
- `POST /programs/non-existent-cuid-xxxxxxxxxxxxxxxxxxxxxx/activate`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `404 Not Found`.
- DB에 `UserProgram` 레코드가 생성/수정되지 않음. 호출 전 `UserProgram WHERE userId = U1.id` 상태와 호출 후 상태가 동일.

**검증 매핑**: REQ-PROG-ACTIVE-008

---

## 4. 활성 프로그램 비활성화 (AC-PROG-DEACTIVATE)

### AC-PROG-DEACTIVATE-01: DELETE /programs/active — 활성 프로그램 있는 상태

**Given**:
- 사용자 `U1`이 임의의 프로그램을 활성화한 상태(`UserProgram WHERE userId = U1.id`이 1건).
- `U1`의 유효한 Access Token `T1`.

**When**:
- `DELETE /programs/active`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `204 No Content`.
- 응답 본문은 비어 있음.
- DB에 `UserProgram WHERE userId = U1.id` 레코드가 0건이 됨.
- 후속 `GET /programs/active` 호출 시 `{ active: null }` 반환.

**검증 매핑**: REQ-PROG-ACTIVE-004

### AC-PROG-DEACTIVATE-02: DELETE /programs/active — 활성 프로그램 없는 상태 (멱등성)

**Given**:
- 사용자 `U1`이 활성 프로그램을 가지지 않은 상태(`UserProgram WHERE userId = U1.id`이 0건).
- `U1`의 유효한 Access Token `T1`.

**When**:
- `DELETE /programs/active`를 `T1`로 두 번 연속 호출.

**Then**:
- 두 번의 응답 모두 상태 코드 `204 No Content`(404 아님, REQ-PROG-ACTIVE-005).
- DB 상태 변화 없음.

**검증 매핑**: REQ-PROG-ACTIVE-005

---

## 5. 활성 프로그램 조회 (AC-PROG-ACTIVE-GET, AC-PROG-ACTIVE-EMPTY)

### AC-PROG-ACTIVE-GET-01: GET /programs/active — 활성 프로그램 있음

**Given**:
- 사용자 `U1`이 카탈로그 프로그램 `P_CATALOG`(`title = "StrongLifts 5x5"`)를 활성화한 상태.
- `U1`의 유효한 Access Token `T1`.

**When**:
- `GET /programs/active`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문 `{ active: <ProgramDetail> }` 구조이며 `active`는 `null`이 아님.
- `active.programId`는 `P_CATALOG.id`와 일치.
- `active.program` (또는 동등한 키)에 AC-PROG-DETAIL-01과 동일한 프로그램 상세 구조(`days`, `exercises`, `exercise` 중첩 정보)가 포함됨.
- `active.startedAt`은 유효한 ISO 8601 타임스탬프.

**검증 매핑**: REQ-PROG-ACTIVE-006, REQ-PROG-DETAIL-002, REQ-PROG-DETAIL-003

### AC-PROG-ACTIVE-EMPTY-01: GET /programs/active — 활성 프로그램 없음

**Given**:
- 신규 사용자 `U_NEW`가 어떤 프로그램도 활성화하지 않음(`UserProgram WHERE userId = U_NEW.id`이 0건).
- `U_NEW`의 유효한 Access Token `T_NEW`.

**When**:
- `GET /programs/active`를 `T_NEW`로 호출.

**Then**:
- 응답 상태 코드는 **`200 OK`** (`404` 아님, REQ-PROG-ACTIVE-007).
- 응답 본문은 정확히 `{ "active": null }`.

**검증 매핑**: REQ-PROG-ACTIVE-007

---

## 6. AI 맞춤 프로그램 생성 — 정상 (AC-PROG-AI-SUCCESS)

### AC-PROG-AI-SUCCESS-01: POST /ai/programs — Premium 사용자, 검증 통과

**Given**:
- Premium 사용자 `UP`가 현재 월(`"YYYY-MM"`)에 대해 `AiUsageLog.programCreations < 10`인 상태(테스트 환경에서 0 또는 N건).
- `UP`의 유효한 Access Token `TP`.
- Anthropic 클라이언트가 다음 유효한 응답을 반환하도록 모킹되어 있음:
  ```json
  {
    "title": "맞춤 가슴/등 4일 프로그램",
    "description": "근비대 목표를 위한 4일 분할 프로그램 ...",
    "level": "intermediate",
    "days": [
      {
        "dayNumber": 1, "name": "Chest Focus",
        "exercises": [
          { "exerciseId": "<유효한 Exercise.id 1>", "orderIndex": 1, "sets": 4, "reps": "8-12", "weightNote": null }
        ]
      },
      { "dayNumber": 2, "name": "Back Focus", "exercises": [ ... ] },
      { "dayNumber": 3, "name": "Push", "exercises": [ ... ] },
      { "dayNumber": 4, "name": "Pull", "exercises": [ ... ] }
    ]
  }
  ```
  모든 `exerciseId`는 시드된 `Exercise.id`에 실제 존재.

**When**:
- `POST /ai/programs`를 `TP`로 다음 본문으로 호출:
  ```json
  {
    "goal": "muscle_gain",
    "daysPerWeek": 4,
    "availableEquipment": ["barbell", "dumbbell", "cable"],
    "focusAreas": ["chest", "back"]
  }
  ```

**Then**:
- 응답 상태 코드는 `201 Created`.
- 응답 본문은 AC-PROG-DETAIL-01과 동일한 프로그램 상세 구조이며:
  - `type === "AI_GENERATED"`.
  - `createdBy`는 응답에 노출되거나 노출되지 않음(공유 타입에 따름). 단 DB 레코드의 `createdBy`는 `UP.id`.
  - `days.length === 4`(요청의 `daysPerWeek`와 일치).
  - 모든 `exerciseId`가 `Exercise` 테이블에 실존.
- DB에 다음이 생성됨(단일 트랜잭션 내, REQ-PROG-AI-009):
  - `Program(type=AI_GENERATED, createdBy=UP.id, isPublic=false)` 1건.
  - 4건의 `ProgramDay`.
  - 모든 `ProgramExercise` 레코드(각 일의 모든 운동).
- `AiUsageLog(userId=UP.id, month="<현재 월>")` 레코드가 생성되거나 갱신되며, `programCreations`가 호출 전 대비 정확히 +1 증가(REQ-PROG-AI-004).

**검증 매핑**: REQ-PROG-AI-001, REQ-PROG-AI-004, REQ-PROG-AI-009, REQ-PROG-AI-010, REQ-PROG-VAL-004, REQ-PROG-VAL-005

---

## 7. AI 맞춤 프로그램 생성 — 권한 (AC-PROG-AI-RBAC)

### AC-PROG-AI-RBAC-01: POST /ai/programs — User 권한 거부

**Given**:
- 일반 사용자 `U1`(role: `USER`)의 유효한 Access Token `T1`.
- Anthropic 클라이언트가 모킹되어 있음(호출이 발생하면 안 됨).

**When**:
- `POST /ai/programs`를 `T1`로 유효한 본문(`goal: "strength"`, `daysPerWeek: 4`, `availableEquipment: ["barbell"]`)으로 호출.

**Then**:
- 응답 상태 코드는 `403 Forbidden` (REQ-PROG-AI-002).
- 응답 본문에 프로그램 상세가 포함되지 않음.
- Anthropic 클라이언트가 호출되지 않음(모킹 검증).
- DB에 `Program` 또는 `AiUsageLog` 레코드가 생성/수정되지 않음.

**검증 매핑**: REQ-PROG-AI-002, REQ-PROG-AI-007, NFR-PROG-SEC-002

---

## 8. AI 맞춤 프로그램 생성 — 월 한도 (AC-PROG-AI-LIMIT)

### AC-PROG-AI-LIMIT-01: POST /ai/programs — 월 한도 10 초과 → 429

**Given**:
- Premium 사용자 `UP`의 `AiUsageLog(userId=UP.id, month="<현재 월>")` 레코드의 `programCreations = 10`인 상태(테스트 환경에서 사전 시드).
- `UP`의 유효한 Access Token `TP`.
- Anthropic 클라이언트가 모킹되어 있음(호출이 발생하면 안 됨).

**When**:
- `POST /ai/programs`를 `TP`로 유효한 본문으로 호출.

**Then**:
- 응답 상태 코드는 `429 Too Many Requests` (REQ-PROG-AI-003).
- Anthropic 클라이언트가 호출되지 않음(모킹 검증).
- DB에 `Program` 레코드가 생성되지 않음.
- `AiUsageLog.programCreations`는 여전히 `10`(증가하지 않음, REQ-PROG-AI-004).

**검증 매핑**: REQ-PROG-AI-003, REQ-PROG-AI-004, NFR-PROG-AI-COST-001, NFR-PROG-AI-COST-002

---

## 9. AI 맞춤 프로그램 생성 — 응답 검증 (AC-PROG-AI-INVALID-AI-RESPONSE, AC-PROG-AI-VALIDATION, AC-PROG-AI-UPSTREAM-FAIL)

### AC-PROG-AI-INVALID-AI-RESPONSE-01: AI 응답에 존재하지 않는 exerciseId → 422, 카운터 미증가

**Given**:
- Premium 사용자 `UP`의 `AiUsageLog.programCreations = 5`인 상태.
- `UP`의 유효한 Access Token `TP`.
- Anthropic 클라이언트가 다음 응답을 반환하도록 모킹:
  - `days.length === request.daysPerWeek`이고 스키마는 유효하나, `exercises[0].exerciseId`가 `"non-existent-exercise-id-xxxxxxxxxxxxxxx"`(Exercise 테이블에 없음).

**When**:
- `POST /ai/programs`를 `TP`로 유효한 본문(`daysPerWeek: 4` 등)으로 호출.

**Then**:
- 응답 상태 코드는 `422 Unprocessable Entity` (REQ-PROG-AI-005).
- DB에 `Program` 레코드가 생성되지 않음.
- `AiUsageLog.programCreations`는 여전히 `5`(증가하지 않음, REQ-PROG-AI-004).
- Anthropic 클라이언트는 호출되었음(모킹 검증, 호출이 발생했으므로 비용은 발생).

**검증 매핑**: REQ-PROG-AI-004, REQ-PROG-AI-005, NFR-PROG-AI-COST-002

**추가 케이스 (단위 테스트로 검증)**: 검증 7단계 각각의 실패 케이스에 대해 422를 반환하고 카운터 미증가:
1. JSON 파싱 실패.
2. 스키마 위반(필수 필드 누락 또는 타입 불일치).
3. `days.length !== request.daysPerWeek`.
4. 어느 `sets`가 0 또는 11 이상.
5. 어느 `reps`가 `^\d+(-\d+)?$` 매치 실패(예: `"5x5"`, `"15-12"`(역순), `"abc"`).
6. `level`이 `"beginner"|"intermediate"|"advanced"` 외 값.
7. 어느 `exerciseId`가 `Exercise.id`에 없음(본 AC-01 케이스).

### AC-PROG-AI-VALIDATION-01: 입력 DTO 검증 실패 → 400

**Given**:
- Premium 사용자 `UP`의 `AiUsageLog.programCreations = 5`인 상태.
- `UP`의 유효한 Access Token `TP`.
- Anthropic 클라이언트가 모킹되어 있음(호출이 발생하면 안 됨).

**When**:
- 다음 본문으로 `POST /ai/programs`를 `TP`로 호출:
  1. `{ "goal": "invalid_goal", "daysPerWeek": 4, "availableEquipment": ["barbell"] }` (goal enum 위반)
  2. `{ "goal": "strength", "daysPerWeek": 2, "availableEquipment": ["barbell"] }` (daysPerWeek < 3)
  3. `{ "goal": "strength", "daysPerWeek": 7, "availableEquipment": ["barbell"] }` (daysPerWeek > 6)
  4. `{ "goal": "strength", "daysPerWeek": 4, "availableEquipment": [] }` (빈 배열)
  5. `{ "goal": "strength", "daysPerWeek": 4 }` (availableEquipment 누락)
  6. `{ "goal": "strength", "daysPerWeek": 4, "availableEquipment": ["barbell"], "extraField": "x" }` (whitelist 위반)

**Then**:
- 케이스 1~6 모두 응답 상태 코드는 `400 Bad Request` (REQ-PROG-AI-008, REQ-PROG-VAL-003).
- Anthropic 클라이언트가 호출되지 않음(모킹 검증).
- DB에 `Program` 또는 `AiUsageLog` 변경 없음(`programCreations`는 여전히 `5`).
- 응답 본문에 `class-validator` 에러 메시지 포함.

**검증 매핑**: REQ-PROG-AI-008, REQ-PROG-VAL-003

### AC-PROG-AI-UPSTREAM-FAIL-01: Anthropic API 장애 → 502/422/504, 카운터 미증가

**Given**:
- Premium 사용자 `UP`의 `AiUsageLog.programCreations = 5`인 상태.
- `UP`의 유효한 Access Token `TP`.
- 다음 시나리오로 Anthropic 클라이언트가 모킹됨:
  - 시나리오 A: Anthropic API가 HTTP 503 또는 5xx 오류를 반환.
  - 시나리오 B: Anthropic API가 30초 timeout (응답 없음).
  - 시나리오 C: Anthropic API가 200을 반환하지만 본문이 잘못된 형식(JSON 파싱 실패).

**When**:
- 시나리오 A: `POST /ai/programs`를 `TP`로 유효한 본문으로 호출.
- 시나리오 B: 같은 호출, 단 클라이언트가 timeout으로 throw.
- 시나리오 C: 같은 호출, 클라이언트가 비-JSON 응답 본문을 반환.

**Then**:
- 시나리오 A: 응답 상태 코드는 `502 Bad Gateway` (REQ-PROG-AI-012, 네트워크 오류 / 5xx 분기 확정).
- 시나리오 B: 응답 상태 코드는 `504 Gateway Timeout` (NFR-PROG-PERF-006, REQ-PROG-AI-012).
- 시나리오 C: 응답 상태 코드는 `422 Unprocessable Entity` (REQ-PROG-AI-012, JSON 파싱 실패 분기 확정).
- 모든 시나리오:
  - DB에 `Program` 레코드가 생성되지 않음.
  - `AiUsageLog.programCreations`는 여전히 `5`(증가하지 않음).

**검증 매핑**: REQ-PROG-AI-012, NFR-PROG-PERF-006

---

## 10. 라우트 정합성 (AC-PROG-ROUTE)

### AC-PROG-ROUTE-01: 고정 경로가 동적 경로보다 먼저 매칭

**Given**:
- 백엔드가 실행 중이며 `ProgramsController`에 5개 라우트가 모두 등록되어 있다(`/catalog`, `/active`, `/active`(DELETE), `/:id/activate`, `/:id`).
- 시드된 카탈로그 6건이 존재.
- 인증된 사용자 `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 요청을 순차적으로 호출:
  1. `GET /programs/catalog`
  2. `GET /programs/active` (활성 없음 상태)
  3. `DELETE /programs/active` (활성 없음 상태)
  4. `POST /programs/<카탈로그 프로그램 ID>/activate`
  5. `GET /programs/<카탈로그 프로그램 ID>`

**Then**:
- 케이스 1: `200 OK`, 카탈로그 6건 반환. **`/catalog`라는 문자열이 `:id`로 잘못 해석되어 404가 발생해서는 안 된다** (REQ-PROG-VAL-001).
- 케이스 2: `200 OK`, `{ active: null }` 반환. `/active`라는 문자열이 `:id`로 잘못 해석되어 404가 발생해서는 안 된다.
- 케이스 3: `204 No Content`. `/active`라는 문자열이 `:id`로 잘못 해석되어 404가 발생해서는 안 된다.
- 케이스 4, 5: 정상 동작.
- 컨트롤러 코드 정적 검사(또는 라우트 dump 검증)에서 `GET /catalog`, `GET /active`, `DELETE /active`가 `GET /:id` 및 `POST /:id/activate`보다 먼저 등록되어 있음이 확인된다.

**검증 매핑**: REQ-PROG-VAL-001

---

## 11. 사용자 격리 및 보안 (AC-PROG-SECURITY)

### AC-PROG-SECURITY-AUTH-01: 인증 누락/만료 시 401

**Given**:
- DB에 시드된 카탈로그 데이터 존재.

**When**:
- 다음 케이스로 본 SPEC의 엔드포인트 호출:
  1. `GET /programs/catalog`을 `Authorization` 헤더 없이 호출.
  2. `GET /programs/active`을 `Authorization: Bearer T_expired`로 호출.
  3. `GET /programs/<카탈로그 ID>`을 `Authorization: Bearer T_tampered`로 호출.
  4. `POST /programs/<카탈로그 ID>/activate`을 토큰 없이 호출.
  5. `DELETE /programs/active`을 만료 토큰으로 호출.
  6. `POST /ai/programs`을 토큰 없이 유효한 본문으로 호출.

**Then**:
- 모든 케이스 응답 상태 코드는 `401 Unauthorized`.
- 응답 본문에 카탈로그 데이터, 프로그램 상세, 사용자 정보가 포함되지 않음.
- DB 상태 변경 없음(케이스 4, 5, 6에서도 레코드 미생성/삭제).
- 케이스 6에서 Anthropic 클라이언트가 호출되지 않음.

**검증 매핑**: REQ-PROG-CATALOG-004, REQ-PROG-DETAIL-006, REQ-PROG-ACTIVE-009, REQ-PROG-AI-007, NFR-PROG-SEC-001

### AC-PROG-SECURITY-OWNERSHIP-01: AI 프로그램 조회 격리

**Given**:
- 사용자 `UP1`(Premium)이 AI 프로그램 `P_AI_UP1`을 생성한 상태(`Program.type=AI_GENERATED, createdBy=UP1.id`).
- 사용자 `UP2`(Premium)의 유효한 Access Token `TP2`.

**When**:
- `GET /programs/{P_AI_UP1.id}`를 `TP2`로 호출.

**Then**:
- 응답 상태 코드는 `404 Not Found` (REQ-PROG-DETAIL-004).
- 응답 본문에 `P_AI_UP1`의 상세가 포함되지 않음.
- **반면, 본인 호출 (`TP1`)은 `200 OK`로 정상 반환**(대조군).

**검증 매핑**: REQ-PROG-DETAIL-004, NFR-PROG-SEC-005

### AC-PROG-SECURITY-OWNERSHIP-02: AI 프로그램 활성화 격리

**Given**:
- 사용자 `UP1`이 AI 프로그램 `P_AI_UP1`을 생성한 상태.
- 사용자 `UP2`(Premium)의 유효한 Access Token `TP2`.
- `UP2`는 활성 프로그램이 없음.

**When**:
- `POST /programs/{P_AI_UP1.id}/activate`를 `TP2`로 호출.

**Then**:
- 응답 상태 코드는 `404 Not Found` (REQ-PROG-ACTIVE-003).
- DB에 `UserProgram(userId=UP2.id)` 레코드가 생성되지 않음.
- `UP1`의 AI 프로그램(`P_AI_UP1`) 데이터는 변경 없음.

**검증 매핑**: REQ-PROG-ACTIVE-003, NFR-PROG-SEC-005

### AC-PROG-SECURITY-OWNERSHIP-03: 요청 바디의 userId 무시 (whitelist 동작)

**Given**:
- 사용자 `U1`(또는 `UP`)의 유효한 Access Token.
- 사용자 `U2`가 활성 프로그램 `P_CATALOG_U2`를 활성화한 상태.

**When**:
- 다음 요청을 다양한 엔드포인트에 시도:
  1. `POST /programs/<카탈로그 ID>/activate` 본문 `{ "userId": "<U2.id>" }` (활성화 시 다른 사용자 ID 주입 시도).
  2. `POST /ai/programs` 본문 `{ "goal": "strength", "daysPerWeek": 4, "availableEquipment": ["barbell"], "userId": "<U2.id>" }` (AI 생성 시 다른 사용자 ID 주입 시도).

**Then**:
- 케이스 1: NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` 설정에 따라 `400 Bad Request` 응답. 에러 메시지에 `property userId should not exist` 포함. DB 변경 없음.
- 케이스 2: 같은 사유로 `400 Bad Request`. Anthropic 클라이언트 호출 없음, `AiUsageLog` 변경 없음.
- 어떤 경우에도 시스템은 요청 바디의 `userId`를 사용자 식별에 적용하지 않음. 대상 사용자는 JWT `sub`로만 결정됨 (REQ-PROG-ACTIVE-010, REQ-PROG-AI-011).
- `U2`의 활성 프로그램(`P_CATALOG_U2`)이 변경되지 않음.

**검증 매핑**: REQ-PROG-ACTIVE-010, REQ-PROG-AI-011, NFR-PROG-SEC-003, NFR-PROG-SEC-004

---

## 12. 카탈로그 시드 (AC-PROG-SEED)

### AC-PROG-SEED-01: 시드 실행 후 정확히 6건 카탈로그

**Given**:
- 깨끗한 테스트 DB (마이그레이션은 적용되었으나 시드 미실행).
- SPEC-EXERCISE-001 시드가 먼저 완료된 상태.

**When**:
- `pnpm prisma db seed`를 실행.

**Then**:
- `prisma.program.count({ where: { type: 'CATALOG' } })` === `6`.
- 6건의 `title`이 다음을 모두 포함(순서 무관): `"StrongLifts 5x5"`, `"Starting Strength"`, `"Beginner PPL"`, `"Intermediate PPL"`, `"Arnold Split"`, `"Upper/Lower Split"`.
- 각 프로그램의 `level`, `frequency`가 spec.md Section 1 표와 일치:
  - StrongLifts 5x5: `level=beginner, frequency=3`
  - Starting Strength: `level=beginner, frequency=3`
  - Beginner PPL: `level=intermediate` (또는 `beginner` — 시드 데이터에서 결정) `, frequency=6`
  - Intermediate PPL: `level=intermediate, frequency=6`
  - Arnold Split: `level=advanced, frequency=6`
  - Upper/Lower Split: `level=intermediate, frequency=4`
- 모든 카탈로그 프로그램의 `createdBy === null`, `isPublic === false`, `type === "CATALOG"` (REQ-PROG-SEED-002).
- 모든 카탈로그 프로그램의 `description`이 한국어를 포함(`/[가-힣]/` 매치, REQ-PROG-SEED-004).
- 각 카탈로그 프로그램의 `ProgramDay`가 최소 1개 이상, 각 `ProgramDay`의 `ProgramExercise`가 최소 1개 이상 존재.
- 모든 `ProgramExercise.exerciseId`가 `Exercise.id`에 실존.

**참고**: 본 SPEC은 각 프로그램의 정확한 운동 구성(스쿼트 5×5 등)을 강제하지 않으며 시드 작성자가 운동학적으로 합리적인 구성을 결정한다. 본 AC는 구조적 정확성(6건, 한국어 description, FK 무결성)만 검증한다.

**검증 매핑**: REQ-PROG-SEED-001, REQ-PROG-SEED-002, REQ-PROG-SEED-003, REQ-PROG-SEED-004, REQ-PROG-VAL-004, REQ-PROG-VAL-005

### AC-PROG-SEED-02: 시드 idempotency (재실행 시 중복 없음)

**Given**:
- AC-PROG-SEED-01 직후 상태(카탈로그 6건 시드 완료).

**When**:
- `pnpm prisma db seed`를 다시 실행.

**Then**:
- 두 번째 실행이 에러 없이 완료(REQ-PROG-SEED-005).
- `prisma.program.count({ where: { type: 'CATALOG' } })` === 여전히 `6` (중복 생성되지 않음, REQ-PROG-SEED-001).
- 기존 카탈로그 프로그램들의 `id`(cuid)가 첫 번째 실행 때 생성된 값과 동일하게 유지됨(또는 시드 정책상 새 cuid 생성 후 기존 삭제 — 본 SPEC은 idempotency 정의를 "신규 생성 안 함"으로 해석하므로 ID 보존을 권장. 정확한 ID 보존 정책은 plan.md에서 확정).
- Exercise 시드가 누락된 상태에서 프로그램 시드만 실행 시 외래키 위반으로 시드 스크립트가 명확한 에러로 실패(REQ-PROG-SEED-003).

**검증 매핑**: REQ-PROG-SEED-001, REQ-PROG-SEED-003, REQ-PROG-SEED-005

---

## 13. 성능 시나리오 (AC-PROG-PERF)

### AC-PROG-PERF-01: 성능 기준선

**Given**:
- 로컬 또는 staging 환경.
- 시드된 카탈로그 6종 + 임의의 사용자 100명, 각자 활성 프로그램 1개 보유, AI 프로그램 누적 평균 3건 보유.
- 인증된 사용자 토큰.

**When**:
- 각 엔드포인트를 100회 반복 호출하고 응답 시간 측정:
  1. `GET /programs/catalog`
  2. `GET /programs/<카탈로그 ID>`
  3. `GET /programs/active`
  4. `POST /programs/<카탈로그 ID>/activate`
  5. `DELETE /programs/active`

**Then**:
- P95 응답 시간:
  - `GET /programs/catalog` ≤ 200ms
  - `GET /programs/:id` ≤ 300ms
  - `GET /programs/active` ≤ 300ms
  - `POST /programs/:id/activate` ≤ 200ms
  - `DELETE /programs/active` ≤ 150ms
- `POST /ai/programs`는 외부 API 의존이므로 본 자동화 시나리오에서는 측정 대상에서 제외하며, staging에서 별도 검증(NFR-PROG-PERF-006 timeout 30초 한도 내).

**검증 매핑**: NFR-PROG-PERF-001 ~ NFR-PROG-PERF-005

---

## 14. 품질 게이트 (Quality Gate Criteria)

### 14.1 테스트 커버리지

- `apps/backend/src/programs/`, `apps/backend/src/ai/` 라인 커버리지 ≥ 85%.
- 다음 함수는 100% 분기 커버리지 필수:
  - `programs.service.ts :: getDetail()` (카탈로그/본인 AI/타인 AI/존재하지 않는 ID 4분기).
  - `programs.service.ts :: activate()` (신규/기존/타인 AI/존재하지 않는 ID 4분기).
  - `programs.service.ts :: deactivate()` (활성 있음/없음 2분기).
  - `programs.service.ts :: getActive()` (활성 있음/없음 2분기).
  - `ai-programs.service.ts :: create()` (한도 초과/API 실패/검증 실패/성공 4분기).
  - `ai-validation.service.ts :: validate()` (7단계 검증 각각의 통과/실패).

### 14.2 TRUST 5 게이트

- **Tested**: 위 14.1 충족, Section 1~13의 모든 자동화 AC가 자동화된 테스트로 통과. Section 15의 수동 검증 시나리오는 QA 체크리스트로 별도 처리.
- **Readable**: ESLint(@typescript-eslint) 0 error, Prettier 통과. 함수명·변수명이 도메인 용어와 일치 (`program`, `userProgram`, `aiUsageLog`, `validateAiResponse`).
- **Unified**: NestJS 공식 컨벤션, Prisma 스키마 일관성, DTO 네이밍 일관성.
- **Secured**: AC-PROG-SECURITY-AUTH-01, AC-PROG-SECURITY-OWNERSHIP-01~03, AC-PROG-AI-RBAC-01 통과. `ANTHROPIC_API_KEY` 로그/응답 비노출.
- **Trackable**: 본 SPEC ID(SPEC-PROGRAM-001)를 모든 커밋 메시지에 포함, MX tag 적용 (plan.md Section 10).

### 14.3 LSP 게이트 (Run Phase)

- TypeScript `tsc --noEmit` 0 error (백엔드 + 모바일 + packages/types).
- `pnpm lint` 0 error, 0 warning.
- Prisma `prisma validate` 통과.

### 14.4 마이그레이션 게이트

- `pnpm prisma migrate status` 클린(drift 없음).
- 마이그레이션 reverse 정의되어 롤백 가능.
- 시드 실행 후 카탈로그 6건 정확성 검증 통과(AC-PROG-SEED-01).

---

## 15. 수동 검증 시나리오 (Manual Verification Scenarios)

본 절의 시나리오는 자동화 테스트로 검증이 어렵거나 비효율적이며, 모바일 클라이언트의 시각적/체험적 동작 또는 AI 응답의 정성적 품질을 사람이 확인해야 한다. **Definition of Done의 자동화 검증 요구(Section 16 항목 6)에서 명시적으로 제외된다**. QA 체크리스트로 별도 관리되며 출시 전 1회 이상 수행되어야 한다.

### MV-PROG-MOBILE-01: 카탈로그 목록 화면 표시 (수동 검증)

**Given**:
- 모바일 앱이 사용자 `U_TEST`로 로그인된 상태.
- 카탈로그 6종 시드 완료.

**When**:
- 사용자가 프로그램 탭 → 카탈로그 목록(`/(tabs)/programs/index`) 진입.

**Then** (수동 검증):
- 6개 프로그램 카드가 표시되며 각 카드는 제목, 분할 설명, 대상 수준, 주 빈도 정보를 포함.
- 카드 탭 시 해당 프로그램 상세 화면으로 이동.
- 로딩/에러 상태 UI 정상 동작.

**검증 매핑**: NFR-PROG-MOBILE-001, NFR-PROG-MOBILE-002

### MV-PROG-MOBILE-02: 프로그램 활성화 흐름 (수동 검증)

**Given**:
- 사용자가 카탈로그 상세 화면에 진입한 상태.
- 사용자에게 활성 프로그램이 없거나 다른 프로그램이 활성화된 상태.

**When**:
- "이 프로그램 활성화" 버튼 탭.
- 활성 프로그램 화면(`/(tabs)/programs/active`)으로 이동 확인.
- 활성 프로그램 화면에서 "해제" 버튼 탭.

**Then** (수동 검증):
- 활성화 시 토스트/안내 메시지 표시.
- 활성 프로그램 화면에 방금 활성화한 프로그램 상세가 표시됨.
- 해제 시 "활성 프로그램이 없습니다" 안내로 전환.
- 캐시 invalidation으로 카탈로그 화면으로 돌아가도 상태 일관성 유지.

**검증 매핑**: NFR-PROG-MOBILE-002

### MV-PROG-MOBILE-03: AI 생성 폼 — 권한 및 한도 표시 (수동 검증)

**Given**:
- 두 가지 사용자로 테스트:
  - 사용자 A: `USER` 권한, 한도 표시 없음.
  - 사용자 B: `PREMIUM` 권한, 현재 월 사용량 7/10.

**When**:
- AI 생성 화면(`/(tabs)/programs/ai-create`) 진입.

**Then** (수동 검증):
- 사용자 A:
  - "AI 맞춤 프로그램은 Premium 이상에서 이용 가능합니다" 안내 표시.
  - 폼이 비활성 또는 진입 자체 차단.
- 사용자 B:
  - 폼이 정상 표시.
  - "이번 달 7/10회 사용" 배지 표시(NFR-PROG-MOBILE-003).
  - 만약 사용량 10/10이면 "생성" 버튼 비활성 + 한도 도달 안내.

**검증 매핑**: NFR-PROG-MOBILE-003, REQ-PROG-AI-002

### MV-PROG-MOBILE-04: AI 생성 진행 중 UX (수동 검증)

**Given**:
- Premium 사용자, 한도 미달.
- AI 생성 폼이 유효하게 채워진 상태.

**When**:
- "생성" 버튼 탭.

**Then** (수동 검증):
- 즉시 로딩 인디케이터 표시(NFR-PROG-MOBILE-004).
- 진행 중 다른 화면으로 빠져나가지 못하거나, 빠져나가도 백그라운드 진행 표시.
- 성공 시 생성된 프로그램 상세 화면으로 자동 이동.
- 실패(400/403/422/429/502/504) 시 적절한 사용자 친화적 에러 메시지.
- 응답 시간이 최대 30초 이내(NFR-PROG-PERF-006).

**검증 매핑**: NFR-PROG-MOBILE-004, NFR-PROG-PERF-006

### MV-PROG-AI-PROMPT-01: AI 응답 품질 시각 검토 (수동 검증)

**Given**:
- Staging 환경, 실제 Anthropic API 호출.
- 다음 입력 매트릭스로 AI 호출:
  - goal × daysPerWeek 조합: (muscle_gain, 4), (strength, 3), (endurance, 5), (muscle_gain, 6)
  - availableEquipment × focusAreas 조합: (barbell+dumbbell, [chest, back]), (bodyweight only, []), (full gym, [legs])

**When**:
- 각 조합으로 `POST /ai/programs` 호출 후 응답 확인.

**Then** (수동 검증):
- 생성된 프로그램의 일별 구성이 운동학적으로 합리적인가? (같은 부위 과부하 없음, 휴식일 배치 적절함 등)
- 한국어 `title`/`description`이 자연스럽고 의미 통하는가?
- `weightNote`가 사용자에게 도움이 되는 가이드인가?
- `availableEquipment`에 없는 장비를 요구하는 운동이 포함되지 않았는가?
- `focusAreas`가 명시된 경우 해당 부위 운동 비중이 충분한가?

**검증 매핑**: REQ-PROG-AI-006, NFR-PROG-AI-COST(품질-비용 트레이드오프 관찰)

---

## 16. Definition of Done (완료 정의)

본 SPEC은 다음 모든 조건을 만족할 때 완료된 것으로 간주한다:

1. **DB 마이그레이션**: `Program`, `ProgramDay`, `ProgramExercise`, `UserProgram`, `AiUsageLog` 모델과 `ProgramType` enum이 추가되고 Prisma migration이 commit된다. 모든 UNIQUE/INDEX/FK 제약(`@@unique([userId])` on UserProgram, `@@unique([programId, dayNumber])`, `@@unique([dayId, orderIndex])`, `@@unique([userId, month])`, Exercise FK)이 적용된다.

2. **카탈로그 시드**: `prisma db seed` 실행 시 6종 카탈로그 프로그램이 정확히 시드되며 idempotent하게 재실행 가능(AC-PROG-SEED-01, AC-PROG-SEED-02 통과).

3. **API 구현**: 6개 엔드포인트(`GET /programs/catalog`, `GET /programs/:id`, `GET /programs/active`, `POST /programs/:id/activate`, `DELETE /programs/active`, `POST /ai/programs`)가 모두 구현되고 동작한다. `ProgramsModule`, `AiModule`이 `AppModule`에 등록된다.

4. **라우트 순서**: `ProgramsController`에서 고정 경로(`catalog`, `active`, `:id/activate`)가 동적 경로(`:id`)보다 먼저 등록되어 AC-PROG-ROUTE-01이 통과한다.

5. **응답 코드 분기**: `POST /programs/:id/activate`가 신규 시 `201 Created`, 기존 교체 시 `200 OK`를 정확히 반환한다(AC-PROG-ACTIVATE-01, AC-PROG-ACTIVATE-02). `DELETE /programs/active`는 활성 유무와 무관하게 `204 No Content`로 멱등 응답(AC-PROG-DEACTIVATE-01, AC-PROG-DEACTIVATE-02). `GET /programs/active`는 활성 부재 시 `200 OK + { active: null }`(AC-PROG-ACTIVE-EMPTY-01).

6. **검증 통과**: Section 1~13의 모든 자동화 시나리오(AC-PROG-CATALOG-01, AC-PROG-DETAIL-01, AC-PROG-DETAIL-NOTFOUND-01, AC-PROG-ACTIVATE-01, AC-PROG-ACTIVATE-02, AC-PROG-ACTIVATE-NOTFOUND-01, AC-PROG-DEACTIVATE-01, AC-PROG-DEACTIVATE-02, AC-PROG-ACTIVE-GET-01, AC-PROG-ACTIVE-EMPTY-01, AC-PROG-AI-SUCCESS-01, AC-PROG-AI-RBAC-01, AC-PROG-AI-LIMIT-01, AC-PROG-AI-INVALID-AI-RESPONSE-01, AC-PROG-AI-VALIDATION-01, AC-PROG-AI-UPSTREAM-FAIL-01, AC-PROG-ROUTE-01, AC-PROG-SECURITY-AUTH-01, AC-PROG-SECURITY-OWNERSHIP-01~03, AC-PROG-SEED-01, AC-PROG-SEED-02, AC-PROG-PERF-01)가 자동화된 테스트로 검증되고 통과한다. **Section 15의 수동 검증 시나리오(MV-PROG-MOBILE-01~04, MV-PROG-AI-PROMPT-01)는 본 자동화 요구에서 제외되며, 출시 전 QA 체크리스트로 별도 검증된다**.

7. **AI 카운터 정책**: AI 응답 검증 실패(422) 및 외부 API 장애(502/422/504) 시 `AiUsageLog.programCreations`가 증가하지 않음이 자동화 테스트로 검증된다(AC-PROG-AI-INVALID-AI-RESPONSE-01, AC-PROG-AI-UPSTREAM-FAIL-01).

8. **모바일 화면**: 카탈로그 목록, 프로그램 상세, 활성 프로그램, AI 생성 폼 4개 화면이 구현되어 Section 15의 수동 검증 시나리오를 통과한다(Phase 8).

9. **공유 타입**: `packages/types/src/program.ts`에 `ProgramType`, `Goal`, `Level`, `Program`, `ProgramDay`, `ProgramExercise`, `CatalogItem`, `CreateAiProgramRequest`, `AiUsage` 타입이 export되며 모바일이 이를 참조한다.

10. **품질 게이트**: 위 Section 14의 모든 기준 통과.

11. **MX tag**: `mx_plan`(spec.md Section 8 및 plan.md Section 10)에 정의된 모든 `@MX:ANCHOR`, `@MX:WARN`, `@MX:NOTE`, `@MX:TODO` 대상이 실제 코드에 적용된다.

12. **추적성**: 모든 REQ-PROG-* 항목이 본 acceptance.md의 시나리오로 1:1 또는 1:N 매핑되며 추적성 매트릭스(spec.md Section 9)가 최신 상태로 유지된다.

13. **보안**: `ANTHROPIC_API_KEY`가 환경 변수로 관리되며 응답/로그에 노출되지 않음이 정적 검사 및 로그 샘플링으로 확인된다(NFR-PROG-SEC-006).

14. **문서 동기화**: `/moai sync SPEC-PROGRAM-001`로 API 문서, README, CHANGELOG가 갱신된다.
