---
id: SPEC-PROGRAM-001
version: "1.0.1"
status: draft
created_at: "2026-05-11"
updated_at: "2026-05-12"
author: leederic9306
priority: high
issue_number: 0
labels: ["program", "ai", "backend", "mobile"]
---

# SPEC-PROGRAM-001 (Compact)

운동 프로그램 — 근력 운동 트래커 앱의 운동 프로그램 시스템. 6종 사전 시드 카탈로그 프로그램(StrongLifts 5x5, Starting Strength, Beginner PPL, Intermediate PPL, Arnold Split, Upper/Lower Split) 조회, 사용자당 활성 프로그램 1개 관리(`@@unique([userId])` upsert), Premium/Admin 전용 AI 맞춤 프로그램 생성(Claude Haiku 4.5, 월 10회). SPEC-AUTH-001 + SPEC-EXERCISE-001 위에서 동작하며 모든 엔드포인트는 `JwtAuthGuard`로 보호, `POST /ai/programs`는 추가로 `RolesGuard(@Roles(PREMIUM, ADMIN))`로 보호.

> **REQ 번호 체계**: 본 SPEC은 도메인 네임스페이스 기반 REQ 번호(`REQ-PROG-CATALOG-001`, `REQ-PROG-DETAIL-001`, `REQ-PROG-ACTIVE-001`, `REQ-PROG-AI-001`, `REQ-PROG-SEED-001`, `REQ-PROG-VAL-001`)를 사용한다. 이는 SPEC-AUTH-001/USER-001/EXERCISE-001/1RM-001과 동일한 프로젝트 표준 컨벤션이다. 평탄 순차 번호로 재번호하지 않는다.

> **v1.0.1 변경 사항 (2026-05-12)**: plan-auditor 1차 감사 반영. (a) REQ-PROG-ACTIVE-010/AI-011/VAL-005 Unwanted EARS 패턴 수정. (b) REQ-PROG-AI-001 응답 코드 `201 Created`로 확정. (c) REQ-PROG-AI-012 upstream 오류 코드 명확화: 네트워크/5xx → `502`, JSON 파싱 실패 → `422`, timeout → `504`. (d) REQ-PROG-AI-004 Event-Driven 재분류.

---

## EARS 요구사항

### REQ-PROG-CATALOG: 카탈로그 조회

- **REQ-PROG-CATALOG-001** (Event-Driven): 인증된 사용자가 `GET /programs/catalog`를 호출했을 때, 시스템은 `Program.type = CATALOG`인 모든 프로그램을 `200 OK`로 배열로 반환해야 한다.
- **REQ-PROG-CATALOG-002** (Ubiquitous): 응답 각 항목은 `id, title, description, type="CATALOG", level, frequency, dayCount, exerciseSummary, createdAt`을 포함한다.
- **REQ-PROG-CATALOG-003** (Ubiquitous): 페이지네이션 메타(`page, limit, total`)는 포함하지 않는다(고정 6건).
- **REQ-PROG-CATALOG-004** (Ubiquitous): `JwtAuthGuard`로 보호.
- **REQ-PROG-CATALOG-005** (Ubiquitous): AI 생성 프로그램(`type = AI_GENERATED`)은 응답에 포함하지 않는다.

### REQ-PROG-DETAIL: 프로그램 상세

- **REQ-PROG-DETAIL-001** (Event-Driven): 인증된 사용자가 `GET /programs/:id`를 호출했을 때, 시스템은 프로그램 상세(모든 `ProgramDay`/`ProgramExercise`)를 `200 OK`로 반환해야 한다.
- **REQ-PROG-DETAIL-002** (Ubiquitous): 각 `ProgramExercise` 항목은 `exerciseId, orderIndex, sets, reps, weightNote, exercise.name/primaryMuscles/images[0]`을 포함한다.
- **REQ-PROG-DETAIL-003** (Ubiquitous): 각 `ProgramDay` 항목은 `id, dayNumber, name, exercises(orderIndex 정렬)`를 포함한다.
- **REQ-PROG-DETAIL-004** (Event-Driven): 본인이 생성하지 않은 AI 프로그램(`type=AI_GENERATED AND createdBy != JWT.sub`)에 대해 `GET /programs/:id` 호출 시 `404 Not Found`.
- **REQ-PROG-DETAIL-005** (Event-Driven): 존재하지 않는 `:id` → `404 Not Found`.
- **REQ-PROG-DETAIL-006** (Ubiquitous): `JwtAuthGuard`로 보호.
- **REQ-PROG-DETAIL-007** (Ubiquitous): `days`는 `dayNumber` 오름차순, 각 일의 `exercises`는 `orderIndex` 오름차순 정렬.

### REQ-PROG-ACTIVE: 활성 프로그램 관리

- **REQ-PROG-ACTIVE-001** (Event-Driven): 인증된 사용자가 `POST /programs/:id/activate`를 호출했을 때, 시스템은 `UserProgram`을 upsert하여 신규 시 `201 Created`, 기존 교체 시 `200 OK`로 `{userProgramId, programId, startedAt}`을 반환한다.
- **REQ-PROG-ACTIVE-002** (Ubiquitous): 사용자당 활성 프로그램 최대 1개(`@@unique([userId])` on UserProgram).
- **REQ-PROG-ACTIVE-003** (Event-Driven): 본인이 생성하지 않은 AI 프로그램 활성화 시도 → `404 Not Found`.
- **REQ-PROG-ACTIVE-004** (Event-Driven): 인증된 사용자가 `DELETE /programs/active`를 호출했을 때, 활성 프로그램 삭제 + `204 No Content`.
- **REQ-PROG-ACTIVE-005** (Event-Driven): 활성 프로그램이 없는 상태에서 `DELETE /programs/active` → 멱등 `204 No Content`(404 아님).
- **REQ-PROG-ACTIVE-006** (Event-Driven): 인증된 사용자가 `GET /programs/active`를 호출했을 때, 활성 있으면 `200 OK + {active: <상세>}` 반환.
- **REQ-PROG-ACTIVE-007** (Event-Driven): 활성 부재 시 `GET /programs/active` → `200 OK + {active: null}`(404 아님).
- **REQ-PROG-ACTIVE-008** (Event-Driven): 존재하지 않는 `:id`로 activate → `404 Not Found`.
- **REQ-PROG-ACTIVE-009** (Ubiquitous): 3개 엔드포인트 모두 `JwtAuthGuard`로 보호.
- **REQ-PROG-ACTIVE-010** (Unwanted): 사용자가 자신의 활성 프로그램이 아닌 타 사용자의 `UserProgram`에 접근하려 할 때, 시스템은 해당 요청을 거부하고 `403 Forbidden`을 반환해야 한다. 모든 활성 프로그램 엔드포인트는 JWT `sub`로만 사용자 식별.

### REQ-PROG-AI: AI 맞춤 프로그램 생성

- **REQ-PROG-AI-001** (Event-Driven): Premium/Admin 사용자가 `POST /ai/programs` 본문 `{goal, daysPerWeek, availableEquipment, focusAreas?}`로 요청 시, 시스템은 Claude Haiku 4.5에 JSON 응답을 요청하고 검증 통과 시 `Program(type:AI_GENERATED, createdBy: JWT.sub)`로 저장한 후 생성된 상세를 **`201 Created`**로 반환한다.
- **REQ-PROG-AI-002** (Event-Driven): `User` 권한 호출 시 `403 Forbidden`. Anthropic API 미호출, 카운터 미증가.
- **REQ-PROG-AI-003** (Event-Driven): 현재 월 `programCreations >= 10`이면 `429 Too Many Requests`. Anthropic API 미호출.
- **REQ-PROG-AI-004** (Event-Driven): Premium 또는 Admin이 `POST /ai/programs`를 호출했을 때, `programCreations < 10`인 경우에만 AI 생성을 진행하고, 응답 검증 통과 + 프로그램 저장 성공 시에만 `programCreations`를 +1 한다. 그 외에는 미증가.
- **REQ-PROG-AI-005** (Event-Driven): AI 응답 검증 실패(스키마/일수/exerciseId 실존/sets 범위/reps 정규식 `^\d+(-\d+)?$`/level 값) 시 `422 Unprocessable Entity`. 카운터 미증가.
- **REQ-PROG-AI-006** (Ubiquitous): AI 응답은 `{title, description, level, days[{dayNumber, name, exercises[{exerciseId, orderIndex, sets, reps, weightNote?}]}]}` 스키마.
- **REQ-PROG-AI-007** (Ubiquitous): `JwtAuthGuard + RolesGuard(@Roles(PREMIUM, ADMIN))`로 보호.
- **REQ-PROG-AI-008** (Event-Driven): 입력 검증 실패(goal enum / daysPerWeek 3~6 / availableEquipment 비어있지 않음) → `400 Bad Request`. Anthropic API 미호출.
- **REQ-PROG-AI-009** (Ubiquitous): 검증 통과된 응답으로 Program/ProgramDay/ProgramExercise를 단일 트랜잭션 내에서 저장.
- **REQ-PROG-AI-010** (Ubiquitous): `AiUsageLog`는 `(userId, month: "YYYY-MM")` 복합 UNIQUE.
- **REQ-PROG-AI-011** (Unwanted): AI 응답 검증이 실패한 경우, 시스템은 `programCreations` 카운터를 증가시키지 않고 `422 Unprocessable Entity`를 반환해야 한다. 요청 바디/헤더의 userId 필드는 사용자 식별에 사용 금지(JWT `sub`/`role`만 사용).
- **REQ-PROG-AI-012** (Event-Driven): Anthropic API 호출 실패 분기 — (a) 네트워크 오류 / API 키 무효 / 5xx → `502 Bad Gateway`, (b) 응답 JSON 파싱 실패 → `422 Unprocessable Entity`, (c) 30초 timeout → `504 Gateway Timeout`. 모든 분기에서 카운터 미증가, Program 미저장.

### REQ-PROG-SEED: 카탈로그 시드

- **REQ-PROG-SEED-001** (Ubiquitous): `prisma db seed` 실행 시 6종 카탈로그 프로그램이 정확히 1회 시드되어야 하며 idempotent.
- **REQ-PROG-SEED-002** (Ubiquitous): 6종은 (1) StrongLifts 5x5/풀바디/초급/주3일 (2) Starting Strength/풀바디/초급/주3일 (3) Beginner PPL/Push-Pull-Legs/초중급/주6일 (4) Intermediate PPL/Push-Pull-Legs/중급/주6일 (5) Arnold Split/가슴등+어깨팔+다리/고급/주6일 (6) Upper/Lower Split/상체-하체/중급/주4일. 각각 `type=CATALOG, createdBy=null, isPublic=false`.
- **REQ-PROG-SEED-003** (Ubiquitous): Exercise 시드(SPEC-EXERCISE-001) 완료 후 시드되어야 함. 모든 `exerciseId`가 `Exercise.id`에 실존. 미실존 시 시드 스크립트 실패.
- **REQ-PROG-SEED-004** (Ubiquitous): `title`(영문 원본 명칭 유지)과 `description`(한국어)을 한국어로 시드.
- **REQ-PROG-SEED-005** (Event-Driven): 시드 재실행 시 중복 생성 없이 정상 종료.

### REQ-PROG-VAL: 검증 및 운영

- **REQ-PROG-VAL-001** (Event-Driven): 고정 경로(`catalog`, `active`)가 동적 경로(`:id`)보다 먼저 라우팅되어야 함. 컨트롤러 메서드 정의 순서 강제(SPEC-EXERCISE-001 REQ-EX-FAV-012 교훈 적용; 구체 구현은 plan.md).
- **REQ-PROG-VAL-002** (Event-Driven): `:id`가 비-cuid 형식 → `404 Not Found`(별도 400 분기 없음).
- **REQ-PROG-VAL-003** (Ubiquitous): NestJS 전역 `ValidationPipe({whitelist:true, forbidNonWhitelisted:true, transform:true})` + `class-validator` 사용.
- **REQ-PROG-VAL-004** (Ubiquitous): enum/형식 일관성 — `ProgramType`(`CATALOG|AI_GENERATED`), `Goal`(`muscle_gain|strength|endurance`), `Level`(`beginner|intermediate|advanced`), `month`(`"YYYY-MM"`).
- **REQ-PROG-VAL-005** (Unwanted): `GET /programs/catalog` 또는 `GET /programs/active` 경로 요청 시 `:id` 동적 라우트로 매칭되어서는 안 된다. 또한 `Program.isPublic` 값을 `true`로 설정해서는 안 되며 본 SPEC에서 항상 `false`로 고정.

### NFR-PROG: 비기능 요구사항

- **NFR-PROG-PERF-001~006**: P95 — `GET catalog ≤ 200ms`, `GET :id ≤ 300ms`, `GET active ≤ 300ms`, `POST activate ≤ 200ms`, `DELETE active ≤ 150ms`, `POST /ai/programs ≤ 10초`(timeout 30초).
- **NFR-PROG-SEC-001~006**: 모든 엔드포인트 `JwtAuthGuard`, AI는 `RolesGuard`, JWT `sub`만 사용, ValidationPipe로 알 수 없는 필드 차단, AI 프로그램 격리, `ANTHROPIC_API_KEY` 로그/응답 비노출.
- **NFR-PROG-DATA-001~007**: `UserProgram(userId)` UNIQUE, `ProgramDay(programId, dayNumber)` 복합 UNIQUE, `ProgramExercise(dayId, orderIndex)` 복합 UNIQUE, `AiUsageLog(userId, month)` 복합 UNIQUE, Exercise FK, User onDelete Cascade, ProgramDay/ProgramExercise onDelete Cascade.
- **NFR-PROG-AI-COST-001~003**: Premium/Admin만, 월 10회 한도, 검증 실패 시 카운터 미증가, `max_tokens: 4096` 상한.
- **NFR-PROG-MOBILE-001~004**: 카탈로그/상세/활성/AI 생성 4개 화면, TanStack Query 캐싱, AI 사용량 배지 표시, 로딩 인디케이터(최대 30초).
- **NFR-PROG-CONSISTENCY-001**: `packages/types/src/program.ts` 공유 타입을 백엔드/모바일이 동일하게 사용.

---

## 인수 시나리오 요약 (Given-When-Then)

### AC-PROG-CATALOG-01: 6종 카탈로그 응답
- Given: 카탈로그 6건 시드 완료
- When: `GET /programs/catalog`
- Then: 200, `programs` 배열 길이 정확히 6, 모두 `type="CATALOG"`, AI 프로그램 미포함, 페이지네이션 메타 없음, 한국어 description 포함

### AC-PROG-DETAIL-01: 카탈로그 상세 조회
- Given: 카탈로그 프로그램 P 존재
- When: `GET /programs/<P.id>`
- Then: 200, days(dayNumber 정렬) + exercises(orderIndex 정렬, Exercise 정보 중첩) 반환

### AC-PROG-DETAIL-NOTFOUND-01: 존재하지 않거나 잘못된 ID
- When: `GET /programs/<non-existent>`, `/invalid-format`, `/12345`
- Then: 모두 404

### AC-PROG-ACTIVATE-01: 신규 활성화
- Given: U1 활성 없음, 카탈로그 P_CATALOG 존재
- When: `POST /programs/<P_CATALOG.id>/activate`
- Then: **201 Created**, `{userProgramId, programId, startedAt}`, DB UserProgram 1건 생성

### AC-PROG-ACTIVATE-02: 기존 활성 교체
- Given: AC-PROG-ACTIVATE-01 직후
- When: 다른 카탈로그 P_CATALOG2로 activate
- Then: **200 OK**(201 아님), UserProgram 1건 유지, programId 교체

### AC-PROG-ACTIVATE-NOTFOUND-01: 존재하지 않는 ID activate
- Then: 404, UserProgram 변경 없음

### AC-PROG-DEACTIVATE-01: 활성 있는 상태에서 DELETE
- Then: 204, UserProgram 0건

### AC-PROG-DEACTIVATE-02: 활성 없는 상태에서 DELETE (멱등성)
- When: 연속 2회 호출
- Then: 두 번 모두 204(404 아님)

### AC-PROG-ACTIVE-GET-01: 활성 있음
- Then: 200, `{active: <ProgramDetail>}` (programId 일치, days+exercises 포함)

### AC-PROG-ACTIVE-EMPTY-01: 활성 없음
- Then: **200 OK** + `{active: null}`(404 아님)

### AC-PROG-AI-SUCCESS-01: Premium + 유효 응답 → 정상 생성
- Given: UP(Premium), `programCreations < 10`, Anthropic 모킹 유효 응답
- When: `POST /ai/programs` 유효 본문
- Then: **`201 Created`**(확정, v1.0.1), type="AI_GENERATED", days.length = daysPerWeek, 단일 트랜잭션 저장, `programCreations` +1

### AC-PROG-AI-RBAC-01: User 권한 → 403
- Given: U1(USER), Anthropic 모킹
- When: `POST /ai/programs` 유효 본문
- Then: 403, Anthropic 미호출, DB 변경 없음, 카운터 미증가

### AC-PROG-AI-LIMIT-01: 월 한도 초과 → 429
- Given: UP, `programCreations = 10`
- When: `POST /ai/programs` 유효 본문
- Then: 429, Anthropic 미호출, 카운터 여전히 10

### AC-PROG-AI-INVALID-AI-RESPONSE-01: 존재하지 않는 exerciseId → 422
- Given: UP, `programCreations = 5`, Anthropic 모킹이 잘못된 exerciseId 응답
- When: `POST /ai/programs`
- Then: 422, Program 미생성, **`programCreations` 여전히 5**(카운터 미증가), Anthropic 호출은 발생(비용 발생)
- 추가 검증 7단계: 파싱/스키마/days.length/sets 범위/reps 정규식/level 값/exerciseId 실존 각각 단위 테스트

### AC-PROG-AI-VALIDATION-01: 입력 DTO 검증 실패 → 400
- When: 잘못된 goal/daysPerWeek/availableEquipment 또는 whitelist 위반
- Then: 모두 400, Anthropic 미호출, 카운터 미증가

### AC-PROG-AI-UPSTREAM-FAIL-01: Anthropic API 장애 분기 (v1.0.1 확정)
- 시나리오 A (네트워크/5xx): → `502 Bad Gateway`
- 시나리오 B (30초 timeout): → `504 Gateway Timeout`
- 시나리오 C (JSON 파싱 실패): → `422 Unprocessable Entity`
- 모든 시나리오: Program 미저장, 카운터 미증가

### AC-PROG-ROUTE-01: 라우트 정합성
- When: `GET /catalog`, `GET /active`, `DELETE /active`, `POST /:id/activate`, `GET /:id` 순차 호출
- Then: catalog/active 고정 경로가 :id로 잘못 라우팅되지 않음. 정적 검사로 메서드 정의 순서 확인.

### AC-PROG-SECURITY-AUTH-01: 인증 누락/만료 401
- When: 6개 엔드포인트를 토큰 없이/만료/변조
- Then: 모두 401, DB 변경 없음, Anthropic 미호출

### AC-PROG-SECURITY-OWNERSHIP-01: AI 프로그램 조회 격리
- Given: UP1의 AI 프로그램 P_AI
- When: UP2가 `GET /programs/<P_AI.id>`
- Then: 404 (본인은 200)

### AC-PROG-SECURITY-OWNERSHIP-02: AI 프로그램 activate 격리
- Given: UP1의 AI 프로그램 P_AI
- When: UP2가 `POST /programs/<P_AI.id>/activate`
- Then: 404, UP2 UserProgram 생성 없음

### AC-PROG-SECURITY-OWNERSHIP-03: 요청 바디 userId 무시 (whitelist)
- When: `POST /programs/:id/activate` 또는 `POST /ai/programs` 본문에 `userId` 포함
- Then: 400 (`property userId should not exist`), DB 변경 없음

### AC-PROG-SEED-01: 시드 후 정확히 6건
- Then: `program.count({where:{type:CATALOG}})` === 6, 한국어 description, 모든 exerciseId 실존, 6종 영문 title 모두 포함

### AC-PROG-SEED-02: 시드 idempotency
- When: `prisma db seed` 2회 실행
- Then: 6건 유지, 중복 생성 없음, 두 번째 실행 에러 없음

### AC-PROG-PERF-01: 성능 기준선
- Then: P95 — GET catalog ≤ 200ms, GET :id ≤ 300ms, GET active ≤ 300ms, POST activate ≤ 200ms, DELETE active ≤ 150ms

### MV-PROG-MOBILE-01~04 + MV-PROG-AI-PROMPT-01: 수동 검증 (DoD 자동화 요구에서 제외)
- 카탈로그 표시 / 활성화 흐름 / AI 권한·한도 표시 / AI 생성 진행 UX / AI 응답 품질 시각 검토

---

## 변경 대상 파일 요약

### 백엔드 (apps/backend/)

- `prisma/schema.prisma` — `ProgramType` enum, `Program`/`ProgramDay`/`ProgramExercise`/`UserProgram`/`AiUsageLog` 모델, 모든 UNIQUE/INDEX/FK 제약, User/Exercise 역참조
- `prisma/migrations/` — `add_program_models` 마이그레이션
- `prisma/seed/programs.ts` — 6종 카탈로그 시드(REQ-PROG-SEED-001~005)
- `prisma/seed/index.ts` — `seedExercises()` 다음으로 `seedCatalogPrograms()` 호출
- `src/programs/programs.module.ts`
- `src/programs/programs.controller.ts` — 5개 라우트 (메서드 정의 순서: catalog/active(GET)/active(DELETE) → :id/activate → :id; REQ-PROG-VAL-001)
- `src/programs/programs.service.ts` — `getCatalog`, `getDetail`(권한 검사 포함), `activate`(upsert + 권한), `deactivate`(멱등), `getActive`
- `src/programs/dto/*.ts` — catalog-item, catalog-response, program-detail, active-response, activate-response
- `src/ai/ai.module.ts`
- `src/ai/ai-programs.controller.ts` — `POST /ai/programs`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(PREMIUM, ADMIN)`, 응답 코드 `201 Created` 확정(v1.0.1)
- `src/ai/ai-programs.service.ts` — 한도 점검 → API 호출 → 검증 → 트랜잭션 저장 + 카운터 +1. upstream 오류 분기 `502`(네트워크/5xx) / `422`(JSON 파싱 실패) / `504`(timeout) 확정(v1.0.1)
- `src/ai/anthropic.client.ts` — Anthropic Messages API 래퍼(`@anthropic-ai/sdk`), 30초 timeout, `max_tokens:4096`
- `src/ai/ai-validation.service.ts` — 7단계 응답 검증(REQ-PROG-AI-005)
- `src/ai/dto/create-ai-program.dto.ts` — `goal`/`daysPerWeek`/`availableEquipment`/`focusAreas` 검증
- `src/app.module.ts` — `ProgramsModule`, `AiModule` 등록
- `src/main.ts` — `ValidationPipe({whitelist:true, forbidNonWhitelisted:true, transform:true})` 전역
- 테스트 4종 (`programs.service.spec.ts`, `programs.e2e-spec.ts`, `ai-programs.service.spec.ts`, `ai-validation.service.spec.ts`, `ai-programs.e2e-spec.ts`)

### 모바일 (apps/mobile/)

- `app/(tabs)/programs/index.tsx` — 카탈로그 목록 화면
- `app/(tabs)/programs/[id].tsx` — 프로그램 상세 화면
- `app/(tabs)/programs/active.tsx` — 활성 프로그램 화면
- `app/(tabs)/programs/ai-create.tsx` — AI 생성 폼 (Premium/Admin)
- `components/programs/ProgramCard.tsx`, `ProgramDaySection.tsx`, `ProgramExerciseRow.tsx`, `AiProgramForm.tsx`, `AiUsageBadge.tsx`
- `services/programs.ts` — fetch/mutation 함수
- `hooks/usePrograms.ts` — TanStack Query 훅

### 공유 타입 (packages/types/)

- `packages/types/src/program.ts` — `ProgramType`, `Goal`, `Level`, `Program`, `ProgramDay`, `ProgramExercise`, `CatalogItem`, `CreateAiProgramRequest`, `AiUsage`
- `packages/types/src/index.ts` — export 추가

### 환경 변수

- `ANTHROPIC_API_KEY` (필수) — `.env`, `.env.example`에 추가

---

## 제외 사항 (Exclusions)

1. **프로그램 재평가 (AI 모드 3)** — SPEC-AI-001(후속). `AiUsageLog.reevaluations` 컬럼 정의만 유지.
2. **AI 카탈로그 추천 (AI 모드 1)** — SPEC-AI-001(후속). `AiUsageLog.catalogRecs` 컬럼 정의만 유지.
3. **운동 세션 기록 (프로그램 진행도 추적)** — SPEC-WORKOUT-001(후속). `Workout`/`WorkoutSet` 모델, 주차/일차 진행 상태 미구현.
4. **Admin 카탈로그 운영 엔드포인트** — `POST/PUT/DELETE /admin/programs` 미제공. 카탈로그 변경은 시드 갱신 + 마이그레이션.
5. **프로그램 공유 기능 (isPublic)** — `Program.isPublic` 필드는 스키마에 정의하되 본 SPEC에서 항상 `false`. 비공개 앱 특성.
6. **사용자 프로그램 히스토리 목록** — 활성 1개만 관리. 과거 활성화 이력 미보존(`UserProgram` 비활성화 시 레코드 삭제).
7. **프로그램 진행 일수 / 완료율** — SPEC-WORKOUT-001 이후 도입.
8. **AI 응답 스트리밍 (SSE)** — 동기 요청·응답으로만 처리.
9. **다국어 프로그램 콘텐츠** — 카탈로그 한국어 단일. 후속 localization SPEC.
10. **프로그램 활성화 푸시 알림 / 캘린더 연동** — 본 SPEC 범위 밖.
11. **AI 사용량 일별 카운터** — 월 단위만 관리.
12. **AI 사용량 환불/리셋 운영 엔드포인트** — 본 SPEC 범위 밖.
13. **AI 프로그램 자동 정리/만료 정책** — 누적 허용. 후속 SPEC 검토.
