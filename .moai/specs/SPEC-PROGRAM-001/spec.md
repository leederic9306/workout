---
id: SPEC-PROGRAM-001
version: "1.0.2"
status: draft
created_at: "2026-05-11"
updated_at: "2026-05-12"
author: leederic9306
priority: high
issue_number: 0
labels: ["program", "ai", "backend", "mobile"]
---

# SPEC-PROGRAM-001: 운동 프로그램 (Workout Program)

## HISTORY

- 2026-05-12 v1.0.2 (draft): plan-auditor 2차 감사 결과 반영. REQ-PROG-AI-011 두 번째 문장(userId 격리) 제거(NFR-PROG-SEC-003 중복), REQ-PROG-VAL-005 Unwanted→Ubiquitous 재분류(isPublic 고정 단일 항목으로 단순화, 라우팅 조항 제거 - REQ-PROG-VAL-001 중복).
- 2026-05-12 v1.0.1 (draft): plan-auditor 1차 감사 결과 반영. REQ-PROG-ACTIVE-010/AI-011/VAL-005 Unwanted EARS 패턴 수정, REQ-PROG-AI-001 응답 코드 201 확정, REQ-PROG-AI-012 upstream 오류 코드 명확화(502/422/504), REQ-PROG-AI-004 Event-Driven 재분류.
- 2026-05-11 v1.0.0 (draft): 초기 작성 (leederic9306). 근력 운동 트래커 앱의 운동 프로그램 시스템을 EARS 형식으로 정의. 6종 사전 시드 카탈로그 프로그램 조회, 사용자당 활성 프로그램 1개 관리(POST activate, DELETE active, GET active), Premium/Admin 전용 AI 맞춤 프로그램 생성(월 10회 한도)을 다룬다. SPEC-AUTH-001(인증/RBAC) 위에서 동작하며 모든 엔드포인트는 `JwtAuthGuard`로 보호되고, AI 생성 엔드포인트는 추가로 `RolesGuard`로 Premium/Admin만 허용한다. 카탈로그 프로그램은 `prisma db seed`로 사전 삽입되며 `Exercise.id`(SPEC-EXERCISE-001)를 참조한다. AI는 Claude Haiku 4.5(Anthropic API)를 사용하여 구조화 JSON을 생성하고 검증 단계에서 모든 `exerciseId`의 실존 여부를 확인한다.

---

## REQ 번호 체계 안내 (Numbering Convention)

본 SPEC은 도메인 네임스페이스 기반 REQ 번호 체계(`REQ-PROG-CATALOG-001`, `REQ-PROG-DETAIL-001`, `REQ-PROG-ACTIVE-001`, `REQ-PROG-AI-001`, `REQ-PROG-SEED-001`, `REQ-PROG-VAL-001`)를 사용한다. 이는 본 프로젝트의 표준 컨벤션이며 SPEC-AUTH-001, SPEC-USER-001, SPEC-EXERCISE-001, SPEC-1RM-001과 동일한 패턴이다. 각 네임스페이스 내에서 번호는 순차적이고 빠짐없이 부여되며, 네임스페이스 분리로 도메인 단위의 추적성과 가독성을 확보한다. 평탄한 순차 번호(`REQ-001`, `REQ-002` ...)로 재번호하지 않는다.

---

## 1. 개요 (Overview)

근력 운동 트래커 앱의 **운동 프로그램(Workout Program) 시스템**을 정의한다. 본 SPEC은 SPEC-AUTH-001(인증 및 권한 관리), SPEC-EXERCISE-001(운동 도감) 위에서 동작하는 **프로그램 카탈로그 및 활성 프로그램 관리 레이어**로서, 인증된 사용자가 사전 정의된 6종 카탈로그 프로그램(StrongLifts 5x5, Starting Strength, Beginner PPL, Intermediate PPL, Arnold Split, Upper/Lower Split)을 조회·활성화하고, Premium/Admin 사용자는 AI(Claude Haiku 4.5)로 본인 맞춤 프로그램을 월 10회 한도 내에서 생성할 수 있게 한다.

### 핵심 가치

- **검증된 프로그램 즉시 활용**: 운동학적으로 검증된 6종 프로그램을 사전 시드 방식으로 제공하여 사용자가 즉시 활성화하고 따를 수 있다.
- **단일 활성 프로그램 원칙**: 사용자당 활성 프로그램은 1개로 제한(`@@unique([userId])` on `UserProgram`)하여 데이터 모델의 단순성과 운영 명료성을 확보한다. 프로그램 전환은 활성화 시 자동 교체(upsert)로 자연스럽게 처리된다.
- **AI 맞춤 프로그램의 안전한 도입**: AI 생성 응답을 항상 사후 검증(exerciseId 실존, 구조 스키마, 일수/세트/렙 범위)으로 통과시키며, 검증 실패 시 사용량 카운터를 증가시키지 않아 사용자 입장에서 한도 손실이 없는 실패 경험을 제공한다.
- **권한 기반 비용 통제**: AI 호출은 Premium/Admin만 허용하고 월 10회 한도를 부과하여 외부 API 비용을 통제한다 (NFR-PROG-AI-COST).
- **카탈로그-AI 분리 데이터 모델**: `Program.type`(`CATALOG` / `AI_GENERATED`)으로 두 유형을 구분하되 동일 스키마(`Program`, `ProgramDay`, `ProgramExercise`)를 공유하여 활성화 로직과 조회 응답이 일관된다.

### 범위

본 SPEC은 백엔드(NestJS 10) 측 `ProgramsModule` 신설과 `AiModule` 확장(또는 `ProgramsModule` 내부 `AiProgramService` 분리), Prisma 스키마의 `ProgramType` enum 및 `Program`, `ProgramDay`, `ProgramExercise`, `UserProgram`, `AiUsageLog` 모델 신설, 6개 엔드포인트(`GET /programs/catalog`, `GET /programs/active`, `GET /programs/:id`, `POST /programs/:id/activate`, `DELETE /programs/active`, `POST /ai/programs`), 6종 카탈로그 프로그램의 시드(`prisma/seed/programs.ts`), 모바일 클라이언트의 프로그램 목록·상세·활성화·AI 생성 화면을 포괄한다.

다음 항목은 본 SPEC 범위에서 명시적으로 제외된다 (Section 7 참조):
- 운동 세션 기록 및 프로그램 진행도 추적 — SPEC-WORKOUT-001(후속).
- 사용자별 프로그램 히스토리 목록 — 활성 1개만 관리.
- AI 카탈로그 추천(모드 1) 및 AI 재평가(모드 3) — 후속 SPEC-AI-001.
- Admin에 의한 카탈로그 프로그램 수정/추가 — 시드 갱신 정책으로 대체.

---

## 2. 목표와 비목표 (Goals & Non-Goals)

### 2.1 목표 (Goals)

1. 인증된 사용자가 `GET /programs/catalog`로 6종 카탈로그 프로그램의 요약 정보(제목, 분할 방식, 대상 수준, 주 빈도, 일수, 일별 운동 수 요약)를 한 번에 조회할 수 있게 한다. 페이지네이션은 사용하지 않는다(고정 6건).
2. 인증된 사용자가 `GET /programs/:id`로 카탈로그 프로그램 또는 본인이 생성한 AI 프로그램의 상세(모든 `ProgramDay`와 각 일의 `ProgramExercise`, 그리고 각 운동의 표시 정보)를 조회할 수 있게 한다.
3. 인증된 사용자가 `POST /programs/:id/activate`로 카탈로그 프로그램 또는 본인이 생성한 AI 프로그램을 활성화할 수 있게 한다. 기존 활성 프로그램이 있으면 자동으로 교체된다(`@@unique([userId])` upsert 의미).
4. 인증된 사용자가 `DELETE /programs/active`로 현재 활성 프로그램을 비활성화할 수 있게 한다. 활성 프로그램이 없는 경우에도 멱등적으로 `204 No Content`를 반환한다(404 아님).
5. 인증된 사용자가 `GET /programs/active`로 현재 활성 프로그램의 상세를 조회할 수 있게 한다. 활성 프로그램이 없는 경우 `{ active: null }`을 `200 OK`로 반환한다(404 아님).
6. **Premium 또는 Admin** 사용자가 `POST /ai/programs`로 본인 목표(`goal`), 주 운동 일수(`daysPerWeek`), 보유 장비(`availableEquipment`), 집중 부위(`focusAreas`, 선택)를 입력하여 AI(Claude Haiku 4.5)가 생성한 본인 맞춤 프로그램을 받을 수 있게 한다.
7. AI 생성 응답은 항상 사후 검증(JSON 스키마, `exerciseId` 실존, `sets` 범위, `reps` 정규식, `daysPerWeek` 일관성)을 거치며, 검증 통과 시 `Program(type: AI_GENERATED, createdBy: userId)`로 저장되고 `AiUsageLog.programCreations`가 +1된다.
8. AI 사용량은 사용자별 월 단위로 제한된다: `AiUsageLog.programCreations <= 10`/월. 한도 초과 시 `429 Too Many Requests`를 반환한다.
9. AI 응답 검증 실패 시 `422 Unprocessable Entity`를 반환하며 **사용량 카운터는 증가시키지 않는다**. 사용자는 한도를 손실하지 않는 실패 경험을 받는다.
10. 카탈로그 프로그램 6종은 `prisma db seed` 명령으로 사전 삽입되며 각 프로그램의 `ProgramDay`와 `ProgramExercise`(Exercise FK 참조)가 함께 시드된다. 시드 결과 카탈로그 프로그램은 정확히 6건이어야 한다(REQ-PROG-SEED-001).
11. 모든 엔드포인트는 `JwtAuthGuard`로 보호되며, `POST /ai/programs`는 추가로 `RolesGuard`(`@Roles(UserRole.PREMIUM, UserRole.ADMIN)`)로 보호된다. 일반 `User` 권한 사용자는 `403 Forbidden`을 받는다.
12. 라우트 등록 순서는 고정 경로(`catalog`, `active`)가 동적 경로(`:id`)보다 먼저 정의되어야 한다(REQ-PROG-VAL-001, SPEC-EXERCISE-001 REQ-EX-FAV-012의 교훈 적용).
13. 사용자는 본인이 생성하지 않은 AI 프로그램(`Program.createdBy != userId`이면서 `Program.type = AI_GENERATED`)에 대해 `GET /programs/:id` 조회 및 `POST /programs/:id/activate`를 수행할 수 없다(`403 Forbidden` 또는 `404 Not Found` — Section 5 참조). 카탈로그 프로그램(`type = CATALOG`)은 모든 인증 사용자가 조회·활성화 가능.

### 2.2 비목표 (Non-Goals)

- 운동 세션 기록(`Workout`, `WorkoutSet`)과 프로그램 진행도(현재 몇 주차/몇 일차 등)는 본 SPEC 범위 밖이다. SPEC-WORKOUT-001(후속)에서 다룬다.
- 사용자의 과거 활성 프로그램 이력(언제 어떤 프로그램을 따랐는지 타임라인)은 본 SPEC 범위 밖이다. `UserProgram`은 사용자당 1건만 유지하며 활성 해제 시 레코드를 삭제한다.
- AI 카탈로그 추천(모드 1: 사용자 입력으로 6종 중 하나를 추천)과 AI 재평가(모드 3: 기존 활성 프로그램의 적합성 분석)는 본 SPEC 범위 밖이다. 후속 SPEC-AI-001.
- Admin에 의한 카탈로그 프로그램의 런타임 수정·삭제·추가 엔드포인트는 본 SPEC 범위 밖이다. 카탈로그 변경은 `prisma db seed` 갱신과 마이그레이션으로 처리된다.
- `Program.isPublic` 필드는 스키마에 정의하되 본 SPEC에서는 항상 `false`로 고정되며, 프로그램 공유·검색 기능은 본 SPEC 범위 밖이다(비공개 앱 특성).
- AI 프로그램의 사용자 간 공유, 좋아요, 댓글 등 소셜 기능은 본 SPEC 범위 밖이다.
- 다국어 프로그램 콘텐츠(영어 외)는 본 SPEC 범위 밖이다. 카탈로그 프로그램의 `title`, `description`은 한국어로 시드한다(모바일 UX 일관성).
- 프로그램 활성화 시 푸시 알림이나 캘린더 연동은 본 SPEC 범위 밖이다.
- AI 응답을 스트리밍(SSE)으로 받는 경험은 본 SPEC 범위 밖이다. 동기 요청·응답으로만 처리한다.

---

## 3. EARS 요구사항 (Requirements)

### 3.1 REQ-PROG-CATALOG: 카탈로그 조회

**REQ-PROG-CATALOG-001** (Event-Driven)
인증된 사용자가 `GET /programs/catalog` 요청을 보냈을 때, 시스템은 `Program.type = CATALOG`인 모든 프로그램을 `200 OK`로 배열로 반환해야 한다.

**REQ-PROG-CATALOG-002** (Ubiquitous)
시스템은 카탈로그 응답 배열의 각 항목에 다음 필드를 포함해야 한다: `id`, `title`, `description`, `type` (항상 `"CATALOG"`), `level`, `frequency` (주 운동 일수), `dayCount` (총 운동 일 수), `exerciseSummary` (일별 운동 수 요약 객체 또는 일별 운동 수 평균), `createdAt`.

**REQ-PROG-CATALOG-003** (Ubiquitous)
시스템은 카탈로그 응답에 페이지네이션 메타(`page`, `limit`, `total`)를 포함하지 않아야 한다. 카탈로그 프로그램 수는 고정 6건이며 단일 페이지로 반환한다.

**REQ-PROG-CATALOG-004** (Ubiquitous)
시스템은 `GET /programs/catalog` 엔드포인트를 `JwtAuthGuard`로 보호하여 JWT가 없거나 만료된 경우 `401 Unauthorized`를 반환해야 한다.

**REQ-PROG-CATALOG-005** (Ubiquitous)
시스템은 카탈로그 응답에 사용자 생성 AI 프로그램(`type = AI_GENERATED`)을 포함하지 않아야 한다.

### 3.2 REQ-PROG-DETAIL: 프로그램 상세 조회

**REQ-PROG-DETAIL-001** (Event-Driven)
인증된 사용자가 `GET /programs/:id` 요청을 보냈을 때, 시스템은 해당 프로그램의 상세 정보(모든 `ProgramDay` 및 각 일의 `ProgramExercise` 목록)를 `200 OK`로 반환해야 한다.

**REQ-PROG-DETAIL-002** (Ubiquitous)
시스템은 프로그램 상세 응답의 각 `ProgramExercise` 항목에 다음 필드를 포함해야 한다: `exerciseId`, `orderIndex`, `sets`, `reps`, `weightNote` (또는 `null`), 그리고 운동 표시 정보(`exercise.name`, `exercise.primaryMuscles`, `exercise.images[0]`).

**REQ-PROG-DETAIL-003** (Ubiquitous)
시스템은 프로그램 상세 응답의 각 `ProgramDay` 항목에 다음 필드를 포함해야 한다: `id`, `dayNumber`, `name`, `exercises` (해당 일의 `ProgramExercise` 배열, `orderIndex` 오름차순 정렬).

**REQ-PROG-DETAIL-004** (Event-Driven, 권한 검사)
사용자가 본인이 생성하지 않은 AI 프로그램(`Program.type = AI_GENERATED` AND `Program.createdBy != JWT.sub`)에 대해 `GET /programs/:id`를 호출한 경우, 시스템은 `404 Not Found`를 반환해야 한다. 카탈로그 프로그램(`type = CATALOG`)은 모든 인증 사용자가 조회 가능하다.

**REQ-PROG-DETAIL-005** (Event-Driven)
사용자가 존재하지 않는 `:id`로 `GET /programs/:id`를 호출한 경우, 시스템은 `404 Not Found`를 반환해야 한다.

**REQ-PROG-DETAIL-006** (Ubiquitous)
시스템은 `GET /programs/:id` 엔드포인트를 `JwtAuthGuard`로 보호하여 JWT가 없거나 만료된 경우 `401 Unauthorized`를 반환해야 한다.

**REQ-PROG-DETAIL-007** (Ubiquitous)
시스템은 프로그램 상세 응답의 `ProgramDay` 배열을 `dayNumber` 오름차순, 각 일의 `exercises` 배열을 `orderIndex` 오름차순으로 정렬하여 반환해야 한다.

### 3.3 REQ-PROG-ACTIVE: 활성 프로그램 관리

**REQ-PROG-ACTIVE-001** (Event-Driven, 활성화)
인증된 사용자가 카탈로그 프로그램 또는 본인 소유 AI 프로그램의 ID로 `POST /programs/:id/activate` 요청을 보냈을 때, 시스템은 해당 사용자의 `UserProgram` 레코드를 upsert(있으면 교체, 없으면 생성)하여 `200 OK` 또는 `201 Created`로 `{ userProgramId, programId, startedAt }`을 반환해야 한다.

**REQ-PROG-ACTIVE-002** (Ubiquitous)
시스템은 사용자당 활성 프로그램이 최대 1개만 존재하도록 보장해야 한다(`@@unique([userId])` on `UserProgram`). `POST /programs/:id/activate` 호출 시 기존 활성 프로그램이 있으면 자동으로 교체된다(별도 명시적 비활성화 요구 없음).

**REQ-PROG-ACTIVE-003** (Event-Driven, 권한 검사)
사용자가 본인이 생성하지 않은 AI 프로그램(`Program.type = AI_GENERATED` AND `Program.createdBy != JWT.sub`)의 ID로 `POST /programs/:id/activate`를 호출한 경우, 시스템은 `404 Not Found`를 반환하고 `UserProgram` 레코드를 생성/수정해서는 안 된다.

**REQ-PROG-ACTIVE-004** (Event-Driven, 비활성화)
인증된 사용자가 `DELETE /programs/active` 요청을 보냈을 때, 시스템은 해당 사용자의 `UserProgram` 레코드를 삭제하고 `204 No Content`를 반환해야 한다.

**REQ-PROG-ACTIVE-005** (Event-Driven, 멱등성)
사용자에게 활성 프로그램이 없는 상태에서 `DELETE /programs/active`를 호출한 경우, 시스템은 `204 No Content`를 반환해야 한다(404 아님, 멱등 보장).

**REQ-PROG-ACTIVE-006** (Event-Driven, 활성 조회)
인증된 사용자가 `GET /programs/active` 요청을 보냈을 때, 활성 프로그램이 있으면 시스템은 `200 OK`로 `{ active: <프로그램 상세, REQ-PROG-DETAIL-002/003 구조와 동일> }`을 반환해야 한다.

**REQ-PROG-ACTIVE-007** (Event-Driven, 활성 부재)
사용자에게 활성 프로그램이 없는 상태에서 `GET /programs/active`를 호출한 경우, 시스템은 `200 OK`로 `{ active: null }`을 반환해야 한다(404 아님).

**REQ-PROG-ACTIVE-008** (Event-Driven, 존재하지 않는 프로그램 활성화)
사용자가 존재하지 않는 `:id`로 `POST /programs/:id/activate`를 호출한 경우, 시스템은 `404 Not Found`를 반환하고 `UserProgram` 레코드를 생성/수정해서는 안 된다.

**REQ-PROG-ACTIVE-009** (Ubiquitous)
시스템은 활성 프로그램 관리 엔드포인트 3개(`POST /programs/:id/activate`, `DELETE /programs/active`, `GET /programs/active`)를 모두 `JwtAuthGuard`로 보호해야 한다.

**REQ-PROG-ACTIVE-010** (Unwanted, 사용자 격리)
사용자가 자신의 활성 프로그램이 아닌 타 사용자의 `UserProgram`에 접근하려 할 때, 시스템은 해당 요청을 거부하고 `403 Forbidden`을 반환해야 한다. 요청 바디·쿼리·path에 `userId`를 받을 수 있는 분기를 제공하지 않으며, 모든 활성 프로그램 관리 엔드포인트는 JWT `sub` 클레임만으로 대상 사용자를 식별해야 한다.

### 3.4 REQ-PROG-AI: AI 맞춤 프로그램 생성

**REQ-PROG-AI-001** (Event-Driven)
Premium 또는 Admin 권한을 가진 인증된 사용자가 `POST /ai/programs` 요청을 본문 `{ goal, daysPerWeek, availableEquipment, focusAreas? }`와 함께 보냈을 때, 시스템은 Claude Haiku 4.5에 구조화된 JSON 응답을 요청하고 사후 검증에 통과한 경우 `Program(type: AI_GENERATED, createdBy: JWT.sub)`로 저장한 후 `201 Created`로 생성된 프로그램 상세를 반환해야 한다.

**REQ-PROG-AI-002** (Event-Driven, 권한 게이팅)
사용자가 `User` 권한(Premium 또는 Admin이 아님)으로 `POST /ai/programs`를 호출한 경우, 시스템은 `403 Forbidden`을 반환하고 Anthropic API를 호출해서는 안 되며 `AiUsageLog`도 갱신하지 않아야 한다.

**REQ-PROG-AI-003** (Event-Driven, 월 한도 초과)
사용자의 현재 월(`YYYY-MM`)에 대한 `AiUsageLog.programCreations`가 10 이상인 상태에서 `POST /ai/programs`를 호출한 경우, 시스템은 `429 Too Many Requests`를 반환하고 Anthropic API를 호출해서는 안 된다.

**REQ-PROG-AI-004** (Event-Driven, 사용량 카운트 정책)
Premium 또는 Admin 사용자가 `POST /ai/programs`를 호출했을 때, 시스템은 현재 월의 `AiUsageLog.programCreations`가 10 미만인 경우에만 AI 생성을 진행해야 하며, AI 응답 검증이 통과하여 프로그램이 실제로 저장된 경우에만 `AiUsageLog.programCreations`를 +1 해야 한다. Anthropic API 호출 실패, 응답 파싱 실패, 사후 검증 실패 등으로 프로그램이 생성되지 않은 경우에는 카운터를 증가시켜서는 안 된다.

**REQ-PROG-AI-005** (Event-Driven, AI 응답 검증 실패)
Anthropic API로부터 받은 응답이 다음 중 하나의 검증에 실패한 경우, 시스템은 `422 Unprocessable Entity`를 반환하고 프로그램을 저장해서는 안 되며 `AiUsageLog.programCreations`를 증가시켜서는 안 된다:
- JSON 스키마 위반(필수 필드 누락, 타입 불일치)
- `days.length != request.daysPerWeek`
- 응답의 `exerciseId` 중 하나라도 `Exercise` 테이블에 존재하지 않음
- `ProgramExercise.sets`가 `1` 미만 또는 `10` 초과
- `ProgramExercise.reps`가 정규식 `^\d+(-\d+)?$`에 매치되지 않음(단일 정수 또는 정수 범위만 허용)

**REQ-PROG-AI-006** (Ubiquitous, AI 응답 스키마)
시스템은 Anthropic API에 다음 구조의 JSON 응답을 요청해야 한다:
```json
{
  "title": "string",
  "description": "string",
  "level": "beginner|intermediate|advanced",
  "days": [
    {
      "dayNumber": 1,
      "name": "string",
      "exercises": [
        { "exerciseId": "string", "orderIndex": 1, "sets": 3, "reps": "8-12", "weightNote": "optional string" }
      ]
    }
  ]
}
```

**REQ-PROG-AI-007** (Ubiquitous)
시스템은 `POST /ai/programs` 엔드포인트를 `JwtAuthGuard`와 `RolesGuard(@Roles(UserRole.PREMIUM, UserRole.ADMIN))`로 보호해야 한다.

**REQ-PROG-AI-008** (Event-Driven, 입력 검증)
사용자가 `POST /ai/programs`의 본문에 다음 중 하나라도 위반하는 값을 지정한 경우, 시스템은 `400 Bad Request`를 반환하고 Anthropic API를 호출해서는 안 된다:
- `goal`이 `"muscle_gain" | "strength" | "endurance"` 중 하나가 아님
- `daysPerWeek`가 정수 3 미만 또는 6 초과(`3 <= daysPerWeek <= 6`)
- `availableEquipment`가 배열이 아니거나 빈 배열
- `focusAreas`가 제공된 경우 배열이 아님

**REQ-PROG-AI-009** (Ubiquitous, AI 프로그램 저장)
시스템은 검증 통과된 AI 응답으로 `Program(type: AI_GENERATED, createdBy: JWT.sub, isPublic: false)`를 생성하고, 응답의 `days` 배열을 `ProgramDay`로, 각 일의 `exercises`를 `ProgramExercise`로 저장해야 한다. 모든 저장은 단일 트랜잭션 내에서 수행되어야 한다(부분 저장 금지).

**REQ-PROG-AI-010** (Ubiquitous, AI 사용량 추적 스키마)
시스템은 `AiUsageLog`를 `(userId, month: "YYYY-MM")` 복합 UNIQUE 키로 관리해야 한다. 동일 사용자의 동일 월에 대해 레코드는 최대 1건만 존재하며 `programCreations`, `catalogRecs`, `reevaluations` 카운터는 각각 별개로 관리된다.

**REQ-PROG-AI-011** (Unwanted)
AI 응답 검증이 실패한 경우(JSON 파싱 실패, 스키마 위반, `exerciseId` 미존재, `sets` 범위 초과, `reps` 정규식 불일치, `level` 값 위반, `days.length != request.daysPerWeek` 등), 시스템은 `AiUsageLog.programCreations` 카운터를 증가시키지 않고 `422 Unprocessable Entity`를 반환해야 한다.

**REQ-PROG-AI-012** (Event-Driven, Anthropic API 장애)
Anthropic API 호출 실패가 발생한 경우, 시스템은 다음 분기로 응답해야 하며 `AiUsageLog.programCreations`를 증가시켜서는 안 되고 어떠한 `Program` 레코드도 저장해서는 안 된다:
- Anthropic API가 네트워크 오류, API 키 무효, 또는 5xx 오류를 반환한 경우 → `502 Bad Gateway`.
- Anthropic API 응답이 잘못된 형식(JSON 파싱 실패 포함)인 경우 → `422 Unprocessable Entity`(REQ-PROG-AI-005 검증 파이프라인과 동일 분기).
- Anthropic API 응답 시간이 30초를 초과한 경우 → `504 Gateway Timeout`(NFR-PROG-PERF-006).

### 3.5 REQ-PROG-SEED: 카탈로그 시드

**REQ-PROG-SEED-001** (Ubiquitous)
시스템은 `prisma db seed` 실행 시 6종 카탈로그 프로그램을 정확히 1회만 시드해야 한다. 재실행 시 idempotent(예: `upsert` 또는 ID 기반 존재 확인)로 처리되어 중복 생성되어서는 안 된다.

**REQ-PROG-SEED-002** (Ubiquitous)
시드된 카탈로그 프로그램은 다음 6종이며 각각 `type = CATALOG`, `createdBy = null`, `isPublic = false`로 저장되어야 한다:
1. StrongLifts 5x5 — 전신(풀바디), 초급, 주 3일
2. Starting Strength — 전신(풀바디), 초급, 주 3일
3. Beginner PPL — Push/Pull/Legs, 초중급, 주 6일
4. Intermediate PPL — Push/Pull/Legs, 중급, 주 6일
5. Arnold Split — 가슴+등/어깨+팔/다리, 고급, 주 6일
6. Upper/Lower Split — 상체/하체, 중급, 주 4일

**REQ-PROG-SEED-003** (Ubiquitous)
각 카탈로그 프로그램의 `ProgramDay`와 `ProgramExercise`는 `Exercise` 테이블(SPEC-EXERCISE-001 시드)이 먼저 완료된 후 시드되어야 하며, 모든 `exerciseId`는 `Exercise.id`에 존재해야 한다. `Exercise` 시드 미완료 상태에서 프로그램 시드를 시도하면 시드 스크립트가 실패해야 한다(외래키 위반).

**REQ-PROG-SEED-004** (Ubiquitous)
시드된 카탈로그 프로그램의 `title`과 `description`은 한국어로 저장되어야 한다(모바일 UX 일관성). 영문 원본 명칭(예: "StrongLifts 5x5")은 `title`에 포함하되 한국어 부제 또는 한국어 `description`을 병행한다.

**REQ-PROG-SEED-005** (Event-Driven)
시드 스크립트가 중복 실행되어 동일 `id`의 카탈로그 프로그램이 이미 존재하는 경우, 스크립트는 해당 프로그램을 다시 생성하지 않고 정상 종료해야 한다(REQ-PROG-SEED-001 idempotency 보장).

### 3.6 REQ-PROG-VAL: 검증 및 운영 규칙

**REQ-PROG-VAL-001** (Event-Driven, 라우트 매칭 검증)
사용자가 `GET /programs/catalog` 또는 `GET /programs/active` 또는 `DELETE /programs/active`를 호출했을 때, 시스템은 해당 고정 경로 핸들러로 라우팅해야 하며 `:id` 동적 경로로 라우팅되어서는 안 된다. 고정 경로는 반드시 동적 경로보다 컨트롤러에서 먼저 등록되어야 한다(구체 구현 가이드는 plan.md에 위임 — SPEC-EXERCISE-001 REQ-EX-FAV-012 교훈 적용).

**REQ-PROG-VAL-002** (Event-Driven)
사용자가 `GET /programs/:id`의 `:id`에 비-cuid 형식 문자열(예: 공백, 잘못된 문자 패턴)을 지정한 경우, 시스템은 `404 Not Found`를 반환해야 한다(별도 `400` 분기는 두지 않으며 일관된 not-found 응답을 채택한다).

**REQ-PROG-VAL-003** (Ubiquitous)
시스템은 모든 입력 본문 검증을 NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` + `class-validator`로 일관되게 수행해야 한다. DTO에 정의되지 않은 필드는 차단되어 `400 Bad Request`를 반환한다.

**REQ-PROG-VAL-004** (Ubiquitous, 본 SPEC에서 정의되는 enum/형식)
시스템은 다음 enum/형식을 일관되게 사용해야 한다:
- `ProgramType`: `CATALOG` | `AI_GENERATED`
- `Goal` (AI 요청): `"muscle_gain"` | `"strength"` | `"endurance"`
- `Level`: 문자열 자유 입력이 아닌 `"beginner"` | `"intermediate"` | `"advanced"` 중 하나(시드 데이터에서 일관 적용)
- `month` (`AiUsageLog`): `"YYYY-MM"` 형식 문자열

**REQ-PROG-VAL-005** (Ubiquitous)
시스템은 본 SPEC 범위 내에서 생성되는 모든 `Program` 레코드(카탈로그 시드 및 AI 생성 포함)의 `isPublic` 값을 항상 `false`로 고정해야 한다.

### 3.7 NFR-PROG: 비기능 요구사항

#### NFR-PROG-PERF: 성능

- **NFR-PROG-PERF-001**: `GET /programs/catalog` 응답 시간 P95 ≤ 200ms (6건 + 일별 운동 수 집계).
- **NFR-PROG-PERF-002**: `GET /programs/:id` 응답 시간 P95 ≤ 300ms (단일 프로그램 전체 일/운동 조회 + Exercise join).
- **NFR-PROG-PERF-003**: `GET /programs/active` 응답 시간 P95 ≤ 300ms (UserProgram → Program → ProgramDay → ProgramExercise → Exercise join).
- **NFR-PROG-PERF-004**: `POST /programs/:id/activate` 응답 시간 P95 ≤ 200ms (UserProgram upsert).
- **NFR-PROG-PERF-005**: `DELETE /programs/active` 응답 시간 P95 ≤ 150ms (UserProgram delete).
- **NFR-PROG-PERF-006**: `POST /ai/programs` 응답 시간 P95 ≤ 10초(Anthropic API 호출 + 검증 + DB 저장 포함). 본 항목은 외부 API의 응답 시간에 강하게 의존하므로 한도(timeout)를 30초로 설정하고 초과 시 `504 Gateway Timeout`을 반환한다.

#### NFR-PROG-SEC: 보안

- **NFR-PROG-SEC-001**: 모든 본 SPEC의 엔드포인트는 `JwtAuthGuard`로 보호되며, JWT 누락/만료 시 `401 Unauthorized`를 반환한다.
- **NFR-PROG-SEC-002**: `POST /ai/programs`는 추가로 `RolesGuard(@Roles(PREMIUM, ADMIN))`로 보호된다. 권한 미달 시 `403 Forbidden`을 반환한다.
- **NFR-PROG-SEC-003**: 모든 엔드포인트는 JWT payload의 `sub`(userId)만 사용하며, URL/쿼리/본문에 `userId`를 받지 않는다.
- **NFR-PROG-SEC-004**: NestJS 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`로 알 수 없는 필드를 차단한다.
- **NFR-PROG-SEC-005**: AI 생성 프로그램의 응답에는 다른 사용자의 AI 프로그램이 포함되지 않으며, 카탈로그 프로그램은 모든 사용자가 동일하게 조회 가능하다.
- **NFR-PROG-SEC-006**: Anthropic API 호출에 사용되는 API 키는 환경 변수(`ANTHROPIC_API_KEY`)로 관리되며 응답이나 로그에 노출되어서는 안 된다.

#### NFR-PROG-DATA: 데이터 무결성

- **NFR-PROG-DATA-001**: `UserProgram(userId)`는 UNIQUE 제약을 가져야 한다(REQ-PROG-ACTIVE-002, 사용자당 활성 프로그램 1개).
- **NFR-PROG-DATA-002**: `ProgramDay(programId, dayNumber)`는 복합 UNIQUE 제약을 가져야 한다(동일 프로그램 내 dayNumber 중복 금지).
- **NFR-PROG-DATA-003**: `ProgramExercise(dayId, orderIndex)`는 복합 UNIQUE 제약을 가져야 한다(동일 일 내 orderIndex 중복 금지).
- **NFR-PROG-DATA-004**: `AiUsageLog(userId, month)`는 복합 UNIQUE 제약을 가져야 한다.
- **NFR-PROG-DATA-005**: `ProgramExercise.exerciseId`는 `Exercise.id`를 참조하는 외래키여야 한다(SPEC-EXERCISE-001 의존성).
- **NFR-PROG-DATA-006**: `UserProgram.userId`, `Program.createdBy`, `AiUsageLog.userId`의 외래키는 `User.id`를 참조하며 `onDelete: Cascade`로 설정한다(사용자 하드 삭제 시 자동 정리).
- **NFR-PROG-DATA-007**: `ProgramDay.programId` 외래키는 `Program.id`를 참조하며 `onDelete: Cascade`로 설정한다. `ProgramExercise.dayId` 외래키는 `ProgramDay.id`를 참조하며 `onDelete: Cascade`로 설정한다.

#### NFR-PROG-AI-COST: AI 비용 통제

- **NFR-PROG-AI-COST-001**: AI 호출은 Premium/Admin 사용자만 가능하며, 사용자별 월 10회로 제한된다(REQ-PROG-AI-002, REQ-PROG-AI-003).
- **NFR-PROG-AI-COST-002**: AI 응답 검증 실패 시 카운터를 증가시키지 않아 사용자 입장에서 "한도 손실 없는 실패"를 보장한다(REQ-PROG-AI-004, REQ-PROG-AI-005).
- **NFR-PROG-AI-COST-003**: Anthropic API의 `max_tokens` 등 비용 인자는 plan.md에서 합리적 상한(예: 4096)으로 설정하여 단일 호출 비용을 통제한다.

#### NFR-PROG-MOBILE: 모바일 호환성

- **NFR-PROG-MOBILE-001**: 모바일 클라이언트는 프로그램 목록(카탈로그 6종), 프로그램 상세, 현재 활성 프로그램, AI 생성 폼의 4개 화면을 제공해야 한다.
- **NFR-PROG-MOBILE-002**: 모바일 클라이언트는 TanStack Query로 `GET /programs/catalog`, `GET /programs/active`를 캐싱하며, `POST /programs/:id/activate` 또는 `DELETE /programs/active` 성공 시 `queryClient.invalidateQueries(['programs', 'active'])`로 캐시를 무효화한다.
- **NFR-PROG-MOBILE-003**: AI 생성 화면은 사용자에게 현재 월 사용량(`programCreations`/10)을 표시해야 하며, 한도 초과 시 호출 버튼을 비활성화한다(서버 측 `429` 응답에 대한 클라이언트 사전 차단).
- **NFR-PROG-MOBILE-004**: AI 생성 요청 중에는 로딩 인디케이터를 표시하고 사용자가 화면을 빠져나가지 못하도록 차단하거나, 진행 중 표시를 명확히 한다(요청 시간이 최대 30초).

#### NFR-PROG-CONSISTENCY: 공유 타입 일관성

- **NFR-PROG-CONSISTENCY-001**: `packages/types/src/program.ts`는 `ProgramType`, `Goal`, `Level`, `Program`, `ProgramDay`, `ProgramExercise`, `UserProgram`, `AiUsageLog` 타입을 export하며 백엔드 DTO와 호환된다.

---

## 4. 데이터 모델 (Data Model)

본 절은 Prisma 스키마 변경 사항을 정의한다. 기존 `prisma/schema.prisma`의 `User`, `Exercise` 모델에 역참조를 추가하고, `Program`, `ProgramDay`, `ProgramExercise`, `UserProgram`, `AiUsageLog` 모델 및 `ProgramType` enum을 신설한다.

### 4.1 ProgramType enum (신규)

```prisma
enum ProgramType {
  CATALOG       // pre-seeded catalog program
  AI_GENERATED  // AI-created custom program
}
```

### 4.2 Program 모델 (신규)

```prisma
model Program {
  id            String        @id @default(cuid())
  title         String
  description   String
  type          ProgramType
  level         String        // "beginner" | "intermediate" | "advanced"
  frequency     Int           // days per week (3~6)
  createdBy     String?       // null for CATALOG, userId for AI_GENERATED
  isPublic      Boolean       @default(false)  // always false in this SPEC
  createdAt     DateTime      @default(now())

  days          ProgramDay[]
  userPrograms  UserProgram[]
  creator       User?         @relation(fields: [createdBy], references: [id], onDelete: Cascade)

  @@index([type])             // for GET /programs/catalog
  @@index([createdBy])        // for owner-based lookup
}
```

**설계 결정**:
- `createdBy`는 `null` 허용(`CATALOG`인 경우). AI 생성 시에만 사용자 ID 저장.
- `isPublic`은 본 SPEC에서 항상 `false`이며, 추후 공유 기능 도입을 위해 필드만 정의(REQ-PROG-VAL-005).
- `type` 인덱스로 `GET /programs/catalog`의 `where type = 'CATALOG'` 쿼리 최적화.
- `createdBy` 인덱스로 사용자가 본인 AI 프로그램을 조회할 때 사용.

### 4.3 ProgramDay 모델 (신규)

```prisma
model ProgramDay {
  id          String            @id @default(cuid())
  programId   String
  dayNumber   Int               // 1-based (day 1, day 2, ...)
  name        String            // "Push Day", "Workout A", etc.

  program     Program           @relation(fields: [programId], references: [id], onDelete: Cascade)
  exercises   ProgramExercise[]

  @@unique([programId, dayNumber])
}
```

### 4.4 ProgramExercise 모델 (신규)

```prisma
model ProgramExercise {
  id          String     @id @default(cuid())
  dayId       String
  exerciseId  String
  orderIndex  Int        // display order within the day
  sets        Int        // 1~10
  reps        String     // "5" or "8-12" (regex: ^\d+(-\d+)?$)
  weightNote  String?    // "bodyweight", "50% 1RM", "start light"

  day         ProgramDay @relation(fields: [dayId], references: [id], onDelete: Cascade)
  exercise    Exercise   @relation(fields: [exerciseId], references: [id])

  @@unique([dayId, orderIndex])
  @@index([exerciseId])
}
```

**설계 결정**:
- `reps`는 문자열로 저장(`"5"`, `"8-12"` 등 범위 표현 지원). 정규식은 애플리케이션 레이어에서 검증.
- `weightNote`는 자유 텍스트(향후 1RM 비율, 부트스트랩 가이드 등을 자유롭게 표현).
- `exerciseId`는 `Exercise.id`(SPEC-EXERCISE-001) 참조. `onDelete`는 RESTRICT 또는 기본(NO ACTION) — Exercise 삭제 시 프로그램이 깨지지 않도록 운영에서는 Exercise 삭제를 금지(SPEC-EXERCISE-001 시드 정책).

### 4.5 UserProgram 모델 (신규)

```prisma
model UserProgram {
  id          String    @id @default(cuid())
  userId      String
  programId   String
  startedAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  program     Program   @relation(fields: [programId], references: [id])

  @@unique([userId])  // only 1 active program per user (REQ-PROG-ACTIVE-002)
}
```

**설계 결정**:
- `@@unique([userId])`로 사용자당 1건만 보장. 활성화 시 upsert로 자동 교체.
- 비활성화는 `DELETE`로 처리(레코드 자체 삭제, 이력 미보존, Non-Goals 참조).
- `program` 측 `onDelete`는 기본(RESTRICT)으로 두어 사용자 활성 프로그램이 있는 한 카탈로그 삭제를 막는다(운영 안전).

### 4.6 AiUsageLog 모델 (신규)

```prisma
model AiUsageLog {
  id               String    @id @default(cuid())
  userId           String
  month            String    // "YYYY-MM" (e.g., "2026-05")
  programCreations Int       @default(0)  // mode 2 (this SPEC), limit 10
  catalogRecs      Int       @default(0)  // mode 1 (future SPEC-AI-001), limit 5
  reevaluations    Int       @default(0)  // mode 3 (future SPEC-AI-001), limit 10

  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, month])
}
```

**설계 결정**:
- `month`는 `"YYYY-MM"` 문자열(타임존 영향 최소화, 단순 비교 가능).
- `catalogRecs`, `reevaluations` 카운터는 본 SPEC에서는 항상 `0`이며 후속 SPEC-AI-001에서 사용 예약(미리 정의해 두어 마이그레이션 추가 비용 회피).

### 4.7 User / Exercise 모델 (역참조 추가)

```prisma
model User {
  // ... existing fields
  aiPrograms    Program[]       @relation()    // type = AI_GENERATED, createdBy = id
  userProgram   UserProgram?    @relation()    // 1:1 active program
  aiUsageLogs   AiUsageLog[]    @relation()
}

model Exercise {
  // ... existing fields
  programExercises ProgramExercise[]
}
```

---

## 5. API 명세 (API Specification)

본 절은 본 SPEC이 정의하는 6개 엔드포인트의 요청·응답 구조를 명시한다. 모든 엔드포인트는 `JwtAuthGuard`로 보호되며, `POST /ai/programs`는 추가로 `RolesGuard(@Roles(PREMIUM, ADMIN))`로 보호된다.

### 5.1 GET /programs/catalog

**용도**: 6종 카탈로그 프로그램의 요약 정보 조회.

**Path/Query Parameters**: 없음

**Response 200 OK**:
```json
{
  "programs": [
    {
      "id": "clxxxxxxxx1",
      "title": "StrongLifts 5x5",
      "description": "초급자를 위한 전신 풀바디 프로그램 ...",
      "type": "CATALOG",
      "level": "beginner",
      "frequency": 3,
      "dayCount": 2,
      "exerciseSummary": { "averagePerDay": 5, "totalExercises": 10 },
      "createdAt": "2026-05-11T00:00:00.000Z"
    }
  ]
}
```

**Behavior**:
- 응답 `programs` 배열의 길이는 정확히 6이어야 한다(REQ-PROG-CATALOG-001, REQ-PROG-SEED-002).
- AI 생성 프로그램(`type = AI_GENERATED`)은 응답에 포함되지 않는다(REQ-PROG-CATALOG-005).

**Error Responses**:
- `401 Unauthorized`: JWT 누락/만료

### 5.2 GET /programs/active

**용도**: 현재 사용자의 활성 프로그램 조회.

**Path/Query Parameters**: 없음

**Response 200 OK (활성 있음)**:
```json
{
  "active": {
    "userProgramId": "...",
    "programId": "...",
    "startedAt": "2026-05-10T...",
    "program": { "id": "...", "title": "...", "type": "CATALOG", "days": [ ... ] }
  }
}
```

**Response 200 OK (활성 없음)**:
```json
{ "active": null }
```

**Behavior**:
- 활성 프로그램이 없을 때 `404`가 아닌 `200 OK`로 `{ active: null }`을 반환한다(REQ-PROG-ACTIVE-007).
- `program.days`와 `program.days[*].exercises`는 `dayNumber`/`orderIndex` 오름차순 정렬(REQ-PROG-DETAIL-007).

**Error Responses**:
- `401 Unauthorized`: JWT 누락/만료

### 5.3 GET /programs/:id

**용도**: 카탈로그 또는 본인 소유 AI 프로그램 상세 조회.

**Path Parameters**:
- `id`: 프로그램의 cuid

**Response 200 OK**:
```json
{
  "id": "...",
  "title": "...",
  "description": "...",
  "type": "CATALOG" | "AI_GENERATED",
  "level": "beginner",
  "frequency": 3,
  "createdAt": "...",
  "days": [
    {
      "id": "...",
      "dayNumber": 1,
      "name": "Workout A",
      "exercises": [
        {
          "id": "...",
          "exerciseId": "...",
          "orderIndex": 1,
          "sets": 5,
          "reps": "5",
          "weightNote": "start with empty bar",
          "exercise": {
            "name": "Barbell Squat",
            "primaryMuscles": ["quadriceps"],
            "image": "https://..."
          }
        }
      ]
    }
  ]
}
```

**Error Responses**:
- `401 Unauthorized`: JWT 누락/만료
- `404 Not Found`:
  - 존재하지 않는 `id` (REQ-PROG-DETAIL-005)
  - 본인이 생성하지 않은 AI 프로그램 (REQ-PROG-DETAIL-004)
  - `:id`가 비-cuid 형식 (REQ-PROG-VAL-002)

### 5.4 POST /programs/:id/activate

**용도**: 카탈로그 또는 본인 소유 AI 프로그램을 활성 프로그램으로 설정(upsert).

**Path Parameters**:
- `id`: 활성화할 프로그램의 cuid

**Request Body**: 없음

**Response Codes**:
- `200 OK`: 기존 활성 프로그램이 다른 프로그램으로 교체됨.
- `201 Created`: 사용자가 활성 프로그램이 없던 상태에서 새로 활성화됨.

**Response Body**:
```json
{
  "userProgramId": "...",
  "programId": "...",
  "startedAt": "2026-05-11T..."
}
```

**Error Responses**:
- `401 Unauthorized`: JWT 누락/만료
- `404 Not Found`:
  - 존재하지 않는 `id` (REQ-PROG-ACTIVE-008)
  - 본인이 생성하지 않은 AI 프로그램 (REQ-PROG-ACTIVE-003)

### 5.5 DELETE /programs/active

**용도**: 현재 활성 프로그램 비활성화(삭제).

**Request Body**: 없음

**Response 204 No Content**: 본문 없음.

**Behavior**:
- 활성 프로그램이 있든 없든 모두 `204`로 응답(멱등성, REQ-PROG-ACTIVE-005).

**Error Responses**:
- `401 Unauthorized`: JWT 누락/만료

### 5.6 POST /ai/programs

**용도**: AI(Claude Haiku 4.5)로 본인 맞춤 프로그램 생성.

**Authorization**: `JwtAuthGuard` + `RolesGuard(@Roles(PREMIUM, ADMIN))`.

**Request Body**:
```json
{
  "goal": "muscle_gain" | "strength" | "endurance",
  "daysPerWeek": 3,
  "availableEquipment": ["barbell", "dumbbell"],
  "focusAreas": ["chest", "back"]
}
```

| 필드 | 타입 | 검증 | 설명 |
|---|---|---|---|
| `goal` | string | enum 3종 | 목표 |
| `daysPerWeek` | integer | `3 <= n <= 6` | 주 운동 일수 |
| `availableEquipment` | string[] | 비어있지 않음 | 보유 장비 |
| `focusAreas` | string[] | 선택, 배열 | 집중 부위(선택) |

**Response 201 Created**:
- REQ-PROG-DETAIL-002/003과 동일한 프로그램 상세 구조 (Section 5.3 응답과 동일 형식).
- `type: "AI_GENERATED"`, `createdBy = JWT.sub`.

**Error Responses**:
- `400 Bad Request`: 입력 검증 실패 (REQ-PROG-AI-008)
- `401 Unauthorized`: JWT 누락/만료
- `403 Forbidden`: 권한 미달(User 역할) (REQ-PROG-AI-002)
- `422 Unprocessable Entity`: AI 응답 검증 실패 또는 Anthropic 응답 JSON 파싱 실패 — 카운터 미증가 (REQ-PROG-AI-005, REQ-PROG-AI-012)
- `429 Too Many Requests`: 월 한도 10회 초과 (REQ-PROG-AI-003)
- `502 Bad Gateway`: Anthropic API 네트워크 오류 / API 키 무효 / 5xx 오류 (REQ-PROG-AI-012)
- `504 Gateway Timeout`: Anthropic API 응답 시간 초과(30초) (NFR-PROG-PERF-006, REQ-PROG-AI-012)

### 5.7 라우트 등록 순서 (REQ-PROG-VAL-001)

`ProgramsController`(또는 동등 컨트롤러)에서 다음 순서를 강제한다(고정 경로가 동적 경로보다 먼저):

```
1. GET    /programs/catalog       (static)
2. GET    /programs/active        (static)
3. DELETE /programs/active        (static)
4. POST   /programs/:id/activate  (param + static suffix)
5. GET    /programs/:id           (dynamic)
```

`POST /ai/programs`는 별도 prefix(`/ai`)이므로 위 순서와 충돌하지 않는다.

---

## 6. AI 통합 설계 (AI Integration Design)

### 6.1 Claude Haiku 4.5 호출 구조

- 모델: `claude-haiku-4-5` (또는 plan.md에서 확정되는 정확한 model id)
- 호출 방식: Anthropic Messages API (`POST https://api.anthropic.com/v1/messages`)
- 요청 메시지: 시스템 프롬프트(역할 정의 + 출력 스키마 강제) + 사용자 프롬프트(사용자 입력 + Exercise ID 화이트리스트 일부 또는 운동 목록 컨텍스트)
- 응답 형식: JSON 구조화 출력 (response 본문에서 `<json>...</json>` 또는 직접 JSON 응답 — 구체 방식은 plan.md에서 확정)

### 6.2 응답 검증 파이프라인(REQ-PROG-AI-005)

다음 단계 순으로 검증하고, 첫 실패 시 `422 Unprocessable Entity`를 반환한다:

1. **JSON 파싱**: 응답 본문이 유효한 JSON인지 확인.
2. **스키마 검증**: `title`, `description`, `level`, `days` 필드 존재 및 타입. 각 `days[*]`의 `dayNumber`, `name`, `exercises` 필드 존재. 각 `exercises[*]`의 `exerciseId`, `orderIndex`, `sets`, `reps` 필드 존재.
3. **일수 일관성**: `days.length === request.daysPerWeek`.
4. **sets 범위**: 모든 `exercises[*].sets`가 정수이며 `1 <= sets <= 10`.
5. **reps 형식**: 모든 `exercises[*].reps`가 정규식 `^\d+(-\d+)?$`에 매치(단일 정수 또는 `n-m` 범위).
6. **level 값**: `"beginner" | "intermediate" | "advanced"` 중 하나.
7. **exerciseId 실존**: 응답에 등장한 모든 `exerciseId`를 `Exercise` 테이블에서 `findMany({ where: { id: { in: [...] } } })`로 일괄 조회하여 모두 존재함을 확인.

검증 통과 시 단일 트랜잭션으로 `Program` → `ProgramDay` → `ProgramExercise`를 순서대로 생성하고 `AiUsageLog.programCreations`를 +1 한다(REQ-PROG-AI-004, REQ-PROG-AI-009).

### 6.3 한도 사전 점검(REQ-PROG-AI-003)

- 요청 처리 시작 시 현재 월(`YYYY-MM`)에 대한 `AiUsageLog`를 조회.
- `programCreations >= 10`이면 즉시 `429 Too Many Requests` 반환(Anthropic API 호출 없음).
- 한도 미달 시에만 Anthropic API 호출 진행.

### 6.4 에러 처리 매트릭스

| 상황 | 응답 코드 | 카운터 영향 | API 호출 |
|---|---|---|---|
| 권한 미달 (User 역할) | 403 | 없음 | 없음 |
| 입력 검증 실패 (DTO) | 400 | 없음 | 없음 |
| 월 한도 초과 | 429 | 없음 | 없음 |
| Anthropic API 네트워크 오류 / API 키 무효 / 5xx | 502 | 없음 | 호출 (실패) |
| Anthropic API timeout (>30초) | 504 | 없음 | 호출 (timeout) |
| 응답 JSON 파싱 실패 | 422 | **없음** | 호출 (성공) |
| 응답 검증 실패 (스키마/exerciseId/sets/reps/level/days.length) | 422 | **없음** | 호출 (성공) |
| 검증 통과 + 저장 성공 | 201 | **+1** | 호출 (성공) |

---

## 7. 제외 사항 (Exclusions - What NOT to Build)

본 SPEC에서 **명시적으로 제외하는 항목**은 다음과 같다. 이는 후속 SPEC 또는 영구 비목표로 분류된다.

1. **프로그램 재평가 (AI 모드 3)**: 사용자의 활성 프로그램에 대한 AI 적합성 분석 및 개선 제안은 본 SPEC 범위 밖이다. 후속 SPEC-AI-001에서 다룬다. `AiUsageLog.reevaluations` 컬럼은 정의만 하고 본 SPEC에서는 사용하지 않는다.
2. **AI 카탈로그 추천 (AI 모드 1)**: 사용자 입력으로부터 6종 카탈로그 중 1~2종을 AI가 추천하는 기능은 본 SPEC 범위 밖이다. 후속 SPEC-AI-001. `AiUsageLog.catalogRecs` 컬럼은 정의만 하고 본 SPEC에서는 사용하지 않는다.
3. **운동 세션 기록(프로그램 진행도 추적)**: 활성 프로그램을 따라 실제로 운동을 수행한 기록(`Workout`, `WorkoutSet`), 현재 몇 주차/몇 일차인지의 진행 상태는 본 SPEC 범위 밖이다. SPEC-WORKOUT-001(후속)에서 다룬다.
4. **Admin의 카탈로그 프로그램 수정/추가**: 런타임 엔드포인트(`POST /admin/programs`, `PUT /admin/programs/:id` 등)는 본 SPEC 범위 밖이다. 카탈로그 변경은 `prisma db seed` 갱신과 마이그레이션으로 처리한다.
5. **프로그램 공유 기능 (`isPublic`)**: `Program.isPublic` 필드는 스키마에 정의하되 본 SPEC 범위에서는 항상 `false`로 고정한다. 사용자 간 프로그램 공유·검색·복제 기능은 비공개 앱 특성상 본 SPEC 및 후속 SPEC에서도 우선순위 낮음.
6. **사용자 프로그램 히스토리 목록**: "내 프로그램 목록"(사용자가 과거에 생성·활성화한 프로그램 타임라인) 조회는 본 SPEC 범위 밖이다. 활성 1개만 관리한다. AI 생성 프로그램의 비활성화 시점에 해당 `Program` 레코드를 삭제할지 유지할지는 plan.md에서 결정(권장: 유지, 사용자 본인 조회만 가능).
7. **프로그램 진행 일수 / 완료율 추적**: 사용자가 활성 프로그램을 며칠째 따르고 있는지, 완료율은 얼마인지 등의 메트릭은 본 SPEC 범위 밖이다. SPEC-WORKOUT-001 이후 도입.
8. **AI 응답 스트리밍 (SSE)**: Anthropic API의 스트리밍 응답을 클라이언트로 전달하는 SSE 엔드포인트는 본 SPEC 범위 밖이다. 동기 요청·응답으로만 처리한다.
9. **다국어 프로그램 콘텐츠**: 카탈로그 프로그램의 `title`, `description`은 한국어 단일 언어로 시드한다. 다국어 지원은 후속 localization SPEC에서 검토.
10. **프로그램 활성화 푸시 알림 / 캘린더 연동**: 활성화 시점 또는 운동 일정에 대한 푸시 알림, 외부 캘린더(Google, iCal) 연동은 본 SPEC 범위 밖이다.
11. **AI 사용량 일별 카운터**: `AiUsageLog`는 월 단위(`YYYY-MM`)만 관리하며, 일별 카운터는 본 SPEC 범위 밖이다.
12. **AI 사용량 환불 / 리셋 운영 엔드포인트**: 사용자가 한도를 잘못 소진한 경우 Admin이 카운터를 리셋하는 기능은 본 SPEC 범위 밖이다(필요 시 DB 직접 수정).
13. **여러 AI 프로그램 동시 보유 제한**: 사용자가 생성한 AI 프로그램은 누적 저장된다(자동 삭제 정책 없음). 다만 활성 프로그램은 1개로 제한된다. AI 프로그램의 자동 정리/만료 정책은 후속 SPEC에서 검토.

---

## 8. mx_plan (MX Tag Annotation Targets)

### 8.1 @MX:ANCHOR 대상 (high fan_in 함수)

- `programs.service.ts :: getCatalog()`: `GET /programs/catalog`의 단일 진입점. 카탈로그 응답 구조 불변식 보장.
- `programs.service.ts :: getProgramDetail(id, userId)`: `GET /programs/:id`와 `GET /programs/active`가 모두 의존하는 상세 빌더. 권한 검사 단일 지점.
- `programs.service.ts :: activateProgram(userId, programId)`: `POST /programs/:id/activate`의 단일 진입점. UserProgram upsert 멱등성 보장.
- `programs.service.ts :: deactivateProgram(userId)`: `DELETE /programs/active`의 단일 진입점. 멱등성(레코드 없어도 204) 보장.
- `ai-programs.service.ts :: createAiProgram(userId, dto)`: `POST /ai/programs`의 단일 진입점. 한도 점검 → API 호출 → 검증 → 저장 → 카운터 증가의 전 과정을 단일 트랜잭션으로 감싸는 지점.
- `ai-programs.service.ts :: validateAiResponse(response, request)`: AI 응답 7단계 검증의 단일 진입점.
- `seed/programs.ts :: seedCatalogPrograms()`: 6종 카탈로그 시드의 단일 진입점, idempotent.

### 8.2 @MX:WARN 대상 (danger zone, requires @MX:REASON)

- `programs.service.ts :: activateProgram()`: 동시에 같은 사용자가 다른 프로그램을 활성화 요청 시 race condition 가능 (REASON: REQ-PROG-ACTIVE-002 멱등성 — Prisma `upsert` on `@@unique([userId])` 사용 필수).
- `ai-programs.service.ts :: createAiProgram()`: 한도 점검과 카운터 증가 사이에 race condition (사용자가 동시에 다중 요청 시 11회 호출 가능) (REASON: REQ-PROG-AI-003 / REQ-PROG-AI-004 — 트랜잭션 + 카운터 increment를 `prisma.aiUsageLog.update({ where: ..., data: { programCreations: { increment: 1 } } })`로 원자적 처리 또는 advisory lock 검토).
- `ai-programs.service.ts :: callAnthropicApi()`: 외부 API 의존, 응답 시간 변동성 큼, 비용 발생 (REASON: NFR-PROG-PERF-006 timeout 30초, NFR-PROG-AI-COST `max_tokens` 상한 필수).
- `programs.controller.ts :: route ordering`: 고정 경로(`catalog`, `active`)와 동적 경로(`:id`) 충돌 가능 (REASON: REQ-PROG-VAL-001, SPEC-EXERCISE-001 REQ-EX-FAV-012 교훈).
- `seed/programs.ts :: seedCatalogPrograms()`: Exercise 시드 의존, FK 위반 가능 (REASON: REQ-PROG-SEED-003).

### 8.3 @MX:NOTE 대상

- `prisma/schema.prisma :: ProgramType enum`: `CATALOG`/`AI_GENERATED` 두 값. 추가 값(예: `USER_CUSTOM` 직접 편집형)은 후속 SPEC.
- `prisma/schema.prisma :: AiUsageLog`: `catalogRecs`, `reevaluations` 컬럼은 후속 SPEC-AI-001 예약, 본 SPEC에서는 항상 0.
- `prisma/schema.prisma :: UserProgram`: `@@unique([userId])`로 활성 1개 보장.
- `programs.controller.ts`: 라우트 순서 정책 — `catalog`/`active`(static) → `:id/activate`(param+suffix) → `:id`(dynamic).
- `ai-programs.service.ts :: validateAiResponse`: 7단계 검증 순서가 비용 효율적(가벼운 스키마 검증 먼저, 무거운 DB 조회 마지막).
- `ai-programs.service.ts :: createAiProgram`: 카운터 증가 정책 — 검증 통과 후에만 +1, 실패 시 미증가(REQ-PROG-AI-004).

### 8.4 @MX:TODO 대상 (후속 SPEC에서 해소)

- AI 카탈로그 추천(`catalogRecs` 카운터 사용) — SPEC-AI-001로 이관.
- AI 재평가(`reevaluations` 카운터 사용) — SPEC-AI-001로 이관.
- 프로그램 진행도 추적(주차, 완료율) — SPEC-WORKOUT-001로 이관.
- 사용자 프로그램 히스토리 목록 — 후속 SPEC 검토.
- Admin의 카탈로그 운영 엔드포인트 — 후속 SPEC 검토.
- `Program.isPublic` 활용(공유 기능) — 후속 SPEC 검토.

---

## 9. 추적성 매트릭스 (Traceability Matrix)

| REQ ID | acceptance.md 시나리오 | 출처 |
|--------|------------------------|------|
| REQ-PROG-CATALOG-001 | AC-PROG-CATALOG-01 | 사용자 인터뷰 (6종 시드) |
| REQ-PROG-CATALOG-002 | AC-PROG-CATALOG-01 | API 응답 일관성 |
| REQ-PROG-CATALOG-003 | AC-PROG-CATALOG-01 | 고정 6건 정책 |
| REQ-PROG-CATALOG-004 | AC-PROG-SECURITY-AUTH-01 | NFR-PROG-SEC-001 |
| REQ-PROG-CATALOG-005 | AC-PROG-CATALOG-01 | 카탈로그-AI 분리 |
| REQ-PROG-DETAIL-001 | AC-PROG-DETAIL-01 | 사용자 인터뷰 (상세 조회) |
| REQ-PROG-DETAIL-002 | AC-PROG-DETAIL-01 | API 응답 일관성 |
| REQ-PROG-DETAIL-003 | AC-PROG-DETAIL-01 | API 응답 일관성 |
| REQ-PROG-DETAIL-004 | AC-PROG-SECURITY-OWNERSHIP-01 | AI 프로그램 권한 격리 |
| REQ-PROG-DETAIL-005 | AC-PROG-DETAIL-NOTFOUND-01 | 404 처리 |
| REQ-PROG-DETAIL-006 | AC-PROG-SECURITY-AUTH-01 | NFR-PROG-SEC-001 |
| REQ-PROG-DETAIL-007 | AC-PROG-DETAIL-01 | 정렬 일관성 |
| REQ-PROG-ACTIVE-001 | AC-PROG-ACTIVATE-01 | 사용자 인터뷰 (활성화) |
| REQ-PROG-ACTIVE-002 | AC-PROG-ACTIVATE-02 | 활성 1개 원칙 |
| REQ-PROG-ACTIVE-003 | AC-PROG-SECURITY-OWNERSHIP-02 | NFR-PROG-SEC-005 |
| REQ-PROG-ACTIVE-004 | AC-PROG-DEACTIVATE-01 | 사용자 인터뷰 (비활성화) |
| REQ-PROG-ACTIVE-005 | AC-PROG-DEACTIVATE-02 | 멱등성 |
| REQ-PROG-ACTIVE-006 | AC-PROG-ACTIVE-GET-01 | 사용자 인터뷰 (현재 활성 조회) |
| REQ-PROG-ACTIVE-007 | AC-PROG-ACTIVE-EMPTY-01 | 사용자 인터뷰 (null 응답) |
| REQ-PROG-ACTIVE-008 | AC-PROG-ACTIVATE-NOTFOUND-01 | 404 처리 |
| REQ-PROG-ACTIVE-009 | AC-PROG-SECURITY-AUTH-01 | NFR-PROG-SEC-001 |
| REQ-PROG-ACTIVE-010 | AC-PROG-SECURITY-OWNERSHIP-03 | 사용자 격리 |
| REQ-PROG-AI-001 | AC-PROG-AI-SUCCESS-01 | 사용자 인터뷰 (AI 모드 2) |
| REQ-PROG-AI-002 | AC-PROG-AI-RBAC-01 | NFR-PROG-SEC-002 |
| REQ-PROG-AI-003 | AC-PROG-AI-LIMIT-01 | 비용 통제 |
| REQ-PROG-AI-004 | AC-PROG-AI-INVALID-AI-RESPONSE-01, AC-PROG-AI-LIMIT-01 | 한도 손실 없는 실패 |
| REQ-PROG-AI-005 | AC-PROG-AI-INVALID-AI-RESPONSE-01 | AI 응답 검증 |
| REQ-PROG-AI-006 | (수동 검증, MV-PROG-AI-PROMPT-01) | AI 프롬프트 설계 |
| REQ-PROG-AI-007 | AC-PROG-AI-RBAC-01, AC-PROG-SECURITY-AUTH-01 | NFR-PROG-SEC-002 |
| REQ-PROG-AI-008 | AC-PROG-AI-VALIDATION-01 | 입력 검증 |
| REQ-PROG-AI-009 | AC-PROG-AI-SUCCESS-01 | 트랜잭션 무결성 |
| REQ-PROG-AI-010 | AC-PROG-AI-SUCCESS-01 | 사용량 추적 스키마 |
| REQ-PROG-AI-011 | AC-PROG-SECURITY-OWNERSHIP-03 | 사용자 격리 |
| REQ-PROG-AI-012 | AC-PROG-AI-UPSTREAM-FAIL-01 | 외부 API 장애 |
| REQ-PROG-SEED-001 | AC-PROG-SEED-01 | 시드 정확성 |
| REQ-PROG-SEED-002 | AC-PROG-SEED-01 | 6종 정의 |
| REQ-PROG-SEED-003 | AC-PROG-SEED-02 | Exercise 의존성 |
| REQ-PROG-SEED-004 | AC-PROG-CATALOG-01, AC-PROG-SEED-01 | 한국어 콘텐츠 |
| REQ-PROG-SEED-005 | AC-PROG-SEED-02 | idempotency |
| REQ-PROG-VAL-001 | AC-PROG-ROUTE-01 | SPEC-EXERCISE-001 교훈 |
| REQ-PROG-VAL-002 | AC-PROG-DETAIL-NOTFOUND-01 | 일관된 404 |
| REQ-PROG-VAL-003 | AC-PROG-AI-VALIDATION-01 | ValidationPipe 표준 |
| REQ-PROG-VAL-004 | AC-PROG-CATALOG-01, AC-PROG-AI-SUCCESS-01 | enum 일관성 |
| REQ-PROG-VAL-005 | AC-PROG-CATALOG-01, AC-PROG-AI-SUCCESS-01 | isPublic 고정 |
| NFR-PROG-PERF-001~006 | AC-PROG-PERF-01 | 성능 SLO |
| NFR-PROG-SEC-001~006 | AC-PROG-SECURITY-AUTH-01, AC-PROG-SECURITY-OWNERSHIP-01~03 | OWASP A01/A02 |
| NFR-PROG-DATA-001~007 | AC-PROG-ACTIVATE-02, AC-PROG-AI-SUCCESS-01 | 데이터 무결성 |
| NFR-PROG-AI-COST-001~003 | AC-PROG-AI-LIMIT-01, AC-PROG-AI-RBAC-01 | 비용 통제 |
| NFR-PROG-MOBILE-001~004 | (수동 검증 MV-PROG-MOBILE-01~04) | 모바일 UX |
| NFR-PROG-CONSISTENCY-001 | (정적 검사 / 빌드 통과) | 공유 타입 |
