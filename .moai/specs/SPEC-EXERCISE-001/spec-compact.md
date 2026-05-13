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

# SPEC-EXERCISE-001 (Compact)

운동 도감 — Free Exercise DB 800+ 운동을 시드하여 운동 목록 조회/상세 조회/부위·기구 필터/즐겨찾기를 제공하는 읽기 전용 라이브러리. SPEC-AUTH-001 위에서 동작하며 모든 엔드포인트는 `JwtAuthGuard`로 보호된다. 이미지는 GitHub raw URL 직접 사용 정책.

---

## EARS 요구사항

### REQ-EX-LIST: 운동 목록 조회

- **REQ-EX-LIST-001** (Event-Driven): 인증된 사용자가 `GET /exercises?page=N&limit=M`을 호출했을 때, 시스템은 페이지네이션된 운동 목록을 200으로 반환해야 한다 (기본 `page=1, limit=20`, `limit ≤ 50`).
- **REQ-EX-LIST-002** (Ubiquitous): 응답은 `items`, `total`, `page`, `limit`, `totalPages`를 포함해야 한다.
- **REQ-EX-LIST-003** (Ubiquitous): 응답 `items` 각 요소는 `id`, `name`, `primaryMuscles`, `equipment`, `category`, `level`, `images`(첫 번째만, 운동이 0개 이미지이면 빈 배열 `[]`), `isFavorite`을 포함해야 한다.
- **REQ-EX-LIST-004** (Ubiquitous): 응답의 모든 운동에 현재 사용자의 즐겨찾기 여부(`isFavorite`)를 항상 포함해야 한다.
- **REQ-EX-LIST-005** (Ubiquitous): 기본 정렬은 `name` 알파벳 오름차순이어야 한다.
- **REQ-EX-LIST-006** (Event-Driven): `page` 최소 1, `limit` 최소 1·최대 50 범위 위반 시 `400`을 반환해야 한다.
- **REQ-EX-LIST-007** (Ubiquitous): 본 엔드포인트는 `JwtAuthGuard`로 보호되어 JWT 누락/만료 시 `401`을 반환해야 한다.

### REQ-EX-DETAIL: 운동 상세 조회

- **REQ-EX-DETAIL-001** (Event-Driven): 인증된 사용자가 `GET /exercises/:id`를 호출했을 때, 시스템은 전체 상세 정보(`id`, `name`, `force`, `level`, `mechanic`, `equipment`, `primaryMuscles`, `secondaryMuscles`, `instructions`, `category`, `images`(전체 배열), `isFavorite`)를 200으로 반환해야 한다.
- **REQ-EX-DETAIL-002** (Event-Driven): 존재하지 않는 ID 조회 시 시스템은 `404`를 반환해야 한다.
- **REQ-EX-DETAIL-003** (Ubiquitous): 응답의 `images` 배열은 GitHub raw URL 전체 경로(`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/<path>`)여야 한다.
- **REQ-EX-DETAIL-004** (Ubiquitous): 응답에 `isFavorite`을 항상 포함하며, 현재 사용자의 즐겨찾기 상태로 계산되어야 한다.
- **REQ-EX-DETAIL-005** (Ubiquitous): 본 엔드포인트는 `JwtAuthGuard`로 보호되어야 한다.

### REQ-EX-FILTER: 부위·기구 필터링

- **REQ-EX-FILTER-001** (Event-Driven): `?primaryMuscle=<value>` 지정 시, 시스템은 `Exercise.primaryMuscles` 배열에 값이 포함된 운동만 반환해야 한다 (Free Exercise DB 영문 식별자 사용).
- **REQ-EX-FILTER-002** (Event-Driven): `?equipment=<value>` 지정 시, 시스템은 `Exercise.equipment`가 일치하는 운동만 반환해야 한다 (Free Exercise DB 영문 식별자 사용).
- **REQ-EX-FILTER-003** (Event-Driven): 두 필터가 동시에 지정되어 요청되었을 때, 시스템은 AND 조건으로 결합해야 한다.
- **REQ-EX-FILTER-004** (Event-Driven): 필터 결과가 0건일 때, 시스템은 `200 OK`와 `items: []`를 반환해야 한다 (`404`가 아님).
- **REQ-EX-FILTER-005** (Unwanted): 시스템은 알 수 없는 쿼리 파라미터(`?level=`, `?q=` 등)에 대해 에러를 발생시키지 않아야 한다. `ValidationPipe({ whitelist: true, forbidNonWhitelisted: false })`로 조용히 무시(strip).
- **REQ-EX-FILTER-006** (Event-Driven): 필터 적용 시 페이지네이션 규칙이 동일하게 적용되어야 한다.

### REQ-EX-FAV: 즐겨찾기

- **REQ-EX-FAV-001** (Event-Driven): 인증된 사용자가 `POST /exercises/:id/favorites`를 호출했을 때, 시스템은 `UserExerciseFavorite` 레코드를 멱등 처리하고 `{ exerciseId, favoritedAt }`을 반환해야 한다. **신규 생성 시 `201 Created`, 기존 레코드 반환 시 `200 OK`**.
- **REQ-EX-FAV-002** (Unwanted): 시스템은 중복 POST에 대해 에러를 반환하지 않아야 하며, 멱등성을 보장(기존 `favoritedAt`을 `200 OK`로 반환)해야 한다.
- **REQ-EX-FAV-003** (Event-Driven): 존재하지 않는 운동 ID로 POST 시 `404`를 반환하고 레코드를 생성하지 않아야 한다.
- **REQ-EX-FAV-004** (Event-Driven): `DELETE /exercises/:id/favorites` 호출 시 시스템은 레코드를 삭제하고 `204 No Content`를 반환해야 한다.
- **REQ-EX-FAV-005** (Event-Driven): 즐겨찾기에 없는 운동에 대한 DELETE도 `204 No Content`를 반환해야 한다 (멱등성).
- **REQ-EX-FAV-006** (Event-Driven): `GET /exercises/favorites?page=N&limit=M` 호출 시 시스템은 현재 사용자의 즐겨찾기 목록을 페이지네이션하여 반환해야 한다.
- **REQ-EX-FAV-007** (Ubiquitous): 즐겨찾기 목록 기본 정렬은 `favoritedAt DESC`여야 한다.
- **REQ-EX-FAV-008** (Ubiquitous): `total`은 현재 사용자의 즐겨찾기 운동 수여야 한다.
- **REQ-EX-FAV-009** (Unwanted): 시스템은 다른 사용자의 즐겨찾기 데이터를 노출하는 엔드포인트를 제공하지 않아야 한다. JWT의 `sub`에 대해서만 작업 수행.
- **REQ-EX-FAV-010** (Ubiquitous): 모든 즐겨찾기 엔드포인트는 `JwtAuthGuard`로 보호되어야 한다.
- **REQ-EX-FAV-011** (Unwanted): 소프트 삭제된 사용자의 즐겨찾기를 본 SPEC에서 자동 정리하지 않으며, 외래키 `onDelete: Cascade`로 향후 하드 삭제 시점에 정리한다.
- **REQ-EX-FAV-012** (Unwanted): 시스템은 `GET /exercises/favorites` 요청을 `GET /exercises/:id` 핸들러로 라우팅하지 않아야 한다. NestJS 컨트롤러에서 `@Get('favorites')`를 `@Get(':id')`보다 먼저 등록하여 라우트 충돌을 방지한다 (E2E 검증 — AC-FAV-LIST-04).

### REQ-EX-SEED: 데이터 시딩

- **REQ-EX-SEED-001** (Ubiquitous): `prisma db seed` 실행 시 Free Exercise DB의 800+ 운동이 적재되어야 한다.
- **REQ-EX-SEED-002** (Ubiquitous): 시드 스크립트는 `Exercise.externalId`(원본 ID) 기반 `upsert`로 멱등성을 보장해야 한다.
- **REQ-EX-SEED-003** (Ubiquitous): 시드 시 원본의 상대 경로 `images`를 GitHub raw URL 전체 경로 배열로 변환하여 저장해야 한다.
- **REQ-EX-SEED-004** (Ubiquitous): Free Exercise DB의 `name`, `force`, `level`, `mechanic`, `equipment`, `primaryMuscles`, `secondaryMuscles`, `instructions`, `category`를 그대로 매핑해야 한다.
- **REQ-EX-SEED-005** (Unwanted): `force`, `mechanic`, `equipment`가 `null`인 운동도 건너뛰지 않고 적재해야 한다.
- **REQ-EX-SEED-006** (Event-Driven): 시드 도중 단일 운동 적재 실패 시 전체 트랜잭션이 롤백되어야 한다.

### REQ-EX-IMG: 이미지 처리

- **REQ-EX-IMG-001** (Ubiquitous): 시스템은 운동 이미지를 GitHub raw URL로 노출하며, 자체 호스팅·CDN·리사이즈를 수행하지 않아야 한다.
- **REQ-EX-IMG-002** (Ubiquitous): 모바일 클라이언트는 Expo Image의 `cachePolicy="disk"`로 디스크 캐싱을 활성화해야 한다.
- **REQ-EX-IMG-003** (Unwanted): 모바일 클라이언트는 이미지 로드 실패 시 앱을 크래시시키지 않아야 하며, 카테고리 기반 fallback을 표시해야 한다.

---

## 인수 시나리오 요약 (Given-When-Then)

### AC-LIST-01: GET /exercises 정상 페이지네이션
- Given: 800+ 운동 시드, U1 토큰
- When: `GET /exercises?page=1&limit=20`
- Then: 200, `items.length=20`, `total>=800`, `totalPages` 계산 일치, `items[i].images.length<=1` (0개 이미지일 경우 `[]`), `isFavorite=false`(즐겨찾기 없음)

### AC-LIST-02: 목록의 images는 첫 번째만 포함
- Given: 다중 이미지 운동
- Then: 목록 응답에서 `images`는 길이 1 배열 (이미지 0개인 경우는 `[]`)

### AC-LIST-03: isFavorite 필드 반영
- Given: U1이 E1만 즐겨찾기
- When: `GET /exercises`
- Then: E1.isFavorite=true, 기타 false

### AC-LIST-04: 다른 페이지 조회
- When: `GET /exercises?page=2&limit=20`
- Then: 200, offset 21~40 운동, 1페이지와 중복 없음

### AC-LIST-05: 쿼리 파라미터 검증 실패
- When: `page=0`, `page=-1`, `limit=0`, `limit=51`, `limit=abc`, `page=1.5`
- Then: 모두 400

### AC-LIST-06: 인증 누락 시 401
- When: 토큰 없음/만료/변조
- Then: 모두 401

### AC-FILTER-01: 부위 필터 (chest)
- Given: chest 운동 1건 이상 시드
- When: `GET /exercises?primaryMuscle=chest`
- Then: 200, 모든 결과의 `primaryMuscles`에 `"chest"` 포함, `total >= 1`

### AC-FILTER-02: 기구 필터 (barbell)
- Given: barbell 운동 1건 이상 시드
- When: `GET /exercises?equipment=barbell`
- Then: 200, 모든 결과의 `equipment="barbell"`, `total >= 1`

### AC-FILTER-03: 복합 필터 (AND)
- Given: chest AND barbell 운동 1건 이상 시드
- When: `?primaryMuscle=chest&equipment=barbell`
- Then: 200, 둘 다 만족하는 운동만 반환, `total >= 1`

### AC-FILTER-04: 0건 결과
- When: 결과 없는 조합
- Then: 200, `items: [], total: 0, totalPages: 0` (404 아님)

### AC-FILTER-05: 알 수 없는 파라미터 무시
- When: `?level=beginner`, `?q=bench`, `?sort=newest`, `?unknownParam=x`
- Then: 200, 알 수 없는 파라미터는 조용히 무시(strip)

### AC-DETAIL-01: 정상 상세 조회
- Given: 즐겨찾기한 운동 E1
- When: `GET /exercises/:id`
- Then: 200, 전체 필드 + `images` 전체 배열 + `isFavorite=true`

### AC-DETAIL-02: 존재하지 않는 ID
- When: `GET /exercises/non-existent-id`
- Then: 404

### AC-DETAIL-03: 인증 누락 시 401
- When: 토큰 없이 호출
- Then: 401

### AC-FAV-ADD-01: 신규 추가 (201 Created)
- Given: U1, E1 미즐겨찾기
- When: `POST /exercises/:id/favorites`
- Then: **201 Created**, `{ exerciseId, favoritedAt }` 응답, DB에 레코드 신규 생성

### AC-FAV-ADD-02: 멱등성 (중복 추가, 200 OK)
- Given: AC-FAV-ADD-01 직후
- When: 같은 POST 재호출
- Then: **200 OK** (`201` 아님), 기존 `favoritedAt` 유지, DB 레코드 1건만, 409/500 없음

### AC-FAV-ADD-03: 존재하지 않는 운동
- When: `POST /exercises/non-existent/favorites`
- Then: 404, 레코드 미생성

### AC-FAV-REMOVE-01: 정상 제거
- Given: 즐겨찾기 존재
- When: `DELETE /exercises/:id/favorites`
- Then: 204, DB에서 레코드 삭제

### AC-FAV-REMOVE-02: 멱등성 (없는 항목 제거)
- When: 즐겨찾기에 없는 운동을 DELETE
- Then: 204 (404 아님), DB 상태 변경 없음

### AC-FAV-LIST-01: 정상 목록 조회
- Given: U1이 E1, E2, E3을 순차 추가
- When: `GET /exercises/favorites?page=1&limit=20`
- Then: 200, `items=[E3, E2, E1]` (favoritedAt DESC), 모두 `isFavorite=true`, `total=3`

### AC-FAV-LIST-02: 사용자 격리
- Given: U1: {E1,E2}, U2: {E3}
- When: U2 토큰으로 호출
- Then: 200, `items=[E3]`만, U1 데이터 노출 없음

### AC-FAV-LIST-03: 인증 누락 시 401
- When: 토큰 없이 호출
- Then: 401

### AC-FAV-LIST-04: 라우트 충돌 방지 (favorites가 :id로 해석되지 않음)
- Given: U1이 E1을 즐겨찾기에 추가
- When: `GET /exercises/favorites?page=1&limit=20`
- Then: **200 OK** (404 아님), 즐겨찾기 목록 구조 반환, E1 포함. `@Get('favorites')`가 `@Get(':id')`보다 먼저 등록되어 있음 (정적 검증).

### AC-SEED-01: 시드 후 800+ 적재
- Given: 빈 DB + seed JSON
- When: `pnpm prisma db seed`
- Then: 종료 0, `count >= 800`, 필수 필드 채워짐

### AC-SEED-02: 시드 멱등성
- Given: AC-SEED-01 완료
- When: 시드 재실행
- Then: count 동일, 운동 `id`(cuid) 보존

### AC-SEED-03: 이미지 URL 변환
- Given: 원본 `images = ["X/0.jpg"]`
- Then: DB의 `images = ["https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/X/0.jpg"]`

### AC-SEED-04: null 필드 운동 적재
- Given: `force=null` 운동 존재
- Then: 스킵 없이 적재, 필드는 `null` 저장

### AC-SEED-05: 트랜잭션 롤백
- Given: 손상된 시드 데이터
- When: 시드 실행
- Then: 종료 ≠ 0, `count = 0` (전체 롤백)

### AC-IMAGE-01: GitHub raw URL (자동화)
- When: 임의 운동 상세 조회
- Then: `images` 모두 `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/` 시작 (0개 이미지면 `[]`)

### AC-IMAGE-02: 디스크 캐싱 (수동 검증 — DoD 자동화 요구에서 제외)
- When: 같은 상세 화면 재진입
- Then: 네트워크 요청 없음, 즉시 표시

### AC-IMAGE-03: 로드 실패 fallback (수동 검증 — DoD 자동화 요구에서 제외)
- Given: 잘못된 이미지 URL
- Then: 크래시 없음, 카테고리 기반 아이콘 표시

### AC-SECURITY-01: 사용자 격리 통합
- When: 모든 5개 엔드포인트 호출
- Then: 다른 사용자 데이터 노출 없음, 시크릿/내부 필드 미노출

### AC-PERF-01: 성능 기준선
- Then: P95 — `/exercises` ≤ 200ms, 복합 필터 ≤ 300ms, `/exercises/:id` ≤ 150ms, 즐겨찾기 toggle ≤ 150ms, `/favorites` ≤ 250ms

---

## 변경 대상 파일 요약

### 백엔드 (apps/backend/)

- `prisma/schema.prisma` — `Exercise.externalId UNIQUE`, `Exercise.images Json`, `UserExerciseFavorite` 모델 신규, `User.favoriteExercises` 역참조, `@@index([equipment])` / `@@index([category])`
- `prisma/migrations/` — `add_exercise_library`, `primaryMuscles` GIN 인덱스 raw migration (NFR-EX-SCALE-003 확정)
- `prisma/seed/exercises.json` — Free Exercise DB 원본 데이터 (신규 복사)
- `prisma/seed.ts` — 시드 스크립트 (upsert + URL 변환 + 트랜잭션)
- `src/exercises/exercises.module.ts` — 모듈 정의
- `src/exercises/exercises.controller.ts` — 5개 라우트 (`@Get('favorites')` 반드시 `@Get(':id')`보다 먼저 등록, REQ-EX-FAV-012)
- `src/exercises/exercises.service.ts` — `findAll`, `findOne`, `addFavorite`(201/200 분기 반환), `removeFavorite`, `findFavorites`
- `src/exercises/dto/list-exercises-query.dto.ts` — `page`, `limit`, `primaryMuscle`, `equipment`
- `src/exercises/dto/exercise-list-item.dto.ts` — 목록 응답 DTO (`images[0]`만, 0개면 `[]`)
- `src/exercises/dto/exercise-detail.dto.ts` — 상세 응답 DTO (전체 `images` + `instructions`)
- `src/exercises/dto/paginated-exercises-response.dto.ts` — 페이지네이션 응답 DTO
- `src/exercises/dto/favorite-toggle-response.dto.ts` — `{ exerciseId, favoritedAt }`
- `src/main.ts` (또는 `src/app.module.ts`) — `ValidationPipe({ whitelist: true, forbidNonWhitelisted: false })` 전역 설정 (REQ-EX-FILTER-005, NFR-EX-SEC-003)
- 테스트 3종 (`exercises.service.spec.ts`, `exercises.controller.spec.ts`, `exercises.e2e-spec.ts` — AC-FAV-LIST-04 라우트 충돌 검증 포함)

### 모바일 (apps/mobile/)

- `app/(tabs)/workout/index.tsx` — 운동 도감 목록 화면 (필터 + 무한 스크롤)
- `app/(tabs)/workout/[id].tsx` — 운동 상세 화면 (이미지 carousel + instructions + 즐겨찾기 토글)
- `components/workout/ExerciseCard.tsx` — 카드 컴포넌트 (Expo Image)
- `components/workout/FilterChips.tsx` (신규) — 부위·기구 필터 칩 UI
- `components/workout/FavoriteButton.tsx` (신규) — 즐겨찾기 토글 (Optimistic Update)
- `services/exercises.ts` — API 호출 함수
- `hooks/useExercises.ts` — TanStack Query 훅 (`useExercises`, `useExerciseDetail`, `useToggleFavorite`, `useFavoriteExercises`)

### 공유 타입 (packages/types/)

- `src/exercise.ts` — `ExerciseListItem`, `ExerciseDetail`, `ExerciseListQuery`, `PaginatedExercisesResponse`, `FavoriteToggleResponse`
- `src/index.ts` — export 추가

### 운영 (root)

- `LICENSE_THIRD_PARTY.md` 또는 `README.md` — yuhonas/free-exercise-db MIT 라이선스 표기
- `apps/backend/README.md` — 시드 실행 가이드

---

## 제외 사항 (Exclusions)

1. **대체 운동 API (`GET /exercises/:id/substitutes`)** — SPEC-SUBSTITUTE-001(후속). `ExerciseRatio` 모델은 스키마에만 존재.
2. **1RM 연동** — 운동 상세에서 사용자의 1RM 표시는 SPEC-WORKOUT-001 완료 후 SPEC-EXERCISE-EXT-XXX에서 검토.
3. **난이도(`level`) 필터** — `level` 데이터는 시드·응답에 포함되지만 API 필터(`?level=`)로 사용하지 않음.
4. **이름 검색** — `?q=bench` 부분 일치 검색은 SPEC-EXERCISE-SEARCH-XXX(후속)에서 PostgreSQL `pg_trgm` 또는 별도 인프라로 다룸.
5. **자체 이미지 호스팅·CDN** — GitHub raw URL 직접 사용. S3 업로드/CloudFront/리사이즈/WebP 변환은 본 SPEC 범위 밖.
6. **Admin 운동 추가/수정/삭제 API** — `POST/PATCH/DELETE /admin/exercises` 등 운영 엔드포인트는 본 SPEC 범위 밖. 데이터 갱신은 `prisma db seed` 재실행으로 처리.
7. **사용자 Custom Exercise 등록** — 사용자가 직접 운동을 등록·편집하는 기능은 본 SPEC 범위 밖.
8. **즐겨찾기 정렬 옵션** — `?sort=name|favoritedAt`은 미지원. 기본 `favoritedAt DESC`만 제공.
9. **운동별 인기 랭킹** — 전체 사용자 즐겨찾기 수 기반 `GET /exercises/popular` 등은 본 SPEC 범위 밖.
10. **즐겨찾기 그룹/태그** — 사용자가 즐겨찾기를 카테고리로 분류하는 기능은 본 SPEC 범위 밖.
11. **운동 추천 (AI)** — Claude API 기반 추천은 SPEC-AI-RECOMMEND-XXX.
12. **다국어 운동 이름** — 한국어 운동 이름 매핑은 후속 SPEC.
13. **즐겨찾기 동기화 알림** — 다른 디바이스 실시간 동기화(WebSocket)는 본 SPEC 범위 밖.
14. **GraphQL** — 본 SPEC은 REST만 정의.

---

## v1.0.1 변경 요약 (plan-auditor 1차 감사 반영)

- **D1 (Critical)**: REQ-EX-FILTER-003 레이블 `Complex → Event-Driven` (공식 EARS 5종 패턴 준수).
- **D3 (Major)**: REQ-EX-FAV-001 응답 코드 명확화 — 신규 생성 `201 Created`, 멱등 반환 `200 OK`. API 명세 6.3, AC-FAV-ADD-01, AC-FAV-ADD-02 동기화.
- **D4 (Major)**: 라우트 충돌 방지를 EARS 요구사항(REQ-EX-FAV-012)으로 격상. AC-FAV-LIST-04 신설.
- **D5 (Minor)**: REQ-EX-LIST-004, REQ-EX-DETAIL-004 레이블 `Event-Driven → Ubiquitous` (항상 수행되는 응답 필드).
- **D6 (Major)**: AC-IMAGE-02, AC-IMAGE-03을 acceptance.md Section 8a (수동 검증 시나리오)로 분리. DoD 자동화 요구에서 명시적 제외.
- **D9 (Minor)**: REQ-EX-LIST-003에 0개 이미지 시 `images: []` 명시.
- **D10 (Minor)**: NFR-EX-SCALE-003에서 `primaryMuscles` GIN 인덱스 접근 확정 (plan.md 결정 반영).
- **D11 (Minor)**: AC-FILTER-01/02/03 픽스처 수치 하드코딩 제거 — `1건 이상` 유연 조건으로 교체.
- **D13 (Major)**: NFR-EX-SEC-003의 `차단 또는 무시` → `조용히 무시(strip)`로 REQ-EX-FILTER-005와 일관성 확보. `forbidNonWhitelisted: false` 명시.
