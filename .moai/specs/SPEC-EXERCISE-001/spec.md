---
id: SPEC-EXERCISE-001
version: "1.0.1"
status: draft
created_at: "2026-05-11"
updated_at: "2026-05-11"
author: leederic9306
priority: high
issue_number: 0
labels: ["exercise", "library", "backend", "mobile"]
---

# SPEC-EXERCISE-001: 운동 도감 (Exercise Library)

## HISTORY

- 2026-05-11 v1.0.1 (draft): plan-auditor 1차 감사 결과 반영. REQ-EX-FILTER-003 레이블 수정(Complex→Event-Driven), REQ-EX-FAV-001 응답 코드 명확화(201/200 구분), 라우트 충돌 방지 요구사항 명시(REQ-EX-FAV-012 추가), NFR-EX-SEC-003과 REQ-EX-FILTER-005 일관성 수정, AC-IMAGE 수동 검증 분리, 기타 minor 결함 수정.
- 2026-05-11 v1.0.0 (draft): 초기 작성 (leederic9306). 근력 운동 트래커 앱의 운동 도감 기능을 EARS 형식으로 정의. Free Exercise DB(yuhonas/free-exercise-db) 800+ 운동을 시드하여 운동 목록 조회/상세 조회/즐겨찾기/부위·기구 필터를 제공하는 읽기 전용 라이브러리. SPEC-AUTH-001(인증 시스템) 위에서 동작하며 모든 엔드포인트는 JwtAuthGuard로 보호된다. 이미지는 GitHub raw URL 직접 사용 정책을 채택.

---

## 1. 개요 (Overview)

근력 운동 트래커 앱의 **운동 도감(Exercise Library) 시스템**을 정의한다. 본 SPEC은 SPEC-AUTH-001(인증 및 권한 관리 시스템) 위에서 동작하는 **운동 정보 조회 레이어**로서, 인증된 사용자가 시드된 800+ 운동 데이터를 페이지네이션으로 조회하고, 운동의 상세 정보(이미지, 동작 지침, 자극 부위)를 확인하며, 부위(`primaryMuscles`)·기구(`equipment`)로 필터링하고, 자주 사용하는 운동을 즐겨찾기로 북마크할 수 있게 한다.

### 핵심 가치

- **운동 정보 접근성**: 사용자가 운동 이름·부위·기구·동작 설명을 한 곳에서 확인하여 올바른 자세와 자극 부위를 학습할 수 있다.
- **개인화된 즐겨찾기**: 사용자별로 자주 사용하는 운동을 북마크하여 운동 세션 기록 시 빠르게 접근할 수 있다 (운동 세션 기록 SPEC은 후속).
- **검증된 데이터 소스**: Free Exercise DB(yuhonas/free-exercise-db, MIT 라이선스)를 단일 진실 공급원으로 사용하여 데이터 품질을 보장하고 자체 콘텐츠 관리 비용을 제거한다.
- **이미지 호스팅 최소화**: GitHub raw URL을 그대로 사용하여 CDN/스토리지 운영 부담을 제거한다. 모바일 클라이언트는 Expo Image의 디스크 캐싱으로 성능을 보완한다.
- **읽기 전용 라이브러리**: 운동 정보는 시드 기반의 정적 데이터로 취급한다. Admin이 운동을 추가/수정/삭제하는 운영 엔드포인트는 본 SPEC 범위 밖이다 (소규모 비공개 앱 특성상 시드 갱신으로 충분).

### 범위

본 SPEC은 백엔드(NestJS 10) 측 `ExercisesModule`의 본격 구현(`ExercisesController`, `ExercisesService`, 즐겨찾기 처리), Prisma 스키마의 `Exercise` 모델 확장 및 `UserExerciseFavorite` 엔티티 신설, `prisma db seed`를 통한 Free Exercise DB 데이터 적재, `GET /exercises`, `GET /exercises/:id`, `GET /exercises/favorites`, `POST /exercises/:id/favorites`, `DELETE /exercises/:id/favorites` 엔드포인트, 모바일 클라이언트의 운동 도감 목록/상세 화면과 즐겨찾기 토글 UX를 포괄한다.

다음 항목은 본 SPEC 범위에서 명시적으로 제외된다 (Section 7 참조):
- 대체 운동 API (`GET /exercises/:id/substitutes`): SPEC-SUBSTITUTE-001(후속)에서 정의.
- 운동 상세에서 1RM 데이터 연동: SPEC-WORKOUT-001(운동 세션 기록, 후속) 완성 후 SPEC-EXERCISE-EXT-XXX에서 검토.
- 난이도(`level`) 기반 필터 노출: 데이터는 저장하되 API 필터에서는 사용하지 않음.
- 이름 검색(`name` LIKE): 후속 SPEC-EXERCISE-SEARCH-XXX에서 다룸.
- Admin용 운동 추가/수정/삭제 엔드포인트: 시드 갱신 정책으로 대체.
- 사용자가 직접 운동을 등록하는 기능 (Custom Exercise): 후속 SPEC.

---

## 2. 목표와 비목표 (Goals & Non-Goals)

### 2.1 목표 (Goals)

1. 인증된 사용자가 `GET /exercises?page=N&limit=M`로 페이지네이션된 운동 목록을 조회할 수 있게 한다 (기본 `page=1, limit=20`, `limit` 최대 50).
2. 인증된 사용자가 `GET /exercises?primaryMuscle=chest`로 특정 부위 운동만 필터링하여 조회할 수 있게 한다.
3. 인증된 사용자가 `GET /exercises?equipment=barbell`로 특정 기구 운동만 필터링하여 조회할 수 있게 한다.
4. 인증된 사용자가 `primaryMuscle`과 `equipment`를 동시에 조합하여 필터링할 수 있게 한다 (AND 조건).
5. 인증된 사용자가 `GET /exercises/:id`로 특정 운동의 전체 상세 정보(이미지 배열, instructions, secondaryMuscles 포함)를 조회할 수 있게 한다.
6. 인증된 사용자가 `POST /exercises/:id/favorites`로 운동을 즐겨찾기에 추가할 수 있게 한다.
7. 인증된 사용자가 `DELETE /exercises/:id/favorites`로 즐겨찾기에서 운동을 제거할 수 있게 한다.
8. 인증된 사용자가 `GET /exercises/favorites`로 본인의 즐겨찾기 운동 목록을 조회할 수 있게 한다.
9. `GET /exercises`, `GET /exercises/:id` 응답의 각 운동 객체에 현재 사용자의 즐겨찾기 여부(`isFavorite: boolean`)를 포함하여 클라이언트가 추가 호출 없이 토글 상태를 표시할 수 있게 한다.
10. `prisma db seed` 스크립트가 Free Exercise DB의 `exercises.json`을 읽어 800+ 운동을 멱등적으로 적재할 수 있게 한다 (재실행 시 중복 없음).
11. 이미지 필드는 GitHub raw URL 전체 경로(`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/<image-path>`)를 JSON 배열로 저장하여 클라이언트가 추가 가공 없이 직접 사용할 수 있게 한다.

### 2.2 비목표 (Non-Goals)

- 대체 운동 API는 SPEC-SUBSTITUTE-001(후속)에서 다룬다. 본 SPEC에서 `ExerciseRatio` 모델은 스키마에만 존재하고 본 SPEC의 API는 노출하지 않는다.
- 1RM 추정/표시 등 운동 세션 데이터 연동은 본 SPEC 범위 밖이다.
- `level` 기반 필터(`?level=beginner`)는 본 SPEC에서 지원하지 않는다. `level` 데이터는 시드되지만 API 응답에 노출만 되고 필터로 사용되지 않는다.
- 이름 검색(`?q=bench`)은 본 SPEC 범위 밖이다.
- Admin이 운동을 추가/수정/삭제하는 운영 엔드포인트(`POST /admin/exercises` 등)는 본 SPEC 범위 밖이다. 운동 데이터 갱신은 `prisma db seed` 재실행으로 처리한다.
- 사용자가 자체적으로 운동을 등록하는 Custom Exercise 기능은 본 SPEC 범위 밖이다.
- 운동별 즐겨찾기 수 집계(`favoriteCount`) 및 인기 운동 랭킹은 본 SPEC 범위 밖이다.
- 즐겨찾기 운동 정렬 옵션(이름순/추가일순)은 본 SPEC에서는 기본 정렬(추가일 내림차순)만 제공한다.
- 자체 CDN 또는 S3 이미지 재호스팅은 본 SPEC 범위 밖이다. 클라이언트가 GitHub raw URL에 직접 접근한다.

---

## 3. EARS 요구사항 (Requirements)

### 3.1 REQ-EX-LIST: 운동 목록 조회

**REQ-EX-LIST-001** (Event-Driven)
인증된 사용자가 `GET /exercises?page=N&limit=M` 요청을 보냈을 때, 시스템은 페이지네이션된 운동 목록을 `200 OK`로 반환해야 한다. 기본값은 `page=1, limit=20`이며, `limit`은 최대 50으로 제한한다.

**REQ-EX-LIST-002** (Ubiquitous)
시스템은 `GET /exercises` 응답에 다음 메타데이터를 포함해야 한다: `items` (운동 배열), `total` (필터 적용 후 총 운동 수), `page`, `limit`, `totalPages`.

**REQ-EX-LIST-003** (Ubiquitous)
시스템은 `GET /exercises`의 `items` 배열 각 요소에 다음 필드를 포함해야 한다: `id`, `name`, `primaryMuscles`, `equipment`, `category`, `level`, `images` (첫 번째 이미지만 포함하여 목록 페이로드 크기 최적화), `isFavorite`. 운동이 0개의 이미지를 가진 경우(`images` 원본 배열이 비어 있는 경우) `images` 필드는 빈 배열 `[]`로 반환되며 `null`이 아니어야 한다. 동일 규칙은 `GET /exercises/:id` 및 `GET /exercises/favorites` 응답의 `images` 필드에도 적용된다.

**REQ-EX-LIST-004** (Ubiquitous)
시스템은 `GET /exercises` 응답의 모든 운동 객체에 현재 인증된 사용자의 즐겨찾기 여부(`isFavorite: boolean`)를 항상 포함해야 한다. `UserExerciseFavorite` 테이블에 해당 사용자와 운동의 매핑 레코드가 존재하면 `true`, 그렇지 않으면 `false`로 계산한다.

**REQ-EX-LIST-005** (Ubiquitous)
시스템은 `GET /exercises`의 기본 정렬을 `name` 오름차순(알파벳 순)으로 적용해야 한다.

**REQ-EX-LIST-006** (Event-Driven)
사용자가 `GET /exercises?page=N&limit=M`을 호출했을 때, 시스템은 다음을 검증해야 한다:
- `page`: 정수, 최소 1
- `limit`: 정수, 최소 1, 최대 50
범위를 벗어나면 `400 Bad Request`를 반환한다.

**REQ-EX-LIST-007** (Ubiquitous)
시스템은 `GET /exercises` 엔드포인트를 `JwtAuthGuard`로 보호하여 JWT가 없거나 만료된 경우 `401 Unauthorized`를 반환해야 한다.

### 3.2 REQ-EX-DETAIL: 운동 상세 조회

**REQ-EX-DETAIL-001** (Event-Driven)
인증된 사용자가 `GET /exercises/:id` 요청을 보냈을 때, 시스템은 해당 운동의 전체 상세 정보를 `200 OK`로 반환해야 한다. 응답 필드는 다음을 포함한다: `id`, `name`, `force`, `level`, `mechanic`, `equipment`, `primaryMuscles`, `secondaryMuscles`, `instructions` (문자열 배열), `category`, `images` (전체 이미지 URL 배열), `isFavorite`.

**REQ-EX-DETAIL-002** (Event-Driven)
사용자가 존재하지 않는 운동 `id`로 `GET /exercises/:id`를 호출했을 때, 시스템은 `404 Not Found`를 반환해야 한다.

**REQ-EX-DETAIL-003** (Ubiquitous)
시스템은 `GET /exercises/:id` 응답의 `images` 배열을 GitHub raw URL 전체 경로 형식(`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/<image-path>`)으로 반환해야 한다. 클라이언트가 별도의 base URL 결합 없이 직접 로드할 수 있어야 한다.

**REQ-EX-DETAIL-004** (Ubiquitous)
시스템은 `GET /exercises/:id` 응답에 `isFavorite` 필드를 항상 포함해야 한다. 값은 현재 인증된 사용자의 즐겨찾기 상태로 계산된다 (REQ-EX-LIST-004와 동일 규칙).

**REQ-EX-DETAIL-005** (Ubiquitous)
시스템은 `GET /exercises/:id` 엔드포인트를 `JwtAuthGuard`로 보호하여 JWT가 없거나 만료된 경우 `401 Unauthorized`를 반환해야 한다.

### 3.3 REQ-EX-FILTER: 부위·기구 필터링

**REQ-EX-FILTER-001** (Event-Driven)
사용자가 `GET /exercises?primaryMuscle=<value>` 요청을 보냈을 때, 시스템은 `Exercise.primaryMuscles` 배열에 해당 값이 포함된 운동만 반환해야 한다. 허용 값은 Free Exercise DB의 영문 식별자(`chest`, `back`, `shoulders`, `quadriceps`, `hamstrings`, `glutes`, `biceps`, `triceps`, `abdominals`, `calves`, `forearms`, `traps`, `lats`, `middle back`, `lower back`, `neck`)를 따른다.

**REQ-EX-FILTER-002** (Event-Driven)
사용자가 `GET /exercises?equipment=<value>` 요청을 보냈을 때, 시스템은 `Exercise.equipment`가 해당 값과 일치하는 운동만 반환해야 한다. 허용 값은 Free Exercise DB의 영문 식별자(`barbell`, `dumbbell`, `cable`, `machine`, `body only`, `kettlebells`, `bands`, `medicine ball`, `exercise ball`, `e-z curl bar`, `foam roll`, `other`)를 따른다.

**REQ-EX-FILTER-003** (Event-Driven)
사용자가 `GET /exercises?primaryMuscle=chest&equipment=barbell`처럼 두 필터를 동시에 지정하여 요청했을 때, 시스템은 두 조건을 AND로 결합하여 결과를 반환해야 한다 (둘 다 만족하는 운동만 포함).

**REQ-EX-FILTER-004** (Event-Driven)
필터 결과가 0건일 때, 시스템은 `200 OK`와 `items: [], total: 0, page: 1, limit: 20, totalPages: 0`을 반환해야 한다. `404`를 사용하지 않는다.

**REQ-EX-FILTER-005** (Unwanted)
시스템은 알 수 없는 쿼리 파라미터(예: `?level=beginner`, `?q=bench`)에 대해 에러를 발생시키지 않아야 한다. `ValidationPipe({ whitelist: true, forbidNonWhitelisted: false })`로 화이트리스트 외 파라미터를 조용히 무시(strip)한다.

**REQ-EX-FILTER-006** (Event-Driven)
필터 적용 시에도 시스템은 페이지네이션 규칙(REQ-EX-LIST-001, REQ-EX-LIST-002)을 동일하게 적용해야 한다. `total`은 필터 적용 후 매칭된 운동 수를 의미한다.

### 3.4 REQ-EX-FAV: 즐겨찾기 (Favorites)

**REQ-EX-FAV-001** (Event-Driven)
인증된 사용자가 `POST /exercises/:id/favorites` 요청을 보냈을 때, 시스템은 `UserExerciseFavorite(userId, exerciseId)` 레코드를 멱등 처리(`upsert`)하고 `{ exerciseId, favoritedAt }`을 반환해야 한다. 응답 코드는 다음 규칙으로 명확히 구분한다: **신규 레코드를 생성한 경우 `201 Created`, 기존 레코드를 반환한 경우 `200 OK`**. 클라이언트는 두 코드 모두 성공으로 처리하며, REST 시멘틱(`201 = 리소스 신규 생성`, `200 = 기존 리소스 반환`)을 따른다.

**REQ-EX-FAV-002** (Unwanted)
시스템은 이미 즐겨찾기에 추가된 운동에 대한 중복 `POST /exercises/:id/favorites` 요청을 에러로 처리하지 않아야 한다. 멱등성을 보장하여 기존 레코드를 유지한 채 `200 OK`와 기존 `favoritedAt`을 반환한다.

**REQ-EX-FAV-003** (Event-Driven)
사용자가 존재하지 않는 운동 `id`로 `POST /exercises/:id/favorites`를 호출했을 때, 시스템은 `404 Not Found`를 반환하고 `UserExerciseFavorite` 레코드를 생성하지 않아야 한다.

**REQ-EX-FAV-004** (Event-Driven)
인증된 사용자가 `DELETE /exercises/:id/favorites` 요청을 보냈을 때, 시스템은 해당 사용자와 운동의 `UserExerciseFavorite` 레코드를 삭제하고 `204 No Content`를 반환해야 한다.

**REQ-EX-FAV-005** (Event-Driven)
사용자가 즐겨찾기에 없는 운동 `id`로 `DELETE /exercises/:id/favorites`를 호출했을 때, 시스템은 멱등성을 보장하기 위해 `204 No Content`를 반환해야 한다 (`404`로 처리하지 않음).

**REQ-EX-FAV-006** (Event-Driven)
인증된 사용자가 `GET /exercises/favorites?page=N&limit=M` 요청을 보냈을 때, 시스템은 해당 사용자의 즐겨찾기 운동 목록을 페이지네이션하여 반환해야 한다. 응답 구조는 `GET /exercises`와 동일하나 `items`의 모든 요소는 `isFavorite=true`로 고정된다.

**REQ-EX-FAV-007** (Ubiquitous)
시스템은 `GET /exercises/favorites`의 기본 정렬을 `UserExerciseFavorite.favoritedAt` 내림차순(최근 추가 순)으로 적용해야 한다.

**REQ-EX-FAV-008** (Ubiquitous)
시스템은 `GET /exercises/favorites`의 `total`을 현재 사용자의 즐겨찾기 운동 수(`UserExerciseFavorite WHERE userId = current_user`의 count)로 계산해야 한다.

**REQ-EX-FAV-009** (Unwanted)
시스템은 다른 사용자의 즐겨찾기 데이터를 조회·수정·삭제할 수 있는 엔드포인트를 노출하지 않아야 한다. 모든 즐겨찾기 작업은 JWT의 `sub`(현재 사용자 ID)에 대해서만 수행된다.

**REQ-EX-FAV-010** (Ubiquitous)
시스템은 `POST /exercises/:id/favorites`, `DELETE /exercises/:id/favorites`, `GET /exercises/favorites` 엔드포인트를 `JwtAuthGuard`로 보호해야 한다.

**REQ-EX-FAV-011** (Unwanted)
시스템은 소프트 삭제된 사용자(`User.deletedAt IS NOT NULL`, SPEC-USER-001)의 `UserExerciseFavorite` 레코드를 본 SPEC에서 자동으로 삭제·NULL 처리하지 않아야 한다. 외래키 cascade 정책은 `onDelete: Cascade`로 설정되어 향후 하드 삭제(SPEC-OPS-XXX) 시점에 동시 정리된다.

**REQ-EX-FAV-012** (Unwanted)
시스템은 `GET /exercises/favorites` 요청을 `GET /exercises/:id` 핸들러로 라우팅하지 않아야 한다. `favorites` 고정 경로는 반드시 `:id` 동적 경로보다 먼저 매칭되어야 하며, 그렇지 않으면 `favorites`라는 문자열이 운동 ID로 해석되어 `404 Not Found`가 반환된다. 본 요구사항은 E2E 테스트로 검증되어야 한다 (AC-FAV-LIST-04 참조).

### 3.5 REQ-EX-SEED: 데이터 시딩

**REQ-EX-SEED-001** (Ubiquitous)
시스템은 `prisma db seed` 실행 시 Free Exercise DB(yuhonas/free-exercise-db)의 `exercises.json`을 읽어 `Exercise` 테이블에 적재해야 한다. 시드 후 적재된 운동 수는 800건 이상이어야 한다.

**REQ-EX-SEED-002** (Ubiquitous)
시스템은 시드 스크립트의 멱등성을 보장해야 한다. `Exercise.externalId`(Free Exercise DB의 원본 ID)를 unique 키로 사용하여 `upsert` 패턴으로 처리하며, 재실행 시 중복 레코드를 생성하지 않아야 한다.

**REQ-EX-SEED-003** (Ubiquitous)
시스템은 시드 시 Free Exercise DB의 `images` 필드(상대 경로 배열, 예: `["Bench_Press/0.jpg", "Bench_Press/1.jpg"]`)를 GitHub raw URL 전체 경로 배열(`["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bench_Press/0.jpg", ...]`)로 변환하여 `Exercise.images` JSON 컬럼에 저장해야 한다.

**REQ-EX-SEED-004** (Ubiquitous)
시스템은 Free Exercise DB의 다음 필드를 `Exercise` 모델에 그대로 매핑해야 한다: `name`, `force` (string/null), `level` (string), `mechanic` (string/null), `equipment` (string/null), `primaryMuscles` (string 배열), `secondaryMuscles` (string 배열), `instructions` (string 배열), `category` (string).

**REQ-EX-SEED-005** (Unwanted)
시스템은 시드 데이터의 `force`, `mechanic`, `equipment`가 `null`인 운동을 건너뛰지 않아야 한다. 모든 필드가 nullable인 경우에도 운동을 적재한다 (Free Exercise DB 일부 운동은 `force` 미정).

**REQ-EX-SEED-006** (Event-Driven)
시드 스크립트 실행 중 단일 운동 적재에 실패했을 때, 시스템은 전체 시드 작업을 중단해야 한다 (트랜잭션 롤백). 부분 적재 상태를 남기지 않는다.

### 3.6 REQ-EX-IMG: 이미지 처리

**REQ-EX-IMG-001** (Ubiquitous)
시스템은 운동 이미지를 GitHub raw URL로 클라이언트에 노출한다. 자체 호스팅, CDN 캐싱, S3 업로드, 리사이즈/포맷 변환을 수행하지 않아야 한다.

**REQ-EX-IMG-002** (Ubiquitous)
모바일 클라이언트는 Expo Image 컴포넌트를 사용하여 이미지를 표시하고, 디스크 캐싱(`cachePolicy="disk"`)으로 반복 로드 시 네트워크 호출을 최소화해야 한다.

**REQ-EX-IMG-003** (Unwanted)
모바일 클라이언트는 이미지 로드 실패 시 앱을 크래시시키지 않아야 한다. Expo Image의 `placeholder`/`onError` 콜백으로 운동 카테고리 기반 fallback 아이콘을 표시한다.

---

## 4. 비기능 요구사항 (Non-Functional Requirements)

### 4.1 보안 (Security)

- **NFR-EX-SEC-001**: 모든 `/exercises/*` 엔드포인트는 `JwtAuthGuard`로 보호되며, JWT 누락/만료 시 `401 Unauthorized`를 반환한다.
- **NFR-EX-SEC-002**: 즐겨찾기 엔드포인트는 JWT payload의 `sub`(userId)만 사용하며, URL 경로나 쿼리 파라미터로 다른 사용자 ID를 받지 않는다 (REQ-EX-FAV-009).
- **NFR-EX-SEC-003**: `ValidationPipe({ whitelist: true, forbidNonWhitelisted: false })`로 화이트리스트 외 쿼리 파라미터를 조용히 무시(strip)한다. `whitelist: true`는 알 수 없는 필드를 자동 제거하고, `forbidNonWhitelisted: false`는 알 수 없는 필드 존재 시 400 에러를 발생시키지 않도록 한다 (REQ-EX-FILTER-005와 일관). SQL 인젝션 방지를 위해 Prisma의 파라미터화된 쿼리만 사용한다.
- **NFR-EX-SEC-004**: 응답 본문에 다른 사용자의 즐겨찾기 정보, 내부 시스템 메타데이터(생성 타임스탬프 등 노출 불필요한 필드)는 포함하지 않는다.

### 4.2 성능 (Performance)

- **NFR-EX-PERF-001**: `GET /exercises` (limit=20, 필터 없음) 응답 시간 P95 ≤ 200ms.
- **NFR-EX-PERF-002**: `GET /exercises?primaryMuscle=<v>&equipment=<v>` 응답 시간 P95 ≤ 300ms.
- **NFR-EX-PERF-003**: `GET /exercises/:id` 응답 시간 P95 ≤ 150ms (단일 PK + 즐겨찾기 1회 조회).
- **NFR-EX-PERF-004**: `POST /exercises/:id/favorites`, `DELETE /exercises/:id/favorites` 응답 시간 P95 ≤ 150ms.
- **NFR-EX-PERF-005**: `GET /exercises/favorites` (limit=20) 응답 시간 P95 ≤ 250ms.
- **NFR-EX-PERF-006**: `GET /exercises` 응답 페이로드는 운동 1건당 평균 ≤ 2KB로 제한되어야 한다 (목록 응답은 `images[0]`만 포함, REQ-EX-LIST-003).

### 4.3 확장성 (Scalability)

- **NFR-EX-SCALE-001**: 운동 데이터는 시드 시점에 800+ 건으로 고정되며, 본 SPEC의 트래픽 가정은 동시 사용자 5명 이내(PRD 기준)이다. 캐싱 레이어(Redis 등)는 본 SPEC에서 도입하지 않는다.
- **NFR-EX-SCALE-002**: 즐겨찾기 테이블 `UserExerciseFavorite`은 `(userId, exerciseId)` 복합 unique 인덱스를 가지며, 사용자당 즐겨찾기 수는 운동 도감 전체(800+)를 초과할 수 없다.
- **NFR-EX-SCALE-003**: 필터 쿼리 성능을 위해 `Exercise.equipment`, `Exercise.category`에 단일 컬럼 인덱스를 추가한다. `primaryMuscles`는 배열 컬럼이므로 PostgreSQL 15의 **GIN 인덱스**를 raw migration으로 적용한다 (Prisma 스키마에서 직접 표현 불가하므로 `prisma/migrations/.../migration.sql`에 `CREATE INDEX ... USING GIN (...)` 추가). 정규화된 `ExerciseTag` 테이블 접근은 본 SPEC에서 채택하지 않는다.

### 4.4 데이터 무결성 (Data Integrity)

- **NFR-EX-DATA-001**: `Exercise.externalId`(Free Exercise DB 원본 ID)는 UNIQUE 제약을 가져야 한다 (REQ-EX-SEED-002 멱등성 기반).
- **NFR-EX-DATA-002**: `UserExerciseFavorite(userId, exerciseId)`는 복합 UNIQUE 제약을 가져야 한다 (중복 즐겨찾기 방지).
- **NFR-EX-DATA-003**: `UserExerciseFavorite.exerciseId`의 외래키는 `Exercise.id`를 참조하며 `onDelete: Cascade`로 설정한다. `UserExerciseFavorite.userId`는 `User.id`를 참조하며 `onDelete: Cascade`로 설정한다 (사용자 하드 삭제 시 즐겨찾기 자동 정리).

### 4.5 모바일 호환성 (Mobile Compatibility)

- **NFR-EX-MOBILE-001**: 모바일 클라이언트(`app/(tabs)/workout/index.tsx`)는 TanStack Query의 `useInfiniteQuery`로 페이지네이션을 처리하며, `getNextPageParam`은 `(lastPage.page < lastPage.totalPages) ? lastPage.page + 1 : undefined`로 결정한다.
- **NFR-EX-MOBILE-002**: 즐겨찾기 토글 시 Optimistic Update를 적용하여 사용자 인지 지연을 최소화한다 (TanStack Query `useMutation`의 `onMutate` + `setQueryData`).
- **NFR-EX-MOBILE-003**: 이미지 로드는 Expo Image의 `cachePolicy="disk"`로 디스크 캐싱을 활성화하여 반복 방문 시 네트워크 호출을 회피한다.

---

## 5. 데이터 모델 (Data Model)

본 절은 Prisma 스키마 변경 사항을 정의한다. 기존 `prisma/schema.prisma`에 이미 존재하는 `Exercise`, `ExerciseTag`, `ExerciseRatio` 엔티티를 확장하고 `UserExerciseFavorite` 엔티티를 신설한다.

### 5.1 Exercise 모델 (확장)

```prisma
model Exercise {
  id                String   @id @default(cuid())
  externalId        String   @unique            // Free Exercise DB 원본 ID (e.g., "Barbell_Bench_Press")
  name              String                       // e.g., "Barbell Bench Press"
  force             String?                      // e.g., "push", "pull", "static", null
  level             String                       // e.g., "beginner", "intermediate", "expert"
  mechanic          String?                      // e.g., "compound", "isolation", null
  equipment         String?                      // e.g., "barbell", "dumbbell", "cable", null
  primaryMuscles    String[]                     // PostgreSQL 배열, e.g., ["chest"]
  secondaryMuscles  String[]                     // PostgreSQL 배열, e.g., ["triceps", "shoulders"]
  instructions      String[]                     // 동작 지침 문자열 배열
  category          String                       // e.g., "strength", "cardio", "stretching"
  images            Json                         // GitHub raw URL 전체 경로 배열 (e.g., ["https://raw.githubusercontent.com/.../0.jpg", ...])
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations (existing in current schema)
  tags              ExerciseTag[]
  ratios            ExerciseRatio[]
  // New relation
  favoritedBy       UserExerciseFavorite[]

  @@index([equipment])
  @@index([category])
  // primaryMuscles GIN 인덱스는 raw migration으로 추가 (plan.md 참조)
}
```

**주요 변경점**:
- `externalId` (UNIQUE): Free Exercise DB 시드 멱등성 보장.
- `images Json`: GitHub raw URL 전체 경로의 JSON 배열 저장 (상대 경로가 아닌 완성된 URL).
- `equipment`, `category` 단일 컬럼 인덱스 추가.
- `primaryMuscles` GIN 인덱스: PostgreSQL의 배열 검색 최적화 (plan.md에서 raw migration으로 처리).

### 5.2 UserExerciseFavorite 모델 (신규)

```prisma
model UserExerciseFavorite {
  id          String   @id @default(cuid())
  userId      String
  exerciseId  String
  favoritedAt DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  exercise    Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)

  @@unique([userId, exerciseId])
  @@index([userId, favoritedAt(sort: Desc)])
}
```

**설계 결정**:
- `(userId, exerciseId)` 복합 UNIQUE: 중복 즐겨찾기 방지 (NFR-EX-DATA-002).
- `onDelete: Cascade`: 사용자 또는 운동이 하드 삭제되면 자동 정리 (NFR-EX-DATA-003).
- `(userId, favoritedAt DESC)` 복합 인덱스: `GET /exercises/favorites` 정렬 최적화 (REQ-EX-FAV-007).
- 본 SPEC은 소프트 삭제(`User.deletedAt`)에 대한 자동 정리를 수행하지 않음 (REQ-EX-FAV-011).

### 5.3 User 모델 (역참조 추가)

```prisma
model User {
  // ... (existing fields from SPEC-AUTH-001 / SPEC-USER-001)
  favoriteExercises UserExerciseFavorite[]
}
```

### 5.4 ExerciseTag, ExerciseRatio (기존 유지, 본 SPEC 미사용)

`ExerciseTag`와 `ExerciseRatio`는 기존 스키마에 존재한다. 본 SPEC에서는 신규 데이터를 적재하거나 API로 노출하지 않는다. `ExerciseRatio`는 SPEC-SUBSTITUTE-001(대체 운동)에서 사용 예정.

---

## 6. API 명세 (API Specification)

본 절은 본 SPEC이 정의하는 5개 엔드포인트의 요청·응답 구조를 명시한다. 모든 엔드포인트는 `JwtAuthGuard`로 보호된다.

### 6.1 GET /exercises

**Query Parameters**:
- `page`: integer, optional, default `1`, min `1`
- `limit`: integer, optional, default `20`, min `1`, max `50`
- `primaryMuscle`: string, optional, Free Exercise DB 부위 식별자 (e.g., `chest`, `back`)
- `equipment`: string, optional, Free Exercise DB 기구 식별자 (e.g., `barbell`, `dumbbell`)

**Response 200 OK**:
```json
{
  "items": [
    {
      "id": "clxxx...",
      "name": "Barbell Bench Press",
      "primaryMuscles": ["chest"],
      "equipment": "barbell",
      "category": "strength",
      "level": "intermediate",
      "images": ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press/0.jpg"],
      "isFavorite": false
    }
  ],
  "total": 142,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

**Error Responses**:
- `400 Bad Request`: 페이지/리미트 범위 위반
- `401 Unauthorized`: JWT 누락/만료

### 6.2 GET /exercises/:id

**Path Parameters**:
- `id`: string (CUID), 운동 ID

**Response 200 OK**:
```json
{
  "id": "clxxx...",
  "name": "Barbell Bench Press",
  "force": "push",
  "level": "intermediate",
  "mechanic": "compound",
  "equipment": "barbell",
  "primaryMuscles": ["chest"],
  "secondaryMuscles": ["triceps", "shoulders"],
  "instructions": [
    "Lie back on a flat bench holding a barbell...",
    "..."
  ],
  "category": "strength",
  "images": [
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press/0.jpg",
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press/1.jpg"
  ],
  "isFavorite": true
}
```

**Error Responses**:
- `401 Unauthorized`: JWT 누락/만료
- `404 Not Found`: 존재하지 않는 운동 ID

### 6.3 POST /exercises/:id/favorites

**Path Parameters**:
- `id`: string (CUID), 운동 ID

**Request Body**: 없음 (`{}` 또는 빈 본문)

**Response Codes** (REQ-EX-FAV-001):
- **`201 Created`**: 신규 즐겨찾기 레코드를 생성한 경우 (해당 사용자가 처음 즐겨찾기에 추가).
- **`200 OK`**: 이미 즐겨찾기에 존재하는 운동을 멱등적으로 다시 요청한 경우 (기존 레코드 반환, REQ-EX-FAV-002).

**Response Body** (두 코드 동일):
```json
{
  "exerciseId": "clxxx...",
  "favoritedAt": "2026-05-11T09:30:00.000Z"
}
```

**Behavior**: 멱등성 — 이미 즐겨찾기에 있으면 기존 `favoritedAt`을 그대로 유지하여 반환하며 응답 코드는 `200 OK`. 신규 생성 시에는 `favoritedAt`이 현재 시각으로 채워지고 응답 코드는 `201 Created`.

**Error Responses**:
- `401 Unauthorized`: JWT 누락/만료
- `404 Not Found`: 존재하지 않는 운동 ID

### 6.4 DELETE /exercises/:id/favorites

**Path Parameters**:
- `id`: string (CUID), 운동 ID

**Response 204 No Content**: 본문 없음

**Behavior**: 멱등성 — 즐겨찾기에 없어도 `204 No Content` 반환 (REQ-EX-FAV-005).

**Error Responses**:
- `401 Unauthorized`: JWT 누락/만료

### 6.5 GET /exercises/favorites

**Query Parameters**:
- `page`: integer, optional, default `1`, min `1`
- `limit`: integer, optional, default `20`, min `1`, max `50`

**Response 200 OK**: `GET /exercises`와 동일한 구조. 단, `items` 모든 요소의 `isFavorite=true`, 정렬은 `favoritedAt DESC`.

```json
{
  "items": [
    {
      "id": "clxxx...",
      "name": "Barbell Bench Press",
      "primaryMuscles": ["chest"],
      "equipment": "barbell",
      "category": "strength",
      "level": "intermediate",
      "images": ["https://raw.githubusercontent.com/.../0.jpg"],
      "isFavorite": true,
      "favoritedAt": "2026-05-11T09:30:00.000Z"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**Error Responses**:
- `400 Bad Request`: 페이지/리미트 범위 위반
- `401 Unauthorized`: JWT 누락/만료

**참고**: `GET /exercises/favorites`는 라우트 매칭 우선순위를 위해 `GET /exercises/:id`보다 먼저 정의되어야 한다 (NestJS Controller 라우트 등록 순서 또는 명시적 `@Get('favorites')` 우선 처리).

---

## 7. 제외 사항 (Exclusions - What NOT to Build)

본 SPEC에서 **명시적으로 제외하는 항목**은 다음과 같다. 이는 후속 SPEC 또는 영구 비목표로 분류된다.

1. **대체 운동 API (`GET /exercises/:id/substitutes`)**: `ExerciseRatio` 모델 기반 대체 운동 추천 기능은 SPEC-SUBSTITUTE-001에서 정의한다. 본 SPEC에서는 스키마에 모델만 존재하고 API로 노출하지 않는다.
2. **1RM 연동**: 운동 상세에서 사용자의 1RM(One Repetition Maximum) 추정치 표시는 SPEC-WORKOUT-001(운동 세션 기록) 완료 후 SPEC-EXERCISE-EXT-XXX에서 검토한다.
3. **난이도(`level`) 필터**: `level` 데이터는 시드되고 응답에 포함되지만 API 필터로는 사용하지 않는다 (`?level=beginner` 미지원). 필요 시 후속 SPEC에서 추가.
4. **이름 검색**: `?q=bench` 형태의 부분 일치 검색은 본 SPEC 범위 밖이다. 후속 SPEC-EXERCISE-SEARCH-XXX에서 PostgreSQL `pg_trgm` 또는 별도 검색 인프라로 다룬다.
5. **자체 이미지 호스팅·CDN**: 운동 이미지는 GitHub raw URL을 그대로 사용한다. S3 업로드, CloudFront/CDN 캐싱, 리사이즈/WebP 변환은 본 SPEC 범위 밖이다.
6. **Admin 운동 추가/수정/삭제 API**: `POST /admin/exercises`, `PATCH /admin/exercises/:id`, `DELETE /admin/exercises/:id` 등 운영 엔드포인트는 본 SPEC 범위 밖이다. 운동 데이터 갱신은 `prisma db seed` 재실행으로 처리한다.
7. **사용자 Custom Exercise 등록**: 사용자가 직접 운동을 등록·편집하는 기능은 본 SPEC 범위 밖이다.
8. **즐겨찾기 정렬 옵션**: `GET /exercises/favorites?sort=name|favoritedAt`은 본 SPEC에서 지원하지 않는다 (기본 `favoritedAt DESC`만 제공).
9. **운동별 인기 랭킹**: 전체 사용자의 즐겨찾기 수 기반 인기 운동 랭킹(`GET /exercises/popular` 등)은 본 SPEC 범위 밖이다.
10. **즐겨찾기 그룹/태그**: 사용자가 즐겨찾기를 카테고리로 분류하는 기능(예: "가슴 데이", "홈트")은 본 SPEC 범위 밖이다.
11. **운동 추천 (AI)**: Claude API 기반 운동 추천은 별도 SPEC-AI-RECOMMEND-XXX에서 다룬다.
12. **다국어 운동 이름**: 한국어 운동 이름(예: "벤치프레스") 매핑은 본 SPEC 범위 밖이다. 영문 이름을 그대로 사용하며, 후속 SPEC에서 localization 검토.
13. **운동 즐겨찾기 동기화 알림**: 다른 디바이스에서 즐겨찾기 추가 시 실시간 동기화 (WebSocket 등)는 본 SPEC 범위 밖이다.
14. **GraphQL 엔드포인트**: 본 SPEC은 REST만 정의한다. GraphQL 도입은 본 프로젝트 범위 밖.

---

## 8. mx_plan (MX Tag Annotation Targets)

### 8.1 @MX:ANCHOR 대상 (high fan_in 함수)

- `exercises.service.ts :: findAll(query, userId)`: 운동 목록 조회 진입점, 모든 도감 화면이 의존
- `exercises.service.ts :: findOne(id, userId)`: 운동 상세 조회 진입점, 도감 상세 화면이 의존
- `exercises.service.ts :: toggleFavorite(userId, exerciseId, action)`: 즐겨찾기 추가/삭제 단일 진입점, 멱등성 보장 지점
- `exercises.service.ts :: findFavorites(userId, query)`: 즐겨찾기 목록 진입점
- `exercise-response.dto.ts :: toResponse(exercise, isFavorite)`: 응답 변환 단일 지점, `isFavorite` 계산 불변식

### 8.2 @MX:WARN 대상 (danger zone, requires @MX:REASON)

- `exercises.service.ts :: findAll()`: `primaryMuscles` 필터에서 PostgreSQL 배열 쿼리(`hasSome` 또는 `has`) 사용 시 잘못된 인덱스 누락으로 풀스캔 가능 (REASON: NFR-EX-PERF-002 P95 ≤ 300ms 위반 가능, GIN 인덱스 필수)
- `exercises.service.ts :: toggleFavorite()`: 동시에 같은 사용자가 같은 운동을 추가 요청 시 race condition으로 unique constraint 위반 가능 (REASON: REQ-EX-FAV-002 멱등성 — `upsert` 또는 `onConflict` 사용 필수)
- `seed.ts :: seedExercises()`: 800+ 운동 삽입 트랜잭션이 길어져 락 점유 가능 (REASON: REQ-EX-SEED-006 원자성 — 배치 처리 검토)
- `exercises.controller.ts :: GET /exercises/favorites`: NestJS 라우트 매칭 순서에서 `GET /exercises/:id`보다 먼저 등록되지 않으면 `favorites`가 `:id`로 해석됨 (REASON: 라우트 충돌)

### 8.3 @MX:NOTE 대상

- `exercises.service.ts :: findAll(query, userId)`: 페이지네이션 + 필터 + `isFavorite` 계산을 단일 쿼리로 처리하기 위한 Prisma `include` 전략 명시
- `exercise-response.dto.ts`: 목록 응답은 `images[0]`만, 상세 응답은 전체 `images` 배열을 노출하는 분기 명시 (REQ-EX-LIST-003 vs REQ-EX-DETAIL-001)
- `seed.ts`: Free Exercise DB의 `images` 상대 경로를 GitHub raw URL로 변환하는 base URL 상수 명시
- `list-exercises-query.dto.ts`: `primaryMuscle`, `equipment`의 허용 값 목록 (Free Exercise DB enum 식별자) 명시
- `prisma/migrations/.../migration.sql`: `primaryMuscles` 배열에 GIN 인덱스 raw migration 명시

### 8.4 @MX:TODO 대상 (Run 단계 GREEN에서 해소)

- 대체 운동 API 연동 — SPEC-SUBSTITUTE-001로 이관
- 1RM 데이터 연동 — SPEC-WORKOUT-001 의존, 본 SPEC 범위 밖
- 이름 검색 — SPEC-EXERCISE-SEARCH-XXX로 이관
- 한국어 운동 이름 localization — 후속 SPEC 검토
- 즐겨찾기 인기 랭킹 — 후속 SPEC 검토

---

## 9. 추적성 매트릭스 (Traceability Matrix)

| REQ ID | acceptance.md 시나리오 | 출처 |
|--------|------------------------|------|
| REQ-EX-LIST-001 | AC-LIST-01, AC-LIST-04 | PRD 운동 도감 §3.4.1 |
| REQ-EX-LIST-002 | AC-LIST-01 | PRD 페이지네이션 정책 |
| REQ-EX-LIST-003 | AC-LIST-01, AC-LIST-02 | NFR-EX-PERF-006 |
| REQ-EX-LIST-004 | AC-LIST-03 | 사용자 인터뷰 (즐겨찾기 토글 즉시 표시) |
| REQ-EX-LIST-005 | AC-LIST-01 | UX 결정 (알파벳 순 일관성) |
| REQ-EX-LIST-006 | AC-LIST-05 | 입력 검증 |
| REQ-EX-LIST-007 | AC-LIST-06 | NFR-EX-SEC-001 |
| REQ-EX-DETAIL-001 | AC-DETAIL-01 | PRD 운동 도감 §3.4.2 |
| REQ-EX-DETAIL-002 | AC-DETAIL-02 | 표준 REST 시멘틱 |
| REQ-EX-DETAIL-003 | AC-DETAIL-01, AC-IMAGE-01 | 사용자 인터뷰 (GitHub raw URL 정책) |
| REQ-EX-DETAIL-004 | AC-DETAIL-01 | REQ-EX-LIST-004와 동일 |
| REQ-EX-DETAIL-005 | AC-DETAIL-03 | NFR-EX-SEC-001 |
| REQ-EX-FILTER-001 | AC-FILTER-01 | PRD 부위 필터 |
| REQ-EX-FILTER-002 | AC-FILTER-02 | PRD 기구 필터 |
| REQ-EX-FILTER-003 | AC-FILTER-03 | 사용자 인터뷰 (다중 필터 조합) |
| REQ-EX-FILTER-004 | AC-FILTER-04 | REST 시멘틱 (필터 결과 0건 != 404) |
| REQ-EX-FILTER-005 | AC-FILTER-05 | NFR-EX-SEC-003 |
| REQ-EX-FILTER-006 | AC-FILTER-01, AC-FILTER-03 | REQ-EX-LIST-001 일관성 |
| REQ-EX-FAV-001 | AC-FAV-ADD-01 | 사용자 인터뷰 (즐겨찾기 기능 포함) |
| REQ-EX-FAV-002 | AC-FAV-ADD-02 | 멱등성 (이중 클릭 안전성) |
| REQ-EX-FAV-003 | AC-FAV-ADD-03 | 데이터 무결성 |
| REQ-EX-FAV-004 | AC-FAV-REMOVE-01 | 사용자 인터뷰 |
| REQ-EX-FAV-005 | AC-FAV-REMOVE-02 | 멱등성 |
| REQ-EX-FAV-006 | AC-FAV-LIST-01 | 사용자 인터뷰 (즐겨찾기 목록) |
| REQ-EX-FAV-007 | AC-FAV-LIST-01 | UX 결정 (최근 추가 우선) |
| REQ-EX-FAV-008 | AC-FAV-LIST-01 | 페이지네이션 일관성 |
| REQ-EX-FAV-009 | AC-FAV-LIST-02 | NFR-EX-SEC-002 (권한 격리) |
| REQ-EX-FAV-010 | AC-FAV-LIST-03 | NFR-EX-SEC-001 |
| REQ-EX-FAV-011 | (계약, 자동 테스트 불요) | SPEC-USER-001 소프트 삭제와 정합 |
| REQ-EX-FAV-012 | AC-FAV-LIST-04 | NestJS 라우트 충돌 방지 (mx_plan §8.2) |
| REQ-EX-SEED-001 | AC-SEED-01 | Free Exercise DB 단일 진실 공급원 |
| REQ-EX-SEED-002 | AC-SEED-02 | 시드 멱등성 (운영 편의) |
| REQ-EX-SEED-003 | AC-SEED-03, AC-IMAGE-01 | 이미지 정책 |
| REQ-EX-SEED-004 | AC-SEED-01 | 데이터 매핑 정확성 |
| REQ-EX-SEED-005 | AC-SEED-04 | 데이터 완전성 |
| REQ-EX-SEED-006 | AC-SEED-05 | 트랜잭션 원자성 |
| REQ-EX-IMG-001 | AC-IMAGE-01 | 인프라 비용 최소화 |
| REQ-EX-IMG-002 | AC-IMAGE-02 | NFR-EX-MOBILE-003 |
| REQ-EX-IMG-003 | AC-IMAGE-03 | UX 안정성 |
| NFR-EX-PERF-001~006 | AC-PERF-01 | 성능 SLO |
| NFR-EX-SEC-001~004 | AC-SECURITY-01 | OWASP A01 |
| NFR-EX-DATA-001~003 | AC-SEED-02, AC-FAV-ADD-02 | 데이터 무결성 |
