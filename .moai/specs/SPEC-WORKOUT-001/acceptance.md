# SPEC-WORKOUT-001 인수 기준 (Acceptance Criteria)

본 문서는 SPEC-WORKOUT-001의 모든 EARS 요구사항에 대한 검증 가능한 Given-When-Then 시나리오를 정의한다. 모든 자동화 시나리오는 단위 테스트, 통합 테스트, E2E 테스트 중 하나 이상으로 자동화되어야 한다. 수동 검증 시나리오는 Section 12에 별도 정리되며 DoD의 자동화 요구에서 명시적으로 제외된다.

전제:
- SPEC-AUTH-001 v1.0.1이 구현되어 있다 (`JwtAuthGuard`, `RolesGuard`, `UserRole` enum, `@CurrentUser()` 데코레이터 존재).
- SPEC-USER-001 v1.0.1이 구현되어 있다.
- SPEC-EXERCISE-001 v1.0.1이 구현되어 있다 (`Exercise` 모델 + 800+ 운동 시드 완료, 5종 컴파운드 운동 포함).
- SPEC-1RM-001 v1.0.1이 구현되어 있다 (`OneRepMax`, `CompoundType`, `OrmSource` enum, `packages/utils/src/1rm.ts` 공식 export 완료).
- SPEC-PROGRAM-001 v1.0.2가 구현되어 있다 (`Program`, `ProgramDay`, `UserProgram` 모델, `prisma db seed`로 6종 카탈로그 프로그램 시드 완료).
- Prisma 마이그레이션이 완료된 PostgreSQL DB가 존재한다 (`WorkoutSession`, `WorkoutSet` 테이블, `SessionStatus` enum).
- 컴파운드 매핑 테이블(`COMPOUND_EXERCISE_MAP` 또는 `Exercise.compoundType` 컬럼, plan.md 결정)이 5종 컴파운드의 `Exercise.id`와 `CompoundType`을 연결한다.
- 테스트 환경의 사용자 `U1`(role: `USER`), `U2`(role: `USER`)가 존재하며 각자 유효한 Access Token `T1`, `T2`를 보유한다.
- `U1`의 활성 프로그램: `UserProgram(userId: U1.id, programId: P_CATALOG.id)` (StrongLifts 5x5 카탈로그 프로그램의 `ProgramDay D1, D2`가 존재).
- 5종 컴파운드 `Exercise` ID: `E_SQUAT`(SQUAT), `E_DEADLIFT`(DEADLIFT), `E_BENCH`(BENCH_PRESS), `E_ROW`(BARBELL_ROW), `E_OHP`(OVERHEAD_PRESS).
- 비컴파운드 `Exercise` ID 예시: `E_CURL`(바이셉 컬), `E_PULLUP`(풀업, 보디웨이트).

---

## 1. 세션 생성 (AC-WO-SESSION)

### AC-WO-SESSION-CREATE-FREE-01: POST /workouts — 자유 세션 신규 생성 (201 Created)

**Given**:
- 사용자 `U1`이 진행 중 세션을 가지지 않음 (`WorkoutSession WHERE userId = U1.id AND status = IN_PROGRESS`이 0건).
- `E_SQUAT`, `E_CURL`이 `Exercise` 테이블에 존재.
- `U1`의 유효한 Access Token `T1`.

**When**:
- 클라이언트가 `POST /workouts`를 본문 `{ "exerciseIds": ["E_SQUAT", "E_CURL"] }`과 `Authorization: Bearer T1`로 호출.

**Then**:
- 응답 상태 코드는 `201 Created`.
- 응답 본문은 다음 필드를 포함:
  - `id`(cuid), `userId == U1.id`, `programId == null`, `programDayId == null`.
  - `status == "IN_PROGRESS"`, `notes == null`.
  - `startedAt`(ISO 8601, 현재 시점 ±5초 이내), `completedAt == null`, `cancelledAt == null`.
  - `sets == []` (빈 배열).
- DB에 `WorkoutSession(id=<응답.id>, userId=U1.id, status=IN_PROGRESS)` 레코드가 생성됨.
- `WorkoutSet` 테이블에 해당 `sessionId`의 레코드가 0건.

**검증 매핑**: REQ-WO-SESSION-001, REQ-WO-SESSION-006, REQ-WO-VAL-004, NFR-WO-DATA-001

### AC-WO-SESSION-CREATE-PROGRAM-01: POST /workouts — 프로그램 기반 세션 (201 Created)

**Given**:
- 사용자 `U1`이 진행 중 세션을 가지지 않음.
- `U1`의 활성 프로그램이 `P_CATALOG`(StrongLifts 5x5)이며 `ProgramDay D1`(`programId = P_CATALOG.id`)이 존재.
- `D1`은 `ProgramExercise`로 `E_SQUAT`, `E_BENCH`를 포함.

**When**:
- 클라이언트가 `POST /workouts`를 본문 `{ "programDayId": "D1.id" }`와 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `201 Created`.
- 응답 본문의 `programId == P_CATALOG.id`, `programDayId == D1.id`, `status == "IN_PROGRESS"`.
- DB에 `WorkoutSession(programId, programDayId)`가 정확히 설정됨.

**검증 매핑**: REQ-WO-SESSION-002, NFR-WO-DATA-002

### AC-WO-SESSION-CONFLICT-01: POST /workouts — 진행 중 세션 충돌 (409 Conflict)

**Given**:
- 사용자 `U1`이 이미 진행 중 세션 `S_ACTIVE`(`status = IN_PROGRESS`)를 보유.

**When**:
- 클라이언트가 `POST /workouts`를 본문 `{ "exerciseIds": ["E_SQUAT"] }`와 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `409 Conflict`.
- DB에 새 `WorkoutSession`이 생성되지 않음(기존 `S_ACTIVE`만 존재).
- 응답 본문은 충돌 사유를 명시(예: `{ "message": "Active session already exists", "activeSessionId": "..." }`).

**검증 매핑**: REQ-WO-SESSION-003

### AC-WO-SESSION-CREATE-INVALID-01: POST /workouts — 잘못된 입력 (400 Bad Request)

**Given**:
- 사용자 `U1`이 진행 중 세션을 가지지 않음.
- 존재하지 않는 `exerciseId = "non-existent-id"`.
- 사용자 `U1`의 활성 프로그램이 `P_CATALOG`이며 `ProgramDay D_OTHER`(`programId = P_OTHER.id`, 활성 아님)가 존재.

**When**:
- 다음 케이스로 `POST /workouts` 호출:
  1. 본문 없음 또는 `{}` → `400 Bad Request`.
  2. `{ "exerciseIds": [], "programDayId": null }` → `400 Bad Request`.
  3. `{ "exerciseIds": ["E_SQUAT"], "programDayId": "D1.id" }` (둘 다 제공) → `400 Bad Request`.
  4. `{ "exerciseIds": ["non-existent-id"] }` → `400 Bad Request`.
  5. `{ "programDayId": "D_OTHER.id" }` (활성 프로그램의 `ProgramDay`가 아님) → `400 Bad Request`.
  6. `{ "programDayId": "non-existent-day-id" }` → `400 Bad Request`.

**Then**:
- 모든 케이스의 응답 상태 코드는 `400 Bad Request`.
- DB에 새 `WorkoutSession`이 생성되지 않음.

**검증 매핑**: REQ-WO-SESSION-004, REQ-WO-SESSION-005, REQ-WO-SESSION-006, REQ-WO-VAL-003

---

## 2. 세트 기록 (AC-WO-SET)

### AC-WO-SET-ADD-01: POST /workouts/:id/sets — 세트 추가 성공 (201 Created)

**Given**:
- 사용자 `U1`이 진행 중 세션 `S_ACTIVE`(`exerciseIds: [E_SQUAT]`)를 보유, 현재 세트 0건.

**When**:
- 클라이언트가 `POST /workouts/S_ACTIVE.id/sets`를 본문 `{ "exerciseId": "E_SQUAT", "setNumber": 1, "weight": 100.0, "reps": 5, "rpe": 8, "isCompleted": true }`와 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `201 Created`.
- 응답 본문은 다음 필드를 포함:
  - `id`(cuid), `sessionId == S_ACTIVE.id`, `exerciseId == "E_SQUAT"`.
  - `setNumber == 1`, `weight == 100.00`(Decimal 2자리), `reps == 5`, `rpe == 8`.
  - `isCompleted == true`, `completedAt`(현재 시점 ±5초).
  - `orderIndex`(정수, 세션 내 첫 세트이므로 0 또는 1).
- DB에 `WorkoutSet(sessionId=S_ACTIVE.id, exerciseId=E_SQUAT, setNumber=1, isCompleted=true, completedAt=<응답.completedAt>)` 레코드가 생성됨.

**검증 매핑**: REQ-WO-SET-001, REQ-WO-SET-003, REQ-WO-VAL-004, NFR-WO-DATA-005

### AC-WO-SET-ADD-BODYWEIGHT-01: 보디웨이트 운동 세트 추가 (weight = null)

**Given**:
- 사용자 `U1`이 진행 중 세션 `S_ACTIVE`를 보유.
- `E_PULLUP`이 `Exercise` 테이블에 존재(보디웨이트 운동).

**When**:
- 클라이언트가 `POST /workouts/S_ACTIVE.id/sets`를 본문 `{ "exerciseId": "E_PULLUP", "setNumber": 1, "weight": null, "reps": 8 }`와 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `201 Created`.
- 응답 본문의 `weight == null`, `reps == 8`, `rpe == null`, `isCompleted == false`.

**검증 매핑**: REQ-WO-SET-001, REQ-WO-SET-003 (weight nullable)

### AC-WO-SET-DUPLICATE-01: 중복 (sessionId, exerciseId, setNumber) (409 Conflict)

**Given**:
- 사용자 `U1`이 진행 중 세션 `S_ACTIVE`에 이미 `WorkoutSet(exerciseId=E_SQUAT, setNumber=1)` 1건 존재.

**When**:
- 동일한 `{ "exerciseId": "E_SQUAT", "setNumber": 1, "reps": 5 }`로 `POST /workouts/S_ACTIVE.id/sets` 재호출.

**Then**:
- 응답 상태 코드는 `409 Conflict`.
- DB에 새 `WorkoutSet`이 추가되지 않음(기존 1건만 유지).

**검증 매핑**: REQ-WO-SET-002, NFR-WO-DATA-005

### AC-WO-SET-VALIDATION-01: 입력 검증 실패 (400 Bad Request)

**Given**:
- 사용자 `U1`이 진행 중 세션 `S_ACTIVE`를 보유.

**When**:
- 다음 케이스로 `POST /workouts/S_ACTIVE.id/sets` 호출:
  1. `{ "exerciseId": "E_SQUAT", "setNumber": 0, "reps": 5 }` (`setNumber < 1`) → `400 Bad Request`.
  2. `{ "exerciseId": "E_SQUAT", "setNumber": 51, "reps": 5 }` (`setNumber > 50`) → `400 Bad Request`.
  3. `{ "exerciseId": "E_SQUAT", "setNumber": 1, "weight": -10, "reps": 5 }` (`weight < 0`) → `400 Bad Request`.
  4. `{ "exerciseId": "E_SQUAT", "setNumber": 1, "weight": 1001, "reps": 5 }` (`weight > 1000`) → `400 Bad Request`.
  5. `{ "exerciseId": "E_SQUAT", "setNumber": 1, "reps": 0 }` (`reps < 1`) → `400 Bad Request`.
  6. `{ "exerciseId": "E_SQUAT", "setNumber": 1, "reps": 201 }` (`reps > 200`) → `400 Bad Request`.
  7. `{ "exerciseId": "E_SQUAT", "setNumber": 1, "reps": 5, "rpe": 11 }` (`rpe > 10`) → `400 Bad Request`.
  8. `{ "exerciseId": "E_SQUAT", "setNumber": 1, "reps": 5, "rpe": 0 }` (`rpe < 1`) → `400 Bad Request`.
  9. `{ "exerciseId": "non-existent-id", "setNumber": 1, "reps": 5 }` → `400 Bad Request`.
  10. `{ "exerciseId": "E_SQUAT", "setNumber": 1, "reps": 5, "extraField": "x" }` (DTO 외 필드) → `400 Bad Request`.

**Then**:
- 모든 케이스의 응답 상태 코드는 `400 Bad Request`.
- DB에 `WorkoutSet`이 추가되지 않음.

**검증 매핑**: REQ-WO-SET-003, REQ-WO-VAL-003

### AC-WO-SET-UPDATE-01: PATCH /workouts/:id/sets/:setId — 부분 수정 (200 OK)

**Given**:
- `S_ACTIVE`에 `WorkoutSet ST1(exerciseId=E_SQUAT, setNumber=1, weight=100, reps=5, rpe=null, isCompleted=false, completedAt=null)`이 존재.

**When**:
- 클라이언트가 `PATCH /workouts/S_ACTIVE.id/sets/ST1.id`를 본문 `{ "weight": 102.5, "reps": 5, "rpe": 9, "isCompleted": true }`와 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문의 `weight == 102.50`, `reps == 5`, `rpe == 9`, `isCompleted == true`, `completedAt`(현재 시점 ±5초).
- DB의 `WorkoutSet ST1`이 갱신됨.

**후속 케이스 (isCompleted true → false 전환)**:
- `ST1`을 다시 `PATCH ... { "isCompleted": false }`로 호출.
- 응답의 `isCompleted == false`, `completedAt == null`.

**검증 매핑**: REQ-WO-SET-004

### AC-WO-SET-DELETE-01: DELETE /workouts/:id/sets/:setId — 삭제 (204 No Content)

**Given**:
- `S_ACTIVE`에 `WorkoutSet ST1`이 존재.

**When**:
- 클라이언트가 `DELETE /workouts/S_ACTIVE.id/sets/ST1.id`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `204 No Content`, 본문 없음.
- DB에서 `ST1`이 영구 삭제됨.

**검증 매핑**: REQ-WO-SET-005

### AC-WO-SET-LOCKED-01: 완료/취소된 세션의 세트 변경 거부 (409 Conflict)

**Given**:
- 사용자 `U1`의 세션 `S_COMPLETED`(`status = COMPLETED`)와 `S_CANCELLED`(`status = CANCELLED`)에 각각 `WorkoutSet ST_C`, `ST_X` 존재.

**When**:
- 다음 케이스로 호출:
  1. `POST /workouts/S_COMPLETED.id/sets` → `409 Conflict`.
  2. `PATCH /workouts/S_COMPLETED.id/sets/ST_C.id` → `409 Conflict`.
  3. `DELETE /workouts/S_COMPLETED.id/sets/ST_C.id` → `409 Conflict`.
  4. 동일하게 `S_CANCELLED`에 대한 세트 변경 → 모두 `409 Conflict`.

**Then**:
- 모든 케이스의 응답 상태 코드는 `409 Conflict`.
- DB에 세트 변경이 발생하지 않음.

**검증 매핑**: REQ-WO-SET-006

### AC-WO-SET-NOTFOUND-01: 존재하지 않는 setId (404 Not Found)

**Given**:
- `S_ACTIVE`(진행 중)가 존재. `setId = "non-existent-set-id"`가 DB에 없음.

**When**:
- `PATCH /workouts/S_ACTIVE.id/sets/non-existent-set-id` 또는 `DELETE /workouts/S_ACTIVE.id/sets/non-existent-set-id`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `404 Not Found`.

**검증 매핑**: REQ-WO-SET-007, REQ-WO-VAL-002

### AC-WO-SET-AUTO-NUMBER-01: setNumber 생략 시 자동 부여

**Given**:
- `S_ACTIVE`에 `WorkoutSet(exerciseId=E_SQUAT, setNumber=1)`, `WorkoutSet(exerciseId=E_SQUAT, setNumber=2)`, `WorkoutSet(exerciseId=E_BENCH, setNumber=1)`이 존재.

**When**:
- 케이스 A: `POST /workouts/S_ACTIVE.id/sets`를 본문 `{ "exerciseId": "E_SQUAT", "reps": 5 }`(setNumber 생략)로 호출.
- 케이스 B: `POST /workouts/S_ACTIVE.id/sets`를 본문 `{ "exerciseId": "E_DEADLIFT", "reps": 5 }`(같은 운동 세트 없음, setNumber 생략)로 호출.

**Then**:
- 케이스 A 응답 `setNumber == 3` (기존 최대 `E_SQUAT.setNumber=2` + 1).
- 케이스 B 응답 `setNumber == 1` (기존 `E_DEADLIFT` 세트 없음).

**검증 매핑**: REQ-WO-SET-008

---

## 3. 세션 완료/취소 (AC-WO-COMPLETE)

### AC-WO-COMPLETE-01: POST /workouts/:id/complete — 완료 성공 (200 OK)

**Given**:
- 사용자 `U1`의 진행 중 세션 `S_ACTIVE`에 완료된 세트 `WorkoutSet(exerciseId=E_SQUAT, setNumber=1, weight=100, reps=5, isCompleted=true)`이 존재.
- `U1`의 `OneRepMax(exerciseType=SQUAT)`가 존재하지 않음.

**When**:
- 클라이언트가 `POST /workouts/S_ACTIVE.id/complete`를 본문 없이 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문의 `status == "COMPLETED"`, `completedAt`(현재 시점 ±5초), `cancelledAt == null`.
- DB의 `WorkoutSession S_ACTIVE`의 `status = COMPLETED`, `completedAt` 설정됨.
- 응답 시간 P95 ≤ 300ms (NFR-WO-PERF-006, 1RM 갱신은 비동기 분리).
- `S_ACTIVE.startedAt < S_ACTIVE.completedAt` 검증 (REQ-WO-VAL-005).

**검증 매핑**: REQ-WO-COMPLETE-001, REQ-WO-VAL-005, NFR-WO-PERF-006

### AC-WO-CANCEL-01: POST /workouts/:id/cancel — 취소 성공 (200 OK)

**Given**:
- 사용자 `U1`의 진행 중 세션 `S_ACTIVE`.

**When**:
- 클라이언트가 `POST /workouts/S_ACTIVE.id/cancel`을 본문 없이 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문의 `status == "CANCELLED"`, `cancelledAt`(현재 시점 ±5초), `completedAt == null`.
- DB의 `WorkoutSession.status = CANCELLED`, `cancelledAt` 설정됨.
- 1RM 자동 갱신은 트리거되지 않음(`COMPLETED`가 아님).

**검증 매핑**: REQ-WO-COMPLETE-002, REQ-WO-VAL-005

### AC-WO-COMPLETE-DOUBLE-01: 이미 종료된 세션 완료/취소 거부 (409 Conflict)

**Given**:
- 사용자 `U1`의 세션 `S_COMPLETED`(`status = COMPLETED`)와 `S_CANCELLED`(`status = CANCELLED`).

**When**:
- 다음 케이스 호출:
  1. `POST /workouts/S_COMPLETED.id/complete` → `409 Conflict`.
  2. `POST /workouts/S_COMPLETED.id/cancel` → `409 Conflict`.
  3. `POST /workouts/S_CANCELLED.id/complete` → `409 Conflict`.
  4. `POST /workouts/S_CANCELLED.id/cancel` → `409 Conflict`.

**Then**:
- 모든 케이스의 응답 상태 코드는 `409 Conflict`.
- DB의 세션 상태는 변경되지 않음.

**검증 매핑**: REQ-WO-COMPLETE-003

### AC-WO-COMPLETE-EMPTY-01: 빈 세션 완료 허용

**Given**:
- 사용자 `U1`의 진행 중 세션 `S_EMPTY`에 `WorkoutSet`이 0건, 또는 모든 세트의 `isCompleted = false`.

**When**:
- `POST /workouts/S_EMPTY.id/complete`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `200 OK` (빈 세션도 정상 완료).
- DB의 `S_EMPTY.status = COMPLETED`.
- 1RM 자동 갱신은 트리거되지 않음(완료 세트 0건).

**검증 매핑**: REQ-WO-COMPLETE-004, REQ-WO-1RM-002

### AC-WO-DELETE-CANCELLED-01: DELETE /workouts/:id — CANCELLED 삭제 (204 No Content)

**Given**:
- 사용자 `U1`의 세션 `S_CANCELLED`에 `WorkoutSet` 3건 존재.

**When**:
- `DELETE /workouts/S_CANCELLED.id`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `204 No Content`.
- DB에서 `S_CANCELLED`와 연관된 모든 `WorkoutSet`이 cascade 삭제됨(`onDelete: Cascade`, NFR-WO-DATA-003).

**검증 매핑**: REQ-WO-COMPLETE-005, NFR-WO-DATA-003

### AC-WO-DELETE-COMPLETED-01: COMPLETED 삭제 금지 (409 Conflict)

**Given**:
- 사용자 `U1`의 세션 `S_COMPLETED`.

**When**:
- `DELETE /workouts/S_COMPLETED.id`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `409 Conflict`.
- DB의 `S_COMPLETED`가 그대로 유지됨.

**검증 매핑**: REQ-WO-COMPLETE-006

### AC-WO-DELETE-INPROGRESS-01: IN_PROGRESS 삭제 거부 (409 Conflict)

**Given**:
- 사용자 `U1`의 진행 중 세션 `S_ACTIVE`.

**When**:
- `DELETE /workouts/S_ACTIVE.id`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `409 Conflict`.
- 응답 본문은 `cancel` 후 `DELETE` 호출하도록 안내(예: `{ "message": "Cancel the session before deleting" }`).
- DB의 `S_ACTIVE`가 그대로 유지됨.

**검증 매핑**: REQ-WO-COMPLETE-007

### AC-WO-NOTES-UPDATE-01: PATCH /workouts/:id — 메모 수정 (모든 상태 허용)

**Given**:
- 사용자 `U1`의 세션 3종: `S_ACTIVE`(IN_PROGRESS), `S_COMPLETED`, `S_CANCELLED`.

**When**:
- 각각에 대해 `PATCH /workouts/<id>`를 본문 `{ "notes": "오늘은 컨디션이 좋았다." }`(한국어 포함, 30자)와 `T1`로 호출.

**Then**:
- 3건 모두 응답 상태 코드 `200 OK`.
- 각 세션의 `notes` 필드가 갱신됨.

**경계 케이스**:
- `notes` 길이 1000자 → `200 OK` (허용).
- `notes` 길이 1001자 → `400 Bad Request`.

**검증 매핑**: REQ-WO-COMPLETE-008, REQ-WO-VAL-004

---

## 4. 세션 조회 (AC-WO-QUERY)

### AC-WO-LIST-01: GET /workouts — 페이지네이션 목록 조회

**Given**:
- 사용자 `U1`이 `WorkoutSession` 47건을 보유(`status` 분포: 5건 IN_PROGRESS는 불가하므로 0건, 30건 COMPLETED, 17건 CANCELLED). `startedAt`은 서로 다른 시각으로 분포.
- 사용자 `U2`가 `WorkoutSession` 10건을 보유(혼입 방지 검증용).

**When**:
- 클라이언트가 `GET /workouts?page=1&limit=20`을 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문의 구조: `{ items: [...], page: 1, limit: 20, total: 47, totalPages: 3 }`.
- `items`는 정확히 20건, 모두 `userId == U1.id` (`U2` 세션 미포함).
- `items`는 `startedAt` 내림차순 정렬.
- 2번째 페이지(`?page=2&limit=20`) 호출 시 `items` 20건, 3번째 페이지 호출 시 `items` 7건.

**검증 매핑**: REQ-WO-QUERY-001, REQ-WO-QUERY-002, REQ-WO-QUERY-008, NFR-WO-SEC-002

### AC-WO-LIST-FILTER-01: GET /workouts — status / 날짜 필터

**Given**:
- 사용자 `U1`의 세션: 30건 COMPLETED, 17건 CANCELLED.
- 30건 중 10건은 `startedAt`이 `2026-05-01 ~ 2026-05-07` 범위.

**When**:
- 다음 케이스로 호출:
  1. `GET /workouts?status=COMPLETED` → `items` 30건, 모두 `status == COMPLETED`.
  2. `GET /workouts?status=CANCELLED` → `items` 17건, 모두 `status == CANCELLED`.
  3. `GET /workouts?status=INVALID_STATUS` → `400 Bad Request`.
  4. `GET /workouts?startedAtFrom=2026-05-01T00:00:00Z&startedAtTo=2026-05-07T23:59:59Z` → `items` 10건.
  5. `GET /workouts?startedAtFrom=2026-05-07&startedAtTo=2026-05-01` (from > to) → `400 Bad Request`.
  6. `GET /workouts?limit=101` → `400 Bad Request` (`limit > 100`).
  7. `GET /workouts?page=0` → `400 Bad Request` (`page < 1`).

**Then**:
- 케이스 1, 2, 4: `200 OK`, 결과 건수 일치.
- 케이스 3, 5, 6, 7: `400 Bad Request`.

**검증 매핑**: REQ-WO-QUERY-003, REQ-WO-VAL-003

### AC-WO-ACTIVE-01: GET /workouts/active — 진행 중 있음

**Given**:
- 사용자 `U1`의 진행 중 세션 `S_ACTIVE`(`status = IN_PROGRESS`)와 세트 5건.

**When**:
- 클라이언트가 `GET /workouts/active`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문은 `{ "active": { ... S_ACTIVE 상세 ... } }` 형식.
- `active.sets`는 5건이며 `orderIndex` 오름차순 정렬, 각 세트는 `exercise` 중첩 객체(`name`, `primaryMuscles`, `image`) 포함.
- 응답 시간 P95 ≤ 200ms (NFR-WO-PERF-002).

**검증 매핑**: REQ-WO-QUERY-004, REQ-WO-QUERY-006, REQ-WO-QUERY-008, NFR-WO-PERF-002

### AC-WO-ACTIVE-EMPTY-01: GET /workouts/active — 진행 중 없음

**Given**:
- 사용자 `U1`이 진행 중 세션을 가지지 않음(`COMPLETED`, `CANCELLED` 세션은 있을 수 있음).

**When**:
- 클라이언트가 `GET /workouts/active`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `200 OK` (404 아님).
- 응답 본문은 정확히 `{ "active": null }`.

**검증 매핑**: REQ-WO-QUERY-005

### AC-WO-DETAIL-01: GET /workouts/:id — 세션 상세

**Given**:
- 사용자 `U1`의 세션 `S_COMPLETED`에 `WorkoutSet` 6건이 존재하며 `exerciseId`가 혼재(`E_SQUAT` 3건, `E_BENCH` 3건).
- 각 세트의 `orderIndex`는 0~5로 설정됨.

**When**:
- 클라이언트가 `GET /workouts/S_COMPLETED.id`를 `T1`로 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문은 다음 필드를 포함:
  - 세션 메타: `id`, `userId`, `programId`, `programDayId`, `status`, `notes`, `startedAt`, `completedAt`, `cancelledAt`, `createdAt`, `updatedAt`.
  - `sets` 배열: 6건, `orderIndex` 오름차순.
  - 각 세트는 `id`, `exerciseId`, `setNumber`, `weight`, `reps`, `rpe`, `isCompleted`, `completedAt`, `orderIndex`, `exercise`(`name`, `primaryMuscles`, `image`) 포함.
- 응답 시간 P95 ≤ 400ms (NFR-WO-PERF-003).

**검증 매핑**: REQ-WO-QUERY-006, REQ-WO-QUERY-008, NFR-WO-PERF-003

### AC-WO-DETAIL-NOTFOUND-01: GET /workouts/:id — 존재하지 않거나 잘못된 형식

**Given**:
- 사용자 `U1`. DB에 `id = "non-existent-cuid"` 미존재.

**When**:
- 다음 케이스로 `GET /workouts/:id`를 `T1`로 호출:
  1. `/workouts/non-existent-cuid` → `404 Not Found`.
  2. `/workouts/invalid-format` (cuid 형식 위반) → `404 Not Found`.
  3. `/workouts/12345` → `404 Not Found`.

**Then**:
- 모든 케이스의 응답 상태 코드는 `404 Not Found`.

**검증 매핑**: REQ-WO-QUERY-007, REQ-WO-VAL-002

---

## 5. 플레이트 계산기 (AC-WO-PLATES)

### AC-WO-PLATES-01: GET /workouts/utils/plates — 정상 계산

**Given**:
- 사용자 `U1`의 유효한 Access Token `T1`.

**When**:
- 클라이언트가 다음 케이스로 `GET /workouts/utils/plates?weight=<W>&barWeight=<B>`를 `T1`로 호출:

| 케이스 | weight | barWeight | 기대 결과 |
|---|---|---|---|
| A | 100 | 20 | perSide=[{20,1},{10,1}], remainder=0 |
| B | 60 | 20 | perSide=[{20,1}], remainder=0 |
| C | 102.5 | 20 | perSide=[{20,1},{10,1},{1.25,1}], remainder=0 |
| D | 20 | 20 | perSide=[], remainder=0 (바벨만) |
| E | 50 | 15 | perSide=[{15,1},{2.5,1}], remainder=0 |
| F | 100.7 | 20 | perSide=[{20,1},{10,1}], remainder=0.7 (표현 불가) |

**Then**:
- 모든 케이스 응답 상태 코드 `200 OK`.
- 응답 본문 구조: `{ totalWeight, barWeight, plates, perSide, remainder }`.
- `plates[*].count`는 항상 짝수(`perSide.count * 2`) (REQ-WO-PLATES-003).
- `perSide` 합계 × 2 + `barWeight` + `remainder` = `weight` (검증식).
- 응답 시간 P95 ≤ 50ms (NFR-WO-PERF-007).

**검증 매핑**: REQ-WO-PLATES-001, REQ-WO-PLATES-003, NFR-WO-PERF-007

### AC-WO-PLATES-VALIDATION-01: 입력 검증 실패

**Given**: 사용자 `U1`의 `T1`.

**When**:
- 다음 케이스로 `GET /workouts/utils/plates` 호출:
  1. `?weight=0` → `400` (`weight <= 0`).
  2. `?weight=-50` → `400`.
  3. `?weight=1001` → `400` (`weight > 1000`).
  4. `?weight=` (생략) → `400`.
  5. `?weight=100&barWeight=10` → `400` (`barWeight` 미허용 값).
  6. `?weight=10&barWeight=20` → `400` (`weight < barWeight`).
  7. `?weight=abc` → `400` (타입 위반).

**Then**:
- 모든 케이스 응답 상태 코드 `400 Bad Request`.

**검증 매핑**: REQ-WO-PLATES-002, REQ-WO-VAL-003

### AC-WO-PLATES-DETERMINISTIC-01: 결정성

**Given**: 사용자 `U1`의 `T1`.

**When**:
- 동일 쿼리(`weight=100&barWeight=20`)로 `GET /workouts/utils/plates`를 10회 연속 호출.

**Then**:
- 10회 응답 본문이 모두 동일(JSON 직렬화 기준 byte-equivalent).

**검증 매핑**: REQ-WO-PLATES-005

---

## 6. 1RM 자동 갱신 (AC-WO-1RM)

### AC-WO-1RM-UPDATE-01: 세션 완료 시 1RM 상향 갱신

**Given**:
- 사용자 `U1`의 진행 중 세션 `S_ACTIVE`에 다음 완료된 세트가 존재:
  - `WorkoutSet(exerciseId=E_SQUAT, weight=100, reps=5, isCompleted=true)` ×1
  - `WorkoutSet(exerciseId=E_BENCH, weight=80, reps=8, isCompleted=true)` ×1
  - `WorkoutSet(exerciseId=E_CURL, weight=15, reps=12, isCompleted=true)` ×1 (비컴파운드)
- `U1`의 `OneRepMax` 테이블: `OneRepMax(exerciseType=SQUAT, value=110)` 존재, 다른 컴파운드 미존재.
- Epley: `100 * (1 + 5/30) = 116.67`, Brzycki: `100 * (36/(37-5)) = 112.50`, Average: `114.58` (소수 둘째자리 반올림).
- Epley(벤치): `80 * (1 + 8/30) = 101.33`, Brzycki: `80 * (36/29) = 99.31`, Average: `100.32`.

**When**:
- 클라이언트가 `POST /workouts/S_ACTIVE.id/complete`를 `T1`로 호출.

**Then**:
- 응답 상태 코드 `200 OK` (즉시 반환, 1RM 갱신 대기 없음).
- 1초 이내(NFR-WO-PERF-008) 이후 DB 상태:
  - `OneRepMax(userId=U1.id, exerciseType=SQUAT).value == 114.58` (기존 110에서 상향 갱신, `source = AVERAGE_ESTIMATE`).
  - `OneRepMax(userId=U1.id, exerciseType=BENCH_PRESS).value == 100.32` (신규 생성, `source = AVERAGE_ESTIMATE`).
  - 비컴파운드 `E_CURL`은 1RM 갱신에서 제외됨.
  - 다른 컴파운드(`DEADLIFT`, `BARBELL_ROW`, `OVERHEAD_PRESS`)는 변경 없음.

**검증 매핑**: REQ-WO-1RM-001, REQ-WO-1RM-002, REQ-WO-1RM-003, REQ-WO-1RM-004, REQ-WO-1RM-005, REQ-WO-1RM-007, NFR-WO-CONSISTENCY-001, NFR-WO-PERF-008

### AC-WO-1RM-NO-DOWNGRADE-01: 추정치가 기존보다 낮을 때 하향 갱신 금지

**Given**:
- 사용자 `U1`의 `OneRepMax(exerciseType=SQUAT, value=150, source=DIRECT_INPUT)` 존재.
- 진행 중 세션 `S_ACTIVE`에 `WorkoutSet(exerciseId=E_SQUAT, weight=80, reps=5, isCompleted=true)` (Average ≈ 91.67).

**When**:
- `POST /workouts/S_ACTIVE.id/complete`를 `T1`로 호출.

**Then**:
- 응답 `200 OK`.
- 1초 이내 DB 상태: `OneRepMax(userId=U1.id, exerciseType=SQUAT).value`는 여전히 `150` (하향 갱신 없음).
- `source`도 `DIRECT_INPUT` 유지(변경 없음).

**검증 매핑**: REQ-WO-1RM-004

### AC-WO-1RM-NO-COMPOUND-01: 컴파운드 세트 없는 세션 완료

**Given**:
- 사용자 `U1`의 진행 중 세션 `S_ACTIVE`에 `WorkoutSet(exerciseId=E_CURL, weight=15, reps=12, isCompleted=true)`만 존재(비컴파운드).
- `U1`의 모든 `OneRepMax` 레코드 현재 상태 스냅샷 저장.

**When**:
- `POST /workouts/S_ACTIVE.id/complete`를 `T1`로 호출.

**Then**:
- 응답 `200 OK`.
- 1초 이내 DB 상태: `U1`의 모든 `OneRepMax` 레코드가 스냅샷과 동일(변경 없음).

**검증 매핑**: REQ-WO-1RM-002, REQ-WO-1RM-007

### AC-WO-1RM-INCOMPLETE-SET-EXCLUDED-01: 미완료 세트는 추정에서 제외

**Given**:
- 사용자 `U1`의 진행 중 세션에 다음 세트:
  - `WorkoutSet(E_SQUAT, weight=200, reps=1, isCompleted=false)` (미완료, 큰 무게)
  - `WorkoutSet(E_SQUAT, weight=100, reps=5, isCompleted=true)` (완료)
- `U1`의 `OneRepMax(SQUAT)` 미존재.

**When**:
- 세션 완료.

**Then**:
- 추정 1RM은 완료된 세트(100×5, Average ≈ 114.58)만 사용.
- `OneRepMax(SQUAT).value == 114.58` (미완료 200×1의 Average 230은 제외됨).

**검증 매핑**: REQ-WO-1RM-002

### AC-WO-1RM-NULL-WEIGHT-EXCLUDED-01: weight=null 세트 제외

**Given**:
- 사용자 `U1`의 세션에 `WorkoutSet(E_SQUAT, weight=null, reps=10, isCompleted=true)` (보디웨이트는 SQUAT에 일반적이지 않으나 테스트 케이스로 가정).
- `U1`의 `OneRepMax(SQUAT)` 미존재.

**When**:
- 세션 완료.

**Then**:
- 1초 이내 DB 상태: `OneRepMax(SQUAT)` 미생성(weight=null 세트는 추정 제외, 적격 세트 0건).

**검증 매핑**: REQ-WO-1RM-002

### AC-WO-1RM-FAILURE-ISOLATED-01: 1RM 갱신 실패 시 세션 완료는 성공

**Given**:
- 사용자 `U1`의 진행 중 세션에 컴파운드 완료 세트 존재.
- 1RM 갱신 서비스가 의도적으로 예외를 던지도록 mock 설정(테스트 환경).

**When**:
- `POST /workouts/S_ACTIVE.id/complete`를 `T1`로 호출.

**Then**:
- 응답 상태 코드 `200 OK` (1RM 실패와 무관하게 성공).
- DB의 `WorkoutSession.status = COMPLETED` (롤백 없음).
- 서버 로그에 1RM 갱신 실패가 ERROR 또는 WARN 레벨로 기록됨.
- `OneRepMax` 레코드는 갱신되지 않음(또는 예외 이전 상태 유지).

**검증 매핑**: REQ-WO-1RM-006

---

## 7. 보안 / 사용자 격리 (AC-WO-SECURITY)

### AC-WO-SECURITY-AUTH-01: JWT 누락/만료 시 401

**Given**:
- DB에 임의의 `WorkoutSession`이 존재.

**When**:
- 다음 케이스로 호출:
  1. `Authorization` 헤더 없이 `GET /workouts` → `401 Unauthorized`.
  2. 만료된 JWT로 `POST /workouts` → `401 Unauthorized`.
  3. 잘못된 서명 JWT로 `GET /workouts/active` → `401 Unauthorized`.
  4. 잘못된 서명 JWT로 `GET /workouts/utils/plates?weight=100` → `401 Unauthorized`.

**Then**:
- 본 SPEC의 모든 12개 엔드포인트에서 위 조건 발생 시 응답 상태 코드 `401 Unauthorized`.

**검증 매핑**: REQ-WO-SESSION-007, REQ-WO-PLATES-004, NFR-WO-SEC-001

### AC-WO-SECURITY-OWNERSHIP-01: 타 사용자 세션 접근 차단

**Given**:
- 사용자 `U1`의 세션 `S_U1`(`userId = U1.id`)이 존재.
- 사용자 `U2`의 유효한 Access Token `T2`.

**When**:
- 사용자 `U2`가 `T2`로 다음 호출:
  1. `GET /workouts/S_U1.id` → `404 Not Found` (존재 정보 누설 방지).
  2. `PATCH /workouts/S_U1.id` body `{ notes: "악의 수정" }` → `404 Not Found`.
  3. `DELETE /workouts/S_U1.id` → `404 Not Found`.
  4. `POST /workouts/S_U1.id/complete` → `404 Not Found`.
  5. `POST /workouts/S_U1.id/cancel` → `404 Not Found`.
  6. `POST /workouts/S_U1.id/sets` body `{ exerciseId: "E_SQUAT", reps: 5 }` → `404 Not Found`.
  7. `GET /workouts?` → 응답의 `items`에 `S_U1` 미포함.

**Then**:
- 케이스 1~6 모두 `404 Not Found` (`403`이 아닌 `404`로 존재 자체를 숨김).
- DB의 `S_U1`은 변경되지 않음.
- 케이스 7: `items` 배열의 모든 항목 `userId == U2.id`, `S_U1` 미포함.

**검증 매핑**: REQ-WO-SESSION-008, REQ-WO-QUERY-007, NFR-WO-SEC-002, NFR-WO-SEC-003

### AC-WO-SECURITY-OWNERSHIP-02: 타 사용자 세션의 세트 접근 차단

**Given**:
- 사용자 `U1`의 세션 `S_U1`에 세트 `ST_U1` 존재.
- 사용자 `U2`의 `T2`.

**When**:
- 사용자 `U2`가 `T2`로 다음 호출:
  1. `PATCH /workouts/S_U1.id/sets/ST_U1.id` → `404 Not Found`.
  2. `DELETE /workouts/S_U1.id/sets/ST_U1.id` → `404 Not Found`.
  3. `POST /workouts/S_U1.id/sets` → `404 Not Found`.

**Then**:
- 모든 케이스 `404 Not Found`.
- `ST_U1`은 변경/삭제되지 않음.

**검증 매핑**: REQ-WO-SESSION-008, NFR-WO-SEC-002

### AC-WO-SECURITY-NO-USERID-IN-INPUT-01: userId 직접 지정 차단

**Given**: 사용자 `U1`의 `T1`.

**When**:
- 다음 케이스로 호출:
  1. `POST /workouts` body `{ exerciseIds: ["E_SQUAT"], userId: "U2.id" }` → DTO whitelist로 `userId` 필드 거부, `400 Bad Request`.
  2. `GET /workouts?userId=U2.id` → 쿼리 파라미터 `userId`는 DTO에 정의 없음, 무시되거나 `400 Bad Request`.

**Then**:
- 케이스 1: `400 Bad Request` 또는 `userId` 무시되고 `userId == U1.id`로 처리.
- 케이스 2: 응답의 `items`는 `U1`의 세션만 포함(`U2` 세션 없음).

**검증 매핑**: REQ-WO-VAL-003, NFR-WO-SEC-003, NFR-WO-SEC-004

---

## 8. 라우트 매칭 (AC-WO-ROUTE)

### AC-WO-ROUTE-01: 고정 경로 vs 동적 경로 라우팅

**Given**:
- 사용자 `U1`의 `T1`.
- DB에 `WorkoutSession` 다수 존재.

**When**:
- 다음 케이스로 호출:
  1. `GET /workouts/active` → `200 OK`, 응답 본문 `{ "active": ... }` 또는 `{ "active": null }`.
  2. `GET /workouts/utils/plates?weight=100` → `200 OK`, 응답 본문 `{ totalWeight, plates, ... }`.
  3. `GET /workouts/some-cuid` → `404 Not Found` (해당 cuid의 세션이 본인 소유 아님).

**Then**:
- 케이스 1, 2: 고정 경로 핸들러로 라우팅됨 (응답 형식이 세션 상세가 아님).
- 케이스 3: 동적 `:id` 핸들러로 라우팅됨.
- 컨트롤러 코드에서 메서드 정의 순서가 고정 → 동적 순으로 작성되어 있음(정적 검사).

**검증 매핑**: REQ-WO-VAL-001

---

## 9. 성능 (AC-WO-PERF)

### AC-WO-PERF-01: 응답 시간 P95 측정

**Given**:
- 테스트 환경에 부하 시뮬레이터(예: k6, autocannon) 구성.
- 사용자 `U1`이 평균 50개 `WorkoutSession`(각 평균 15세트)을 보유.

**When**:
- 다음 엔드포인트에 대해 각각 1000건 부하 테스트 수행:

| 엔드포인트 | 메서드 | 목표 P95 |
|---|---|---|
| /workouts | POST | ≤ 300ms |
| /workouts/active | GET | ≤ 200ms |
| /workouts/:id | GET | ≤ 400ms |
| /workouts | GET | ≤ 500ms |
| /workouts/:id/sets | POST | ≤ 200ms |
| /workouts/:id/sets/:setId | PATCH | ≤ 200ms |
| /workouts/:id/sets/:setId | DELETE | ≤ 200ms |
| /workouts/:id/complete | POST | ≤ 300ms |
| /workouts/:id/cancel | POST | ≤ 300ms |
| /workouts/utils/plates | GET | ≤ 50ms |

**Then**:
- 모든 엔드포인트에서 P95가 목표 이내.
- 1RM 자동 갱신 비동기 작업 완료 시각 - 세션 완료 응답 시각 < 1초 (NFR-WO-PERF-008).

**검증 매핑**: NFR-WO-PERF-001~008

---

## 10. 완료 정의 (Definition of Done)

본 SPEC이 구현 완료(`status: completed`)로 전환되려면 다음 모든 조건이 만족되어야 한다:

1. **DB 마이그레이션**: `WorkoutSession`, `WorkoutSet` 모델, `SessionStatus` enum이 추가되고 Prisma migration이 commit된다. `User.workoutSessions`, `Exercise.workoutSets`, `Program.workoutSessions`, `ProgramDay.workoutSessions` 역참조가 적용된다. 필수 인덱스(`(userId, status)`, `(userId, startedAt DESC)`, `(sessionId, exerciseId, setNumber)` UNIQUE)와 cascade 정책(Cascade for session/set/user, SetNull for program/programDay, Restrict for exercise)이 모두 적용된다.
2. **컴파운드 매핑**: `COMPOUND_EXERCISE_MAP` 정적 테이블 또는 `Exercise.compoundType` 컬럼(plan.md 결정)이 5종 컴파운드 `Exercise.id`를 `CompoundType` enum에 매핑하며, 매핑 빈틈이 없음을 자동 검증(테스트 또는 기동 시점 assertion).
3. **백엔드 엔드포인트**: 12개 엔드포인트가 NestJS `WorkoutsController`(+ `PlatesController` 또는 동일 컨트롤러)에 구현되어 모든 EARS 요구사항을 충족한다. 라우트 등록 순서(REQ-WO-VAL-001)가 SPEC-EXERCISE-001 / SPEC-PROGRAM-001 패턴과 일관되게 적용된다.
4. **인증/권한**: 모든 엔드포인트가 `JwtAuthGuard`로 보호되며, JWT의 `sub`만 사용하여 사용자를 식별한다(URL/쿼리/본문에 `userId` 미수용).
5. **세션 상태 관리**: 진행 1개 제약(REQ-WO-SESSION-003)이 application layer에서 enforced되며 race condition(advisory lock 또는 serializable 트랜잭션, plan.md 결정)을 통과한다.
6. **세트 기록**: `WorkoutSet` 추가/수정/삭제가 `IN_PROGRESS` 세션에서만 동작하며 `COMPLETED`/`CANCELLED` 세션에서는 `409 Conflict`로 거부된다.
7. **세션 완료/취소**: `COMPLETED`는 영구 삭제 불가, `CANCELLED`는 삭제 가능. `notes` 수정은 모든 상태에서 허용.
8. **1RM 자동 갱신**: 세션 완료 시 컴파운드 세트의 Epley/Brzycki 평균 추정 1RM이 기존보다 높을 때만 `OneRepMax` 테이블에 `source = AVERAGE_ESTIMATE`로 상향 갱신된다. 비동기 best-effort 처리로 세션 완료 응답을 차단하지 않으며, 갱신 실패가 세션 완료를 롤백하지 않는다.
9. **플레이트 계산기**: `GET /workouts/utils/plates`가 표준 원판(1.25/2.5/5/10/15/20 kg)과 표준 바벨(15/20 kg)을 기반으로 좌우 대칭 조합을 결정적으로 반환한다.
10. **자동화 테스트**: 본 acceptance.md의 모든 시나리오(수동 검증 시나리오 Section 12 제외)가 다음 중 하나로 자동화된다 — Vitest 단위 테스트, Vitest + supertest 통합 테스트, e2e 테스트. 백엔드 라인 커버리지 ≥ 85%.
11. **공유 타입**: `packages/types/src/workout.ts`에 `SessionStatus`, `WorkoutSession`, `WorkoutSet`, 요청/응답 DTO 타입이 export되며 모바일이 이를 참조한다(`pnpm typecheck` 통과).
12. **공식 공유**: 1RM 자동 갱신 로직이 `packages/utils/src/1rm.ts`의 `epley()`, `brzycki()`, `averageEstimate()` 함수를 호출하며 별도 구현하지 않는다(NFR-WO-CONSISTENCY-001).
13. **모바일 화면**: 모바일 클라이언트에 세션 시작, 세션 진행(세트 입력 + 휴식 타이머 + 완료/취소), 세션 상세, 세션 히스토리의 4개 화면이 구현되며 EAS 빌드 APK로 직접 배포 가능한 상태(NFR-WO-MOBILE-001~005).
14. **성능 SLO**: NFR-WO-PERF-001~008의 P95 목표를 만족함이 부하 테스트로 검증된다.
15. **CI 통과**: ESLint, TypeScript 컴파일, `pnpm test`, `pnpm typecheck`, `pnpm lint`가 monorepo 전반에서 통과한다.
16. **문서화**: `.moai/docs/api-reference.md`에 12개 엔드포인트가 추가되며, `.moai/docs/architecture.md`에 세션 기록 도메인이 반영된다.

---

## 11. MX Tag 자동화 검증

`spec.md` Section 8 mx_plan의 모든 `@MX:ANCHOR`, `@MX:WARN`, `@MX:NOTE` 대상에 대해 다음을 검증한다:

- **@MX:ANCHOR**: 8개 함수(`createSession`, `getSessionDetail`, `completeSession`, `cancelSession`, `addSet`, `updateSet`, `updateOneRepMaxFromSession`, `plates.calculate`)에 `@MX:ANCHOR` 주석이 부착되어 있음. 각 함수의 fan_in ≥ 3 (호출자 수).
- **@MX:WARN**: 5개 위험 지점(진행 1개 race, 1RM 갱신 분리, 외부 트랜잭션 격리, 라우트 순서, setNumber 자동 부여 race)에 `@MX:WARN` + `@MX:REASON` 주석이 부착됨.
- **@MX:NOTE**: 7개 설계 결정 지점(SessionStatus enum, 진행 제약, weight Decimal, 라우트 순서, 비동기 처리, 플레이트 정책, 컴파운드 매핑)에 `@MX:NOTE` 주석이 부착됨.
- **@MX:TODO**: 후속 SPEC 이관 항목 6개(통계, export, AI 분석, 푸시, 템플릿, PR 알림)에 `@MX:TODO` 주석이 부착되며 해당 SPEC-ID 참조(예: `// @MX:TODO SPEC-STATS-001`).

자동화: `moai mx scan` 또는 ESLint 커스텀 룰(plan.md 결정)로 CI에서 검증.

---

## 12. 수동 검증 시나리오 (Manual Verification Scenarios)

다음 시나리오는 자동화가 어려운 UX 검증이며 DoD의 자동화 요구에서 명시적으로 제외된다. 릴리즈 전 수동 체크리스트로 수행한다.

### MV-WO-MOBILE-01: 세션 시작 화면 UX

- 활성 프로그램이 있는 상태에서 앱 진입 시 "오늘의 운동"으로 활성 프로그램의 `ProgramDay` 추천 카드가 표시되는가?
- "자유 운동 시작" 버튼으로 운동 검색·다중 선택 화면으로 진입할 수 있는가?
- 진행 중 세션이 이미 있을 때 새 세션 시작 시도 시 명확한 안내 토스트("진행 중인 운동을 먼저 완료하거나 취소하세요")가 표시되는가?

### MV-WO-MOBILE-02: 세션 진행 화면 UX

- 운동별 세트 카드가 직관적으로 표시되는가? (운동 이름, 이전 세트 weight/reps, 입력 폼)
- 세트 입력 시 optimistic update가 즉각 반영되는가? (네트워크 지연 ≥ 500ms 환경에서 테스트)
- 휴식 타이머가 세트 `isCompleted: true` 마킹 시 자동 시작되며 카운트다운/사운드 알림이 작동하는가?
- 플레이트 계산기가 세션 진행 화면에서 1탭으로 접근 가능한가?
- 화면 회전(가로/세로)에서 입력 상태가 유실되지 않는가?

### MV-WO-MOBILE-03: 세션 완료 후 요약 화면

- 완료 직후 1RM이 갱신된 컴파운드(예: 스쿼트 +5kg)에 대해 "PR 달성!" 시각적 피드백이 표시되는가? (클라이언트 측 비교)
- 세션 메모(`notes`) 작성 폼이 키보드 토글에 자연스럽게 반응하는가?
- "히스토리로 이동" 버튼이 작동하는가?

### MV-WO-MOBILE-04: 세션 히스토리 화면

- 무한 스크롤로 페이지네이션이 자연스럽게 동작하는가?
- 필터(status, 날짜 범위)가 UI에서 직관적인가?
- 각 세션 카드 탭 시 상세 화면으로 전환되며 모든 세트가 표시되는가?
- `CANCELLED` 세션에서 "삭제" 버튼이 활성, `COMPLETED` 세션에서 "삭제" 버튼이 비활성 또는 미표시되는가?

### MV-WO-MOBILE-05: 오프라인 / 네트워크 불안정

- 네트워크 단절 중 세트 추가 시도 시 명확한 오류 메시지(예: "네트워크 연결을 확인하세요") 표시되는가?
- 네트워크 복구 후 자동 재시도 또는 수동 재시도 옵션이 제공되는가?

---

## 13. 참조 (References)

- spec.md (본 SPEC의 EARS 요구사항)
- plan.md (구현 계획)
- SPEC-AUTH-001 (인증/RBAC 기반)
- SPEC-EXERCISE-001 (Exercise 모델 + 800+ 운동 시드)
- SPEC-1RM-001 (`CompoundType`, `OneRepMax`, Epley/Brzycki 공식)
- SPEC-PROGRAM-001 (`Program`, `ProgramDay`, `UserProgram`, 라우트 순서 패턴)
