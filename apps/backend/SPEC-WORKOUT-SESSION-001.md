---
id: SPEC-WORKOUT-SESSION-001
version: "1.0.0"
status: draft
created_at: "2026-05-12"
updated_at: "2026-05-12"
author: leederic9306
priority: high
issue_number: 0
labels: ["workout", "session", "set-logging", "history", "backend", "mobile"]
---

# SPEC-WORKOUT-SESSION-001: 운동 세션 기록 (Workout Session Recording — MVP)

## HISTORY

- 2026-05-12 v1.0.0 (draft): 초기 작성 (leederic9306). 운동 트래커 앱의 **MVP 세션 기록 시스템**을 EARS 형식으로 정의. 자유 세션(이름 있음/없음) 시작, 운동 도감(SPEC-EXERCISE-001)에서 운동 추가, 세트 기록(reps + weight 또는 duration), 세션 완료/저장, 과거 세션 히스토리 조회·상세 조회를 다룬다. 본 SPEC은 인증(SPEC-AUTH-001)과 운동 도감(SPEC-EXERCISE-001) 위에서 동작한다. **명시적 제외 사항**: 프로그램 기반 세션, 1RM 자동 갱신, 플레이트 계산기, 소셜 공유, AI 추천, 복잡한 통계(주별 볼륨/부위별 빈도 등)는 본 SPEC 범위 밖이며 후속 SPEC에서 다룬다.

---

## REQ 번호 체계 안내 (Numbering Convention)

본 SPEC은 도메인 네임스페이스 기반 REQ 번호 체계를 사용한다: `REQ-WS-MODEL-001`(데이터 모델), `REQ-WS-API-001`(API 엔드포인트), `REQ-WS-MOBILE-001`(모바일 화면), `REQ-WS-VAL-001`(검증·운영 규칙). 이는 본 프로젝트의 표준 컨벤션이며 SPEC-AUTH-001, SPEC-EXERCISE-001, SPEC-1RM-001과 동일한 패턴이다. 각 네임스페이스 내에서 번호는 순차적이고 빠짐없이 부여되며, 평탄한 순차 번호(`REQ-001`, `REQ-002` ...)로 재번호하지 않는다.

`WS` 접두는 "Workout Session"의 축약이며, 기존 SPEC-WORKOUT-001(`WO` 접두, 풀스펙)과의 네임스페이스 충돌을 방지한다.

---

## 1. 개요 (Overview)

운동 트래커 모바일 앱의 **MVP(Minimum Viable Product) 운동 세션 기록 시스템**을 정의한다. 본 SPEC은 SPEC-AUTH-001(JWT 인증)과 SPEC-EXERCISE-001(800+ 운동 도감) 위에서 동작하는 **최소 기록 레이어**로서, 인증된 사용자가:

1. 자유 세션을 시작하고(선택적으로 이름 부여),
2. 운동 도감의 운동을 세션에 추가하고,
3. 각 운동의 세트(`reps` + `weight` 또는 `duration`)를 실시간 기록하고,
4. 세션을 완료하여 DB에 영구 저장하고,
5. 과거 세션 히스토리(목록 + 상세)를 조회할 수 있게 한다.

### 핵심 가치

- **단순한 자유 세션 흐름**: 프로그램·템플릿·AI 추천 없이 순수 자유 세션만 지원. 사용자는 즉흥적으로 세션을 시작하고 운동을 추가하며 기록한다.
- **유연한 세트 입력**: 근력 운동(`weight` + `reps`)과 유산소 운동(`duration` 초 단위) 두 가지 입력 모드를 단일 `WorkoutSet` 모델에서 nullable 필드로 지원한다.
- **단일 진행 세션 원칙**: 사용자당 진행 중(`IN_PROGRESS`) 세션은 1개만 허용한다. UX와 데이터 모델의 단순성을 확보하며, 진행 중 세션 보유 시 새 세션 생성은 `409 Conflict`로 거부된다.
- **완료된 세션은 불변(메모 외)**: 완료(`COMPLETED`) 세션의 세트는 변경 불가. 메모(`notes`)만 사후 편집 가능하다. 데이터 일관성과 기록 신뢰성을 보장한다.
- **사용자 격리 우선**: 모든 엔드포인트는 JWT `sub`로 식별되며, 타 사용자의 세션 접근 시도는 `404 Not Found`로 응답(존재 정보 누설 방지).
- **MVP 범위 명확화**: 1RM 자동 갱신, 플레이트 계산기, 프로그램 기반 세션, 소셜 공유, 통계·집계, AI 추천 등은 본 SPEC에서 **명시적으로 제외**되며 후속 SPEC에서 다룬다(Section 7).

### 범위

본 SPEC은 다음을 포괄한다:

- **Backend (NestJS 10)**: `WorkoutsModule` 신설, `SessionStatus` enum과 `WorkoutSession`/`WorkoutSet` Prisma 모델 신설, 8개 엔드포인트(세션 CRUD 5개 + 세트 CRUD 3개), `Exercise` 모델 역참조(`workoutSets`) 추가.
- **공유 타입 (packages/types)**: `SessionStatus`, `WorkoutSession`, `WorkoutSet`, 요청·응답 DTO 타입 export.
- **Mobile (Expo SDK 51 / React Native)**: Tab 2 "운동 기록" 홈, 활성 세션 화면, 세트 입력 모달, 세션 완료 요약, 히스토리 목록·상세 5개 화면.

본 SPEC은 다음을 **포괄하지 않는다** (Section 7 제외 사항 참조):

- 프로그램·템플릿 기반 세션 시작 — 후속 SPEC-PROGRAM-001 후보.
- 1RM 자동 갱신·PR 감지 — 후속 SPEC-1RM-INTEGRATION-001 후보.
- 플레이트 계산기, 휴식 타이머의 서버 동기화 — 클라이언트 로컬 또는 후속 SPEC.
- 통계·집계(주별 볼륨, 부위별 빈도, 진척도 그래프) — 후속 SPEC-STATS-001 후보.
- 소셜 기능(공유·좋아요·댓글), 외부 export(CSV, Apple Health), AI 분석.

---

## 2. 목표와 비목표 (Goals & Non-Goals)

### 2.1 목표 (Goals)

1. 인증된 사용자가 `POST /workouts`로 자유 세션을 시작할 수 있게 한다(`name`은 선택, 미지정 시 `null`). 응답은 `201 Created`와 함께 생성된 `WorkoutSession`(`status: IN_PROGRESS`, 빈 `sets` 배열) 상세를 반환한다.
2. 사용자당 진행 중 세션(`status: IN_PROGRESS`)은 최대 1개만 존재하도록 보장한다. 진행 중 세션 보유 상태에서 `POST /workouts` 호출 시 `409 Conflict`를 반환한다.
3. 인증된 사용자가 `GET /workouts/active`로 현재 진행 중인 세션을 조회할 수 있게 한다. 진행 중 세션이 없으면 `200 OK`로 `{ active: null }`을 반환한다(404 아님, 멱등 UX).
4. 인증된 사용자가 `POST /workouts/:id/sets`로 세션에 세트를 추가하고, `PATCH /workouts/:id/sets/:setId`로 수정하며, `DELETE /workouts/:id/sets/:setId`로 삭제할 수 있게 한다. 세트 변경은 `status: IN_PROGRESS` 세션에서만 허용된다.
5. 세트는 근력 운동(`weight` + `reps`)과 유산소 운동(`duration` 초 단위) 두 가지 입력 모드를 지원한다. 클라이언트는 운동 카테고리에 따라 적절한 UI를 표시하지만, 서버 모델은 두 필드 모두 nullable로 받아 유연성을 확보한다.
6. 인증된 사용자가 `POST /workouts/:id/complete`로 세션을 완료할 수 있게 한다. 완료 시 `status: COMPLETED`, `completedAt`이 설정되며, 응답은 `200 OK`로 완료된 세션 상세를 반환한다.
7. 인증된 사용자가 `GET /workouts`로 본인 세션 히스토리를 페이지네이션과 함께 조회할 수 있게 한다(필터: `status`, `startedAtFrom`, `startedAtTo`). 응답은 최신 `startedAt` 내림차순으로 정렬되며, 각 항목은 요약 정보(총 세트 수, 총 볼륨 = sum(weight × reps), 총 운동 수, duration 등)를 포함한다.
8. 인증된 사용자가 `GET /workouts/:id`로 본인 세션 상세(모든 `WorkoutSet` + Exercise 표시 정보 포함)를 조회할 수 있게 한다.
9. 인증된 사용자가 `PATCH /workouts/:id`로 세션의 `name`(최대 100자)과 `notes`(최대 1000자)를 수정할 수 있게 한다. `IN_PROGRESS`와 `COMPLETED` 세션 모두 허용된다(기록 보강 목적).
10. 인증된 사용자가 `DELETE /workouts/:id`로 본인 세션을 삭제할 수 있게 한다(세트 cascade 삭제). MVP에서는 `IN_PROGRESS`와 `COMPLETED` 모두 삭제 허용(취소 상태는 도입하지 않음, Section 7 참조).
11. 모든 엔드포인트는 `JwtAuthGuard`로 보호되며, 모든 작업은 JWT의 `sub`(본인 ID)에 한정된다. URL/쿼리/본문에 `userId`를 받지 않는다.
12. 라우트 등록 순서는 고정 경로(`active`)가 동적 경로(`:id`)보다 먼저 정의되어야 한다(REQ-WS-VAL-001, SPEC-EXERCISE-001 REQ-EX-FAV-012 교훈 적용).
13. 모바일 클라이언트는 5개 화면을 제공한다: (a) Tab 2 운동 기록 홈(시작 버튼 + 최근 히스토리), (b) 활성 세션, (c) 세트 입력 모달, (d) 세션 완료 요약, (e) 히스토리 목록 및 상세.

### 2.2 비목표 (Non-Goals)

- 프로그램·템플릿 기반 세션 시작은 본 SPEC 범위 밖이다. 후속 SPEC에서 `programDayId` 파라미터를 추가할 수 있도록 `WorkoutSession.programId`/`programDayId` 필드는 nullable로 예약하지 않으며, 후속 SPEC에서 마이그레이션으로 추가한다(스키마 단순성 유지).
- 1RM 자동 갱신, PR 감지·축하, 운동별 진척도 추적은 본 SPEC 범위 밖이다. 후속 SPEC-1RM-INTEGRATION-001 후보.
- 플레이트 계산기, 휴식 타이머는 본 SPEC 범위 밖이다. 휴식 타이머는 클라이언트 로컬로 처리 가능하므로 본 SPEC에서 다루지 않는다.
- 세션 통계·집계(주별/월별 볼륨, 부위별 빈도, 진척도 그래프)는 본 SPEC 범위 밖이다. 후속 SPEC-STATS-001 후보. 단, `GET /workouts` 응답의 항목별 요약(총 볼륨, 세트 수)은 클라이언트 표시 편의를 위해 제공한다.
- 세션 공유·소셜 기능, 외부 export(CSV, Apple Health, Strava), AI 분석은 본 SPEC 범위 밖이다.
- "취소(`CANCELLED`)" 상태는 본 MVP에서 도입하지 않는다. 단순 삭제(`DELETE /workouts/:id`)로 충분하다. 후속 SPEC에서 데이터 보존 정책이 필요해지면 도입한다.
- 세션의 다중 동시 진행, 일시정지, 세션 병합은 본 SPEC 범위 밖이다(사용자당 진행 1개 원칙).
- 푸시 알림, 운동 누락 리마인더는 본 SPEC 범위 밖이다.
- 세트 단위 메모·태그는 본 SPEC 범위 밖이다(세션 단위 `notes`만 제공).

---

## 3. EARS 요구사항 (Requirements)

### 3.1 REQ-WS-MODEL: 데이터 모델

**REQ-WS-MODEL-001** (Ubiquitous, SessionStatus enum 신설)
시스템은 `SessionStatus` enum을 두 값으로 정의해야 한다: `IN_PROGRESS`(진행 중), `COMPLETED`(완료). 본 MVP에서는 `CANCELLED` 상태를 도입하지 않으며, 후속 SPEC에서 필요 시 마이그레이션으로 추가한다.

**REQ-WS-MODEL-002** (Ubiquitous, WorkoutSession 모델 신설)
시스템은 `WorkoutSession` 모델을 다음 필드로 정의해야 한다:
- `id`: cuid PK.
- `userId`: FK to `User.id`, `onDelete: Cascade`.
- `name`: 선택 텍스트(nullable), 최대 100자(애플리케이션 검증).
- `notes`: 선택 텍스트(nullable), 최대 1000자(애플리케이션 검증).
- `status`: `SessionStatus`, 기본 `IN_PROGRESS`.
- `startedAt`: `DateTime`, 기본 `now()`.
- `completedAt`: `DateTime?` (nullable, 완료 시점 설정).
- `createdAt`: `DateTime`, 기본 `now()`.
- `updatedAt`: `DateTime`, `@updatedAt`.
- 역참조: `sets WorkoutSet[]`.
- 인덱스: `@@index([userId, status])`(진행 중 세션 조회 최적화), `@@index([userId, startedAt(sort: Desc)])`(히스토리 페이지네이션 최적화).

**REQ-WS-MODEL-003** (Ubiquitous, WorkoutSet 모델 신설)
시스템은 `WorkoutSet` 모델을 다음 필드로 정의해야 한다:
- `id`: cuid PK.
- `sessionId`: FK to `WorkoutSession.id`, `onDelete: Cascade`.
- `exerciseId`: FK to `Exercise.id`, `onDelete: Restrict`(`Exercise` 삭제 시 세트 보존, SPEC-EXERCISE-001 정책과 일관).
- `setNumber`: `Int`, 같은 운동 내 1-based 순서, `1 <= setNumber <= 50`.
- `weight`: `Decimal(7, 2)?`(nullable, kg), `0 <= weight <= 1000`. 보디웨이트 운동·유산소 운동에서는 `null`.
- `reps`: `Int?`(nullable), `1 <= reps <= 200`. 유산소 전용 세트에서는 `null`.
- `duration`: `Int?`(nullable, 초 단위), `1 <= duration <= 36000`(10시간 상한). 근력 세트에서는 `null`.
- `restSeconds`: `Int?`(nullable, 휴식 시간, 클라이언트 입력 기반), `0 <= restSeconds <= 3600`.
- `orderIndex`: `Int`, 세션 내 전체 세트의 시간 순서(서비스가 자동 부여).
- `createdAt`: `DateTime`, 기본 `now()`.
- `updatedAt`: `DateTime`, `@updatedAt`.
- 역참조: `session WorkoutSession`, `exercise Exercise`.
- 제약: `@@unique([sessionId, exerciseId, setNumber])`, `@@index([sessionId, orderIndex])`, `@@index([exerciseId])`.

**REQ-WS-MODEL-004** (Ubiquitous, 세트 입력 모드 검증)
시스템은 `WorkoutSet` 저장 시 다음 입력 모드 중 정확히 하나가 만족되도록 검증해야 한다:
- **근력 모드**: `reps != null` AND `reps >= 1`. `weight`는 nullable(보디웨이트 허용). `duration`은 반드시 `null`.
- **유산소 모드**: `duration != null` AND `duration >= 1`. `reps`와 `weight`는 반드시 `null`.

두 모드 모두 만족하지 않거나 둘 다 만족하는 경우 `400 Bad Request`를 반환한다.

**REQ-WS-MODEL-005** (Ubiquitous, User/Exercise 역참조)
시스템은 기존 `User` 모델에 `workoutSessions WorkoutSession[]` 역참조를 추가하고, 기존 `Exercise` 모델에 `workoutSets WorkoutSet[]` 역참조를 추가해야 한다. 다른 필드는 변경하지 않는다.

### 3.2 REQ-WS-API: API 엔드포인트

#### 3.2.1 세션 CRUD

**REQ-WS-API-001** (Event-Driven, 세션 시작)
인증된 사용자가 `POST /workouts` 요청을 본문 `{ name?: string }`와 함께 보냈고 해당 사용자에게 진행 중 세션이 없을 때, 시스템은 `WorkoutSession(userId: JWT.sub, name: <body.name ?? null>, status: IN_PROGRESS, startedAt: now())`을 생성하고 `201 Created`로 세션 상세(`sets` 빈 배열 포함)를 반환해야 한다.

**REQ-WS-API-002** (Event-Driven, 진행 중 세션 충돌)
사용자가 진행 중 세션(`status: IN_PROGRESS`)이 1개 이상 존재하는 상태에서 `POST /workouts`를 호출한 경우, 시스템은 `409 Conflict`를 반환하고 새 세션을 생성해서는 안 된다. 응답 본문에는 기존 진행 중 세션의 `id`를 포함하여 클라이언트가 활성 세션으로 복귀할 수 있게 한다.

**REQ-WS-API-003** (Event-Driven, 진행 중 세션 조회)
인증된 사용자가 `GET /workouts/active` 요청을 보냈을 때, 본인에게 진행 중 세션(`status: IN_PROGRESS`)이 있으면 시스템은 `200 OK`로 `{ active: <세션 상세, sets 포함> }`을 반환해야 한다. 진행 중 세션이 없으면 `200 OK`로 `{ active: null }`을 반환한다(404 아님).

**REQ-WS-API-004** (Event-Driven, 세션 목록 조회)
인증된 사용자가 `GET /workouts?status=&startedAtFrom=&startedAtTo=&page=&limit=` 요청을 보냈을 때, 시스템은 본인 소유 세션을 `startedAt` 내림차순으로 페이지네이션하여 `200 OK`로 반환해야 한다. 각 항목은 `id`, `name`, `status`, `startedAt`, `completedAt`, 그리고 요약 필드 `summary: { totalSets, totalExercises, totalVolume, totalDurationSeconds }`를 포함한다. 응답에는 `{ items, page, limit, total, totalPages }` 메타가 포함된다.

`totalVolume`은 해당 세션의 모든 세트에 대한 `sum(weight × reps)`이며, `weight` 또는 `reps`가 `null`인 세트는 0으로 계산한다. `totalDurationSeconds`는 유산소 세트의 `sum(duration)`이다. 기본값 `page=1`, `limit=20`, 최댓값 `limit=100`.

**REQ-WS-API-005** (Ubiquitous, 필터 검증)
시스템은 `GET /workouts`의 쿼리 파라미터를 다음과 같이 검증해야 한다:
- `status`: 선택, `SessionStatus` enum 중 하나(`IN_PROGRESS` | `COMPLETED`). 미지정 시 모든 상태 반환.
- `startedAtFrom`, `startedAtTo`: 선택, ISO 8601 날짜/시각. 둘 다 제공 시 `from <= to` 검증, 위반 시 `400 Bad Request`.
- `page`: 선택, 정수 1 이상, 기본 1.
- `limit`: 선택, 정수, `1 <= limit <= 100`, 기본 20.

**REQ-WS-API-006** (Event-Driven, 세션 상세 조회)
인증된 사용자가 본인 세션에 대해 `GET /workouts/:id` 요청을 보냈을 때, 시스템은 `200 OK`로 다음 구조를 반환해야 한다:
- 세션 메타: `id`, `userId`, `name`, `notes`, `status`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`.
- 요약: `summary: { totalSets, totalExercises, totalVolume, totalDurationSeconds }`.
- `sets` 배열: 모든 `WorkoutSet`을 `orderIndex` 오름차순으로 정렬. 각 항목은 `id`, `exerciseId`, `setNumber`, `weight`, `reps`, `duration`, `restSeconds`, `orderIndex`, `createdAt`과 운동 표시 정보 `exercise: { id, name, category, primaryMuscles, equipment }`.

**REQ-WS-API-007** (Event-Driven, 세션 메모·이름 수정)
인증된 사용자가 본인 세션에 대해 `PATCH /workouts/:id` 요청을 부분 본문(`name?: string | null`, `notes?: string | null`)과 함께 보냈을 때, 시스템은 해당 필드를 갱신하고 `200 OK`로 갱신된 세션 상세를 반환해야 한다. `PATCH`는 `IN_PROGRESS`와 `COMPLETED` 세션 모두 허용된다(기록 보강 목적). `name`이 `""`(빈 문자열)로 전달된 경우 `null`로 정규화한다.

**REQ-WS-API-008** (Event-Driven, 세션 완료)
인증된 사용자가 본인의 진행 중 세션에 대해 `POST /workouts/:id/complete` 요청을 보냈을 때, 시스템은 해당 세션의 `status`를 `COMPLETED`로 변경하고 `completedAt = now()`를 설정한 후 `200 OK`로 완료된 세션 상세(요약 + sets 포함)를 반환해야 한다.

**REQ-WS-API-009** (Unwanted, 이미 완료된 세션 재완료 금지)
사용자가 이미 `status: COMPLETED`인 세션에 대해 `POST /workouts/:id/complete`를 호출한 경우, 시스템은 해당 요청을 거부하고 `409 Conflict`를 반환해야 한다.

**REQ-WS-API-010** (Event-Driven, 세션 삭제)
인증된 사용자가 본인 세션에 대해 `DELETE /workouts/:id` 요청을 보냈을 때, 시스템은 해당 `WorkoutSession`과 연관된 모든 `WorkoutSet`을 영구 삭제(`onDelete: Cascade`)하고 `204 No Content`를 반환해야 한다. MVP에서는 `IN_PROGRESS`와 `COMPLETED` 상태 모두 삭제 허용한다.

#### 3.2.2 세트 CRUD

**REQ-WS-API-011** (Event-Driven, 세트 추가)
인증된 사용자가 본인의 진행 중(`status: IN_PROGRESS`) 세션에 대해 `POST /workouts/:id/sets` 요청을 본문 `{ exerciseId, setNumber?, weight?, reps?, duration?, restSeconds? }`와 함께 보냈고 입력 모드(REQ-WS-MODEL-004) 검증을 통과했을 때, 시스템은 해당 세션에 `WorkoutSet`을 생성하고 `201 Created`로 생성된 세트 상세(`exercise` 객체 포함)를 반환해야 한다. `orderIndex`는 해당 세션 내 기존 세트의 `max(orderIndex) + 1`로 자동 부여된다.

**REQ-WS-API-012** (Event-Driven, setNumber 자동 추천)
사용자가 `POST /workouts/:id/sets`를 호출할 때 `setNumber`를 생략한 경우, 시스템은 해당 세션 내 같은 `exerciseId`의 최대 `setNumber + 1`을 자동 부여해야 한다. 같은 `exerciseId`의 세트가 없으면 `setNumber = 1`을 부여한다.

**REQ-WS-API-013** (Event-Driven, 세트 수정)
인증된 사용자가 본인의 진행 중 세션 내 세트에 대해 `PATCH /workouts/:id/sets/:setId` 요청을 부분 본문(`weight`, `reps`, `duration`, `restSeconds` 중 일부)과 함께 보냈고 변경 후 입력 모드(REQ-WS-MODEL-004) 검증을 통과했을 때, 시스템은 해당 세트를 수정하고 `200 OK`로 수정된 세트를 반환해야 한다.

**REQ-WS-API-014** (Event-Driven, 세트 삭제)
인증된 사용자가 본인의 진행 중 세션 내 세트에 대해 `DELETE /workouts/:id/sets/:setId` 요청을 보냈을 때, 시스템은 해당 `WorkoutSet`을 영구 삭제하고 `204 No Content`를 반환해야 한다. 삭제 후 남은 세트의 `setNumber`는 자동 재정렬하지 않는다(MVP 단순성).

**REQ-WS-API-015** (Unwanted, 완료된 세션의 세트 변경 금지)
사용자가 `status: COMPLETED` 세션에 대해 `POST /workouts/:id/sets`, `PATCH /workouts/:id/sets/:setId`, `DELETE /workouts/:id/sets/:setId`를 호출한 경우, 시스템은 해당 요청을 거부하고 `409 Conflict`를 반환해야 한다.

**REQ-WS-API-016** (Event-Driven, 세트 중복 방지)
시스템은 `WorkoutSet`을 `(sessionId, exerciseId, setNumber)` 복합 UNIQUE 키로 식별해야 한다(REQ-WS-MODEL-003 제약과 일관). 동일한 세션 내 동일 운동의 동일 `setNumber`로 중복 세트를 추가할 수 없으며, 위반 시 `409 Conflict`를 반환한다.

#### 3.2.3 공통 보안·검증

**REQ-WS-API-017** (Ubiquitous, JwtAuthGuard 보호)
시스템은 본 SPEC의 모든 엔드포인트(`POST /workouts`, `GET /workouts`, `GET /workouts/active`, `GET /workouts/:id`, `PATCH /workouts/:id`, `DELETE /workouts/:id`, `POST /workouts/:id/complete`, `POST /workouts/:id/sets`, `PATCH /workouts/:id/sets/:setId`, `DELETE /workouts/:id/sets/:setId`)를 `JwtAuthGuard`로 보호해야 한다.

**REQ-WS-API-018** (Unwanted, 사용자 격리)
사용자가 본인이 소유하지 않은 세션(`WorkoutSession.userId != JWT.sub`)의 ID로 본 SPEC의 어떠한 엔드포인트(`GET /workouts/:id`, `PATCH /workouts/:id`, `DELETE /workouts/:id`, `POST /workouts/:id/complete`, `POST /workouts/:id/sets`, `PATCH /workouts/:id/sets/:setId`, `DELETE /workouts/:id/sets/:setId`)를 호출한 경우, 시스템은 해당 요청을 거부하고 `404 Not Found`를 반환해야 한다(존재 정보 누설 방지).

**REQ-WS-API-019** (Unwanted, userId 본문 차단)
시스템은 본 SPEC의 모든 본문·쿼리 DTO에 `userId` 필드를 정의해서는 안 되며, 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`로 클라이언트가 임의 `userId`를 전달하는 경우 `400 Bad Request`를 반환해야 한다.

**REQ-WS-API-020** (Event-Driven, exerciseId 무결성)
사용자가 `POST /workouts/:id/sets`를 호출하면서 `exerciseId`가 `Exercise` 테이블에 존재하지 않는 경우, 시스템은 `400 Bad Request`를 반환하고 세트를 생성해서는 안 된다.

### 3.3 REQ-WS-MOBILE: 모바일 화면 요구사항

**REQ-WS-MOBILE-001** (Ubiquitous, Tab 2 운동 기록 홈 화면)
모바일 클라이언트는 하단 탭 두 번째 항목으로 "운동 기록" 홈 화면(`apps/mobile/app/(tabs)/workouts/index.tsx` 또는 동등 경로)을 제공해야 한다. 본 화면은 다음 UI 요소를 포함한다:
- 최상단 "운동 시작" CTA 버튼: 진행 중 세션이 없으면 새 세션 시작 후 활성 세션 화면으로 navigation. 진행 중 세션이 있으면 "운동 이어하기" 라벨로 변경되어 활성 세션 화면으로 navigation.
- 최근 히스토리 섹션: 최근 완료 세션 5건(`GET /workouts?status=COMPLETED&limit=5`)을 카드 리스트로 표시. 각 카드는 세션 이름(없으면 날짜 표시), 시작일, 총 운동 수, 총 세트 수, 총 볼륨(kg)을 표시.
- 빈 상태: 히스토리가 없으면 안내 메시지 표시("아직 기록된 운동이 없습니다. 운동 시작 버튼을 눌러 첫 운동을 시작하세요.").

**REQ-WS-MOBILE-002** (Event-Driven, 활성 세션 화면)
사용자가 활성 세션을 보유한 상태로 진입하거나 신규 세션을 시작했을 때, 모바일 클라이언트는 활성 세션 화면(`apps/mobile/app/workouts/[id].tsx` 또는 활성 세션 전용 라우트)을 표시해야 한다. 본 화면은:
- 헤더: 세션 이름(편집 가능, 미설정 시 "운동 기록 중") + 경과 시간(클라이언트 측 `Date.now() - startedAt` 계산).
- 운동별 그룹 리스트: 동일 `exerciseId`로 추가된 세트를 그룹화하여 표시. 각 그룹은 운동 이름, 부위, 세트 카운트(`{n}세트`)를 헤더에, 세트 행(세트 번호, weight × reps 또는 duration)을 본문에 표시.
- "+ 운동 추가" 버튼: 운동 도감(SPEC-EXERCISE-001 `GET /exercises`)에서 운동을 선택하여 세션에 추가하는 선택 화면으로 navigation. 선택 시 즉시 첫 세트 입력 모달을 띄운다.
- "+ 세트 추가" 버튼(운동 그룹 하단): 해당 운동의 새 세트를 입력하는 모달을 띄운다(`setNumber` 자동 부여).
- 하단 고정 CTA: "세션 완료" 버튼.
- "취소" 옵션(우상단 메뉴): 세션 삭제 후 홈으로 navigation(MVP: `DELETE /workouts/:id` 호출).

**REQ-WS-MOBILE-003** (Ubiquitous, 세트 입력 모달)
모바일 클라이언트는 세트 추가·수정 시 세트 입력 모달을 표시해야 한다. 본 모달은 운동 카테고리(`Exercise.category`)에 따라 두 가지 입력 모드를 표시한다:
- **근력 모드** (카테고리가 `strength`, `powerlifting`, `olympic_weightlifting` 등): 무게(`weight` kg, 보디웨이트는 빈 값 허용) 입력, 횟수(`reps`) 입력, 휴식 시간(`restSeconds`, 선택) 입력.
- **유산소 모드** (카테고리가 `cardio`, `stretching` 등): 지속 시간(`duration` 초 단위 또는 분:초 형식) 입력, 휴식 시간(선택) 입력. `weight`와 `reps` 필드는 표시하지 않는다.
- 저장 버튼: `POST /workouts/:id/sets` 또는 `PATCH /workouts/:id/sets/:setId` 호출 후 모달 닫고 활성 세션 화면 갱신.
- 삭제 버튼(수정 모드에서만): `DELETE /workouts/:id/sets/:setId` 호출 후 확인 다이얼로그 → 모달 닫고 갱신.

**REQ-WS-MOBILE-004** (Event-Driven, 세션 완료 요약 화면)
사용자가 활성 세션 화면에서 "세션 완료" 버튼을 눌렀을 때, 모바일 클라이언트는 `POST /workouts/:id/complete`를 호출하고 응답을 받은 후 세션 완료 요약 화면을 표시해야 한다. 본 화면은:
- 축하 헤더: "운동 완료!" 또는 세션 이름.
- 요약 카드: 총 운동 수, 총 세트 수, 총 볼륨(kg), 총 운동 시간(`completedAt - startedAt`).
- 운동별 상세: 각 운동의 세트 리스트(세트 번호, weight × reps 또는 duration).
- "메모 추가" 입력: 선택, `PATCH /workouts/:id`로 저장.
- 하단 CTA: "확인" 버튼 → Tab 2 홈으로 navigation.

**REQ-WS-MOBILE-005** (Ubiquitous, 히스토리 목록·상세 화면)
모바일 클라이언트는 히스토리 목록 화면(`apps/mobile/app/workouts/history.tsx` 또는 Tab 2 홈에 통합)과 히스토리 상세 화면(`apps/mobile/app/workouts/[id].tsx`의 `COMPLETED` 상태 변형)을 제공해야 한다:
- 목록 화면: 무한 스크롤 또는 페이지네이션(`GET /workouts?status=COMPLETED`)으로 과거 세션을 최신순 표시. 각 항목은 세션 이름(없으면 날짜), 날짜, 요약(운동 수, 세트 수, 총 볼륨).
- 상세 화면: `GET /workouts/:id` 응답을 표시. 세션 이름·날짜·요약 헤더와 운동별 세트 리스트. 메모 편집(`PATCH /workouts/:id`), 세션 삭제(`DELETE /workouts/:id`) 옵션.

**REQ-WS-MOBILE-006** (Ubiquitous, 데이터 페칭·캐시)
모바일 클라이언트는 TanStack Query를 사용하여 `GET /workouts/active`, `GET /workouts`, `GET /workouts/:id`를 캐싱해야 한다. 세션·세트 변경 후(`POST/PATCH/DELETE /workouts*`) `queryClient.invalidateQueries`로 `workouts` 관련 캐시를 무효화하여 UI 일관성을 보장한다.

**REQ-WS-MOBILE-007** (Ubiquitous, optimistic update)
모바일 클라이언트는 세트 추가·수정·삭제 시 optimistic update를 적용하여 네트워크 지연에도 즉시 UI에 반영해야 한다. 서버 오류(`409`, `400`, `500`) 발생 시 rollback하고 사용자에게 토스트 알림을 표시한다.

### 3.4 REQ-WS-VAL: 검증 및 운영 규칙

**REQ-WS-VAL-001** (Event-Driven, 라우트 매칭 검증)
사용자가 `GET /workouts/active`를 호출했을 때, 시스템은 해당 고정 경로 핸들러로 라우팅해야 하며 `:id` 동적 경로(`GET /workouts/:id`)로 라우팅되어서는 안 된다. NestJS 컨트롤러에서 고정 경로(`@Get('active')`)는 반드시 동적 경로(`@Get(':id')`)보다 먼저 등록되어야 한다. SPEC-EXERCISE-001 REQ-EX-FAV-012의 라우트 순서 교훈을 그대로 적용한다. 검증 책임은 plan.md/acceptance.md의 E2E 시나리오 AC-WS-ROUTE-01에 위임한다.

**REQ-WS-VAL-002** (Event-Driven, 비-cuid 형식)
사용자가 `:id` 또는 `:setId`에 비-cuid 형식 문자열(예: 공백, 특수 문자, 잘못된 길이)을 지정한 경우, 시스템은 `404 Not Found`를 반환해야 한다. 별도 `400` 분기는 두지 않으며 일관된 not-found 응답을 채택한다.

**REQ-WS-VAL-003** (Ubiquitous, 전역 ValidationPipe)
시스템은 모든 입력 본문/쿼리 검증을 NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + `class-validator`로 일관되게 수행해야 한다. DTO에 정의되지 않은 필드는 차단되어 `400 Bad Request`를 반환한다. `class-transformer`로 문자열 숫자(`"5"`)는 정수로 자동 변환된다.

**REQ-WS-VAL-004** (Ubiquitous, 시간 일관성)
시스템은 `WorkoutSession.startedAt < completedAt` 시간 일관성을 보장해야 한다. `startedAt`은 생성 시점, `completedAt`은 완료 시점으로 모두 서버 측 `now()`로 자동 설정되며 클라이언트 시계의 영향을 받지 않는다. `PATCH /workouts/:id`는 `startedAt`·`completedAt`을 변경할 수 없다.

**REQ-WS-VAL-005** (Ubiquitous, name·notes 검증)
시스템은 `name`(최대 100자) 및 `notes`(최대 1000자)의 길이를 UTF-8 코드 포인트 기준으로 검증해야 한다(이모지·다국어 문자 포함 정확한 카운트). 위반 시 `400 Bad Request`를 반환한다.

### 3.5 NFR-WS: 비기능 요구사항

#### NFR-WS-PERF: 성능

- **NFR-WS-PERF-001**: `POST /workouts` 응답 시간 P95 ≤ 200ms (진행 세션 체크 + 세션 생성).
- **NFR-WS-PERF-002**: `GET /workouts/active` 응답 시간 P95 ≤ 200ms (단일 인덱스 쿼리 + 세트/Exercise join).
- **NFR-WS-PERF-003**: `GET /workouts/:id` 응답 시간 P95 ≤ 400ms (세션 + 모든 세트 + Exercise join, 일반적 세션 기준 30세트 내).
- **NFR-WS-PERF-004**: `GET /workouts` 목록 응답 시간 P95 ≤ 500ms (페이지네이션 + 사용자별 인덱스 + 요약 집계).
- **NFR-WS-PERF-005**: `POST /workouts/:id/sets`, `PATCH .../sets/:setId`, `DELETE .../sets/:setId` 응답 시간 P95 ≤ 200ms (단일 행 작업).
- **NFR-WS-PERF-006**: `POST /workouts/:id/complete` 응답 시간 P95 ≤ 300ms (상태 전환 + 요약 계산).

#### NFR-WS-SEC: 보안

- **NFR-WS-SEC-001**: 모든 본 SPEC의 엔드포인트는 `JwtAuthGuard`로 보호되며, JWT 누락/만료 시 `401 Unauthorized`를 반환한다.
- **NFR-WS-SEC-002**: 사용자는 본인 세션·세트에만 접근 가능하며, 타 사용자의 세션 조회/수정/삭제 시도는 `404 Not Found`로 응답한다(존재 정보 누설 방지, REQ-WS-API-018).
- **NFR-WS-SEC-003**: 모든 엔드포인트는 JWT payload의 `sub`(userId)만 사용하며, URL/쿼리/본문에 `userId`를 받지 않는다(REQ-WS-API-019).
- **NFR-WS-SEC-004**: 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`로 알 수 없는 필드를 차단한다.
- **NFR-WS-SEC-005**: `name`·`notes` 필드는 자유 텍스트이며 서버는 raw 문자열로 저장한다. React Native는 기본적으로 텍스트 노드로만 렌더링되므로 XSS 위험이 없지만, 향후 웹 클라이언트가 추가될 경우 별도 escape가 필요할 수 있다(본 SPEC 범위 밖).

#### NFR-WS-DATA: 데이터 무결성

- **NFR-WS-DATA-001**: `WorkoutSession.userId` FK는 `User.id`를 참조하며 `onDelete: Cascade`로 설정한다(사용자 하드 삭제 시 자동 정리).
- **NFR-WS-DATA-002**: `WorkoutSet.sessionId` FK는 `WorkoutSession.id`를 참조하며 `onDelete: Cascade`로 설정한다(세션 삭제 시 세트 자동 삭제).
- **NFR-WS-DATA-003**: `WorkoutSet.exerciseId` FK는 `Exercise.id`를 참조하며 `onDelete: Restrict`로 설정한다(SPEC-EXERCISE-001 정책: Exercise 삭제 금지).
- **NFR-WS-DATA-004**: `WorkoutSet(sessionId, exerciseId, setNumber)`는 복합 UNIQUE 제약을 가져야 한다(REQ-WS-MODEL-003, REQ-WS-API-016).
- **NFR-WS-DATA-005**: `WorkoutSession`에 `(userId, status)` 인덱스를 두어 `GET /workouts/active` 쿼리를 최적화한다. 사용자당 진행 1개 제약은 application layer에서 enforced(Prisma는 partial unique index를 직접 지원하지 않음).
- **NFR-WS-DATA-006**: `WorkoutSession`에 `(userId, startedAt DESC)` 인덱스를 두어 `GET /workouts` 목록 페이지네이션을 최적화한다.

#### NFR-WS-MOBILE: 모바일 호환성

- **NFR-WS-MOBILE-001**: 모바일 클라이언트는 REQ-WS-MOBILE-001~005의 5개 화면을 expo-router v3로 구성한다.
- **NFR-WS-MOBILE-002**: TanStack Query 캐싱 전략은 REQ-WS-MOBILE-006 참조.
- **NFR-WS-MOBILE-003**: optimistic update 정책은 REQ-WS-MOBILE-007 참조.
- **NFR-WS-MOBILE-004**: 활성 세션 화면은 백그라운드 진입 후 재진입 시 `GET /workouts/active`로 상태를 재동기화하여 멀티 디바이스 일관성을 유지한다.

#### NFR-WS-CONSISTENCY: 공유 타입 일관성

- **NFR-WS-CONSISTENCY-001**: `packages/types/src/workout-session.ts`(또는 `packages/types/src/index.ts`에 통합)는 다음 타입을 export하며 백엔드 DTO와 모바일 클라이언트가 동일하게 사용한다: `SessionStatus`, `WorkoutSession`, `WorkoutSet`, `WorkoutSessionSummary`, `CreateWorkoutSessionRequest`, `UpdateWorkoutSessionRequest`, `CreateWorkoutSetRequest`, `UpdateWorkoutSetRequest`, `WorkoutSessionListResponse`, `WorkoutSessionDetailResponse`.

---

## 4. 데이터 모델 (Data Model)

본 절은 Prisma 스키마 변경 사항을 정의한다. 기존 `apps/backend/prisma/schema.prisma`의 `User`, `Exercise` 모델에 역참조를 추가하고, `WorkoutSession`, `WorkoutSet` 모델 및 `SessionStatus` enum을 신설한다.

### 4.1 SessionStatus enum (신규)

```prisma
enum SessionStatus {
  IN_PROGRESS  // 진행 중 세션, 세트 추가·수정 가능
  COMPLETED    // 완료된 세션, 메모(name/notes)만 수정 가능
}
```

### 4.2 WorkoutSession 모델 (신규)

```prisma
model WorkoutSession {
  id           String         @id @default(cuid())
  userId       String
  name         String?        // optional session name (max 100 chars, app-validated)
  notes        String?        // free text notes (max 1000 chars, app-validated)
  status       SessionStatus  @default(IN_PROGRESS)
  startedAt    DateTime       @default(now())
  completedAt  DateTime?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  user         User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  sets         WorkoutSet[]

  @@index([userId, status])               // for GET /workouts/active
  @@index([userId, startedAt(sort: Desc)]) // for GET /workouts paginated list
}
```

**설계 결정**:
- 진행 1개 제약은 application layer에서 enforced(NFR-WS-DATA-005).
- `(userId, status)` 인덱스로 진행 중 세션 조회 O(1) 보장.
- `(userId, startedAt DESC)` 인덱스로 히스토리 페이지네이션 최적화.
- `CANCELLED` 상태 미도입(Section 7 제외 사항 참조).

### 4.3 WorkoutSet 모델 (신규)

```prisma
model WorkoutSet {
  id           String          @id @default(cuid())
  sessionId    String
  exerciseId   String
  setNumber    Int             // 1-based within (sessionId, exerciseId)
  weight       Decimal?        @db.Decimal(7, 2)  // kg, nullable for bodyweight/cardio
  reps         Int?            // 1~200, nullable for cardio
  duration     Int?            // seconds, 1~36000 (10h), nullable for strength
  restSeconds  Int?            // 0~3600, optional rest time
  orderIndex   Int             // global display order within session
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  session      WorkoutSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  exercise     Exercise        @relation(fields: [exerciseId], references: [id])

  @@unique([sessionId, exerciseId, setNumber])
  @@index([sessionId, orderIndex])
  @@index([exerciseId])
}
```

**설계 결정**:
- `weight`는 `Decimal(7, 2)` 2자리 소수 정밀도(예: 102.50 kg).
- `reps`와 `duration` 모두 nullable: 근력 세트는 `reps`만, 유산소는 `duration`만 사용. 입력 모드 검증은 REQ-WS-MODEL-004 application layer에서.
- `orderIndex`는 세션 내 전체 세트 시간 순서(여러 운동 교차 수행 시 시간순 표시).
- `setNumber`는 운동별 sequence로 사용자 입력 보조.

### 4.4 User / Exercise 모델 (역참조 추가)

```prisma
model User {
  // ... existing fields (SPEC-AUTH-001 등)
  workoutSessions  WorkoutSession[]
}

model Exercise {
  // ... existing fields (SPEC-EXERCISE-001)
  workoutSets      WorkoutSet[]
}
```

---

## 5. API 명세 (API Specification)

본 절은 본 SPEC이 정의하는 10개 엔드포인트의 요청·응답 구조를 명시한다. 모든 엔드포인트는 `JwtAuthGuard`로 보호되며, 사용자 식별은 JWT `sub`로만 한정된다.

### 5.1 POST /workouts — 세션 시작

**Request Body** (선택):
```json
{ "name": "월요일 가슴 운동" }
```
또는 빈 본문 `{}`(세션은 이름 없이 생성).

**Response 201 Created**:
```json
{
  "id": "clxxxsession1",
  "userId": "clxxxuser1",
  "name": "월요일 가슴 운동",
  "notes": null,
  "status": "IN_PROGRESS",
  "startedAt": "2026-05-12T10:00:00.000Z",
  "completedAt": null,
  "createdAt": "2026-05-12T10:00:00.000Z",
  "updatedAt": "2026-05-12T10:00:00.000Z",
  "summary": { "totalSets": 0, "totalExercises": 0, "totalVolume": 0, "totalDurationSeconds": 0 },
  "sets": []
}
```

**Error Responses**:
- `400 Bad Request`: `name` 길이 초과 또는 `userId` 등 금지 필드 포함.
- `401 Unauthorized`: JWT 누락/만료.
- `409 Conflict`: 진행 중 세션 존재. 응답 본문: `{ "error": "ACTIVE_SESSION_EXISTS", "activeSessionId": "<existing-session-id>" }`.

### 5.2 GET /workouts — 세션 목록

**Query Parameters**:
- `status`: `IN_PROGRESS` | `COMPLETED` (선택).
- `startedAtFrom`, `startedAtTo`: ISO 8601 (선택).
- `page`: 기본 1.
- `limit`: 기본 20, 최대 100.

**Response 200 OK**:
```json
{
  "items": [
    {
      "id": "clxxx1",
      "name": "월요일 가슴 운동",
      "status": "COMPLETED",
      "startedAt": "2026-05-12T10:00:00.000Z",
      "completedAt": "2026-05-12T11:15:00.000Z",
      "summary": { "totalSets": 15, "totalExercises": 4, "totalVolume": 3250.0, "totalDurationSeconds": 0 }
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 47,
  "totalPages": 3
}
```

**Error Responses**:
- `400 Bad Request`: 잘못된 필터(`startedAtFrom > startedAtTo`, 잘못된 enum 등).
- `401 Unauthorized`.

### 5.3 GET /workouts/active — 진행 중 세션

**Response 200 OK (진행 중)**:
```json
{ "active": { "id": "...", "status": "IN_PROGRESS", "sets": [...], "summary": {...}, ... } }
```

**Response 200 OK (진행 없음)**:
```json
{ "active": null }
```

**Error Responses**: `401 Unauthorized`.

### 5.4 GET /workouts/:id — 세션 상세

**Response 200 OK**: REQ-WS-API-006 참조(메타 + summary + sets 배열, sets는 `orderIndex` 오름차순, 각 항목에 `exercise: { id, name, category, primaryMuscles, equipment }` 포함).

**Error Responses**:
- `401 Unauthorized`.
- `404 Not Found`: 존재하지 않거나 본인 소유 아님(REQ-WS-API-018).

### 5.5 PATCH /workouts/:id — 세션 메모·이름 수정

**Request Body** (부분):
```json
{ "name": "다시 부른 이름", "notes": "오늘 컨디션 좋았음" }
```

**Response 200 OK**: 갱신된 세션 상세.

**Error Responses**:
- `400 Bad Request`: `name`/`notes` 길이 초과.
- `401 Unauthorized`.
- `404 Not Found`.

### 5.6 DELETE /workouts/:id — 세션 삭제

**Response 204 No Content**.

**Error Responses**:
- `401 Unauthorized`.
- `404 Not Found`.

### 5.7 POST /workouts/:id/complete — 세션 완료

**Request Body**: 없음.

**Response 200 OK**: 완료된 세션 상세(`status: COMPLETED`, `completedAt` 설정, summary 갱신, sets 포함).

**Error Responses**:
- `401 Unauthorized`.
- `404 Not Found`.
- `409 Conflict`: 이미 `COMPLETED`(REQ-WS-API-009).

### 5.8 POST /workouts/:id/sets — 세트 추가

**Request Body**:
```json
// 근력 세트 (setNumber 자동 부여)
{ "exerciseId": "clxxxbench1", "weight": 60.0, "reps": 10, "restSeconds": 90 }

// 유산소 세트
{ "exerciseId": "clxxxrun1", "duration": 1800, "restSeconds": 0 }

// 보디웨이트 (weight 생략)
{ "exerciseId": "clxxxpushup1", "reps": 15 }
```

**Response 201 Created**: 생성된 세트 상세(`exercise` 객체 포함).

**Error Responses**:
- `400 Bad Request`: 입력 모드 위반(REQ-WS-MODEL-004), `exerciseId` 미존재, 필드 검증 실패.
- `401 Unauthorized`.
- `404 Not Found`: 세션 미존재 또는 본인 소유 아님.
- `409 Conflict`: 세션이 진행 중 아님(REQ-WS-API-015), 또는 `(exerciseId, setNumber)` 중복(REQ-WS-API-016).

### 5.9 PATCH /workouts/:id/sets/:setId — 세트 수정

**Request Body** (부분):
```json
{ "weight": 62.5, "reps": 10 }
```

**Response 200 OK**: 수정된 세트.

**Error Responses**:
- `400 Bad Request`: 입력 모드 위반, 필드 검증 실패.
- `401 Unauthorized`.
- `404 Not Found`: 세션 또는 세트 미존재.
- `409 Conflict`: 세션이 진행 중 아님(REQ-WS-API-015).

### 5.10 DELETE /workouts/:id/sets/:setId — 세트 삭제

**Response 204 No Content**.

**Error Responses**:
- `401 Unauthorized`.
- `404 Not Found`.
- `409 Conflict`: 세션이 진행 중 아님(REQ-WS-API-015).

### 5.11 라우트 등록 순서 (REQ-WS-VAL-001)

`WorkoutsController`(`@Controller('workouts')`)에서 다음 순서를 강제한다(고정 경로가 동적 경로보다 먼저):

```
1.  POST   /workouts                       (collection POST)
2.  GET    /workouts                       (collection GET)
3.  GET    /workouts/active                (static)
4.  GET    /workouts/:id                   (dynamic GET)
5.  PATCH  /workouts/:id                   (dynamic PATCH)
6.  DELETE /workouts/:id                   (dynamic DELETE)
7.  POST   /workouts/:id/complete          (dynamic + static suffix)
8.  POST   /workouts/:id/sets              (dynamic + static suffix)
9.  PATCH  /workouts/:id/sets/:setId       (dynamic + static suffix + dynamic)
10. DELETE /workouts/:id/sets/:setId       (dynamic + static suffix + dynamic)
```

---

## 6. 의존성 (Dependencies)

### 6.1 선행 SPEC

| SPEC | 사용 요소 | 본 SPEC에서의 활용 |
|---|---|---|
| SPEC-AUTH-001 | `JwtAuthGuard`, `@CurrentUser('sub')` 데코레이터 | 모든 엔드포인트 보호, 사용자 식별. |
| SPEC-EXERCISE-001 | `Exercise` 모델 (`id`, `name`, `category`, `primaryMuscles`, `equipment`), 시드된 800+ 운동 | `WorkoutSet.exerciseId` FK, 응답 join, 카테고리 기반 입력 모드 결정. |

### 6.2 의존성 검증 시 확인 사항

- 백엔드: `JwtAuthGuard`가 `apps/backend/src/auth/`에 export되어 있고 정상 동작함.
- 백엔드: `Exercise` 시드 완료(SPEC-EXERCISE-001) — `exerciseId` FK 무결성 보장.
- 백엔드: 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`가 `main.ts`에 활성화되어 있음.
- 공유 타입: `packages/types/src/index.ts`에서 추가 타입 export 시 빌드 통과.
- 모바일: TanStack Query, expo-router v3 설정 완료, Tab 2 라우트 슬롯 확보.

### 6.3 후속 SPEC 후보

본 SPEC이 완료되면 다음 SPEC이 자연스럽게 활성화된다:

- **SPEC-PROGRAM-MVP-001** (가칭): 운동 프로그램·템플릿. `WorkoutSession`에 `programId`/`programDayId` 추가 마이그레이션.
- **SPEC-1RM-INTEGRATION-001** (가칭): 세션 완료 시 컴파운드 운동 1RM 자동 갱신(SPEC-1RM-001 위에).
- **SPEC-STATS-001** (가칭): 주별/월별 볼륨, 부위별 빈도, 진척도 그래프.
- **SPEC-WORKOUT-EXPORT-001** (가칭): CSV/JSON export, Apple Health 연동.

---

## 7. 제외 사항 (Exclusions - What NOT to Build)

본 SPEC에서 **명시적으로 제외하는 항목**은 다음과 같다. MVP 범위 명확화를 위해 모든 항목은 후속 SPEC 또는 영구 비목표로 분류된다.

1. **프로그램·템플릿 기반 세션**: `programId`/`programDayId`를 통한 프로그램 일자 기반 세션 시작은 본 SPEC 범위 밖이다. `WorkoutSession`에 해당 필드를 예약 추가하지 않으며, 후속 SPEC-PROGRAM-MVP-001에서 마이그레이션으로 추가한다.

2. **1RM 자동 갱신·PR 감지**: 세션 완료 시 컴파운드 운동의 추정 1RM을 자동 갱신하거나, 신기록(PR) 감지·축하 메시지·푸시 알림 등은 본 SPEC 범위 밖이다. 후속 SPEC-1RM-INTEGRATION-001 후보.

3. **플레이트 계산기**: 바벨+원판 조합 계산 유틸리티(`GET /workouts/utils/plates`)는 본 SPEC 범위 밖이다. 클라이언트 로컬에서 단순 구현 가능하며 서버 의존 없음.

4. **휴식 타이머 서버 동기화**: 휴식 타이머의 카운트다운·만료 처리는 클라이언트 로컬 상태로만 관리하며 서버에 저장하지 않는다. 본 SPEC은 `restSeconds` 필드만 입력값으로 저장한다.

5. **통계·집계 화면**: 주별/월별 볼륨, 부위별 빈도, 운동별 진척도 그래프, 1RM 타임라인 등은 본 SPEC 범위 밖이다. 후속 SPEC-STATS-001 후보. `GET /workouts` 응답의 항목별 `summary`는 표시 편의 수준의 단순 집계만 제공한다.

6. **소셜 기능**: 세션 공유, 좋아요, 댓글, 팔로우 등은 본 SPEC 및 후속 SPEC에서도 우선순위 낮음(비공개 앱 특성).

7. **외부 export·통합**: CSV/JSON export, Apple Health, Google Fit, Strava, MyFitnessPal 등 외부 서비스 연동은 본 SPEC 범위 밖이다.

8. **AI 기반 분석·추천**: 운동 추천, 폼 분석, 다음 세트 가중치 추천, 부상 위험 경고, 자동 메모 생성 등 AI 기능은 본 SPEC 범위 밖이다.

9. **세션 취소 상태(`CANCELLED`)**: 본 MVP에서는 단순화를 위해 취소 상태를 도입하지 않는다. 진행 중 또는 완료된 세션은 `DELETE /workouts/:id`로 즉시 영구 삭제 가능. 데이터 보존 정책이 필요해지면 후속 SPEC에서 추가.

10. **다중 동시 진행·일시정지**: 사용자당 진행 1개로 제한. 일시정지, 세션 병합, 다중 세션 동시 진행은 본 SPEC 범위 밖이다.

11. **푸시 알림·리마인더**: 휴식 타이머 만료, 운동 누락 리마인더, 친구 운동 알림 등 푸시 알림은 본 SPEC 범위 밖이다.

12. **세션 템플릿**: "이전 세션 복제", "5x5 프리셋" 등 템플릿 기반 세트 자동 입력은 본 SPEC 범위 밖이다.

13. **세트 단위 메모·태그**: `WorkoutSet`에는 자유 텍스트 메모·태그 필드를 두지 않는다(세션 단위 `notes`만 제공). 향후 추가 가능.

14. **운동 강도 자동 추천**: "1RM의 70%로 8reps 권장" 같은 자동 강도 추천은 본 SPEC 범위 밖이다. SPEC-1RM-INTEGRATION-001 또는 AI 후속 SPEC에서 검토.

15. **세트 자동 재정렬**: 세트 삭제 후 남은 세트의 `setNumber` 자동 재정렬은 수행하지 않는다(MVP 단순성). 예: 1,2,3 세트 중 2를 삭제하면 1,3이 남으며 자동 1,2로 재번호하지 않는다.

---

## 8. mx_plan (MX Tag Annotation Targets)

### 8.1 @MX:ANCHOR 대상 (high fan_in 함수)

- `workouts.service.ts :: createSession(userId, dto)`: `POST /workouts`의 단일 진입점. 진행 1개 제약 enforced 단일 지점.
- `workouts.service.ts :: getSessionDetail(sessionId, userId)`: `GET /workouts/:id`와 `GET /workouts/active`가 모두 의존하는 상세 빌더. 권한 검사(`userId` 일치) 단일 지점.
- `workouts.service.ts :: completeSession(sessionId, userId)`: `POST /workouts/:id/complete`의 단일 진입점. 상태 전환 보장.
- `workouts.service.ts :: computeSummary(session)`: `summary` 계산(totalSets, totalExercises, totalVolume, totalDurationSeconds)의 단일 지점. 목록·상세·완료 응답에서 공통 사용.
- `workout-sets.service.ts :: addSet(sessionId, userId, dto)`: `POST /workouts/:id/sets`의 단일 진입점. 진행 상태 검증 + 입력 모드 검증 + 중복 검증 + `setNumber` 자동 추천의 단일 지점.
- `workout-sets.service.ts :: updateSet(sessionId, setId, userId, dto)`: `PATCH /workouts/:id/sets/:setId`의 단일 진입점. 입력 모드 재검증.

### 8.2 @MX:WARN 대상 (danger zone, requires @MX:REASON)

- `workouts.service.ts :: createSession()`: 사용자가 동시에 다중 `POST /workouts`를 호출 시 race condition으로 진행 2개 생성 가능 (REASON: REQ-WS-API-002 진행 1개 제약 — `WorkoutSession.count({ where: { userId, status: IN_PROGRESS } })` 체크와 INSERT 사이 race; serializable 트랜잭션 또는 PG advisory lock 검토 필요).
- `workouts.controller.ts :: route ordering`: 고정 경로(`active`)와 동적 경로(`:id`) 충돌 가능 (REASON: REQ-WS-VAL-001 — SPEC-EXERCISE-001 REQ-EX-FAV-012 교훈 적용. NestJS는 등록 순서대로 매칭하므로 `@Get('active')`가 `@Get(':id')`보다 먼저 정의되어야 함).
- `workout-sets.service.ts :: addSet()`: `setNumber` 자동 추천과 중복 검증 사이 race condition 가능 (REASON: REQ-WS-API-016 `@@unique([sessionId, exerciseId, setNumber])` — 같은 운동 동시 추가 시 unique 위반 가능, 재시도 또는 advisory lock 필요).
- `workout-sets.service.ts :: validateInputMode()`: REQ-WS-MODEL-004의 근력/유산소 입력 모드 배타 검증 (REASON: 수정 시 부분 필드만 전달되므로 기존 값과 병합 후 검증해야 함 — null 처리 실수 시 양쪽 모드 동시 만족 또는 양쪽 모두 미충족 발생 위험).

### 8.3 @MX:NOTE 대상

- `prisma/schema.prisma :: SessionStatus enum`: 2개 값(`IN_PROGRESS`, `COMPLETED`). `CANCELLED`는 본 MVP에서 의도적으로 제외(Section 7).
- `prisma/schema.prisma :: WorkoutSession`: 진행 1개 제약은 application layer enforced(Prisma partial unique index 미지원).
- `prisma/schema.prisma :: WorkoutSet.weight/reps/duration`: nullable 조합 — 근력(reps+optional weight) vs 유산소(duration). 검증은 REQ-WS-MODEL-004.
- `workouts.controller.ts`: 라우트 순서 정책 — collection → static(`active`) → dynamic(`:id`) → dynamic + suffix(`:id/complete`, `:id/sets`) → nested dynamic(`:id/sets/:setId`).
- `packages/types/src/workout-session.ts`: 공유 DTO 타입 — 백엔드 DTO 클래스와 모바일 클라이언트가 동일 인터페이스를 import해야 함(NFR-WS-CONSISTENCY-001).

### 8.4 @MX:TODO 대상 (후속 SPEC에서 해소)

- 프로그램 기반 세션 시작 — SPEC-PROGRAM-MVP-001로 이관.
- 1RM 자동 갱신 — SPEC-1RM-INTEGRATION-001로 이관.
- 통계·집계 화면 — SPEC-STATS-001로 이관.
- 플레이트 계산기 — 클라이언트 로컬 구현 또는 후속 유틸 SPEC.
- 외부 export(CSV, Apple Health) — 후속 SPEC.
- 세션 취소 상태(`CANCELLED`) — 데이터 보존 정책 필요 시점에 후속 SPEC.

---

## 9. 추적성 매트릭스 (Traceability Matrix)

본 매트릭스는 각 REQ를 acceptance.md의 시나리오(예: AC-WS-XXX)와 매핑한다. acceptance.md는 본 SPEC과 함께 작성될 검증 문서이며, MVP 일정상 본 단일 파일에서 시나리오 식별자만 예약한다.

| REQ ID | acceptance.md 시나리오 | 출처 |
|--------|------------------------|------|
| REQ-WS-MODEL-001 | (정적 검사: schema.prisma enum 정의 확인) | 데이터 모델 설계 |
| REQ-WS-MODEL-002 | (정적 검사: schema.prisma `WorkoutSession` 확인) | 데이터 모델 설계 |
| REQ-WS-MODEL-003 | (정적 검사: schema.prisma `WorkoutSet` 확인) + AC-WS-SET-VALIDATION-01 | 데이터 모델 설계 |
| REQ-WS-MODEL-004 | AC-WS-SET-MODE-STRENGTH-01, AC-WS-SET-MODE-CARDIO-01, AC-WS-SET-MODE-INVALID-01 | 입력 모드 배타 검증 |
| REQ-WS-MODEL-005 | (정적 검사: 역참조 컴파일) | Prisma relation 설정 |
| REQ-WS-API-001 | AC-WS-SESSION-CREATE-01 | 사용자 흐름 (세션 시작) |
| REQ-WS-API-002 | AC-WS-SESSION-CONFLICT-01 | 진행 1개 제약 |
| REQ-WS-API-003 | AC-WS-ACTIVE-01, AC-WS-ACTIVE-EMPTY-01 | 활성 세션 조회 |
| REQ-WS-API-004 | AC-WS-LIST-01 | 사용자 흐름 (히스토리) |
| REQ-WS-API-005 | AC-WS-LIST-FILTER-01 | 필터 검증 |
| REQ-WS-API-006 | AC-WS-DETAIL-01 | 사용자 흐름 (상세) |
| REQ-WS-API-007 | AC-WS-PATCH-METADATA-01 | 메모·이름 수정 |
| REQ-WS-API-008 | AC-WS-COMPLETE-01 | 사용자 흐름 (완료) |
| REQ-WS-API-009 | AC-WS-COMPLETE-DOUBLE-01 | 중복 완료 거부 |
| REQ-WS-API-010 | AC-WS-DELETE-01 | 사용자 흐름 (삭제) |
| REQ-WS-API-011 | AC-WS-SET-ADD-01 | 사용자 흐름 (세트 추가) |
| REQ-WS-API-012 | AC-WS-SET-AUTO-NUMBER-01 | setNumber 자동 부여 |
| REQ-WS-API-013 | AC-WS-SET-UPDATE-01 | 사용자 흐름 (세트 수정) |
| REQ-WS-API-014 | AC-WS-SET-DELETE-01 | 사용자 흐름 (세트 삭제) |
| REQ-WS-API-015 | AC-WS-SET-LOCKED-01 | 완료 후 변경 금지 |
| REQ-WS-API-016 | AC-WS-SET-DUPLICATE-01 | 복합 UNIQUE 강제 |
| REQ-WS-API-017 | AC-WS-SECURITY-AUTH-01 | NFR-WS-SEC-001 |
| REQ-WS-API-018 | AC-WS-SECURITY-OWNERSHIP-01 | NFR-WS-SEC-002 |
| REQ-WS-API-019 | AC-WS-SECURITY-VALIDATION-01 | NFR-WS-SEC-003, NFR-WS-SEC-004 |
| REQ-WS-API-020 | AC-WS-SET-VALIDATION-01 | exerciseId 무결성 |
| REQ-WS-MOBILE-001 | MV-WS-MOBILE-HOME-01 (수동 검증) | 사용자 흐름 (홈) |
| REQ-WS-MOBILE-002 | MV-WS-MOBILE-ACTIVE-01 (수동 검증) | 사용자 흐름 (활성 세션) |
| REQ-WS-MOBILE-003 | MV-WS-MOBILE-SET-MODAL-01 (수동 검증) | 세트 입력 UX |
| REQ-WS-MOBILE-004 | MV-WS-MOBILE-COMPLETE-01 (수동 검증) | 완료 요약 |
| REQ-WS-MOBILE-005 | MV-WS-MOBILE-HISTORY-01 (수동 검증) | 히스토리 화면 |
| REQ-WS-MOBILE-006 | MV-WS-MOBILE-CACHE-01 (수동 검증) | TanStack Query |
| REQ-WS-MOBILE-007 | MV-WS-MOBILE-OPTIMISTIC-01 (수동 검증) | optimistic update |
| REQ-WS-VAL-001 | AC-WS-ROUTE-01 | SPEC-EXERCISE-001 교훈 |
| REQ-WS-VAL-002 | AC-WS-DETAIL-NOTFOUND-01 | 일관된 404 |
| REQ-WS-VAL-003 | AC-WS-SECURITY-VALIDATION-01 | ValidationPipe 표준 |
| REQ-WS-VAL-004 | AC-WS-COMPLETE-01 | 시간 일관성 |
| REQ-WS-VAL-005 | AC-WS-PATCH-METADATA-01 | 길이 검증 |
| NFR-WS-PERF-001~006 | AC-WS-PERF-01 (부하 테스트) | 성능 SLO |
| NFR-WS-SEC-001~005 | AC-WS-SECURITY-AUTH-01, AC-WS-SECURITY-OWNERSHIP-01, AC-WS-SECURITY-VALIDATION-01 | OWASP A01/A02 |
| NFR-WS-DATA-001~006 | AC-WS-SESSION-CREATE-01, AC-WS-SET-DUPLICATE-01, AC-WS-DELETE-01 | 데이터 무결성 |
| NFR-WS-MOBILE-001~004 | MV-WS-MOBILE-* (수동 검증) | 모바일 UX |
| NFR-WS-CONSISTENCY-001 | (정적 검사: TypeScript 빌드 통과) | 공유 타입 |

---

## 10. 핵심 acceptance 시나리오 (요약, Given-When-Then)

본 SPEC은 단일 파일로 작성되었으므로 acceptance.md를 별도 분리하지 않고, 본 절에서 핵심 시나리오를 Given-When-Then 형식으로 요약 제공한다. 후속 plan.md/acceptance.md에서 본 시나리오를 E2E 테스트로 구현한다.

### AC-WS-SESSION-CREATE-01: 자유 세션 시작
- **Given**: 인증된 사용자(JWT 유효)에게 진행 중 세션이 없다.
- **When**: 사용자가 `POST /workouts {"name": "월요일 가슴 운동"}`을 호출한다.
- **Then**: 응답 코드는 `201 Created`이며, 본문에는 `id`, `userId = JWT.sub`, `name = "월요일 가슴 운동"`, `status = "IN_PROGRESS"`, `startedAt`이 설정되고 `sets: []`, `summary.totalSets = 0`이 포함된다.

### AC-WS-SESSION-CONFLICT-01: 진행 중 세션 보유 시 신규 세션 거부
- **Given**: 사용자가 진행 중(`IN_PROGRESS`) 세션 1개를 보유한다.
- **When**: 사용자가 `POST /workouts`를 다시 호출한다.
- **Then**: 응답 코드는 `409 Conflict`이며, 본문에 `{ error: "ACTIVE_SESSION_EXISTS", activeSessionId: <existing-id> }`가 포함되고, DB에는 진행 중 세션이 여전히 1개만 존재한다.

### AC-WS-ACTIVE-01 / AC-WS-ACTIVE-EMPTY-01: 활성 세션 조회 멱등성
- **Given (A)**: 사용자가 진행 중 세션 1개를 보유한다.
- **When (A)**: 사용자가 `GET /workouts/active`를 호출한다.
- **Then (A)**: 응답 코드는 `200 OK`이며, `{ active: { ... sets: [...] } }`을 반환한다.
- **Given (B)**: 사용자가 진행 중 세션을 보유하지 않는다.
- **When (B)**: 사용자가 `GET /workouts/active`를 호출한다.
- **Then (B)**: 응답 코드는 `200 OK`이며, `{ active: null }`을 반환한다(404 아님).

### AC-WS-SET-ADD-01: 근력 세트 추가
- **Given**: 사용자가 진행 중 세션을 보유하고, `Exercise.id = ex-bench-1`이 시드되어 있다.
- **When**: 사용자가 `POST /workouts/:id/sets {"exerciseId": "ex-bench-1", "weight": 60.0, "reps": 10}`을 호출한다.
- **Then**: 응답 코드는 `201 Created`이며, `setNumber = 1`(자동 부여), `weight = 60.0`, `reps = 10`, `duration = null`, `orderIndex = 1`이 반환되고, 세션의 `summary.totalSets`가 1로 갱신된다.

### AC-WS-SET-MODE-CARDIO-01: 유산소 세트 추가
- **Given**: 사용자가 진행 중 세션을 보유한다.
- **When**: 사용자가 `POST /workouts/:id/sets {"exerciseId": "ex-run-1", "duration": 1800}`을 호출한다.
- **Then**: 응답 코드는 `201 Created`이며, `duration = 1800`, `weight = null`, `reps = null`이 저장된다.

### AC-WS-SET-MODE-INVALID-01: 입력 모드 위반
- **Given**: 사용자가 진행 중 세션을 보유한다.
- **When**: 사용자가 `POST /workouts/:id/sets {"exerciseId": "ex-x-1", "weight": 60.0, "reps": 10, "duration": 1800}`을 호출한다(`reps`와 `duration` 동시).
- **Then**: 응답 코드는 `400 Bad Request`이며, 세트는 생성되지 않는다.

### AC-WS-SET-DUPLICATE-01: 세트 중복 거부
- **Given**: 사용자가 진행 중 세션을 보유하고, `(exerciseId: ex-1, setNumber: 1)`인 세트가 이미 존재한다.
- **When**: 사용자가 `POST /workouts/:id/sets {"exerciseId": "ex-1", "setNumber": 1, "reps": 10}`을 호출한다.
- **Then**: 응답 코드는 `409 Conflict`이며, DB에 중복 세트가 생성되지 않는다.

### AC-WS-SET-LOCKED-01: 완료된 세션의 세트 변경 금지
- **Given**: 사용자가 `status: COMPLETED` 세션을 보유한다.
- **When**: 사용자가 `POST /workouts/:id/sets`, `PATCH /workouts/:id/sets/:setId`, `DELETE /workouts/:id/sets/:setId` 중 하나를 호출한다.
- **Then**: 응답 코드는 각각 `409 Conflict`이며, 세트는 변경되지 않는다.

### AC-WS-COMPLETE-01: 세션 완료
- **Given**: 사용자가 진행 중 세션을 보유하고 세트 3개를 기록했다.
- **When**: 사용자가 `POST /workouts/:id/complete`를 호출한다.
- **Then**: 응답 코드는 `200 OK`이며, `status = "COMPLETED"`, `completedAt`이 `startedAt`보다 이후로 설정되고, `summary.totalSets = 3`을 포함한 응답이 반환된다.

### AC-WS-COMPLETE-DOUBLE-01: 이미 완료된 세션 재완료 거부
- **Given**: 사용자가 `status: COMPLETED` 세션을 보유한다.
- **When**: 사용자가 `POST /workouts/:id/complete`를 호출한다.
- **Then**: 응답 코드는 `409 Conflict`이며, `completedAt`은 변경되지 않는다.

### AC-WS-LIST-01: 히스토리 목록 페이지네이션
- **Given**: 사용자가 25개의 `COMPLETED` 세션을 보유한다.
- **When**: 사용자가 `GET /workouts?status=COMPLETED&page=1&limit=20`을 호출한다.
- **Then**: 응답 코드는 `200 OK`이며, `items.length = 20`, `page = 1`, `limit = 20`, `total = 25`, `totalPages = 2`이고, `items`는 `startedAt` 내림차순으로 정렬되며 각 항목에 `summary`가 포함된다.

### AC-WS-DETAIL-01: 세션 상세 조회
- **Given**: 사용자가 본인의 세션을 보유하며 세트 5개(2개 운동)를 가진다.
- **When**: 사용자가 `GET /workouts/:id`를 호출한다.
- **Then**: 응답 코드는 `200 OK`이며, 세션 메타·summary·sets 배열이 반환되고, `sets`는 `orderIndex` 오름차순이며 각 항목에 `exercise` 객체(name, category, primaryMuscles, equipment)가 포함된다.

### AC-WS-SECURITY-OWNERSHIP-01: 사용자 격리
- **Given**: 사용자 A가 세션 S를 보유하고, 사용자 B가 다른 사용자로 인증된다.
- **When**: 사용자 B가 `GET /workouts/S`, `PATCH /workouts/S`, `DELETE /workouts/S`, `POST /workouts/S/complete`, `POST /workouts/S/sets`, `PATCH /workouts/S/sets/setId`, `DELETE /workouts/S/sets/setId` 중 하나를 호출한다.
- **Then**: 모든 응답 코드는 `404 Not Found`이며(403 아님 — 존재 정보 누설 방지), 세션 S는 변경되지 않는다.

### AC-WS-SECURITY-AUTH-01: 인증 누락
- **Given**: 사용자가 JWT를 제공하지 않거나 만료된 JWT를 제공한다.
- **When**: 사용자가 본 SPEC의 어떤 엔드포인트라도 호출한다.
- **Then**: 응답 코드는 `401 Unauthorized`이며, 어떤 작업도 수행되지 않는다.

### AC-WS-SECURITY-VALIDATION-01: 비-whitelisted 필드 차단
- **Given**: 사용자가 진행 중 세션을 보유한다.
- **When**: 사용자가 `POST /workouts {"name": "test", "userId": "attempted-spoof"}` 또는 `POST /workouts/:id/sets {"exerciseId": "x", "reps": 10, "userId": "spoof"}`를 호출한다.
- **Then**: 응답 코드는 `400 Bad Request`(전역 `ValidationPipe forbidNonWhitelisted`)이며, 세션·세트는 생성되지 않는다.

### AC-WS-ROUTE-01: 라우트 순서 검증
- **Given**: 사용자가 인증되어 있다.
- **When**: 사용자가 `GET /workouts/active`를 호출한다.
- **Then**: 응답 코드는 `200 OK`이며 `{ active: ... | null }` 구조를 반환한다. `GET /workouts/:id`의 `:id = "active"`로 라우팅되어 `404`를 반환해서는 안 된다.

### AC-WS-DETAIL-NOTFOUND-01: 비-cuid id 일관된 404
- **Given**: 사용자가 인증되어 있다.
- **When**: 사용자가 `GET /workouts/!!invalid-cuid!!`를 호출한다.
- **Then**: 응답 코드는 `404 Not Found`이며(400 아님), 일관된 not-found 응답을 반환한다.

### AC-WS-DELETE-01: 세션 삭제 (cascade)
- **Given**: 사용자가 본인 세션(`IN_PROGRESS` 또는 `COMPLETED`)을 보유하고 세트 5개를 가진다.
- **When**: 사용자가 `DELETE /workouts/:id`를 호출한다.
- **Then**: 응답 코드는 `204 No Content`이며, `WorkoutSession`과 연관된 5개 `WorkoutSet`이 모두 DB에서 삭제된다.

상기 시나리오 외 NFR(성능 SLO, 모바일 UX) 검증은 부하 테스트 도구(k6, autocannon) 및 수동 디바이스 테스트로 별도 수행하며, plan.md에서 상세 절차를 정의한다.

---

**문서 끝.**
