---
id: SPEC-WORKOUT-001
version: "1.0.0"
status: draft
created_at: "2026-05-12"
updated_at: "2026-05-12"
author: leederic9306
priority: high
issue_number: 0
labels: ["workout", "session", "backend", "mobile"]
---

# SPEC-WORKOUT-001: 운동 세션 기록 (Workout Session Logging)

## HISTORY

- 2026-05-12 v1.0.0 (draft): 초기 작성 (leederic9306). 근력 운동 트래커 앱의 운동 세션(Workout Session) 기록 시스템을 EARS 형식으로 정의. 자유 세션 또는 활성 프로그램 기반 세션 시작, 운동별 세트 추가/수정/삭제, 세션 완료·취소, 사용자별 세션 조회·수정·삭제, 바벨+원판 조합 계산 유틸리티, 그리고 세션 완료 시점의 1RM 자동 갱신 통합을 다룬다. SPEC-AUTH-001(인증/RBAC), SPEC-EXERCISE-001(800+ 운동 도감), SPEC-1RM-001(`CompoundType` enum + Epley/Brzycki 공식), SPEC-PROGRAM-001(활성 프로그램 + `ProgramDay`/`ProgramExercise`) 위에서 동작한다. Phase 3의 마지막 SPEC으로 운동 트래커 앱의 기록·진행도 추적 레이어를 완성한다.

---

## REQ 번호 체계 안내 (Numbering Convention)

본 SPEC은 도메인 네임스페이스 기반 REQ 번호 체계를 사용한다: `REQ-WO-SESSION-001`(세션 생명주기), `REQ-WO-SET-001`(세트 기록), `REQ-WO-COMPLETE-001`(완료·취소), `REQ-WO-QUERY-001`(조회), `REQ-WO-PLATES-001`(플레이트 계산기), `REQ-WO-1RM-001`(1RM 자동 갱신), `REQ-WO-VAL-001`(검증·운영 규칙). 이는 본 프로젝트의 표준 컨벤션이며 SPEC-AUTH-001, SPEC-USER-001, SPEC-EXERCISE-001, SPEC-1RM-001, SPEC-PROGRAM-001과 동일한 패턴이다. 각 네임스페이스 내에서 번호는 순차적이고 빠짐없이 부여되며, 네임스페이스 분리로 도메인 단위의 추적성과 가독성을 확보한다. 평탄한 순차 번호(`REQ-001`, `REQ-002` ...)로 재번호하지 않는다.

---

## 1. 개요 (Overview)

근력 운동 트래커 앱의 **운동 세션(Workout Session) 기록 시스템**을 정의한다. 본 SPEC은 SPEC-AUTH-001(인증/RBAC), SPEC-EXERCISE-001(운동 도감), SPEC-1RM-001(1RM 관리), SPEC-PROGRAM-001(운동 프로그램) 위에서 동작하는 **운동 기록·진행도 추적 레이어**로서, 인증된 사용자가 자유 세션 또는 활성 프로그램의 특정 일(`ProgramDay`) 기반 세션을 시작하고, 운동별 세트(weight, reps, rpe)를 실시간으로 기록하며, 세션을 완료/취소하고, 과거 세션을 조회·관리할 수 있게 한다. 세션 완료 시점에는 컴파운드 세트 기준으로 1RM 추정값을 계산하여 상향 갱신만 적용한다(SPEC-1RM-001 `OneRepMax` 테이블 연동).

### 핵심 가치

- **유연한 세션 시작**: 자유 세션(`exerciseIds` 직접 지정)과 프로그램 기반 세션(`programDayId` 지정) 두 가지 진입점을 제공하여, 카탈로그/AI 프로그램을 따르는 사용자와 즉흥 운동을 하는 사용자 모두를 지원한다.
- **단일 진행 세션 원칙**: 사용자당 진행 중(`IN_PROGRESS`) 세션은 1개만 허용(애플리케이션 레이어 enforced)하여 데이터 모델과 UX의 단순성을 확보한다. 진행 중 세션이 있을 때 새 세션 생성 시도는 `409 Conflict`로 거부된다.
- **실시간 세트 기록**: 운동 중 세트를 즉시 추가/수정/삭제할 수 있으며 각 세트는 weight(보디웨이트 운동은 `null`), reps, rpe(1~10, 선택), `isCompleted` 마킹을 지원한다. 세션은 `IN_PROGRESS` 상태에서만 세트 변경 가능.
- **완료 vs 취소 명확한 분리**: 완료(`COMPLETED`)는 기록 보존 대상이며 영구 삭제 불가, 취소(`CANCELLED`)는 사용자가 의도적으로 중단한 세션으로 삭제 허용. 데이터 보존 정책의 명료성.
- **1RM 자동 상향 갱신**: 세션 완료 시 5종 컴파운드 운동(SPEC-1RM-001의 `CompoundType`에 대응하는 `Exercise.id`)에서 완료 세트의 Epley/Brzycki 평균 추정 1RM이 기존 `OneRepMax.value`보다 높을 때만 갱신한다(하향 갱신 없음). 이는 best-effort fire-and-forget 비동기 작업으로 세션 완료 응답을 차단하지 않는다.
- **플레이트 계산기**: 사용자가 목표 무게를 입력하면 바벨 + 좌우 대칭 원판 조합(1.25/2.5/5/10/15/20 kg)을 계산하여 운동 중 빠른 보조를 제공한다. DB 의존 없는 순수 계산 유틸.

### 범위

본 SPEC은 백엔드(NestJS 10) 측 `WorkoutsModule` 신설, Prisma 스키마의 `SessionStatus` enum 및 `WorkoutSession`, `WorkoutSet` 모델 신설, 12개 엔드포인트(세션 CRUD 6개 + 세트 CRUD 3개 + 완료/취소 2개 + 플레이트 계산기 1개), `Exercise` 모델 역참조(`workoutSets`) 추가, 모바일 클라이언트의 세션 시작/진행/상세/히스토리 4개 화면을 포괄한다.

다음 항목은 본 SPEC 범위에서 명시적으로 제외된다 (Section 7 참조):
- 세션 통계·집계 화면(주별/월별 볼륨, 부위별 빈도 등) — 후속 SPEC-STATS-001 후보.
- 세션 공유·소셜 기능 — 비공개 앱 특성상 우선순위 낮음.
- 세션 기록의 외부 export(CSV, Apple Health, Strava 연동 등).
- 휴식 타이머의 서버 측 동기화(클라이언트 로컬 상태로 처리).
- AI 기반 세션 분석/피드백(다음 SPEC-AI-001 이후).

---

## 2. 목표와 비목표 (Goals & Non-Goals)

### 2.1 목표 (Goals)

1. 인증된 사용자가 `POST /workouts`로 자유 세션(`exerciseIds: string[]`) 또는 활성 프로그램 기반 세션(`programDayId: string`) 중 하나를 시작할 수 있게 한다. 응답은 `201 Created`와 함께 생성된 `WorkoutSession`(`status: IN_PROGRESS`) 상세를 반환한다.
2. 사용자당 진행 중 세션(`status: IN_PROGRESS`)은 최대 1개만 존재하도록 보장한다. 진행 중 세션이 있는 상태에서 `POST /workouts`를 호출하면 `409 Conflict`를 반환한다.
3. 인증된 사용자가 `GET /workouts/active`로 현재 진행 중인 세션을 조회할 수 있게 한다. 진행 중 세션이 없으면 `200 OK`로 `{ active: null }`을 반환한다(404 아님, 멱등 UX).
4. 인증된 사용자가 `POST /workouts/:id/sets`로 세션에 세트를 추가하고, `PATCH /workouts/:id/sets/:setId`로 수정하며, `DELETE /workouts/:id/sets/:setId`로 삭제할 수 있게 한다. 세트 변경은 `status: IN_PROGRESS` 세션에서만 허용된다.
5. 인증된 사용자가 `POST /workouts/:id/complete`로 세션을 완료하고, `POST /workouts/:id/cancel`로 취소할 수 있게 한다. 완료 시 `status: COMPLETED`, `completedAt`이 설정되며, 취소 시 `status: CANCELLED`, `cancelledAt`이 설정된다.
6. 세션 완료 시점에 시스템은 완료 세트의 컴파운드 운동(`Exercise.id`가 SPEC-1RM-001 `CompoundType`에 대응되는 5종)에 대해 Epley/Brzycki 평균 추정 1RM을 계산하고, 기존 `OneRepMax.value`보다 추정치가 높을 때만 갱신한다(하향 갱신 없음). 본 작업은 best-effort 비동기 처리로 세션 완료 응답(`200 OK` 또는 `201 Created`)을 차단하지 않는다.
7. 인증된 사용자가 `GET /workouts`로 본인 세션 목록을 페이지네이션과 함께 조회할 수 있게 한다(필터: `status`, `startedAtFrom`, `startedAtTo`). 응답은 최신 `startedAt` 내림차순으로 정렬된다.
8. 인증된 사용자가 `GET /workouts/:id`로 본인 세션 상세(모든 `WorkoutSet` 포함)를 조회할 수 있게 한다.
9. 인증된 사용자가 `PATCH /workouts/:id`로 세션의 `notes`(자유 텍스트, 최대 1000자)를 수정할 수 있게 한다. `COMPLETED` 세션도 메모 수정만은 허용한다(기록 보강 목적).
10. 인증된 사용자가 `DELETE /workouts/:id`로 `CANCELLED` 상태의 세션을 영구 삭제할 수 있게 한다. `COMPLETED` 세션은 기록 보존을 위해 삭제 불가(`409 Conflict`).
11. 인증된 사용자가 `GET /workouts/utils/plates?weight=100&barWeight=20`로 바벨+원판 조합을 계산할 수 있게 한다. DB 의존 없는 순수 계산이며 `JwtAuthGuard`로만 보호된다(인증 필요).
12. 모든 엔드포인트는 `JwtAuthGuard`로 보호되며, 모든 작업은 JWT의 `sub`(본인 ID)에 한정된다. URL/쿼리/본문에 `userId`를 받지 않는다(NFR-WO-SEC-003).
13. 라우트 등록 순서는 고정 경로(`active`, `utils/plates`)가 동적 경로(`:id`)보다 먼저 정의되어야 한다(REQ-WO-VAL-001, SPEC-EXERCISE-001 REQ-EX-FAV-012 / SPEC-PROGRAM-001 REQ-PROG-VAL-001 교훈 적용).
14. 모바일 클라이언트는 세션 시작 화면, 세션 진행 화면(세트 기록 + 휴식 타이머 + 완료/취소), 세션 상세/완료 화면, 세션 히스토리 화면의 4개 화면을 제공한다.

### 2.2 비목표 (Non-Goals)

- 세션 통계·집계(주별/월별 볼륨, 부위별 빈도, 1RM 진척도 그래프 등)는 본 SPEC 범위 밖이다. 후속 SPEC-STATS-001(가칭) 후보.
- 휴식 타이머의 서버 측 상태 관리는 본 SPEC 범위 밖이다. 클라이언트 로컬 타이머로 충분하며 서버는 세트의 `completedAt` 타임스탬프만 기록한다.
- 세션의 사용자 간 공유, 좋아요, 댓글 등 소셜 기능은 본 SPEC 범위 밖이다(비공개 앱 특성).
- 외부 export(CSV, Apple Health, Google Fit, Strava 연동 등)는 본 SPEC 범위 밖이다.
- AI 기반 세션 분석·피드백(폼 분석, 다음 세트 가중치 추천 등)은 본 SPEC 범위 밖이다.
- 세션의 다중 동시 진행(예: A 세션 일시정지 후 B 세션 시작)은 본 SPEC 범위 밖이다. 사용자당 진행 1개로 단순화.
- 세션의 푸시 알림(휴식 타이머 알림, 운동 누락 리마인더 등)은 본 SPEC 범위 밖이다.
- 운동별 PR(Personal Record) 자동 감지·축하 메시지는 본 SPEC 범위 밖이다. 1RM 자동 갱신만 다룬다.
- 세션 데이터의 백업/복원(파일 export, iCloud/Google Drive 등)은 본 SPEC 범위 밖이다.
- 다국어 세션 콘텐츠(메모의 자동 번역 등)는 본 SPEC 범위 밖이다.
- 1RM 자동 갱신의 실시간 사용자 알림(예: "PR 달성!" 토스트)은 클라이언트 측 비교로 처리하며 서버 푸시는 본 SPEC 범위 밖이다.

---

## 3. EARS 요구사항 (Requirements)

### 3.1 REQ-WO-SESSION: 세션 생성 및 관리

**REQ-WO-SESSION-001** (Event-Driven, 자유 세션 생성)
인증된 사용자가 `POST /workouts` 요청을 본문 `{ exerciseIds: string[] }`와 함께 보냈고 해당 사용자에게 진행 중 세션이 없을 때, 시스템은 `WorkoutSession(userId: JWT.sub, status: IN_PROGRESS, programId: null, programDayId: null, startedAt: now())`을 생성하고 `201 Created`로 세션 상세(`WorkoutSet`은 빈 배열)를 반환해야 한다.

**REQ-WO-SESSION-002** (Event-Driven, 프로그램 기반 세션 생성)
인증된 사용자가 `POST /workouts` 요청을 본문 `{ programDayId: string }`와 함께 보냈고 해당 사용자에게 진행 중 세션이 없으며 `programDayId`가 본인의 활성 프로그램(`UserProgram.programId`)에 속한 `ProgramDay`일 때, 시스템은 `WorkoutSession(userId: JWT.sub, status: IN_PROGRESS, programId: <UserProgram.programId>, programDayId: <programDayId>, startedAt: now())`을 생성하고 `201 Created`로 세션 상세를 반환해야 한다.

**REQ-WO-SESSION-003** (Event-Driven, 진행 중 세션 충돌)
사용자가 진행 중 세션(`WorkoutSession.status = IN_PROGRESS`)이 1개 이상 존재하는 상태에서 `POST /workouts`를 호출한 경우, 시스템은 `409 Conflict`를 반환하고 새 세션을 생성해서는 안 된다.

**REQ-WO-SESSION-004** (Event-Driven, 잘못된 프로그램 일 참조)
사용자가 `POST /workouts`를 `{ programDayId }`로 호출했으나 해당 `programDayId`가 존재하지 않거나 본인의 활성 `UserProgram.programId`에 속하지 않는 경우, 시스템은 `400 Bad Request`를 반환하고 세션을 생성해서는 안 된다.

**REQ-WO-SESSION-005** (Event-Driven, 빈 입력)
사용자가 `POST /workouts`를 본문 없이 또는 `{ exerciseIds: [] }` / `{ programDayId: null, exerciseIds: null }`로 호출한 경우, 시스템은 `400 Bad Request`를 반환해야 한다. `exerciseIds`와 `programDayId`는 동시에 제공될 수 없으며(상호 배타), 둘 다 제공된 경우 `400 Bad Request`를 반환한다.

**REQ-WO-SESSION-006** (Ubiquitous, 자유 세션 운동 검증)
시스템은 `POST /workouts` 본문의 `exerciseIds` 각 항목이 `Exercise` 테이블에 존재함을 검증해야 한다. 하나라도 존재하지 않으면 `400 Bad Request`를 반환하고 세션을 생성해서는 안 된다.

**REQ-WO-SESSION-007** (Ubiquitous)
시스템은 모든 세션 관련 엔드포인트(`POST /workouts`, `GET /workouts`, `GET /workouts/active`, `GET /workouts/:id`, `PATCH /workouts/:id`, `DELETE /workouts/:id`, `POST /workouts/:id/complete`, `POST /workouts/:id/cancel`)를 `JwtAuthGuard`로 보호해야 한다.

**REQ-WO-SESSION-008** (Unwanted, 사용자 격리)
사용자가 본인이 소유하지 않은 세션(`WorkoutSession.userId != JWT.sub`)의 ID로 `GET /workouts/:id`, `PATCH /workouts/:id`, `DELETE /workouts/:id`, `POST /workouts/:id/complete`, `POST /workouts/:id/cancel`, `POST /workouts/:id/sets`, `PATCH /workouts/:id/sets/:setId`, `DELETE /workouts/:id/sets/:setId`를 호출한 경우, 시스템은 해당 요청을 거부하고 `404 Not Found`를 반환해야 한다(존재 정보 누설 방지).

### 3.2 REQ-WO-SET: 세트 기록

**REQ-WO-SET-001** (Event-Driven, 세트 추가)
인증된 사용자가 진행 중(`status: IN_PROGRESS`) 세션에 대해 `POST /workouts/:id/sets` 요청을 본문 `{ exerciseId, setNumber, weight?, reps, rpe?, isCompleted? }`와 함께 보냈을 때, 시스템은 해당 세션에 `WorkoutSet`을 생성하고 `201 Created`로 생성된 세트를 반환해야 한다.

**REQ-WO-SET-002** (Ubiquitous, 세트 식별)
시스템은 `WorkoutSet`을 `(sessionId, exerciseId, setNumber)` 복합 UNIQUE 키로 식별해야 한다. 동일한 세션 내 동일 운동의 동일 `setNumber`로 중복 세트를 추가할 수 없으며, 위반 시 `409 Conflict`를 반환한다.

**REQ-WO-SET-003** (Ubiquitous, 세트 필드 정의)
시스템은 `WorkoutSet`의 각 필드를 다음 제약으로 검증해야 한다:
- `exerciseId`: 필수, `Exercise.id`에 실존해야 함.
- `setNumber`: 필수, 정수, `1 <= setNumber <= 50`.
- `weight`: 선택(nullable, 보디웨이트 운동 지원), `Decimal` 2자리, `0 <= weight <= 1000` (kg).
- `reps`: 필수, 정수, `1 <= reps <= 200`.
- `rpe`: 선택(nullable), 정수, `1 <= rpe <= 10`.
- `isCompleted`: 선택(기본 `false`), boolean.
- `completedAt`: `isCompleted = true`일 때 시스템이 자동 설정(`now()`).
- `orderIndex`: 정수, 세션 내 세트 표시 순서(서비스가 자동 부여).

**REQ-WO-SET-004** (Event-Driven, 세트 수정)
인증된 사용자가 진행 중 세션 내 본인 세트에 대해 `PATCH /workouts/:id/sets/:setId` 요청을 부분 필드 본문(`weight`, `reps`, `rpe`, `isCompleted` 중 일부)과 함께 보냈을 때, 시스템은 해당 세트를 수정하고 `200 OK`로 수정된 세트를 반환해야 한다. `isCompleted`가 `false → true`로 변경된 경우 `completedAt = now()`를 설정하고, `true → false`로 변경된 경우 `completedAt = null`로 초기화한다.

**REQ-WO-SET-005** (Event-Driven, 세트 삭제)
인증된 사용자가 진행 중 세션 내 본인 세트에 대해 `DELETE /workouts/:id/sets/:setId` 요청을 보냈을 때, 시스템은 해당 `WorkoutSet`을 영구 삭제하고 `204 No Content`를 반환해야 한다.

**REQ-WO-SET-006** (Unwanted, 완료된 세션의 세트 변경 금지)
사용자가 `status: COMPLETED` 또는 `status: CANCELLED` 세션에 대해 `POST /workouts/:id/sets`, `PATCH /workouts/:id/sets/:setId`, `DELETE /workouts/:id/sets/:setId`를 호출한 경우, 시스템은 해당 요청을 거부하고 `409 Conflict`를 반환해야 한다.

**REQ-WO-SET-007** (Event-Driven, 존재하지 않는 세트)
사용자가 세션에 존재하지 않는 `setId`로 `PATCH /workouts/:id/sets/:setId` 또는 `DELETE /workouts/:id/sets/:setId`를 호출한 경우, 시스템은 `404 Not Found`를 반환해야 한다.

**REQ-WO-SET-008** (Event-Driven, setNumber 자동 추천)
사용자가 `POST /workouts/:id/sets`를 호출할 때 `setNumber`를 생략한 경우, 시스템은 해당 세션 내 같은 `exerciseId`의 최대 `setNumber` + 1을 자동 부여해야 한다. 같은 `exerciseId`의 세트가 없으면 `setNumber = 1`을 부여한다.

### 3.3 REQ-WO-COMPLETE: 세션 완료/취소

**REQ-WO-COMPLETE-001** (Event-Driven, 세션 완료)
인증된 사용자가 본인의 진행 중 세션에 대해 `POST /workouts/:id/complete` 요청을 보냈을 때, 시스템은 해당 세션의 `status`를 `COMPLETED`로 변경하고 `completedAt = now()`를 설정한 후 `200 OK`로 완료된 세션 상세를 반환해야 한다.

**REQ-WO-COMPLETE-002** (Event-Driven, 세션 취소)
인증된 사용자가 본인의 진행 중 세션에 대해 `POST /workouts/:id/cancel` 요청을 보냈을 때, 시스템은 해당 세션의 `status`를 `CANCELLED`로 변경하고 `cancelledAt = now()`를 설정한 후 `200 OK`로 취소된 세션 상세를 반환해야 한다.

**REQ-WO-COMPLETE-003** (Unwanted, 이미 종료된 세션)
사용자가 이미 `COMPLETED` 또는 `CANCELLED` 상태인 세션에 대해 `POST /workouts/:id/complete` 또는 `POST /workouts/:id/cancel`을 호출한 경우, 시스템은 해당 요청을 거부하고 `409 Conflict`를 반환해야 한다.

**REQ-WO-COMPLETE-004** (Event-Driven, 빈 세션 완료)
사용자가 `WorkoutSet`이 0건이거나 모든 세트의 `isCompleted = false`인 세션에 대해 `POST /workouts/:id/complete`를 호출한 경우, 시스템은 세션을 정상적으로 `COMPLETED` 처리해야 한다(빈 세션 완료 허용). 단, 1RM 자동 갱신은 완료된 세트가 없으므로 트리거되지 않는다(REQ-WO-1RM-002).

**REQ-WO-COMPLETE-005** (Event-Driven, 세션 삭제)
인증된 사용자가 본인의 `CANCELLED` 상태 세션에 대해 `DELETE /workouts/:id`를 호출한 경우, 시스템은 해당 세션과 연관된 모든 `WorkoutSet`을 영구 삭제(`onDelete: Cascade`)하고 `204 No Content`를 반환해야 한다.

**REQ-WO-COMPLETE-006** (Unwanted, COMPLETED 삭제 금지)
사용자가 `status: COMPLETED` 세션에 대해 `DELETE /workouts/:id`를 호출한 경우, 시스템은 해당 요청을 거부하고 `409 Conflict`를 반환해야 한다(기록 보존 정책).

**REQ-WO-COMPLETE-007** (Event-Driven, IN_PROGRESS 삭제 금지)
사용자가 `status: IN_PROGRESS` 세션에 대해 `DELETE /workouts/:id`를 호출한 경우, 시스템은 `409 Conflict`를 반환하고 사용자에게 먼저 `POST /workouts/:id/cancel`을 호출하도록 안내해야 한다.

**REQ-WO-COMPLETE-008** (Event-Driven, 메모 수정)
인증된 사용자가 본인 세션에 대해 `PATCH /workouts/:id` 요청을 본문 `{ notes: string }`(최대 1000자)와 함께 보냈을 때, 시스템은 해당 세션의 `notes`를 갱신하고 `200 OK`로 갱신된 세션 상세를 반환해야 한다. `PATCH /workouts/:id`는 `status`에 관계없이(IN_PROGRESS, COMPLETED, CANCELLED 모두) 허용된다(기록 보강 목적).

### 3.4 REQ-WO-QUERY: 세션 조회

**REQ-WO-QUERY-001** (Event-Driven, 목록 조회)
인증된 사용자가 `GET /workouts?status=&startedAtFrom=&startedAtTo=&page=&limit=` 요청을 보냈을 때, 시스템은 본인 소유 세션(`WorkoutSession.userId = JWT.sub`)을 `startedAt` 내림차순으로 페이지네이션하여 `200 OK`로 반환해야 한다.

**REQ-WO-QUERY-002** (Ubiquitous, 페이지네이션 메타)
시스템은 `GET /workouts` 응답에 다음 페이지네이션 메타를 포함해야 한다: `{ items, page, limit, total, totalPages }`. 기본값은 `page=1`, `limit=20`, 최댓값은 `limit=100`.

**REQ-WO-QUERY-003** (Ubiquitous, 필터 검증)
시스템은 `GET /workouts`의 쿼리 파라미터를 다음과 같이 검증해야 한다:
- `status`: 선택, `SessionStatus` enum 중 하나(`IN_PROGRESS` | `COMPLETED` | `CANCELLED`). 미지정 시 모든 상태 반환.
- `startedAtFrom`, `startedAtTo`: 선택, ISO 8601 날짜/시각. 둘 다 제공 시 `from <= to` 검증, 위반 시 `400 Bad Request`.
- `page`: 선택, 정수 1 이상, 기본 1.
- `limit`: 선택, 정수, `1 <= limit <= 100`, 기본 20.

**REQ-WO-QUERY-004** (Event-Driven, 진행 중 세션 조회)
인증된 사용자가 `GET /workouts/active` 요청을 보냈을 때, 본인에게 진행 중 세션(`status: IN_PROGRESS`)이 있으면 시스템은 `200 OK`로 `{ active: <세션 상세, REQ-WO-QUERY-006 구조와 동일> }`을 반환해야 한다.

**REQ-WO-QUERY-005** (Event-Driven, 활성 세션 부재)
사용자에게 진행 중 세션이 없는 상태에서 `GET /workouts/active`를 호출한 경우, 시스템은 `200 OK`로 `{ active: null }`을 반환해야 한다(404 아님).

**REQ-WO-QUERY-006** (Event-Driven, 세션 상세 조회)
인증된 사용자가 본인 세션에 대해 `GET /workouts/:id` 요청을 보냈을 때, 시스템은 다음 구조로 `200 OK` 응답을 반환해야 한다:
- 세션 메타: `id`, `userId`, `programId`, `programDayId`, `status`, `notes`, `startedAt`, `completedAt`, `cancelledAt`, `createdAt`, `updatedAt`.
- `sets` 배열: 모든 `WorkoutSet`을 `orderIndex` 오름차순으로 정렬. 각 항목은 `id`, `exerciseId`, `setNumber`, `weight`, `reps`, `rpe`, `isCompleted`, `completedAt`, `orderIndex`, 그리고 운동 표시 정보 `exercise`(`name`, `primaryMuscles`, `image`).

**REQ-WO-QUERY-007** (Event-Driven, 존재하지 않거나 타 사용자 세션)
사용자가 존재하지 않는 `:id` 또는 본인이 소유하지 않은 세션의 `:id`로 `GET /workouts/:id`를 호출한 경우, 시스템은 `404 Not Found`를 반환해야 한다(존재 정보 누설 방지).

**REQ-WO-QUERY-008** (Ubiquitous, 응답 정렬)
시스템은 `GET /workouts`의 `items` 배열을 `startedAt` 내림차순으로, `GET /workouts/:id`의 `sets` 배열을 `orderIndex` 오름차순으로 정렬하여 반환해야 한다.

### 3.5 REQ-WO-PLATES: 플레이트 계산기

**REQ-WO-PLATES-001** (Event-Driven)
인증된 사용자가 `GET /workouts/utils/plates?weight=<W>&barWeight=<B>` 요청을 보냈을 때, 시스템은 목표 무게 `W`에서 바벨 무게 `B`를 뺀 후 좌우 절반에 표준 원판(1.25/2.5/5/10/15/20 kg)을 큰 순서대로 탐욕적(greedy)으로 채워 조합한 결과를 `200 OK`로 반환해야 한다. 응답 구조는 `{ totalWeight, barWeight, plates: [{ weight: 20, count: 2 }, ...], perSide: [{ weight: 20, count: 1 }, ...], remainder: 0.0 }`이며 `plates`는 양측 합계, `perSide`는 한쪽 표시용이다.

**REQ-WO-PLATES-002** (Ubiquitous, 입력 검증)
시스템은 다음 입력 제약을 검증해야 한다:
- `weight`: 필수, 양의 실수, `0 < weight <= 1000` (kg).
- `barWeight`: 선택, 기본 `20` (kg), 허용값 `{ 15, 20 }`.
- `weight >= barWeight` 검증, 위반 시 `400 Bad Request`.
- `weight - barWeight`이 음수이거나 표준 원판 조합으로 표현 불가능한 경우(나머지 발생), 가능한 최대 조합을 반환하고 `remainder` 필드에 잔여 무게(kg)를 명시한다.

**REQ-WO-PLATES-003** (Ubiquitous, 좌우 대칭)
시스템은 `plates[*].count`를 항상 짝수로 반환해야 한다(좌우 대칭). 홀수 원판은 사용하지 않으며, 표현 불가능한 잔여는 `remainder`로 처리한다.

**REQ-WO-PLATES-004** (Ubiquitous)
시스템은 `GET /workouts/utils/plates` 엔드포인트를 `JwtAuthGuard`로 보호해야 한다. 본 엔드포인트는 DB 의존 없는 순수 계산이지만 비공개 앱 정책상 인증을 요구한다.

**REQ-WO-PLATES-005** (Ubiquitous, 결정성)
시스템은 동일한 입력(`weight`, `barWeight`)에 대해 항상 동일한 응답을 반환해야 한다(결정적 알고리즘). 시간/사용자/세션 상태에 의존하지 않는다.

### 3.6 REQ-WO-1RM: 1RM 자동 갱신

**REQ-WO-1RM-001** (Event-Driven, 1RM 갱신 트리거)
사용자가 `POST /workouts/:id/complete`로 세션을 완료한 경우, 시스템은 완료된 세트(`isCompleted = true`) 중 컴파운드 운동(`Exercise.id`가 `CompoundType` enum(`SQUAT` | `DEADLIFT` | `BENCH_PRESS` | `BARBELL_ROW` | `OVERHEAD_PRESS`)에 매핑된 5종)에 해당하는 항목에 대해 1RM 추정·갱신 작업을 트리거해야 한다. 본 작업은 best-effort 비동기 처리이며 세션 완료 응답을 차단해서는 안 된다.

**REQ-WO-1RM-002** (Ubiquitous, 추정 대상 세트 필터링)
시스템은 1RM 추정 계산 시 다음 조건을 모두 만족하는 세트만 사용해야 한다:
- `isCompleted = true`
- `weight != null` AND `weight > 0`
- `reps >= 1`
- `exerciseId`가 `CompoundType` 매핑 5종 중 하나에 해당

조건 미달 세트는 추정 대상에서 제외되며, 완료된 컴파운드 세트가 0건인 경우 1RM 갱신은 트리거되지 않는다.

**REQ-WO-1RM-003** (Ubiquitous, 추정 공식)
시스템은 각 컴파운드 운동별로 다음 알고리즘으로 1RM 추정값을 계산해야 한다:
1. 해당 컴파운드의 모든 적격 세트(REQ-WO-1RM-002)에 대해 `weight * (1 + reps/30)` (Epley)와 `weight * (36 / (37 - reps))` (Brzycki)를 각각 계산.
2. 각 세트별 두 공식의 평균(`(epley + brzycki) / 2`)을 계산.
3. 모든 세트의 평균값 중 최댓값을 해당 컴파운드의 추정 1RM으로 채택.
4. 추정값은 소수 둘째 자리에서 반올림.

본 공식은 SPEC-1RM-001의 `packages/utils/src/1rm.ts` 구현을 공유한다(NFR-WO-CONSISTENCY-001).

**REQ-WO-1RM-004** (Event-Driven, 상향 갱신만)
컴파운드별 추정 1RM이 계산된 후, 시스템은 기존 `OneRepMax(userId, exerciseType)` 레코드의 `value`보다 추정치가 **높을 때만** `upsert`로 갱신해야 한다. 기존 값보다 낮거나 같은 경우 갱신하지 않는다(하향 갱신 금지). 기존 레코드가 없는 경우 신규 생성한다.

**REQ-WO-1RM-005** (Ubiquitous, 갱신 시 source 표기)
시스템은 1RM 자동 갱신 시 `OneRepMax.source`를 `AVERAGE_ESTIMATE`(Epley+Brzycki 평균)로 설정해야 한다(SPEC-1RM-001 `OrmSource` enum 사용).

**REQ-WO-1RM-006** (Unwanted, 트랜잭션 격리)
세션 완료 트랜잭션과 1RM 갱신 트랜잭션은 분리되어야 한다. 1RM 갱신 작업의 실패(예: DB 오류, 추정 함수 예외)는 세션 완료의 성공 응답을 변경하거나 세션 상태를 롤백해서는 안 된다. 1RM 갱신 실패는 서버 로그에만 기록한다.

**REQ-WO-1RM-007** (Ubiquitous, exerciseId ↔ CompoundType 매핑)
시스템은 `Exercise.id`와 `CompoundType` 간 매핑을 백엔드 내부의 정적 매핑 테이블(`COMPOUND_EXERCISE_MAP`) 또는 `Exercise` 테이블에 추가되는 식별 필드(plan.md에서 결정)로 관리해야 한다. 매핑되지 않은 운동은 1RM 자동 갱신 대상이 아니다.

### 3.7 REQ-WO-VAL: 검증 및 운영 규칙

**REQ-WO-VAL-001** (Event-Driven, 라우트 매칭 검증)
사용자가 `GET /workouts/active`, `GET /workouts/utils/plates`를 호출했을 때, 시스템은 해당 고정 경로 핸들러로 라우팅해야 하며 `:id` 동적 경로로 라우팅되어서는 안 된다. 고정 경로는 반드시 동적 경로보다 컨트롤러에서 먼저 등록되어야 한다(구체 구현 가이드는 plan.md에 위임 — SPEC-EXERCISE-001 REQ-EX-FAV-012 / SPEC-PROGRAM-001 REQ-PROG-VAL-001 교훈 적용).

**REQ-WO-VAL-002** (Event-Driven, 비-cuid 형식)
사용자가 `:id` 또는 `:setId`에 비-cuid 형식 문자열(공백, 잘못된 문자 패턴)을 지정한 경우, 시스템은 `404 Not Found`를 반환해야 한다(별도 `400` 분기는 두지 않으며 일관된 not-found 응답을 채택한다).

**REQ-WO-VAL-003** (Ubiquitous, 전역 ValidationPipe)
시스템은 모든 입력 본문/쿼리 검증을 NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + `class-validator`로 일관되게 수행해야 한다. DTO에 정의되지 않은 필드는 차단되어 `400 Bad Request`를 반환한다.

**REQ-WO-VAL-004** (Ubiquitous, 본 SPEC에서 정의되는 enum/형식)
시스템은 다음 enum/형식을 일관되게 사용해야 한다:
- `SessionStatus`: `IN_PROGRESS` | `COMPLETED` | `CANCELLED`
- `notes`: 자유 텍스트, 최대 1000자(UTF-8 코드 포인트 기준).
- `WorkoutSet.weight`: `Decimal(7, 2)` (최대 99999.99 kg이나 검증으로 1000 제한).

**REQ-WO-VAL-005** (Ubiquitous, 시간 일관성)
시스템은 세션의 `startedAt < completedAt`, `startedAt < cancelledAt` 시간 일관성을 보장해야 한다. 세션 완료/취소 시점이 시작 시점보다 빠를 수 없으며, 서버 측 `now()`로 자동 설정되므로 클라이언트 시계 왜곡의 영향을 받지 않는다.

### 3.8 NFR-WO: 비기능 요구사항

#### NFR-WO-PERF: 성능

- **NFR-WO-PERF-001**: `POST /workouts` 응답 시간 P95 ≤ 300ms (진행 세션 체크 + 세션 생성 + 활성 프로그램 검증).
- **NFR-WO-PERF-002**: `GET /workouts/active` 응답 시간 P95 ≤ 200ms (단일 인덱스 쿼리 + 세트/Exercise join).
- **NFR-WO-PERF-003**: `GET /workouts/:id` 응답 시간 P95 ≤ 400ms (세션 + 모든 세트 + Exercise join).
- **NFR-WO-PERF-004**: `GET /workouts` 목록 응답 시간 P95 ≤ 500ms (페이지네이션 + 사용자별 인덱스).
- **NFR-WO-PERF-005**: `POST /workouts/:id/sets`, `PATCH .../sets/:setId`, `DELETE .../sets/:setId` 응답 시간 P95 ≤ 200ms (단일 행 작업).
- **NFR-WO-PERF-006**: `POST /workouts/:id/complete`, `POST /workouts/:id/cancel` 응답 시간 P95 ≤ 300ms (1RM 갱신은 비동기 분리).
- **NFR-WO-PERF-007**: `GET /workouts/utils/plates` 응답 시간 P95 ≤ 50ms (순수 계산, DB 의존 없음).
- **NFR-WO-PERF-008**: 1RM 자동 갱신 비동기 작업은 세션 완료 응답 이후 1초 이내에 완료되어야 한다(최대 5개 컴파운드, 최대 50세트 기준).

#### NFR-WO-SEC: 보안

- **NFR-WO-SEC-001**: 모든 본 SPEC의 엔드포인트는 `JwtAuthGuard`로 보호되며, JWT 누락/만료 시 `401 Unauthorized`를 반환한다.
- **NFR-WO-SEC-002**: 사용자는 본인 세션·세트에만 접근 가능하며, 타 사용자의 세션 조회/수정/삭제 시도는 `404 Not Found`로 응답한다(존재 정보 누설 방지, REQ-WO-SESSION-008).
- **NFR-WO-SEC-003**: 모든 엔드포인트는 JWT payload의 `sub`(userId)만 사용하며, URL/쿼리/본문에 `userId`를 받지 않는다.
- **NFR-WO-SEC-004**: NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`로 알 수 없는 필드를 차단한다.
- **NFR-WO-SEC-005**: `notes` 필드는 자유 텍스트이며 서버는 raw 문자열로 저장하지만, 응답 시 XSS 방어는 모바일 클라이언트의 렌더링 책임이다(react-native는 기본적으로 텍스트 노드로만 렌더링되어 XSS 위험 없음).

#### NFR-WO-DATA: 데이터 무결성

- **NFR-WO-DATA-001**: `WorkoutSession.userId` FK는 `User.id`를 참조하며 `onDelete: Cascade`로 설정한다(사용자 하드 삭제 시 자동 정리).
- **NFR-WO-DATA-002**: `WorkoutSession.programId`, `WorkoutSession.programDayId` FK는 `Program.id`, `ProgramDay.id`를 참조하며 `onDelete: SetNull`로 설정한다(프로그램 삭제 시 세션은 보존하되 참조만 끊는다).
- **NFR-WO-DATA-003**: `WorkoutSet.sessionId` FK는 `WorkoutSession.id`를 참조하며 `onDelete: Cascade`로 설정한다(세션 삭제 시 세트 자동 삭제).
- **NFR-WO-DATA-004**: `WorkoutSet.exerciseId` FK는 `Exercise.id`를 참조하며 `onDelete: Restrict`(또는 기본)로 설정한다(`Exercise` 삭제는 운영 정책상 금지, SPEC-EXERCISE-001).
- **NFR-WO-DATA-005**: `WorkoutSet(sessionId, exerciseId, setNumber)`는 복합 UNIQUE 제약을 가져야 한다(REQ-WO-SET-002).
- **NFR-WO-DATA-006**: `WorkoutSession`에 `(userId, status)` 인덱스를 두어 `GET /workouts/active` 쿼리를 최적화한다. 사용자당 진행 1개 제한은 application layer에서 enforced(Prisma partial unique index 직접 지원 부재).
- **NFR-WO-DATA-007**: `WorkoutSession`에 `(userId, startedAt DESC)` 인덱스를 두어 `GET /workouts` 목록 페이지네이션 쿼리를 최적화한다.

#### NFR-WO-MOBILE: 모바일 호환성

- **NFR-WO-MOBILE-001**: 모바일 클라이언트는 4개 화면을 제공해야 한다 — 세션 시작(활성 프로그램의 `ProgramDay` 선택 또는 자유 운동 선택), 세션 진행(운동별 세트 입력 + 휴식 타이머 + 완료/취소), 세션 상세/완료 후 요약, 세션 히스토리(페이지네이션).
- **NFR-WO-MOBILE-002**: 모바일 클라이언트는 TanStack Query로 `GET /workouts/active`, `GET /workouts`, `GET /workouts/:id`를 캐싱하며, 세션 변경 후(`POST/PATCH/DELETE /workouts*`) `queryClient.invalidateQueries`로 캐시를 무효화한다.
- **NFR-WO-MOBILE-003**: 세션 진행 화면에서 세트 추가/수정/삭제는 optimistic update를 적용하여 네트워크 지연에도 즉시 UI에 반영되어야 한다(서버 오류 시 rollback).
- **NFR-WO-MOBILE-004**: 휴식 타이머는 클라이언트 로컬 상태로 처리하며 서버에 저장하지 않는다. 사용자가 앱을 종료하면 타이머는 초기화된다.
- **NFR-WO-MOBILE-005**: 플레이트 계산기는 세션 진행 화면 내 모달 또는 별도 탭으로 제공하며 운동 중 빠른 접근이 가능해야 한다.

#### NFR-WO-CONSISTENCY: 공유 타입 일관성

- **NFR-WO-CONSISTENCY-001**: 1RM 추정 계산은 SPEC-1RM-001의 `packages/utils/src/1rm.ts` 구현(Epley, Brzycki, Average)을 백엔드 1RM 자동 갱신 로직에서 동일하게 참조한다. 별도 구현하지 않는다.
- **NFR-WO-CONSISTENCY-002**: `packages/types/src/workout.ts`는 `SessionStatus`, `WorkoutSession`, `WorkoutSet`, `CreateWorkoutSessionRequest`, `CreateWorkoutSetRequest`, `UpdateWorkoutSetRequest`, `WorkoutSessionListResponse`, `PlateCalculationResponse` 타입을 export하며 백엔드 DTO와 호환된다.

---

## 4. 데이터 모델 (Data Model)

본 절은 Prisma 스키마 변경 사항을 정의한다. 기존 `prisma/schema.prisma`의 `User`, `Exercise`, `Program`, `ProgramDay` 모델에 역참조를 추가하고, `WorkoutSession`, `WorkoutSet` 모델 및 `SessionStatus` enum을 신설한다.

### 4.1 SessionStatus enum (신규)

```prisma
enum SessionStatus {
  IN_PROGRESS  // active session being recorded
  COMPLETED    // finished session, immutable except for notes
  CANCELLED    // user-cancelled session, deletable
}
```

### 4.2 WorkoutSession 모델 (신규)

```prisma
model WorkoutSession {
  id            String         @id @default(cuid())
  userId        String
  programId     String?        // null for free sessions
  programDayId  String?        // null for free sessions
  status        SessionStatus  @default(IN_PROGRESS)
  notes         String?        // free text, max 1000 chars (app-layer validated)
  startedAt     DateTime       @default(now())
  completedAt   DateTime?
  cancelledAt   DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  program       Program?       @relation(fields: [programId], references: [id], onDelete: SetNull)
  programDay    ProgramDay?    @relation(fields: [programDayId], references: [id], onDelete: SetNull)
  sets          WorkoutSet[]

  @@index([userId, status])              // for GET /workouts/active and IN_PROGRESS lookup
  @@index([userId, startedAt(sort: Desc)]) // for GET /workouts paginated list
}
```

**설계 결정**:
- `@@unique([userId, status])`로 진행 1개 제한을 강제하지 않는다. Prisma는 partial unique index를 직접 지원하지 않으므로, 진행 1개 제약은 application layer에서 `status: IN_PROGRESS` 카운트 체크로 enforced한다(REQ-WO-SESSION-003, NFR-WO-DATA-006).
- `(userId, status)` 인덱스로 진행 중 세션 조회 O(1) 보장.
- `(userId, startedAt DESC)` 인덱스로 목록 페이지네이션 최적화.
- `programId`/`programDayId`는 `SetNull` cascade로 프로그램 삭제 시 세션 보존(기록 보호).

### 4.3 WorkoutSet 모델 (신규)

```prisma
model WorkoutSet {
  id           String          @id @default(cuid())
  sessionId    String
  exerciseId   String
  setNumber    Int             // 1-based within (sessionId, exerciseId)
  weight       Decimal?        @db.Decimal(7, 2)  // kg, nullable for bodyweight
  reps         Int             // 1~200
  rpe          Int?            // 1~10, nullable
  isCompleted  Boolean         @default(false)
  completedAt  DateTime?
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
- `weight`는 `Decimal(7, 2)`로 저장 — 2자리 소수 정밀도(예: 102.50 kg), 최대 99999.99 kg(검증으로 1000 제한).
- `weight` nullable 허용으로 보디웨이트 운동(풀업, 푸시업, 딥스 등) 지원.
- `rpe` nullable로 RPE를 기록하지 않는 사용자 지원.
- `isCompleted` + `completedAt` 분리: 세트는 "기록만 함"(예: 워밍업 세트)과 "실제 완료"를 구분.
- `orderIndex`는 세션 내 전체 세트 표시 순서(여러 운동을 교차로 수행할 때 시간 순서 유지).
- `setNumber`는 (운동별 sequence)로 사용자 입력 보조.

### 4.4 User / Exercise / Program / ProgramDay 모델 (역참조 추가)

```prisma
model User {
  // ... existing fields (SPEC-AUTH-001, SPEC-USER-001, SPEC-1RM-001, SPEC-PROGRAM-001)
  workoutSessions   WorkoutSession[]
}

model Exercise {
  // ... existing fields (SPEC-EXERCISE-001)
  workoutSets       WorkoutSet[]
}

model Program {
  // ... existing fields (SPEC-PROGRAM-001)
  workoutSessions   WorkoutSession[]
}

model ProgramDay {
  // ... existing fields (SPEC-PROGRAM-001)
  workoutSessions   WorkoutSession[]
}
```

### 4.5 컴파운드 운동 매핑 (REQ-WO-1RM-007)

`Exercise.id`와 `CompoundType` 간 매핑은 다음 두 방안 중 plan.md에서 결정한다:

**옵션 A**: 백엔드 내부 정적 매핑 테이블(`apps/backend/src/workouts/compound-exercise.map.ts`) — `Exercise` 시드 시 5종 컴파운드 운동의 `Exercise.id`(또는 `slug`)를 상수로 매핑.

**옵션 B**: `Exercise` 모델에 `compoundType: CompoundType?` 컬럼 추가 — DB 레벨 매핑.

선택 사유는 plan.md에서 다룬다. 본 SPEC은 매핑 존재만 요구하며 구체 구현 방식은 plan.md에 위임한다.

---

## 5. API 명세 (API Specification)

본 절은 본 SPEC이 정의하는 12개 엔드포인트의 요청·응답 구조를 명시한다. 모든 엔드포인트는 `JwtAuthGuard`로 보호된다.

### 5.1 POST /workouts

**용도**: 자유 세션 또는 활성 프로그램 기반 세션 시작.

**Request Body** (상호 배타):
```json
// 자유 세션
{ "exerciseIds": ["clxxx1", "clxxx2"] }

// 프로그램 기반 세션
{ "programDayId": "clxxxday1" }
```

**Response 201 Created**:
```json
{
  "id": "clxxxsession1",
  "userId": "...",
  "programId": null,
  "programDayId": null,
  "status": "IN_PROGRESS",
  "notes": null,
  "startedAt": "2026-05-12T...",
  "completedAt": null,
  "cancelledAt": null,
  "sets": []
}
```

**Error Responses**:
- `400 Bad Request`: 입력 검증 실패, 둘 다 제공/둘 다 미제공, `exerciseIds` 중 미존재(REQ-WO-SESSION-004/005/006).
- `401 Unauthorized`: JWT 누락/만료.
- `409 Conflict`: 진행 중 세션 존재(REQ-WO-SESSION-003).

### 5.2 GET /workouts

**용도**: 사용자 세션 목록 페이지네이션 조회.

**Query Parameters**:
- `status`: 선택, `IN_PROGRESS` | `COMPLETED` | `CANCELLED`.
- `startedAtFrom`, `startedAtTo`: 선택, ISO 8601.
- `page`: 선택, 기본 1.
- `limit`: 선택, 기본 20, 최대 100.

**Response 200 OK**:
```json
{
  "items": [{ "id": "...", "status": "COMPLETED", "startedAt": "...", "completedAt": "...", "setCount": 15, ... }],
  "page": 1,
  "limit": 20,
  "total": 47,
  "totalPages": 3
}
```

**Error Responses**:
- `400 Bad Request`: 잘못된 필터(`startedAtFrom > startedAtTo`, 잘못된 `status` 등).
- `401 Unauthorized`.

### 5.3 GET /workouts/active

**용도**: 현재 진행 중인 세션 조회.

**Response 200 OK (진행 중)**:
```json
{
  "active": {
    "id": "...",
    "status": "IN_PROGRESS",
    "sets": [ ... ],
    ...
  }
}
```

**Response 200 OK (진행 없음)**: `{ "active": null }`.

**Error Responses**:
- `401 Unauthorized`.

### 5.4 GET /workouts/:id

**용도**: 본인 세션 상세 조회.

**Response 200 OK**: REQ-WO-QUERY-006 참조(`sets` 포함, `orderIndex` 정렬).

**Error Responses**:
- `401 Unauthorized`.
- `404 Not Found`: 존재하지 않거나 본인 소유 아님(REQ-WO-QUERY-007).

### 5.5 PATCH /workouts/:id

**용도**: 세션 메모 수정(모든 상태에서 허용).

**Request Body**: `{ "notes": "string (max 1000)" }`.

**Response 200 OK**: 갱신된 세션 상세.

**Error Responses**:
- `400 Bad Request`: `notes` 길이 초과 또는 누락.
- `401 Unauthorized`.
- `404 Not Found`.

### 5.6 DELETE /workouts/:id

**용도**: `CANCELLED` 세션 영구 삭제.

**Response 204 No Content**.

**Error Responses**:
- `401 Unauthorized`.
- `404 Not Found`.
- `409 Conflict`: `COMPLETED` 또는 `IN_PROGRESS` 세션 삭제 시도(REQ-WO-COMPLETE-006/007).

### 5.7 POST /workouts/:id/complete

**용도**: 진행 중 세션을 `COMPLETED`로 전환. 1RM 자동 갱신 비동기 트리거.

**Request Body**: 없음.

**Response 200 OK**: 완료된 세션 상세(`status: COMPLETED`, `completedAt` 설정).

**Error Responses**:
- `401 Unauthorized`.
- `404 Not Found`.
- `409 Conflict`: 이미 `COMPLETED` 또는 `CANCELLED`(REQ-WO-COMPLETE-003).

### 5.8 POST /workouts/:id/cancel

**용도**: 진행 중 세션을 `CANCELLED`로 전환.

**Request Body**: 없음.

**Response 200 OK**: 취소된 세션 상세(`status: CANCELLED`, `cancelledAt` 설정).

**Error Responses**:
- `401 Unauthorized`.
- `404 Not Found`.
- `409 Conflict`: 이미 `COMPLETED` 또는 `CANCELLED`(REQ-WO-COMPLETE-003).

### 5.9 POST /workouts/:id/sets

**용도**: 진행 중 세션에 세트 추가.

**Request Body**:
```json
{
  "exerciseId": "clxxx1",
  "setNumber": 1,        // optional, auto-assigned if omitted (REQ-WO-SET-008)
  "weight": 100.0,       // optional (nullable for bodyweight)
  "reps": 5,
  "rpe": 8,              // optional
  "isCompleted": true    // optional, default false
}
```

**Response 201 Created**: 생성된 세트 상세.

**Error Responses**:
- `400 Bad Request`: 입력 검증 실패(REQ-WO-SET-003).
- `401 Unauthorized`.
- `404 Not Found`: 세션 미존재 또는 본인 소유 아님.
- `409 Conflict`: 세션이 진행 중 아님(REQ-WO-SET-006) 또는 `(exerciseId, setNumber)` 중복(REQ-WO-SET-002).

### 5.10 PATCH /workouts/:id/sets/:setId

**용도**: 세트 부분 수정.

**Request Body** (부분):
```json
{ "weight": 102.5, "reps": 5, "rpe": 9, "isCompleted": true }
```

**Response 200 OK**: 수정된 세트.

**Error Responses**:
- `400 Bad Request`: 입력 검증 실패.
- `401 Unauthorized`.
- `404 Not Found`: 세션 또는 세트 미존재.
- `409 Conflict`: 세션이 진행 중 아님(REQ-WO-SET-006).

### 5.11 DELETE /workouts/:id/sets/:setId

**용도**: 세트 영구 삭제.

**Response 204 No Content**.

**Error Responses**:
- `401 Unauthorized`.
- `404 Not Found`.
- `409 Conflict`: 세션이 진행 중 아님(REQ-WO-SET-006).

### 5.12 GET /workouts/utils/plates

**용도**: 바벨+원판 조합 계산(인증 필요, DB 의존 없음).

**Query Parameters**:
- `weight`: 필수, 양의 실수 `0 < weight <= 1000` (kg).
- `barWeight`: 선택, `{15, 20}` 중 하나, 기본 `20`.

**Response 200 OK**:
```json
{
  "totalWeight": 100.0,
  "barWeight": 20,
  "plates": [
    { "weight": 20, "count": 2 },
    { "weight": 15, "count": 0 },
    { "weight": 10, "count": 2 },
    { "weight": 5, "count": 0 },
    { "weight": 2.5, "count": 0 },
    { "weight": 1.25, "count": 0 }
  ],
  "perSide": [
    { "weight": 20, "count": 1 },
    { "weight": 10, "count": 1 }
  ],
  "remainder": 0.0
}
```

**Error Responses**:
- `400 Bad Request`: 검증 실패(REQ-WO-PLATES-002).
- `401 Unauthorized`.

### 5.13 라우트 등록 순서 (REQ-WO-VAL-001)

`WorkoutsController`(`@Controller('workouts')`)에서 다음 순서를 강제한다(고정 경로가 동적 경로보다 먼저):

```
1. GET    /workouts                        (collection)
2. POST   /workouts                        (collection)
3. GET    /workouts/active                 (static)
4. GET    /workouts/utils/plates           (static, nested)
5. GET    /workouts/:id                    (dynamic)
6. PATCH  /workouts/:id                    (dynamic)
7. DELETE /workouts/:id                    (dynamic)
8. POST   /workouts/:id/complete           (dynamic + static suffix)
9. POST   /workouts/:id/cancel             (dynamic + static suffix)
10. POST  /workouts/:id/sets               (dynamic + static suffix)
11. PATCH /workouts/:id/sets/:setId        (dynamic + static suffix + dynamic)
12. DELETE /workouts/:id/sets/:setId       (dynamic + static suffix + dynamic)
```

---

## 6. 의존성 (Dependencies)

### 6.1 선행 SPEC

| SPEC | 사용 요소 | 본 SPEC에서의 활용 |
|---|---|---|
| SPEC-AUTH-001 | `JwtAuthGuard`, `@CurrentUser('sub')`, `UserRole` enum | 모든 엔드포인트 보호, 사용자 식별. |
| SPEC-USER-001 | `User` 모델, `User.deletedAt` | FK 참조(`WorkoutSession.userId`), 사용자 삭제 시 cascade. |
| SPEC-EXERCISE-001 | `Exercise` 모델 (id, name, primaryMuscles, images) | FK 참조(`WorkoutSet.exerciseId`), 응답 join. |
| SPEC-1RM-001 | `OneRepMax`, `CompoundType`, `OrmSource`, `packages/utils/src/1rm.ts` | 세션 완료 시 1RM 자동 갱신, 공식 공유. |
| SPEC-PROGRAM-001 | `Program`, `ProgramDay`, `UserProgram` | 프로그램 기반 세션의 `programDayId` 검증, FK 참조. |

### 6.2 의존성 검증 시 확인 사항

- `Exercise` 시드 완료(800+ 운동, SPEC-EXERCISE-001 REQ-EX-SEED-001) — `exerciseId` FK 무결성 보장.
- `CompoundType` enum과 `OneRepMax` 테이블 존재(SPEC-1RM-001 마이그레이션 완료).
- `UserProgram`, `ProgramDay` 모델 존재(SPEC-PROGRAM-001 마이그레이션 완료).
- `packages/utils/src/1rm.ts`의 `epley()`, `brzycki()`, `averageEstimate()` 함수 export 확인.

### 6.3 후속 SPEC 후보

본 SPEC이 완료되면 다음 SPEC이 자연스럽게 활성화된다:

- SPEC-STATS-001 (가칭): 주별/월별 볼륨, 부위별 빈도, 1RM 진척도 그래프.
- SPEC-AI-001 (가칭): AI 카탈로그 추천(`catalogRecs`) + AI 재평가(`reevaluations`) — SPEC-PROGRAM-001 `AiUsageLog` 예약 컬럼 활용.
- SPEC-WORKOUT-EXPORT-001 (가칭): 세션 기록의 CSV/JSON export.

---

## 7. 제외 사항 (Exclusions - What NOT to Build)

본 SPEC에서 **명시적으로 제외하는 항목**은 다음과 같다. 이는 후속 SPEC 또는 영구 비목표로 분류된다.

1. **세션 통계·집계 화면**: 주별/월별 볼륨, 부위별 빈도, 1RM 진척도 그래프, 운동별 PR 타임라인 등은 본 SPEC 범위 밖이다. 후속 SPEC-STATS-001 후보.
2. **휴식 타이머의 서버 동기화**: 휴식 타이머는 클라이언트 로컬 상태로만 관리하며 서버에 저장하지 않는다. 앱 종료 시 타이머는 초기화된다.
3. **세션 공유·소셜 기능**: 사용자 간 세션 공유, 좋아요, 댓글, 팔로우 등은 비공개 앱 특성상 본 SPEC 및 후속 SPEC에서도 우선순위 낮음.
4. **외부 export 및 통합**: CSV/JSON export, Apple Health, Google Fit, Strava, MyFitnessPal 등 외부 서비스 연동은 본 SPEC 범위 밖이다.
5. **AI 기반 세션 분석/피드백**: 폼 분석, 다음 세트 추천, 운동 강도 조절 제안, 부상 위험 경고 등 AI 기반 기능은 본 SPEC 범위 밖이다. 후속 SPEC-AI-001 검토.
6. **다중 동시 진행 세션**: 사용자당 진행 중 세션 1개로 제한. 일시정지 후 다른 세션 시작, 세션 병합 등의 기능은 본 SPEC 범위 밖이다.
7. **푸시 알림**: 휴식 타이머 만료, 운동 누락 리마인더, PR 달성 축하 등 푸시 알림은 본 SPEC 범위 밖이다.
8. **자동 PR 감지·축하**: 1RM 자동 갱신은 서버 측 데이터 업데이트만 수행하며, 사용자에게 "PR!" 토스트 또는 푸시는 클라이언트 측 비교로 처리한다(서버는 비개입).
9. **세션 데이터 백업/복원**: 파일 export, iCloud/Google Drive 백업, 다른 기기로 복원 등은 본 SPEC 범위 밖이다.
10. **다국어 세션 콘텐츠**: `notes` 자동 번역, 운동명 다국어 표시 등은 본 SPEC 범위 밖이다.
11. **세션 템플릿**: "이전 세션 복제", "프리셋 세트 템플릿"(예: 5x5 자동 세팅) 등 템플릿 기반 세트 입력 보조는 본 SPEC 범위 밖이다. 후속 SPEC에서 검토 가능.
12. **세트 단위 메모/태그**: `WorkoutSet`에는 자유 텍스트 필드를 두지 않는다(세션 단위 `notes`만 제공). 향후 추가 가능하지만 현재 SPEC에서는 단순성 유지.
13. **세션 시간 추적**: 세션의 실제 운동 시간(`duration`), 평균 휴식 시간 등의 자동 계산은 본 SPEC 범위 밖이다. `startedAt`/`completedAt`의 차이는 클라이언트에서 계산 가능.
14. **운동 강도 자동 추천**: `1RM의 70%로 8reps 권장` 같은 운동 강도 자동 추천은 본 SPEC 범위 밖이다. SPEC-AI-001 또는 별도 후속에서 검토.
15. **`isCompleted` 일괄 토글 엔드포인트**: 한 운동의 모든 세트를 한 번에 완료 마킹하는 별도 엔드포인트는 본 SPEC 범위 밖이다. 클라이언트가 개별 `PATCH .../sets/:setId`를 다중 호출한다.

---

## 8. mx_plan (MX Tag Annotation Targets)

### 8.1 @MX:ANCHOR 대상 (high fan_in 함수)

- `workouts.service.ts :: createSession(userId, dto)`: `POST /workouts`의 단일 진입점. 진행 1개 제약 + 자유/프로그램 분기 + 활성 프로그램 검증의 단일 지점.
- `workouts.service.ts :: getSessionDetail(sessionId, userId)`: `GET /workouts/:id`, `GET /workouts/active`가 모두 의존하는 상세 빌더. 권한 검사(`userId` 일치) 단일 지점.
- `workouts.service.ts :: completeSession(sessionId, userId)`: `POST /workouts/:id/complete`의 단일 진입점. 상태 전환 + 1RM 갱신 트리거 분리 보장.
- `workouts.service.ts :: cancelSession(sessionId, userId)`: `POST /workouts/:id/cancel`의 단일 진입점.
- `workout-sets.service.ts :: addSet(sessionId, userId, dto)`: `POST /workouts/:id/sets`의 단일 진입점. 진행 상태 검증 + 중복 검증 + `setNumber` 자동 추천의 단일 지점.
- `workout-sets.service.ts :: updateSet(sessionId, setId, userId, dto)`: `PATCH /workouts/:id/sets/:setId`의 단일 진입점. `isCompleted` 전환 시 `completedAt` 자동 설정.
- `one-rm-update.service.ts :: updateOneRepMaxFromSession(sessionId)`: 세션 완료 시 1RM 갱신의 단일 진입점. 비동기 best-effort 작업.
- `plates.service.ts :: calculate(weight, barWeight)`: 플레이트 계산 단일 진입점. 순수 함수, 결정성 보장.

### 8.2 @MX:WARN 대상 (danger zone, requires @MX:REASON)

- `workouts.service.ts :: createSession()`: 사용자가 동시에 다중 `POST /workouts`를 호출 시 race condition으로 진행 2개 생성 가능 (REASON: REQ-WO-SESSION-003 진행 1개 제약 — `WorkoutSession.count({ where: { userId, status: IN_PROGRESS } })` 체크와 INSERT 사이 race; serializable 트랜잭션 또는 advisory lock 검토 필요).
- `workouts.service.ts :: completeSession()`: 상태 전환과 1RM 갱신 분리 트랜잭션 — 1RM 갱신 실패가 세션 완료를 롤백하지 않음 (REASON: REQ-WO-1RM-006 트랜잭션 격리, best-effort 보장).
- `one-rm-update.service.ts :: updateOneRepMaxFromSession()`: 외부 트랜잭션과 분리, 실패 시 로그만 (REASON: REQ-WO-1RM-006 — 1RM 갱신 실패가 세션 완료 응답을 변경해서는 안 됨).
- `workouts.controller.ts :: route ordering`: 고정 경로(`active`, `utils/plates`)와 동적 경로(`:id`) 충돌 가능 (REASON: REQ-WO-VAL-001 — SPEC-EXERCISE-001, SPEC-PROGRAM-001의 동일 교훈 적용).
- `workout-sets.service.ts :: addSet()`: `setNumber` 자동 추천과 중복 검증 사이 race condition 가능 (REASON: REQ-WO-SET-002 `@@unique([sessionId, exerciseId, setNumber])` — 같은 운동 동시 추가 시 unique 위반 가능, 재시도 또는 advisory lock 필요).

### 8.3 @MX:NOTE 대상

- `prisma/schema.prisma :: SessionStatus enum`: 3개 값(`IN_PROGRESS`, `COMPLETED`, `CANCELLED`). 추가 상태(`PAUSED`, `ARCHIVED` 등)는 후속 SPEC.
- `prisma/schema.prisma :: WorkoutSession`: 진행 1개 제약은 application layer enforced(Prisma partial unique index 미지원).
- `prisma/schema.prisma :: WorkoutSet.weight`: `Decimal(7, 2)` nullable — 보디웨이트 운동 지원.
- `workouts.controller.ts`: 라우트 순서 정책 — collection → static(`active`, `utils/plates`) → dynamic(`:id`) → dynamic + suffix(`:id/complete`, `:id/cancel`, `:id/sets`) → nested dynamic(`:id/sets/:setId`).
- `one-rm-update.service.ts`: 비동기 best-effort 처리 — `setImmediate` 또는 별도 worker queue. 실패는 로그.
- `plates.service.ts`: 표준 원판 1.25/2.5/5/10/15/20 kg, 표준 바벨 15/20 kg. 좌우 대칭(`count` 항상 짝수).
- `compound-exercise.map.ts`: 5종 컴파운드 `Exercise.id` 매핑 — Exercise 시드 변경 시 동기화 필요.

### 8.4 @MX:TODO 대상 (후속 SPEC에서 해소)

- 세션 통계·집계(주별/월별 볼륨) — SPEC-STATS-001로 이관.
- 외부 export(CSV, Apple Health 등) — 후속 SPEC.
- AI 세션 분석·피드백 — SPEC-AI-001로 이관.
- 푸시 알림 — 후속 SPEC.
- 세션 템플릿(이전 세션 복제) — 후속 SPEC.
- 자동 PR 감지·축하 알림 — 후속 SPEC.

---

## 9. 추적성 매트릭스 (Traceability Matrix)

| REQ ID | acceptance.md 시나리오 | 출처 |
|--------|------------------------|------|
| REQ-WO-SESSION-001 | AC-WO-SESSION-CREATE-FREE-01 | 사용자 인터뷰 (자유 세션) |
| REQ-WO-SESSION-002 | AC-WO-SESSION-CREATE-PROGRAM-01 | 사용자 인터뷰 (프로그램 기반) |
| REQ-WO-SESSION-003 | AC-WO-SESSION-CONFLICT-01 | 진행 1개 제약 |
| REQ-WO-SESSION-004 | AC-WO-SESSION-CREATE-INVALID-01 | 프로그램 검증 |
| REQ-WO-SESSION-005 | AC-WO-SESSION-CREATE-INVALID-01 | 입력 검증 |
| REQ-WO-SESSION-006 | AC-WO-SESSION-CREATE-INVALID-01 | exerciseId 무결성 |
| REQ-WO-SESSION-007 | AC-WO-SECURITY-AUTH-01 | NFR-WO-SEC-001 |
| REQ-WO-SESSION-008 | AC-WO-SECURITY-OWNERSHIP-01 | NFR-WO-SEC-002 |
| REQ-WO-SET-001 | AC-WO-SET-ADD-01 | 사용자 인터뷰 (세트 추가) |
| REQ-WO-SET-002 | AC-WO-SET-DUPLICATE-01 | 데이터 무결성 |
| REQ-WO-SET-003 | AC-WO-SET-VALIDATION-01 | 입력 검증 |
| REQ-WO-SET-004 | AC-WO-SET-UPDATE-01 | 사용자 인터뷰 (세트 수정) |
| REQ-WO-SET-005 | AC-WO-SET-DELETE-01 | 사용자 인터뷰 (세트 삭제) |
| REQ-WO-SET-006 | AC-WO-SET-LOCKED-01 | 완료 후 변경 금지 |
| REQ-WO-SET-007 | AC-WO-SET-NOTFOUND-01 | 404 처리 |
| REQ-WO-SET-008 | AC-WO-SET-AUTO-NUMBER-01 | setNumber 자동 부여 |
| REQ-WO-COMPLETE-001 | AC-WO-COMPLETE-01 | 사용자 인터뷰 (완료) |
| REQ-WO-COMPLETE-002 | AC-WO-CANCEL-01 | 사용자 인터뷰 (취소) |
| REQ-WO-COMPLETE-003 | AC-WO-COMPLETE-DOUBLE-01 | 중복 완료/취소 거부 |
| REQ-WO-COMPLETE-004 | AC-WO-COMPLETE-EMPTY-01 | 빈 세션 완료 허용 |
| REQ-WO-COMPLETE-005 | AC-WO-DELETE-CANCELLED-01 | 사용자 인터뷰 (삭제) |
| REQ-WO-COMPLETE-006 | AC-WO-DELETE-COMPLETED-01 | 기록 보존 정책 |
| REQ-WO-COMPLETE-007 | AC-WO-DELETE-INPROGRESS-01 | 안전 가이드 |
| REQ-WO-COMPLETE-008 | AC-WO-NOTES-UPDATE-01 | 사용자 인터뷰 (메모) |
| REQ-WO-QUERY-001 | AC-WO-LIST-01 | 사용자 인터뷰 (히스토리) |
| REQ-WO-QUERY-002 | AC-WO-LIST-01 | 페이지네이션 |
| REQ-WO-QUERY-003 | AC-WO-LIST-FILTER-01 | 필터 검증 |
| REQ-WO-QUERY-004 | AC-WO-ACTIVE-01 | 사용자 인터뷰 (진행 조회) |
| REQ-WO-QUERY-005 | AC-WO-ACTIVE-EMPTY-01 | 멱등 UX |
| REQ-WO-QUERY-006 | AC-WO-DETAIL-01 | 응답 일관성 |
| REQ-WO-QUERY-007 | AC-WO-DETAIL-NOTFOUND-01, AC-WO-SECURITY-OWNERSHIP-01 | 404 처리, 정보 누설 방지 |
| REQ-WO-QUERY-008 | AC-WO-LIST-01, AC-WO-DETAIL-01 | 정렬 일관성 |
| REQ-WO-PLATES-001 | AC-WO-PLATES-01 | 사용자 인터뷰 (계산기) |
| REQ-WO-PLATES-002 | AC-WO-PLATES-VALIDATION-01 | 입력 검증 |
| REQ-WO-PLATES-003 | AC-WO-PLATES-01 | 좌우 대칭 |
| REQ-WO-PLATES-004 | AC-WO-SECURITY-AUTH-01 | NFR-WO-SEC-001 |
| REQ-WO-PLATES-005 | AC-WO-PLATES-DETERMINISTIC-01 | 결정성 |
| REQ-WO-1RM-001 | AC-WO-1RM-UPDATE-01 | 1RM 통합 |
| REQ-WO-1RM-002 | AC-WO-1RM-UPDATE-01, AC-WO-1RM-NO-COMPOUND-01 | 적격 세트 필터 |
| REQ-WO-1RM-003 | AC-WO-1RM-UPDATE-01 | SPEC-1RM-001 공식 공유 |
| REQ-WO-1RM-004 | AC-WO-1RM-NO-DOWNGRADE-01 | 상향 갱신만 |
| REQ-WO-1RM-005 | AC-WO-1RM-UPDATE-01 | source 표기 |
| REQ-WO-1RM-006 | AC-WO-1RM-FAILURE-ISOLATED-01 | 트랜잭션 격리 |
| REQ-WO-1RM-007 | (정적 검사 / 매핑 테이블 검증) | 컴파운드 매핑 |
| REQ-WO-VAL-001 | AC-WO-ROUTE-01 | SPEC-EXERCISE/PROGRAM 교훈 |
| REQ-WO-VAL-002 | AC-WO-DETAIL-NOTFOUND-01 | 일관된 404 |
| REQ-WO-VAL-003 | AC-WO-SET-VALIDATION-01 | ValidationPipe 표준 |
| REQ-WO-VAL-004 | AC-WO-LIST-01, AC-WO-SET-VALIDATION-01 | enum 일관성 |
| REQ-WO-VAL-005 | AC-WO-COMPLETE-01, AC-WO-CANCEL-01 | 시간 일관성 |
| NFR-WO-PERF-001~008 | AC-WO-PERF-01 | 성능 SLO |
| NFR-WO-SEC-001~005 | AC-WO-SECURITY-AUTH-01, AC-WO-SECURITY-OWNERSHIP-01 | OWASP A01/A02 |
| NFR-WO-DATA-001~007 | AC-WO-SESSION-CREATE-FREE-01, AC-WO-SET-DUPLICATE-01 | 데이터 무결성 |
| NFR-WO-MOBILE-001~005 | (수동 검증 MV-WO-MOBILE-01~05) | 모바일 UX |
| NFR-WO-CONSISTENCY-001~002 | (정적 검사 / 빌드 통과) | 공유 타입·공식 |
