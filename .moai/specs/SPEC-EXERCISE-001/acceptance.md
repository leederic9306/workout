# SPEC-EXERCISE-001 인수 기준 (Acceptance Criteria)

본 문서는 SPEC-EXERCISE-001의 모든 EARS 요구사항에 대한 검증 가능한 Given-When-Then 시나리오를 정의한다. 모든 시나리오는 단위 테스트, 통합 테스트, E2E 테스트 중 하나 이상으로 자동화되어야 한다.

전제:
- SPEC-AUTH-001 v1.0.1이 이미 구현되어 있다 (`JwtAuthGuard`, `JwtStrategy`, `@CurrentUser()` 데코레이터 존재).
- SPEC-USER-001 v1.0.1이 구현되어 있다 (`User.deletedAt` 컬럼 존재).
- 시드 데이터(800+ 운동)가 `prisma db seed`로 DB에 적재되어 있다 (Phase 1 완료).
- 테스트 환경의 사용자 `U1`, `U2`(둘 다 일반 USER 권한, 온보딩 완료)가 존재하며 각자 유효한 Access Token을 보유한다.

---

## 1. 운동 목록 조회 (AC-LIST)

### AC-LIST-01: GET /exercises — 정상 페이지네이션 조회

**Given**:
- DB에 800건 이상의 운동이 시드된 상태.
- 사용자 `U1`의 유효한 Access Token `T1`.
- `U1`은 어떤 운동도 즐겨찾기에 추가하지 않은 상태.

**When**:
- 클라이언트가 `GET /exercises?page=1&limit=20` 요청을 `Authorization: Bearer T1` 헤더와 함께 전송.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문 구조:
  - `items`: 길이 20 배열.
  - `total >= 800`.
  - `page=1`, `limit=20`, `totalPages = ceil(total / 20)`.
- 각 `items[i]` 요소는 다음 필드를 포함: `id`, `name`, `primaryMuscles`, `equipment`, `category`, `level`, `images` (길이 1 배열, GitHub raw URL), `isFavorite=false`.
- `items`는 `name` 알파벳 오름차순 정렬.
- 응답 본문에 `externalId`, `createdAt`, `updatedAt`, `secondaryMuscles`, `instructions`, `force`, `mechanic`은 포함되지 않음 (목록 응답 최적화).

**검증 매핑**: REQ-EX-LIST-001, REQ-EX-LIST-002, REQ-EX-LIST-003, REQ-EX-LIST-005

### AC-LIST-02: GET /exercises — 목록 응답의 images는 첫 번째만 포함

**Given**:
- 운동 `E1` (`images = ["https://.../0.jpg", "https://.../1.jpg", "https://.../2.jpg"]`)이 시드되어 있음.
- `U1`의 유효한 Access Token.

**When**:
- `GET /exercises?page=1&limit=20` 호출 (E1이 포함되는 페이지).

**Then**:
- 응답 `items` 중 `E1` 요소의 `images` 필드는 길이 1 배열: `["https://.../0.jpg"]`.
- 두 번째/세 번째 이미지는 목록 응답에 포함되지 않음.

**검증 매핑**: REQ-EX-LIST-003, NFR-EX-PERF-006

### AC-LIST-03: GET /exercises — isFavorite 필드 반영

**Given**:
- 운동 `E1`(`id="ex-001"`), `E2`(`id="ex-002"`)가 시드되어 있음.
- `U1`이 `E1`만 즐겨찾기에 추가한 상태 (`UserExerciseFavorite(userId=U1, exerciseId="ex-001")` 존재).

**When**:
- `U1`의 토큰으로 `GET /exercises?page=1&limit=50` 호출 (E1, E2 모두 포함).

**Then**:
- `items` 중 `id="ex-001"`의 `isFavorite=true`.
- `items` 중 `id="ex-002"`의 `isFavorite=false`.

**검증 매핑**: REQ-EX-LIST-004

### AC-LIST-04: GET /exercises — 다른 페이지 조회

**Given**:
- 시드 후 활성 운동 수 `N ≥ 40` (2페이지 이상 존재 보장).
- `U1`의 유효한 Access Token.

**When**:
- `GET /exercises?page=2&limit=20` 호출.

**Then**:
- 응답 상태 `200 OK`.
- `items.length ≤ 20`.
- `page=2`, `limit=20`, `total = N`, `totalPages = ceil(N/20)`.
- `items`는 첫 번째 페이지와 중복되지 않음.

**검증 매핑**: REQ-EX-LIST-001, REQ-EX-LIST-002

### AC-LIST-05: GET /exercises — 쿼리 파라미터 검증 실패 (400)

**Given**:
- `U1`의 유효한 Access Token.

**When**:
- 다음 쿼리로 `GET /exercises` 호출:
  1. `?page=0` (최소 1 위반)
  2. `?page=-1`
  3. `?limit=0`
  4. `?limit=51` (최대 50 위반)
  5. `?limit=abc` (비숫자)
  6. `?page=1.5` (비정수)

**Then**:
- 모든 경우 응답 상태 코드는 `400 Bad Request`.
- 응답 본문에 `class-validator` 에러 메시지 포함.
- DB 변경 없음 (조회 작업이므로 본래 변경 없음).

**검증 매핑**: REQ-EX-LIST-006

### AC-LIST-06: GET /exercises — 인증 누락/만료 시 401

**Given**:
- 시드된 운동 데이터.

**When**:
- `GET /exercises`를 다음 케이스로 호출:
  1. `Authorization` 헤더 없이.
  2. `Authorization: Bearer T_expired`.
  3. `Authorization: Bearer T_tampered`.

**Then**:
- 모든 경우 응답 상태 코드는 `401 Unauthorized`.
- 응답 본문에 운동 데이터가 포함되지 않음.

**검증 매핑**: REQ-EX-LIST-007, NFR-EX-SEC-001

---

## 2. 부위·기구 필터링 (AC-FILTER)

### AC-FILTER-01: GET /exercises?primaryMuscle=chest — 부위 필터

**Given**:
- DB에 Free Exercise DB 800+ 운동이 시드되어 있으며, `primaryMuscles`에 `"chest"`를 포함하는 운동이 1건 이상, `primaryMuscles`에 `"back"`을 포함하는 운동이 1건 이상 존재.
- `U1`의 유효한 Access Token.

**When**:
- `GET /exercises?primaryMuscle=chest&page=1&limit=20` 호출.

**Then**:
- 응답 `200 OK`.
- `items` 모든 요소의 `primaryMuscles`가 `"chest"`를 포함 (assertion: 각 item에 대해 `primaryMuscles.includes("chest")`).
- `total >= 1`, `totalPages = ceil(total / 20)` 일관 (`Math.ceil(total / 20)`).
- `primaryMuscles`에 `"chest"`를 포함하지 않는 운동(예: `back` 단독)은 결과에 포함되지 않음.

**참고**: 픽스처 수치는 Free Exercise DB 데이터 갱신에 의존하므로 하드코딩하지 않는다. 정확한 count는 시드 시점의 실제 데이터로 산출된다.

**검증 매핑**: REQ-EX-FILTER-001, REQ-EX-FILTER-006

### AC-FILTER-02: GET /exercises?equipment=barbell — 기구 필터

**Given**:
- DB에 Free Exercise DB 800+ 운동이 시드되어 있으며, `equipment="barbell"`인 운동이 1건 이상, `equipment="dumbbell"`인 운동이 1건 이상 존재.
- `U1`의 유효한 Access Token.

**When**:
- `GET /exercises?equipment=barbell&page=1&limit=20` 호출.

**Then**:
- 응답 `200 OK`.
- `items` 모든 요소의 `equipment="barbell"`.
- `total >= 1`, `totalPages = ceil(total / 20)` 일관.
- `equipment="dumbbell"`인 운동은 결과에 포함되지 않음.

**검증 매핑**: REQ-EX-FILTER-002, REQ-EX-FILTER-006

### AC-FILTER-03: GET /exercises?primaryMuscle=chest&equipment=barbell — 복합 필터

**Given**:
- DB에 `primaryMuscles ⊇ ["chest"]` AND `equipment="barbell"`인 운동이 1건 이상 존재.
- `U1`의 유효한 Access Token.

**When**:
- `GET /exercises?primaryMuscle=chest&equipment=barbell&page=1&limit=20` 호출.

**Then**:
- 응답 `200 OK`.
- `items` 모든 요소가 `primaryMuscles ⊇ ["chest"]` AND `equipment="barbell"` 조건 동시 만족.
- `total >= 1`, `totalPages = ceil(total / 20)` 일관, `items.length = min(total, 20)`.

**검증 매핑**: REQ-EX-FILTER-003

### AC-FILTER-04: GET /exercises — 필터 결과 0건

**Given**:
- DB에 `primaryMuscles=["neck"]` AND `equipment="barbell"`인 운동이 0건.
- `U1`의 유효한 Access Token.

**When**:
- `GET /exercises?primaryMuscle=neck&equipment=barbell` 호출.

**Then**:
- 응답 상태 코드는 `200 OK` (`404`가 아님).
- 응답 본문: `{ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }`.

**검증 매핑**: REQ-EX-FILTER-004

### AC-FILTER-05: GET /exercises — 알 수 없는 쿼리 파라미터 무시

**Given**:
- `U1`의 유효한 Access Token.

**When**:
- 다음 쿼리로 `GET /exercises` 호출:
  1. `?level=beginner` (난이도 필터는 본 SPEC 범위 밖)
  2. `?q=bench` (이름 검색은 본 SPEC 범위 밖)
  3. `?sort=newest` (정렬 옵션 미지원)
  4. `?primaryMuscle=chest&unknownParam=value`

**Then**:
- 모든 경우 응답 상태 코드는 `200 OK`.
- 케이스 1~3: 필터 적용 없이 전체 결과 또는 다른 적용된 필터 기준 결과 반환.
- 케이스 4: `primaryMuscle=chest`만 적용되고 `unknownParam`은 조용히 무시됨.
- 어떤 경우에도 `400 Bad Request`가 반환되지 않음.

**검증 매핑**: REQ-EX-FILTER-005, NFR-EX-SEC-003

---

## 3. 운동 상세 조회 (AC-DETAIL)

### AC-DETAIL-01: GET /exercises/:id — 정상 상세 조회

**Given**:
- 운동 `E1`이 다음 데이터로 시드됨:
  - `id="ex-bench-press-001"`, `name="Barbell Bench Press"`, `force="push"`, `level="intermediate"`, `mechanic="compound"`, `equipment="barbell"`, `primaryMuscles=["chest"]`, `secondaryMuscles=["triceps", "shoulders"]`, `instructions=["Lie back on a flat bench...", "Press the bar..."]`, `category="strength"`, `images=["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press/0.jpg", "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press/1.jpg"]`.
- `U1`이 `E1`을 즐겨찾기에 추가한 상태.
- `U1`의 유효한 Access Token.

**When**:
- `GET /exercises/ex-bench-press-001` 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문은 다음 필드를 모두 포함:
  - `id="ex-bench-press-001"`, `name="Barbell Bench Press"`
  - `force="push"`, `level="intermediate"`, `mechanic="compound"`, `equipment="barbell"`
  - `primaryMuscles=["chest"]`, `secondaryMuscles=["triceps", "shoulders"]`
  - `instructions` (길이 2 이상 배열)
  - `category="strength"`
  - `images` (길이 2 배열, 모든 요소가 `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/`로 시작)
  - `isFavorite=true`
- 응답 본문에 `externalId`, `createdAt`, `updatedAt`은 포함되지 않음.

**검증 매핑**: REQ-EX-DETAIL-001, REQ-EX-DETAIL-003, REQ-EX-DETAIL-004

### AC-DETAIL-02: GET /exercises/:id — 존재하지 않는 ID

**Given**:
- DB에 `id="non-existent-id"`인 운동이 없음.
- `U1`의 유효한 Access Token.

**When**:
- `GET /exercises/non-existent-id` 호출.

**Then**:
- 응답 상태 코드는 `404 Not Found`.
- 응답 본문에 운동 데이터가 포함되지 않음.

**검증 매핑**: REQ-EX-DETAIL-002

### AC-DETAIL-03: GET /exercises/:id — 인증 누락 시 401

**Given**:
- 유효한 운동 ID `ex-001`이 DB에 존재.

**When**:
- `GET /exercises/ex-001`을 `Authorization` 헤더 없이 호출.

**Then**:
- 응답 상태 코드는 `401 Unauthorized`.
- 응답 본문에 운동 데이터가 포함되지 않음.

**검증 매핑**: REQ-EX-DETAIL-005

---

## 4. 즐겨찾기 추가 (AC-FAV-ADD)

### AC-FAV-ADD-01: POST /exercises/:id/favorites — 신규 추가 (201 Created)

**Given**:
- 운동 `E1`(`id="ex-001"`)이 DB에 존재.
- `U1`이 `E1`을 즐겨찾기에 추가하지 않은 상태 (`UserExerciseFavorite(U1, ex-001)` 미존재).
- `U1`의 유효한 Access Token.

**When**:
- `POST /exercises/ex-001/favorites`를 `U1`의 토큰으로 호출 (본문 없음).

**Then**:
- 응답 상태 코드는 **`201 Created`** (신규 레코드 생성).
- 응답 본문: `{ exerciseId: "ex-001", favoritedAt: "<ISO 8601>" }`.
- DB에 `UserExerciseFavorite(userId=U1.id, exerciseId="ex-001", favoritedAt=now)` 레코드 신규 생성.
- 후속 `GET /exercises?page=1&limit=50` 호출 시 `E1`의 `isFavorite=true`.

**검증 매핑**: REQ-EX-FAV-001

### AC-FAV-ADD-02: POST /exercises/:id/favorites — 멱등성 (중복 추가, 200 OK)

**Given**:
- AC-FAV-ADD-01 직후 상태 (`UserExerciseFavorite(U1, ex-001, favoritedAt=t1)` 존재).
- `U1`의 유효한 Access Token.

**When**:
- 같은 `POST /exercises/ex-001/favorites`를 두 번째로 호출 (시각 `t2 > t1`).

**Then**:
- 응답 상태 코드는 **`200 OK`** (기존 레코드 반환 — REQ-EX-FAV-001의 멱등 응답 코드 규칙).
- 응답 본문의 `favoritedAt`은 `t1` (기존 값 유지) — Prisma `upsert`의 `update: {}` 동작.
- DB에 `UserExerciseFavorite` 레코드가 여전히 1건만 존재 (중복 생성 없음).
- 어떤 경우에도 `409 Conflict`, `500 Internal Server Error`, `201 Created`가 반환되지 않음 (기존 레코드 반환이므로 `201`이 아님).

**검증 매핑**: REQ-EX-FAV-002, NFR-EX-DATA-002

### AC-FAV-ADD-03: POST /exercises/:id/favorites — 존재하지 않는 운동 ID

**Given**:
- DB에 `id="non-existent"`인 운동이 없음.
- `U1`의 유효한 Access Token.

**When**:
- `POST /exercises/non-existent/favorites` 호출.

**Then**:
- 응답 상태 코드는 `404 Not Found`.
- DB에 `UserExerciseFavorite` 레코드가 생성되지 않음.

**검증 매핑**: REQ-EX-FAV-003

---

## 5. 즐겨찾기 제거 (AC-FAV-REMOVE)

### AC-FAV-REMOVE-01: DELETE /exercises/:id/favorites — 정상 제거

**Given**:
- AC-FAV-ADD-01 완료 상태 (`UserExerciseFavorite(U1, ex-001)` 존재).
- `U1`의 유효한 Access Token.

**When**:
- `DELETE /exercises/ex-001/favorites`를 `U1`의 토큰으로 호출.

**Then**:
- 응답 상태 코드는 `204 No Content`.
- 응답 본문은 비어있음.
- DB에서 `UserExerciseFavorite(userId=U1.id, exerciseId="ex-001")` 레코드가 삭제됨.
- 후속 `GET /exercises?page=1&limit=50` 호출 시 `E1`의 `isFavorite=false`.

**검증 매핑**: REQ-EX-FAV-004

### AC-FAV-REMOVE-02: DELETE /exercises/:id/favorites — 멱등성 (없는 항목 제거)

**Given**:
- `U1`이 운동 `E1`(`id="ex-001"`)을 즐겨찾기에 추가한 적이 없음.
- `U1`의 유효한 Access Token.

**When**:
- `DELETE /exercises/ex-001/favorites` 호출.

**Then**:
- 응답 상태 코드는 `204 No Content` (`404`가 아님).
- 응답 본문은 비어있음.
- DB 상태 변경 없음 (원래 없었던 레코드이므로).

**검증 매핑**: REQ-EX-FAV-005

---

## 6. 즐겨찾기 목록 조회 (AC-FAV-LIST)

### AC-FAV-LIST-01: GET /exercises/favorites — 정상 목록 조회

**Given**:
- `U1`이 다음 운동을 순차적으로 즐겨찾기에 추가:
  - `E1` (`favoritedAt = 2026-05-10T10:00:00Z`)
  - `E2` (`favoritedAt = 2026-05-10T11:00:00Z`)
  - `E3` (`favoritedAt = 2026-05-10T12:00:00Z`)
- `U1`의 유효한 Access Token.

**When**:
- `GET /exercises/favorites?page=1&limit=20`을 `U1`의 토큰으로 호출.

**Then**:
- 응답 상태 코드는 `200 OK`.
- 응답 본문:
  - `items`: 길이 3 배열, 순서는 `[E3, E2, E1]` (favoritedAt DESC).
  - 각 `items[i]`의 `isFavorite=true`.
  - `total=3`, `page=1`, `limit=20`, `totalPages=1`.
- 각 요소는 `GET /exercises` 목록 응답과 동일 구조 (id, name, primaryMuscles, equipment, category, level, images[0], isFavorite).

**검증 매핑**: REQ-EX-FAV-006, REQ-EX-FAV-007, REQ-EX-FAV-008

### AC-FAV-LIST-02: GET /exercises/favorites — 사용자 격리

**Given**:
- `U1`은 `E1`, `E2`를 즐겨찾기에 추가.
- `U2`는 `E3`을 즐겨찾기에 추가.
- `U2`의 유효한 Access Token.

**When**:
- `GET /exercises/favorites`를 `U2`의 토큰으로 호출.

**Then**:
- 응답 `200 OK`.
- `items`: 길이 1 배열, `E3`만 포함.
- `E1`, `E2`는 응답에 포함되지 않음 (`U1`의 즐겨찾기).
- `total=1`.

**검증 매핑**: REQ-EX-FAV-009, NFR-EX-SEC-002

### AC-FAV-LIST-03: GET /exercises/favorites — 인증 누락 시 401

**Given**:
- DB에 즐겨찾기 데이터 존재.

**When**:
- `GET /exercises/favorites`를 `Authorization` 헤더 없이 호출.

**Then**:
- 응답 상태 코드는 `401 Unauthorized`.

**검증 매핑**: REQ-EX-FAV-010

### AC-FAV-LIST-04: GET /exercises/favorites — 라우트 충돌 방지 (favorites가 :id로 해석되지 않음)

**Given**:
- DB에 `id="favorites"`라는 운동이 **존재하지 않음** (Free Exercise DB cuid는 `c`로 시작하므로 충돌 불가하나 명시적 검증).
- `U1`이 `E1`을 즐겨찾기에 추가한 상태 (`UserExerciseFavorite(U1, ex-001)` 존재).
- `U1`의 유효한 Access Token.

**When**:
- `GET /exercises/favorites?page=1&limit=20`을 `U1`의 토큰으로 호출.

**Then**:
- 응답 상태 코드는 **`200 OK`** (`404 Not Found`가 아님).
- 응답 본문은 페이지네이션된 즐겨찾기 목록 구조(`items`, `total`, `page`, `limit`, `totalPages`)를 가진다.
- `items`에는 `E1`이 포함되며 `isFavorite=true`.
- `favorites` 문자열이 `:id` 동적 라우트로 잘못 해석되어 `404` 또는 `500`이 반환되지 않음.
- 추가 검증: NestJS 컨트롤러 소스 코드에서 `@Get('favorites')` 메서드가 `@Get(':id')` 메서드보다 앞에 정의되어 있음 (정적 검증 또는 lint 규칙으로 자동화 가능).

**검증 매핑**: REQ-EX-FAV-012

---

## 7. 데이터 시딩 (AC-SEED)

### AC-SEED-01: 시드 후 800+ 운동 적재

**Given**:
- Prisma 마이그레이션 완료된 빈 DB (`Exercise` 테이블에 0건).
- `prisma/seed/exercises.json`에 Free Exercise DB 데이터가 복사되어 있음.

**When**:
- `pnpm prisma db seed` 실행 후 완료될 때까지 대기.

**Then**:
- 시드 종료 코드 0 (성공).
- `prisma.exercise.count() >= 800`.
- 임의의 운동 1건을 조회하여 다음 필드가 채워져 있음을 확인:
  - `name`, `level`, `primaryMuscles`, `instructions`, `category`, `images`, `externalId`.

**검증 매핑**: REQ-EX-SEED-001, REQ-EX-SEED-004

### AC-SEED-02: 시드 멱등성

**Given**:
- AC-SEED-01 완료 후 `count1 = prisma.exercise.count()` 기록.

**When**:
- `pnpm prisma db seed`를 한 번 더 실행.

**Then**:
- 시드 종료 코드 0 (성공).
- `count2 = prisma.exercise.count()` 측정 시 `count2 === count1` (중복 생성 없음).
- 임의의 운동 1건의 `id` 필드(cuid)가 시드 전후 동일 (`externalId` 키 기반 upsert 동작).

**검증 매핑**: REQ-EX-SEED-002, NFR-EX-DATA-001

### AC-SEED-03: 이미지 URL 변환

**Given**:
- Free Exercise DB 원본의 운동 `Barbell_Bench_Press`의 `images = ["Barbell_Bench_Press/0.jpg", "Barbell_Bench_Press/1.jpg"]`.

**When**:
- 시드 후 해당 운동 조회 (`prisma.exercise.findUnique({ where: { externalId: "Barbell_Bench_Press" } })`).

**Then**:
- 조회된 `images` 필드:
  ```json
  [
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press/0.jpg",
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press/1.jpg"
  ]
  ```
- 모든 이미지 URL이 GitHub raw base prefix로 시작.

**검증 매핑**: REQ-EX-SEED-003

### AC-SEED-04: null 필드 운동도 적재

**Given**:
- Free Exercise DB에서 `force=null` 또는 `mechanic=null` 또는 `equipment=null`인 운동이 최소 1건 존재 (실제 데이터에 다수 존재).

**When**:
- 시드 실행 후 해당 운동 조회.

**Then**:
- 해당 운동이 DB에 적재되어 있음 (스킵되지 않음).
- 해당 필드(`force`/`mechanic`/`equipment`) 값은 `null`로 저장됨.

**검증 매핑**: REQ-EX-SEED-005

### AC-SEED-05: 시드 도중 실패 시 트랜잭션 롤백

**Given**:
- 빈 `Exercise` 테이블.
- 의도적으로 손상된 시드 데이터 (예: 한 항목에 필수 필드 `name` 누락 또는 타입 위반).

**When**:
- `pnpm prisma db seed` 실행.

**Then**:
- 시드 종료 코드 ≠ 0 (실패).
- `prisma.exercise.count() === 0` (부분 적재 없음, 전체 롤백).
- 에러 로그에 실패한 항목 정보가 포함됨.

**검증 매핑**: REQ-EX-SEED-006

---

## 8. 이미지 로딩 (AC-IMAGE) — 자동화 시나리오

### AC-IMAGE-01: 이미지 URL은 GitHub raw 전체 경로

**Given**:
- 시드 완료 상태.

**When**:
- `GET /exercises/:id`로 임의의 운동 상세 조회.

**Then**:
- 응답의 `images` 배열 모든 요소는 `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/`로 시작.
- 클라이언트가 별도의 base URL 결합 없이 직접 HTTP GET으로 이미지를 로드할 수 있음.
- 운동이 0개의 이미지를 가진 경우 `images` 필드는 빈 배열 `[]`로 반환되며 `null`이 아님 (REQ-EX-LIST-003 일관).

**검증 매핑**: REQ-EX-DETAIL-003, REQ-EX-IMG-001, REQ-EX-LIST-003

---

## 8a. 수동 검증 시나리오 (Manual Verification Scenarios)

본 절의 시나리오는 자동화 테스트로 검증이 어렵거나 비효율적이며, 모바일 클라이언트의 시각적/체험적 동작을 사람이 확인해야 한다. **Definition of Done의 자동화 검증 요구(Section 12 항목 6)에서 명시적으로 제외된다**. QA 체크리스트로 별도 관리되며 출시 전 1회 이상 수행되어야 한다.

### AC-IMAGE-02: 모바일에서 디스크 캐싱 동작 (수동 검증)

**Given**:
- 모바일 앱이 운동 상세 화면에서 이미지를 한 번 로드한 상태 (Expo Image 디스크 캐싱).

**When**:
- 사용자가 같은 운동 상세 화면을 다시 진입.

**Then** (수동 검증):
- 이미지 로드 시 네트워크 요청 없음 (Expo dev tools 또는 Chrome inspect에서 확인).
- 이미지가 즉시 표시됨 (네트워크 지연 없음).

**검증 매핑**: REQ-EX-IMG-002, NFR-EX-MOBILE-003

**검증 방법**: Expo dev tools의 Network 탭 또는 디바이스 패킷 캡처로 같은 URL에 대한 두 번째 요청이 발생하지 않음을 확인.

### AC-IMAGE-03: 이미지 로드 실패 시 fallback (수동 검증)

**Given**:
- 운동 `E1`의 `images = ["https://invalid-url.example/0.jpg"]` (의도적 잘못된 URL).
- 모바일 앱이 `E1` 상세 화면 진입.

**When**:
- Expo Image가 이미지 로드 시도 후 실패.

**Then** (수동 검증):
- 앱이 크래시하지 않음.
- 운동 카테고리(`category`) 기반 fallback 아이콘이 표시됨 (예: `strength` → 덤벨 아이콘).
- 사용자가 상세 정보(이름, instructions)를 정상적으로 확인 가능.

**검증 매핑**: REQ-EX-IMG-003

**검증 방법**: QA 환경에서 의도적으로 손상된 이미지 URL을 가진 테스트 운동을 시드하고, 모바일 앱에서 상세 화면 진입 시 카테고리 fallback 아이콘이 표시되며 크래시 없이 정상 동작함을 시각적으로 확인.

---

## 9. 보안 시나리오 (AC-SECURITY)

### AC-SECURITY-01: 사용자 격리 및 시크릿 노출 차단 (통합)

**Given**:
- `U1`, `U2` 두 사용자가 각자 다른 즐겨찾기 데이터를 보유.
- 각자의 유효한 Access Token.

**When**:
- 다음 엔드포인트들을 `U1`의 토큰으로 호출:
  - `GET /exercises`
  - `GET /exercises/:id` (`U2`가 즐겨찾기한 운동 ID 포함)
  - `GET /exercises/favorites`
  - `POST /exercises/:id/favorites`
  - `DELETE /exercises/:id/favorites`

**Then**:
- 모든 응답에 `U1`의 즐겨찾기 상태만 반영되며, `U2`의 즐겨찾기 데이터는 노출되지 않음.
- 응답 어디에도 다음 항목이 포함되지 않음:
  - 다른 사용자의 `userId`, `email`, 기타 PII
  - 데이터베이스 내부 필드 (`externalId`, `createdAt`, `updatedAt` — 운동 목록/상세)
  - JWT secret 또는 환경 변수
- 백엔드 로그에도 위 시크릿이 출력되지 않음.

**검증 매핑**: REQ-EX-FAV-009, NFR-EX-SEC-001, NFR-EX-SEC-002, NFR-EX-SEC-004

---

## 10. 성능 시나리오 (AC-PERF)

### AC-PERF-01: 성능 기준선

**Given**:
- 로컬 또는 staging 환경.
- 시드 완료(800+ 운동), `Exercise.equipment`/`category` 단일 인덱스 + `primaryMuscles` GIN 인덱스 적용.
- 인증된 사용자, 즐겨찾기 5건 보유.

**When**:
- 각 엔드포인트를 100회 반복 호출하고 응답 시간 측정:
  1. `GET /exercises?page=1&limit=20`
  2. `GET /exercises?primaryMuscle=chest&equipment=barbell`
  3. `GET /exercises/:id`
  4. `POST /exercises/:id/favorites`
  5. `DELETE /exercises/:id/favorites`
  6. `GET /exercises/favorites?page=1&limit=20`

**Then**:
- P95 응답 시간:
  - `GET /exercises` ≤ 200ms
  - `GET /exercises` (복합 필터) ≤ 300ms
  - `GET /exercises/:id` ≤ 150ms
  - `POST/DELETE /exercises/:id/favorites` ≤ 150ms
  - `GET /exercises/favorites` ≤ 250ms

**검증 매핑**: NFR-EX-PERF-001 ~ NFR-EX-PERF-005

---

## 11. 품질 게이트 (Quality Gate Criteria)

### 11.1 테스트 커버리지

- `apps/backend/src/exercises/` 라인 커버리지 ≥ 85%.
- 다음 함수는 100% 분기 커버리지 필수:
  - `exercises.service.ts :: findAll()` (필터 분기 포함)
  - `exercises.service.ts :: findOne()` (404 분기 포함)
  - `exercises.service.ts :: addFavorite()` (멱등성 분기 포함)
  - `exercises.service.ts :: removeFavorite()` (없는 항목 분기 포함)
  - `exercises.service.ts :: findFavorites()`

### 11.2 TRUST 5 게이트

- **Tested**: 위 11.1 충족, Section 1~7, 9, 10의 모든 자동화 AC가 자동화된 테스트로 통과 (수동 검증 AC-IMAGE-02, AC-IMAGE-03은 Section 8a QA 체크리스트로 별도 처리).
- **Readable**: ESLint(@typescript-eslint) 0 error, Prettier 통과. 함수명·변수명이 도메인 용어와 일치 (`exercise`, `favorite`, `equipment`).
- **Unified**: NestJS 공식 컨벤션(모듈/컨트롤러/서비스 분리), Prisma 스키마 일관성.
- **Secured**: AC-SECURITY-01 통과, 사용자 격리 검증.
- **Trackable**: 본 SPEC ID(SPEC-EXERCISE-001)를 모든 커밋 메시지에 포함, MX tag(`@MX:ANCHOR`, `@MX:WARN`) 적용 (mx_plan §8).

### 11.3 LSP 게이트 (Run Phase)

- TypeScript `tsc --noEmit` 0 error (백엔드 + 모바일 + packages/types).
- `pnpm lint` 0 error, 0 warning.
- Prisma `prisma validate` 통과.

### 11.4 시드 게이트

- `pnpm prisma db seed` 실행 후 종료 코드 0.
- AC-SEED-01 (count ≥ 800) 자동 검증.
- AC-SEED-02 (멱등성) 자동 검증 (시드 두 번 실행하여 count 동일 확인).

---

## 12. Definition of Done (완료 정의)

본 SPEC은 다음 모든 조건을 만족할 때 완료된 것으로 간주한다:

1. **DB 마이그레이션**: `Exercise.externalId`, `Exercise.images`, `UserExerciseFavorite` 테이블이 추가되고 Prisma migration이 commit된다.
2. **인덱스 적용**: `Exercise.equipment`, `Exercise.category` 단일 인덱스 + `primaryMuscles` GIN 인덱스가 적용된다.
3. **시드 완료**: `prisma db seed`로 800+ 운동이 적재되고 멱등성이 검증된다 (AC-SEED-01, AC-SEED-02 통과).
4. **API 구현**: 5개 엔드포인트(`GET /exercises`, `GET /exercises/:id`, `POST /exercises/:id/favorites`, `DELETE /exercises/:id/favorites`, `GET /exercises/favorites`)가 모두 구현되고 동작한다.
5. **라우트 순서**: `GET /exercises/favorites`가 `GET /exercises/:id`보다 먼저 매칭됨이 E2E 테스트로 검증된다.
6. **검증 통과**: Section 1~7, 9, 10의 모든 자동화 시나리오(AC-LIST-01 ~ AC-FAV-LIST-04, AC-DETAIL-01 ~ AC-DETAIL-03, AC-FILTER-01 ~ AC-FILTER-05, AC-FAV-ADD-01 ~ AC-FAV-REMOVE-02, AC-SEED-01 ~ AC-SEED-05, AC-IMAGE-01, AC-SECURITY-01, AC-PERF-01)가 자동화된 테스트로 검증되고 통과한다. **Section 8a의 수동 검증 시나리오(AC-IMAGE-02, AC-IMAGE-03)는 본 자동화 요구에서 제외되며, 출시 전 QA 체크리스트로 별도 검증된다**.
7. **모바일 화면**: 운동 도감 목록/상세/즐겨찾기 토글 3개 흐름이 구현되고 백엔드와 통합된다 (Phase 5~7).
8. **공유 타입**: `packages/types/src/exercise.ts`에 `ExerciseListItem`, `ExerciseDetail`, `PaginatedExercisesResponse`, `FavoriteToggleResponse` 타입이 export되며 백엔드/모바일이 동일 타입을 참조한다.
9. **품질 게이트**: 위 Section 11의 모든 기준 통과.
10. **이미지 정책**: 응답의 모든 `images`가 GitHub raw URL 전체 경로이며 자동화 테스트로 검증된다(AC-IMAGE-01 통과). 모바일에서 Expo Image 디스크 캐싱이 활성화되고 fallback이 동작함은 수동 검증 시나리오로 확인된다(AC-IMAGE-02, AC-IMAGE-03 — Section 8a QA 체크리스트).
11. **MX tag**: `mx_plan` Section 8에 정의된 모든 `@MX:ANCHOR`, `@MX:WARN` 대상이 실제 코드에 적용된다.
12. **추적성**: 모든 REQ-EX-* 항목이 본 acceptance.md의 시나리오로 1:1 또는 1:N 매핑되며 추적성 매트릭스(spec.md Section 9)가 최신 상태로 유지된다.
13. **라이선스 표기**: yuhonas/free-exercise-db MIT 라이선스가 `LICENSE_THIRD_PARTY.md` 또는 `README.md` Acknowledgements 섹션에 명시된다.
14. **문서 동기화**: `/moai sync SPEC-EXERCISE-001`로 API 문서, README, CHANGELOG가 갱신된다.
