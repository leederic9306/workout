# SPEC-DASHBOARD-001 인수 기준 (Acceptance Criteria)

본 문서는 SPEC-DASHBOARD-001의 모든 EARS 요구사항에 대한 검증 가능한 Given/When/Then 시나리오를 정의한다. 모든 자동화 시나리오는 단위 테스트, 통합 테스트, E2E 테스트 중 하나 이상으로 자동화되어야 한다. 수동 검증 시나리오는 Section 9에 별도 정리되며 DoD의 자동화 요구에서 명시적으로 제외된다.

전제:
- SPEC-AUTH-001 v1.0.1이 이미 구현되어 있다 (`JwtAuthGuard`, `JwtStrategy`, `@CurrentUser()` 데코레이터 존재).
- SPEC-USER-001 v1.0.1이 구현되어 있다 (`User.deletedAt` 컬럼 존재).
- SPEC-EXERCISE-001이 구현되어 있다 (`Exercise.slug` 필드 존재).
- SPEC-1RM-001이 구현되어 있다 (`OneRepMax`, `CompoundType` enum, `packages/utils/src/1rm.ts`의 `calculateEpley`).
- SPEC-WORKOUT-001이 RUN 완료 상태이다 (`WorkoutSession`, `WorkoutSet` + `isCompleted`/`rpe`/`orderIndex` 필드, `compound-exercise.map.ts`의 `COMPOUND_EXERCISE_SLUG_MAP`).
- Prisma 마이그레이션이 완료된 PostgreSQL DB가 존재한다 (`BodyComposition` 테이블 + `@@index([userId, recordedAt(sort: Desc)])`).
- 테스트 환경의 사용자 `U1`, `U2`(둘 다 일반 USER 권한, 온보딩 완료)가 존재하며 각자 유효한 Access Token `T1`, `T2`를 보유한다.
- 시드 운동: `barbell-squat`(SQUAT 매핑), `barbell-deadlift`(DEADLIFT), `barbell-bench-press`(BENCH_PRESS), `bent-over-barbell-row`(BARBELL_ROW), `barbell-overhead-press`(OVERHEAD_PRESS) — `COMPOUND_EXERCISE_SLUG_MAP` 기준.
- 모든 시각은 UTC 기준이며, ISO 8601 문자열 형식이다.

---

## 1. 체성분 생성 (AC-DASH-BODY-CREATE)

### AC-DASH-BODY-CREATE-01: POST /users/me/body-composition — weight만 입력 (정상)

**Given**:
- `U1`의 유효한 Access Token `T1`.
- DB에 `U1`의 `BodyComposition` 레코드가 0건.

**When**:
- 클라이언트가 `POST /users/me/body-composition`을 다음 요청으로 전송:
  - 헤더: `Authorization: Bearer T1`, `Content-Type: application/json`
  - 본문: `{ "weight": 75.2 }`

**Then**:
- 응답 상태 코드는 **`201 Created`**.
- 응답 본문은 다음 필드를 포함:
  - `id`: cuid 형식의 string
  - `weight`: `75.2` (number)
  - `muscleMass`: `null`
  - `bodyFatPct`: `null`
  - `recordedAt`: ISO 8601 타임스탬프 (요청 시각 ±1초 이내)
  - `createdAt`: ISO 8601 타임스탬프 (요청 시각 ±1초 이내)
- 응답 본문에 `userId`는 포함되지 않음 (NFR-DASH-SEC-003).
- DB에 `BodyComposition(userId=U1.id, weight=75.20, muscleMass=NULL, bodyFatPct=NULL)` 레코드가 1건 생성됨.

**검증 매핑**: REQ-DASH-BODY-001, REQ-DASH-BODY-002, NFR-DASH-SEC-003

### AC-DASH-BODY-CREATE-02: POST /users/me/body-composition — 전체 필드 입력 (정상)

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 클라이언트가 `POST /users/me/body-composition`을 다음 본문으로 전송:
  ```json
  {
    "weight": 75.2,
    "muscleMass": 32.5,
    "bodyFatPct": 18.3,
    "recordedAt": "2026-05-10T08:30:00.000Z"
  }
  ```

**Then**:
- 응답 상태 코드는 **`201 Created`**.
- 응답 본문:
  - `weight`: `75.2`
  - `muscleMass`: `32.5`
  - `bodyFatPct`: `18.3`
  - `recordedAt`: `"2026-05-10T08:30:00.000Z"` (사용자 지정 시각 그대로)
  - `createdAt`: 요청 시각 (서버 생성)
- DB에 해당 레코드가 생성되며 `recordedAt`이 사용자 지정값과 일치.

**검증 매핑**: REQ-DASH-BODY-001, REQ-DASH-BODY-002

### AC-DASH-BODY-CREATE-INVALID-01: weight 범위 위반

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 본문으로 각각 `POST /users/me/body-composition` 호출:
  1. `{ "weight": 0 }`
  2. `{ "weight": -50 }`
  3. `{ "weight": 30 }` (40 미만)
  4. `{ "weight": 350 }` (300 초과)
  5. `{ "weight": "abc" }` (비숫자)

**Then**:
- 모든 케이스의 응답 상태 코드는 **`400 Bad Request`**.
- DB에 어떠한 레코드도 생성되지 않음.
- 응답 본문에 어떤 필드가 실패했는지 명시 (`weight`).

**검증 매핑**: REQ-DASH-BODY-009, NFR-DASH-SEC-004

### AC-DASH-BODY-CREATE-INVALID-02: muscleMass 검증

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 본문으로 각각 `POST /users/me/body-composition` 호출:
  1. `{ "weight": 75.0, "muscleMass": -5.0 }` (음수)
  2. `{ "weight": 75.0, "muscleMass": 0 }` (0)
  3. `{ "weight": 75.0, "muscleMass": 80.0 }` (weight 초과)

**Then**:
- 모든 케이스의 응답 상태 코드는 **`400 Bad Request`**.
- DB에 어떠한 레코드도 생성되지 않음.

**검증 매핑**: REQ-DASH-BODY-010

### AC-DASH-BODY-CREATE-INVALID-03: bodyFatPct 범위 위반

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 본문으로 각각 `POST /users/me/body-composition` 호출:
  1. `{ "weight": 75.0, "bodyFatPct": 0.5 }` (1.0 미만)
  2. `{ "weight": 75.0, "bodyFatPct": 70.0 }` (60.0 초과)
  3. `{ "weight": 75.0, "bodyFatPct": -3.0 }` (음수)

**Then**:
- 모든 케이스의 응답 상태 코드는 **`400 Bad Request`**.
- DB에 어떠한 레코드도 생성되지 않음.

**검증 매핑**: REQ-DASH-BODY-011

### AC-DASH-BODY-CREATE-INVALID-04: recordedAt 미래 시각 차단

**Given**:
- `U1`의 유효한 Access Token `T1`. 현재 시각 `now`.

**When**:
- 다음 본문으로 각각 `POST /users/me/body-composition` 호출:
  1. `{ "weight": 75.0, "recordedAt": <now + 1시간> }` (미래)
  2. `{ "weight": 75.0, "recordedAt": "not-an-iso-string" }` (잘못된 형식)
  3. `{ "weight": 75.0, "recordedAt": "2025-01-01T00:00:00.000Z" }` (과거, 정상)

**Then**:
- 케이스 1, 2: 응답 상태 코드 `400 Bad Request`, DB에 레코드 없음.
- 케이스 3: 응답 상태 코드 `201 Created`, `recordedAt`이 과거 시각으로 저장됨 (사후 입력 허용).

**검증 매핑**: REQ-DASH-BODY-012

### AC-DASH-BODY-CREATE-INVALID-05: 소수점 자릿수 초과

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 본문으로 각각 `POST /users/me/body-composition` 호출:
  1. `{ "weight": 75.123 }` (소수 3자리)
  2. `{ "weight": 75.0, "bodyFatPct": 18.35 }` (bodyFatPct 소수 2자리)
  3. `{ "weight": 75.0, "muscleMass": 32.555 }` (muscleMass 소수 3자리)

**Then**:
- 모든 케이스의 응답 상태 코드는 **`400 Bad Request`**.

**검증 매핑**: REQ-DASH-BODY-013

---

## 2. 체성분 조회 (AC-DASH-BODY-LIST)

### AC-DASH-BODY-LIST-01: GET /users/me/body-composition — 페이지네이션 최신순

**Given**:
- `U1`의 유효한 Access Token `T1`.
- DB에 `U1`의 `BodyComposition` 25건이 `recordedAt` 분포로 존재 (5분 간격, 총 25건).

**When**:
- 클라이언트가 `GET /users/me/body-composition`를 다음 헤더로 호출:
  - 헤더: `Authorization: Bearer T1`

**Then**:
- 응답 상태 코드는 **`200 OK`**.
- 응답 본문:
  - `items`: `BodyComposition` 객체 20개 (기본 `limit=20`)
  - `nextCursor`: 21번째 레코드의 `id` (string)
- `items`는 `recordedAt` 내림차순으로 정렬됨 (최신이 첫 번째).
- 각 item에 `userId`는 포함되지 않음 (NFR-DASH-SEC-003).

- 후속 요청 `GET /users/me/body-composition?cursor=<nextCursor>` 호출 시:
  - 응답 본문에 나머지 5개 레코드가 포함되고 `nextCursor: null`.

**검증 매핑**: REQ-DASH-BODY-003, REQ-DASH-BODY-004, NFR-DASH-SEC-003, NFR-DASH-PERF-003

### AC-DASH-BODY-LIST-INVALID-01: limit 범위 위반

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 쿼리로 각각 호출:
  1. `GET /users/me/body-composition?limit=0`
  2. `GET /users/me/body-composition?limit=101`
  3. `GET /users/me/body-composition?limit=abc`

**Then**:
- 모든 케이스의 응답 상태 코드는 **`400 Bad Request`**.

**검증 매핑**: REQ-DASH-BODY-003

---

## 3. 체성분 삭제 (AC-DASH-BODY-DELETE)

### AC-DASH-BODY-DELETE-01: DELETE /users/me/body-composition/:id — 본인 소유 삭제

**Given**:
- `U1`의 유효한 Access Token `T1`.
- DB에 `U1`이 소유한 `BodyComposition(id=B1)` 레코드가 존재.

**When**:
- 클라이언트가 `DELETE /users/me/body-composition/B1`를 호출:
  - 헤더: `Authorization: Bearer T1`

**Then**:
- 응답 상태 코드는 **`204 No Content`** (응답 본문 없음).
- DB에서 `BodyComposition(id=B1)`가 삭제됨.
- 후속 `GET /users/me/body-composition` 호출 시 해당 레코드 부재.

**검증 매핑**: REQ-DASH-BODY-005, NFR-DASH-PERF-004

### AC-DASH-BODY-DELETE-NOTFOUND-01: 존재하지 않는 id 또는 타 사용자 소유

**Given**:
- `U1`의 유효한 Access Token `T1`.
- DB에 `U2`가 소유한 `BodyComposition(id=B2)` 레코드가 존재. `U1`은 해당 레코드를 소유하지 않음.
- `id=nonexistent`는 DB에 존재하지 않음.

**When**:
- `U1`이 다음 두 요청을 순차 전송:
  1. `DELETE /users/me/body-composition/B2` (타 사용자 소유)
  2. `DELETE /users/me/body-composition/nonexistent` (미존재)

**Then**:
- 두 케이스 모두 응답 상태 코드 **`404 Not Found`** (REQ-DASH-BODY-006, NFR-DASH-SEC-005).
- DB의 `B2` 레코드는 변경되지 않음.
- 두 응답이 동일한 메시지를 반환하여 존재 여부 노출이 차단됨.

**검증 매핑**: REQ-DASH-BODY-006, NFR-DASH-SEC-005

---

## 4. 체성분 권한 격리 및 인증 (AC-DASH-BODY-SECURITY / AUTH)

### AC-DASH-BODY-SECURITY-01: 다른 사용자 데이터 격리

**Given**:
- `U1`이 본인 체성분 3건을 기록, `U2`가 본인 체성분 5건을 기록.
- `U1`의 Access Token `T1`, `U2`의 Access Token `T2`.

**When**:
- `U1`이 `GET /users/me/body-composition` 호출 (헤더 `Bearer T1`).
- `U2`가 `GET /users/me/body-composition` 호출 (헤더 `Bearer T2`).

**Then**:
- `T1` 응답: `items` 길이 3, 모두 `U1`의 데이터.
- `T2` 응답: `items` 길이 5, 모두 `U2`의 데이터.
- 두 응답에 다른 사용자의 레코드가 포함되지 않음.
- 본문에 `userId` 필드는 포함되지 않음 (NFR-DASH-SEC-003).

**검증 매핑**: REQ-DASH-BODY-007, NFR-DASH-SEC-002, NFR-DASH-SEC-003

### AC-DASH-BODY-AUTH-01: JWT 누락/만료 시 401

**Given**:
- 만료된 JWT `T_expired`, 누락된 헤더.

**When**:
- 다음 요청을 각각 전송:
  1. `POST /users/me/body-composition` (헤더 없음, 본문 `{ "weight": 75 }`)
  2. `GET /users/me/body-composition` (헤더 `Authorization: Bearer T_expired`)
  3. `DELETE /users/me/body-composition/anyId` (헤더 없음)
  4. `GET /dashboard/1rm-history?exerciseType=SQUAT` (헤더 없음)
  5. `GET /dashboard/body-composition` (헤더 없음)
  6. `GET /dashboard/weekly-volume` (헤더 없음)
  7. `GET /dashboard/workout-frequency` (헤더 없음)

**Then**:
- 모든 케이스의 응답 상태 코드는 **`401 Unauthorized`**.
- DB에 어떠한 변경도 발생하지 않음.

**검증 매핑**: REQ-DASH-BODY-008, NFR-DASH-SEC-001

---

## 5. 1RM 이력 집계 (AC-DASH-1RM)

### AC-DASH-1RM-HISTORY-01: GET /dashboard/1rm-history — 정상 시계열 조회

**Given**:
- `U1`의 유효한 Access Token `T1`.
- `Exercise(slug='barbell-squat')`가 `COMPOUND_EXERCISE_SLUG_MAP`에 `SQUAT`로 매핑됨.
- `U1`이 최근 60일 동안 3개의 완료된 `WorkoutSession`(`status=COMPLETED`)을 가짐:
  - 세션 S1 (`completedAt = now - 50일`): 스쿼트 세트 2개 — (weight=100, reps=5), (weight=110, reps=3) → Epley best=110*(1+3/30)=121.0
  - 세션 S2 (`completedAt = now - 30일`): 스쿼트 세트 1개 — (weight=115, reps=5) → Epley=115*(1+5/30)=134.17
  - 세션 S3 (`completedAt = now - 10일`): 스쿼트 세트 1개 — (weight=120, reps=3) → Epley=120*(1+3/30)=132.0
- 모든 세트는 `isCompleted=true`, `weight IS NOT NULL`, `reps IS NOT NULL`.

**When**:
- 클라이언트가 `GET /dashboard/1rm-history?exerciseType=SQUAT&period=3m`를 호출:
  - 헤더: `Authorization: Bearer T1`

**Then**:
- 응답 상태 코드는 **`200 OK`**.
- 응답 본문:
  ```json
  {
    "exerciseType": "SQUAT",
    "period": "3m",
    "points": [
      { "sessionId": "<S1>", "completedAt": "<S1 completedAt ISO>", "estimated1RM": 121.0 },
      { "sessionId": "<S2>", "completedAt": "<S2 completedAt ISO>", "estimated1RM": 134.17 },
      { "sessionId": "<S3>", "completedAt": "<S3 completedAt ISO>", "estimated1RM": 132.0 }
    ]
  }
  ```
- `points`는 `completedAt` 오름차순으로 정렬됨 (REQ-DASH-1RM-003).
- 각 `estimated1RM`은 세션 내 best Epley 값이며 소수 2자리 반올림 (REQ-DASH-1RM-002).

**검증 매핑**: REQ-DASH-1RM-001, REQ-DASH-1RM-002, REQ-DASH-1RM-003, REQ-DASH-1RM-007, REQ-DASH-1RM-008

### AC-DASH-1RM-BEST-SET-01: 세션 내 best-set 선택

**Given**:
- `U1`의 유효한 Access Token `T1`.
- `U1`이 1개 완료 세션 S4(`completedAt = now - 5일`)를 가지며, 스쿼트 세트 3개:
  - (weight=100, reps=8) → Epley=100*(1+8/30)=126.67
  - (weight=120, reps=5) → Epley=120*(1+5/30)=140.0
  - (weight=130, reps=3) → Epley=130*(1+3/30)=143.0

**When**:
- 클라이언트가 `GET /dashboard/1rm-history?exerciseType=SQUAT&period=3m` 호출.

**Then**:
- 응답의 `points`에서 S4 항목의 `estimated1RM`은 **`143.0`** (3개 세트 중 max Epley 값).
- 다른 두 세트의 Epley 값은 응답에 포함되지 않음 (세션당 1 point).

**검증 매핑**: REQ-DASH-1RM-002

### AC-DASH-1RM-HISTORY-EMPTY-01: 데이터 없음

**Given**:
- `U1`의 유효한 Access Token `T1`.
- `U1`의 완료된 컴파운드 세트가 0건 (스쿼트 운동을 한 적 없음).

**When**:
- 클라이언트가 `GET /dashboard/1rm-history?exerciseType=SQUAT&period=3m` 호출.

**Then**:
- 응답 상태 코드는 **`200 OK`**.
- 응답 본문: `{ "exerciseType": "SQUAT", "period": "3m", "points": [] }`.
- `404`로 응답하지 않음 (REQ-DASH-1RM-006).

**검증 매핑**: REQ-DASH-1RM-006

### AC-DASH-1RM-REPS-RANGE-01: reps 범위 외 세트 제외

**Given**:
- `U1`의 유효한 Access Token `T1`.
- `U1`이 1개 완료 세션 S5(`completedAt = now - 5일`)를 가지며, 스쿼트 세트 3개:
  - (weight=100, reps=12) → reps > 10 (REQ-DASH-1RM-009로 제외)
  - (weight=80, reps=0) → reps < 1 (제외)
  - (weight=110, reps=5) → 유효, Epley=128.33

**When**:
- 클라이언트가 `GET /dashboard/1rm-history?exerciseType=SQUAT&period=3m` 호출.

**Then**:
- 응답의 `points`에 S5 항목 1개 포함, `estimated1RM=128.33`.
- reps=12, reps=0 세트는 계산에서 제외됨.

- 변형: S5의 모든 세트가 reps 범위 외라면, S5는 응답에 포함되지 않음 (REQ-DASH-1RM-009).

**검증 매핑**: REQ-DASH-1RM-009

### AC-DASH-1RM-INVALID-01: period 검증

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 쿼리로 각각 호출:
  1. `GET /dashboard/1rm-history?exerciseType=SQUAT&period=2m` (정의되지 않은 값)
  2. `GET /dashboard/1rm-history?exerciseType=SQUAT&period=invalid`
  3. `GET /dashboard/1rm-history?exerciseType=SQUAT` (period 누락)

**Then**:
- 케이스 1, 2: 응답 상태 코드 `400 Bad Request`.
- 케이스 3: 응답 상태 코드 `200 OK`, 기본값 `period=3m` 적용 (REQ-DASH-1RM-004).

**검증 매핑**: REQ-DASH-1RM-004

### AC-DASH-1RM-INVALID-02: exerciseType 검증

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 쿼리로 각각 호출:
  1. `GET /dashboard/1rm-history?exerciseType=PULL_UP&period=3m` (CompoundType 외)
  2. `GET /dashboard/1rm-history?exerciseType=squat&period=3m` (소문자)
  3. `GET /dashboard/1rm-history?period=3m` (exerciseType 누락)

**Then**:
- 모든 케이스의 응답 상태 코드는 **`400 Bad Request`** (REQ-DASH-1RM-005).

**검증 매핑**: REQ-DASH-1RM-005

---

## 6. 주간 볼륨 집계 (AC-DASH-VOL)

### AC-DASH-VOL-01: 주간 볼륨 집계 정확도

**Given**:
- `U1`의 유효한 Access Token `T1`.
- 시드 시나리오 (모두 `status=COMPLETED`, `isCompleted=true`):
  - **Week W1** (월요일 = `2026-04-13T00:00:00Z`, UTC):
    - 세션 SA: 세트 (weight=100, reps=5) + 세트 (weight=80, reps=10) → 볼륨 100*5 + 80*10 = 500 + 800 = 1300
    - 세션 SB: 세트 (weight=120, reps=3) → 볼륨 360
    - W1 총: 1660, 세션 2건
  - **Week W2** (월요일 = `2026-04-20T00:00:00Z`):
    - 세션 SC: 세트 (weight=110, reps=5) → 볼륨 550
    - W2 총: 550, 세션 1건
  - **Week W3** (월요일 = `2026-04-27T00:00:00Z`): 데이터 없음 → 0, 0건
- 현재 시각: `2026-05-04T08:00:00Z`이며 weeks=4 요청.

**When**:
- 클라이언트가 `GET /dashboard/weekly-volume?weeks=4` 호출.

**Then**:
- 응답 상태 코드는 **`200 OK`**.
- 응답 본문 `points` 배열 길이 4 (4주):
  ```json
  [
    { "weekStart": "2026-04-13", "totalVolume": 1660.0, "sessionCount": 2 },
    { "weekStart": "2026-04-20", "totalVolume": 550.0, "sessionCount": 1 },
    { "weekStart": "2026-04-27", "totalVolume": 0,    "sessionCount": 0 },
    { "weekStart": "2026-05-04", "totalVolume": 0,    "sessionCount": 0 }
  ]
  ```
- `points`는 `weekStart` 오름차순.
- 데이터 없는 주(week)도 결과에 포함됨 (REQ-DASH-VOL-002).
- `totalVolume`은 소수 2자리 반올림 number (REQ-DASH-VOL-005).

**검증 매핑**: REQ-DASH-VOL-001, REQ-DASH-VOL-002, REQ-DASH-VOL-005

### AC-DASH-VOL-EMPTY-WEEK-01: 데이터 0인 주 포함 확인

**Given**:
- `U1`의 유효한 Access Token `T1`.
- `U1`의 모든 완료 세션이 5주 전과 1주 전에만 분포 (중간 3주는 운동 없음).

**When**:
- `GET /dashboard/weekly-volume?weeks=6` 호출.

**Then**:
- 응답의 `points` 배열 길이 6.
- 중간 3주는 `{ "totalVolume": 0, "sessionCount": 0 }`이지만 `weekStart`는 포함됨.

**검증 매핑**: REQ-DASH-VOL-002

### AC-DASH-VOL-BW-EXCLUDE-01: 보디웨이트 세트 제외

**Given**:
- `U1`의 유효한 Access Token `T1`.
- Week WX에 1개 완료 세션 SD:
  - 보디웨이트 세트: (weight=NULL, reps=10) — 풀업
  - 바벨 세트: (weight=60, reps=10) → 볼륨 600
- 본 세션의 `totalVolume`은 보디웨이트 세트를 제외한 **600**이어야 함.

**When**:
- `GET /dashboard/weekly-volume?weeks=4` 호출.

**Then**:
- WX 주의 `totalVolume`은 `600.0` (보디웨이트 세트 제외, REQ-DASH-VOL-004).
- `sessionCount`는 `1` (세션은 카운트, 단 볼륨 SUM에서 NULL weight 세트는 제외).

**검증 매핑**: REQ-DASH-VOL-004

### AC-DASH-VOL-INVALID-01: weeks 검증

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 쿼리로 각각 호출:
  1. `GET /dashboard/weekly-volume?weeks=3` (4 미만)
  2. `GET /dashboard/weekly-volume?weeks=53` (52 초과)
  3. `GET /dashboard/weekly-volume?weeks=abc`
  4. `GET /dashboard/weekly-volume?weeks=10.5` (소수)
  5. `GET /dashboard/weekly-volume` (누락)

**Then**:
- 케이스 1, 2, 3, 4: 응답 상태 코드 `400 Bad Request`.
- 케이스 5: 응답 상태 코드 `200 OK`, 기본값 `weeks=12` 적용 (REQ-DASH-VOL-003).

**검증 매핑**: REQ-DASH-VOL-003

---

## 7. 운동 빈도 집계 (AC-DASH-FREQ)

### AC-DASH-FREQ-01: 주간 빈도 집계

**Given**:
- `U1`의 유효한 Access Token `T1`.
- 시드 시나리오:
  - **Week W1**: 세션 3개 완료
  - **Week W2**: 세션 1개 완료
  - **Week W3**: 세션 0개
  - **Week W4**: 세션 2개 완료

**When**:
- `GET /dashboard/workout-frequency?weeks=4` 호출.

**Then**:
- 응답 상태 코드는 **`200 OK`**.
- 응답 본문:
  ```json
  {
    "weeks": 4,
    "points": [
      { "weekStart": "<W1>", "sessionCount": 3 },
      { "weekStart": "<W2>", "sessionCount": 1 },
      { "weekStart": "<W3>", "sessionCount": 0 },
      { "weekStart": "<W4>", "sessionCount": 2 }
    ]
  }
  ```
- `points`는 `weekStart` 오름차순으로 정렬됨.
- 0인 주도 포함됨 (REQ-DASH-FREQ-002).

**검증 매핑**: REQ-DASH-FREQ-001, REQ-DASH-FREQ-002

### AC-DASH-FREQ-CANCEL-EXCLUDE-01: 취소/진행 중 세션 제외

**Given**:
- `U1`의 유효한 Access Token `T1`.
- Week WY 시드:
  - 세션 SE: `status=COMPLETED`, `completedAt` 존재 (카운트 대상)
  - 세션 SF: `status=CANCELLED` (제외)
  - 세션 SG: `status=IN_PROGRESS`, `completedAt=NULL` (제외)

**When**:
- `GET /dashboard/workout-frequency?weeks=4` 호출.

**Then**:
- WY 주의 `sessionCount`는 **`1`** (SE만 카운트, SF/SG 제외).

**검증 매핑**: REQ-DASH-FREQ-004

### AC-DASH-FREQ-INVALID-01: weeks 검증

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 쿼리로 각각 호출:
  1. `GET /dashboard/workout-frequency?weeks=3` (4 미만)
  2. `GET /dashboard/workout-frequency?weeks=53` (52 초과)
  3. `GET /dashboard/workout-frequency?weeks=abc`
  4. `GET /dashboard/workout-frequency` (누락 — 기본값 적용)

**Then**:
- 케이스 1, 2, 3: 응답 상태 코드 `400 Bad Request`.
- 케이스 4: 응답 상태 코드 `200 OK`, 기본값 `weeks=12` 적용.

**검증 매핑**: REQ-DASH-FREQ-003

---

## 8. 체성분 추세 집계 (AC-DASH-BTREND)

### AC-DASH-BTREND-01: 체성분 추세 정상 조회

**Given**:
- `U1`의 유효한 Access Token `T1`.
- `U1`의 `BodyComposition` 시드:
  - `recordedAt = now - 80일`: `{weight: 78.0, muscleMass: 31.5, bodyFatPct: 20.0}` — 90일 이내 (period=3m 포함)
  - `recordedAt = now - 60일`: `{weight: 77.0, muscleMass: 32.0, bodyFatPct: 19.0}`
  - `recordedAt = now - 30일`: `{weight: 76.0, muscleMass: null, bodyFatPct: null}` — 부분 측정
  - `recordedAt = now - 100일`: `{weight: 79.0, muscleMass: 31.0, bodyFatPct: 21.0}` — 90일 외 (제외)

**When**:
- `GET /dashboard/body-composition?period=3m` 호출.

**Then**:
- 응답 상태 코드는 **`200 OK`**.
- 응답 본문 `points` 배열 길이 3 (`now - 80일`, `now - 60일`, `now - 30일`).
- `recordedAt` 오름차순 정렬.
- 부분 측정 항목은 `muscleMass: null`, `bodyFatPct: null`로 표현됨 (REQ-DASH-BTREND-002).
- `now - 100일` 항목은 응답에 포함되지 않음 (period 범위 외).

**검증 매핑**: REQ-DASH-BTREND-001, REQ-DASH-BTREND-002

### AC-DASH-BTREND-EMPTY-01: 데이터 없음

**Given**:
- `U1`의 유효한 Access Token `T1`.
- `U1`의 `BodyComposition` 0건.

**When**:
- `GET /dashboard/body-composition?period=3m` 호출.

**Then**:
- 응답 상태 코드는 **`200 OK`**.
- 응답 본문: `{ "period": "3m", "points": [] }` (REQ-DASH-BTREND-004).
- `404`로 응답하지 않음.

**검증 매핑**: REQ-DASH-BTREND-004

### AC-DASH-BTREND-INVALID-01: period 검증

**Given**:
- `U1`의 유효한 Access Token `T1`.

**When**:
- 다음 쿼리로 각각 호출:
  1. `GET /dashboard/body-composition?period=2m`
  2. `GET /dashboard/body-composition?period=invalid`
  3. `GET /dashboard/body-composition` (누락)

**Then**:
- 케이스 1, 2: 응답 상태 코드 `400 Bad Request`.
- 케이스 3: 응답 상태 코드 `200 OK`, 기본값 `period=3m` 적용 (REQ-DASH-BTREND-001).

**검증 매핑**: REQ-DASH-BTREND-003

---

## 9. 성능 검증 (AC-DASH-PERF)

### AC-DASH-PERF-01: 4종 대시보드 엔드포인트 P95 응답 시간

**Given**:
- `U1`의 시드 데이터:
  - 완료된 `WorkoutSession` 500건 (12개월 분포)
  - 완료된 `WorkoutSet` 2500건 (세션당 평균 5세트)
  - `BodyComposition` 50건
- 백엔드는 로컬 PostgreSQL 15 + 권장 인덱스(`@@index([userId, recordedAt(sort: Desc)])`, SPEC-WORKOUT-001의 `WorkoutSession` 및 `WorkoutSet` 인덱스) 적용.

**When**:
- 4종 대시보드 엔드포인트에 각 100 req 부하 (autocannon, NestJS 자체 부하 테스트):
  - `GET /dashboard/1rm-history?exerciseType=SQUAT&period=3m`
  - `GET /dashboard/body-composition?period=3m`
  - `GET /dashboard/weekly-volume?weeks=12`
  - `GET /dashboard/workout-frequency?weeks=12`

**Then**:
- 각 엔드포인트의 응답 시간 **P95 ≤ 500ms** (NFR-DASH-PERF-001).
- 단일 SQL로 수행됨 (N+1 없음). `prisma.$queryRaw` 또는 `findMany`/`groupBy`의 EXPLAIN으로 확인 (NFR-DASH-PERF-005).
- 추가로 `POST /users/me/body-composition` P95 ≤ 150ms, `GET /users/me/body-composition?limit=100` P95 ≤ 200ms, `DELETE /users/me/body-composition/:id` P95 ≤ 150ms.

**검증 매핑**: NFR-DASH-PERF-001~005

---

## 10. 일관성 검증 (AC-DASH-CONSISTENCY, 단위 테스트)

### AC-DASH-CONSISTENCY-EPLEY-01: Epley 공식 결과 일관성

**Given**:
- 백엔드의 1RM 추정 계산 코드와 `packages/utils/src/1rm.ts`의 `calculateEpley`.
- 입력 쌍 표본:
  - `(weight=100, reps=5)` → 기대값 `116.67` (소수 2자리)
  - `(weight=80, reps=8)` → 기대값 `101.33`
  - `(weight=120, reps=1)` → 기대값 `124.0`
  - `(weight=150, reps=3)` → 기대값 `165.0`

**When**:
- 백엔드 `DashboardService`의 내부 Epley 계산과 `calculateEpley(weight, reps)`를 동일 입력으로 호출.

**Then**:
- 모든 입력에서 두 결과가 소수 2자리 반올림 후 일치.

**검증 매핑**: REQ-DASH-1RM-007, NFR-DASH-CONSISTENCY-001

### AC-DASH-CONSISTENCY-MAP-01: 컴파운드 매핑 재사용

**Given**:
- SPEC-WORKOUT-001 `apps/backend/src/workouts/compound-exercise.map.ts`의 `COMPOUND_EXERCISE_SLUG_MAP` 존재.

**When**:
- 본 SPEC의 `DashboardService`가 1RM 이력 계산을 위해 컴파운드 식별을 수행.

**Then**:
- 동일한 `COMPOUND_EXERCISE_SLUG_MAP`을 import하여 사용.
- 본 SPEC 코드 내부에 별도의 컴파운드 매핑 상수가 정의되지 않음 (NFR-DASH-CONSISTENCY-002).

**검증 매핑**: REQ-DASH-1RM-008, NFR-DASH-CONSISTENCY-002

---

## 11. 수동 검증 시나리오 (모바일 UX, AC-DASH-MOBILE-MANUAL)

다음 시나리오는 모바일 디바이스(Android)에서 수동으로 검증한다. 본 SPEC의 DoD 자동화 요구에서는 명시적으로 제외된다.

### AC-DASH-MOBILE-MANUAL-01: 체성분 입력 화면

- `app/(tabs)/my/body.tsx` 진입.
- 입력 폼에서 `weight`만 입력 → "기록" 버튼 → 이력 리스트 최상단에 새 항목 추가됨.
- 입력 폼에 `weight`, `muscleMass`, `bodyFatPct`, `recordedAt`(과거 시각) 입력 → 기록 → 이력 리스트에 반영.
- 이력 항목의 "삭제" 버튼 → 확인 대화상자 → 삭제 → 리스트에서 제거됨.

**검증 매핑**: REQ-DASH-MOBILE-001

### AC-DASH-MOBILE-MANUAL-02: 대시보드 화면 4종 차트 렌더링

- `app/(tabs)/my/dashboard.tsx` 진입.
- 4종 차트(`OneRepMaxChart`, `BodyCompositionChart`, `WeeklyVolumeChart`, `WorkoutFrequencyChart`)가 한 화면에 표시됨.
- 기간 필터 토글(`1m`/`3m`/`6m`/`1y`) 클릭 → 4종 차트 모두 새 데이터로 갱신됨.
- 차트 라이브러리가 `react-native-gifted-charts`임을 확인 (의존성).

**검증 매핑**: REQ-DASH-MOBILE-002, REQ-DASH-MOBILE-003, REQ-DASH-MOBILE-004

### AC-DASH-MOBILE-MANUAL-03: 빈 데이터 처리

- 신규 사용자(데이터 0건)로 로그인 → 대시보드 화면 진입.
- 4종 차트 영역에 "기록된 데이터가 없습니다" 안내 메시지 표시.
- 차트 라이브러리 호출이 빈 배열로 인해 크래시하지 않음.

**검증 매핑**: REQ-DASH-MOBILE-006

### AC-DASH-MOBILE-MANUAL-04: TanStack Query 캐싱

- 대시보드 화면 첫 진입 → 데이터 로드.
- 다른 화면 이동 후 1분 내 재진입 → 즉시 캐시 표시 (`staleTime: 5min` 동작).
- 체성분 신규 입력 → `body.tsx`에서 `POST` 호출 → 대시보드 화면 재진입 시 체성분 추세 차트가 invalidate되어 새 데이터 반영됨.

**검증 매핑**: REQ-DASH-MOBILE-005

### AC-DASH-MOBILE-MANUAL-05: Expo Managed Workflow 빌드

- `pnpm --filter @workout/mobile start` → Android 디바이스에서 Expo Go 또는 EAS Development Build로 실행.
- 추가 prebuild나 네이티브 모듈 설치 없이 정상 동작.

**검증 매핑**: NFR-DASH-MOBILE-001, NFR-DASH-MOBILE-002

---

## 12. Definition of Done (DoD)

본 SPEC은 다음 조건을 모두 만족할 때 완료(Done)로 간주한다:

1. **Section 1~10의 자동화 시나리오 100% 통과**: 단위/통합/E2E 테스트.
2. **Section 11의 수동 검증 시나리오 100% 통과**: Android 디바이스 수동 확인 + 스크린샷 또는 영상 증빙.
3. **Prisma 마이그레이션 적용 완료**: `BodyComposition` 테이블 존재, `@@index([userId, recordedAt(sort: Desc)])` 적용.
4. **NFR-DASH-PERF SLO 충족**: AC-DASH-PERF-01의 P95 응답 시간 기준 만족.
5. **NFR-DASH-CONSISTENCY 보장**: 백엔드 1RM 계산이 `calculateEpley`와 일관 (AC-DASH-CONSISTENCY-EPLEY-01 통과), `COMPOUND_EXERCISE_SLUG_MAP` 재사용 확인.
6. **OWASP A01 검증**: AC-DASH-BODY-SECURITY-01, AC-DASH-BODY-DELETE-NOTFOUND-01, AC-DASH-BODY-AUTH-01 통과 (권한 격리 + 존재 여부 노출 차단).
7. **Section 8 MX 태그 적용**: spec.md `mx_plan`의 @MX:ANCHOR/@MX:WARN/@MX:NOTE/@MX:TODO 대상 모두에 적절한 태그 적용 (REASON 포함).
8. **추적성 매트릭스 검증**: spec.md Section 9의 모든 REQ가 본 acceptance.md의 한 개 이상 시나리오로 매핑되며, 모든 시나리오가 통과.
9. **변경 영향 분석 검증**: spec.md Section 10의 [NEW]/[MODIFY]/[DEPENDS-ON] 파일이 모두 실제로 변경/생성되었으며, 그 외 파일은 변경되지 않음.
10. **TRUST 5 통과**: Tested(85%+ coverage on body-composition/dashboard modules), Readable(ruff/eslint 0 warning), Unified(prettier/ESLint), Secured(OWASP A01 검증 완료), Trackable(commit 메시지에 SPEC-DASHBOARD-001 참조).

---

본 acceptance.md는 SPEC-DASHBOARD-001의 모든 EARS 요구사항(REQ + NFR)을 검증 가능한 행위 시나리오로 분해한 문서이다. 모든 자동화 시나리오는 백엔드 측 단위/E2E 테스트로 자동 검증되며, 모바일 UX 시나리오는 수동 검증을 통해 확인한다.
