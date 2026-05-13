# SPEC-WORKOUT-001 Compact

## ID
SPEC-WORKOUT-001

## Domain
운동 세션 기록 (Workout Session Logging) — Phase 3 마지막 SPEC

## Dependencies
SPEC-AUTH-001 (JwtAuthGuard, @CurrentUser), SPEC-USER-001 (User), SPEC-EXERCISE-001 (Exercise + slug), SPEC-1RM-001 (OneRepMax, CompoundType, OrmSource, packages/utils/src/1rm.ts), SPEC-PROGRAM-001 (UserProgram, ProgramDay, route order pattern)

## Endpoints (12)
- POST /workouts — 세션 생성 (자유 `exerciseIds` 또는 프로그램 `programDayId`, 진행 1개 제약 409)
- GET /workouts — 페이지네이션 목록 (status, startedAtFrom/To, page, limit≤100, startedAt DESC)
- GET /workouts/active — 진행 중 세션 (없으면 `{ active: null }` 200)
- GET /workouts/:id — 본인 세션 상세 (sets + exercise join, orderIndex ASC)
- PATCH /workouts/:id — notes 수정 (모든 status 허용, ≤1000자)
- DELETE /workouts/:id — CANCELLED만 삭제 (COMPLETED/IN_PROGRESS는 409)
- POST /workouts/:id/complete — IN_PROGRESS→COMPLETED + 1RM 비동기 갱신
- POST /workouts/:id/cancel — IN_PROGRESS→CANCELLED
- POST /workouts/:id/sets — 세트 추가 (IN_PROGRESS 한정, setNumber 자동 추천)
- PATCH /workouts/:id/sets/:setId — 세트 부분 수정 (isCompleted 전환 시 completedAt 자동)
- DELETE /workouts/:id/sets/:setId — 세트 영구 삭제
- GET /workouts/utils/plates?weight&barWeight — 좌우 대칭 원판 조합 (1.25/2.5/5/10/15/20kg, bar 15/20)

## Data Models
- `SessionStatus` enum: IN_PROGRESS | COMPLETED | CANCELLED
- `WorkoutSession`: id, userId(FK Cascade), programId?(FK SetNull), programDayId?(FK SetNull), status, notes?, startedAt, completedAt?, cancelledAt?, createdAt, updatedAt. Index: (userId, status), (userId, startedAt DESC). 진행 1개 제약은 app-layer enforced (advisory lock).
- `WorkoutSet`: id, sessionId(FK Cascade), exerciseId(FK Restrict), setNumber(1~50), weight Decimal(7,2)?(0~1000, null for bodyweight), reps(1~200), rpe?(1~10), isCompleted, completedAt?, orderIndex, createdAt, updatedAt. UNIQUE(sessionId, exerciseId, setNumber).

## Key REQs
- REQ-WO-SESSION-001/002: 자유 또는 프로그램 기반 세션 생성 (201)
- REQ-WO-SESSION-003: 진행 1개 충돌 시 409 (PostgreSQL advisory lock)
- REQ-WO-SESSION-008: 타 사용자 접근 시 404 (정보 누설 방지)
- REQ-WO-SET-002: UNIQUE(sessionId, exerciseId, setNumber) 위반 409
- REQ-WO-SET-006: COMPLETED/CANCELLED 세션의 세트 변경 409
- REQ-WO-COMPLETE-006: COMPLETED 삭제 금지 409 (기록 보존)
- REQ-WO-1RM-001~007: 세션 완료 시 컴파운드(SQUAT/DEADLIFT/BENCH_PRESS/BARBELL_ROW/OVERHEAD_PRESS) 적격 세트의 Epley/Brzycki Average 최댓값 추정 → 상향 갱신만 (source=AVERAGE_ESTIMATE), best-effort 비동기 (`setImmediate`), 실패는 로그만
- REQ-WO-PLATES-001~005: 좌우 대칭 탐욕 알고리즘, 결정성 보장, JwtAuthGuard 보호
- REQ-WO-VAL-001: 라우트 등록 순서 (collection → static → dynamic → suffix → nested dynamic)

## NFRs
- PERF P95: POST /workouts ≤300ms, GET /active ≤200ms, GET /:id ≤400ms, GET list ≤500ms, 세트 CRUD ≤200ms, complete/cancel ≤300ms, plates ≤50ms, 1RM 비동기 ≤1s
- SEC: 모든 엔드포인트 JwtAuthGuard, JWT.sub만 사용, URL/쿼리/본문에 userId 미수용, ownership 위반 404
- DATA: User Cascade, Program/ProgramDay SetNull, Exercise Restrict, Session Cascade, 인덱스 3종, UNIQUE 1종
- MOBILE: 4개 화면 (시작/진행/상세/히스토리), TanStack Query + Zustand 휴식 타이머, optimistic update
- CONSISTENCY: 1RM 공식은 packages/utils/src/1rm.ts 공유 (별도 구현 금지)

## Compound Mapping
`COMPOUND_EXERCISE_SLUG_MAP`: barbell-back-squat→SQUAT, conventional-deadlift→DEADLIFT, barbell-bench-press→BENCH_PRESS, barbell-row→BARBELL_ROW, overhead-press→OVERHEAD_PRESS. 기동 시점 assertion으로 매핑 실존 검증.

## Acceptance
AC-WO-SESSION-CREATE-FREE-01, AC-WO-SESSION-CREATE-PROGRAM-01, AC-WO-SESSION-CONFLICT-01, AC-WO-SESSION-CREATE-INVALID-01, AC-WO-SET-ADD-01, AC-WO-SET-ADD-BODYWEIGHT-01, AC-WO-SET-DUPLICATE-01, AC-WO-SET-VALIDATION-01, AC-WO-SET-UPDATE-01, AC-WO-SET-DELETE-01, AC-WO-SET-LOCKED-01, AC-WO-SET-NOTFOUND-01, AC-WO-SET-AUTO-NUMBER-01, AC-WO-COMPLETE-01, AC-WO-CANCEL-01, AC-WO-COMPLETE-DOUBLE-01, AC-WO-COMPLETE-EMPTY-01, AC-WO-DELETE-CANCELLED-01, AC-WO-DELETE-COMPLETED-01, AC-WO-DELETE-INPROGRESS-01, AC-WO-NOTES-UPDATE-01, AC-WO-LIST-01, AC-WO-LIST-FILTER-01, AC-WO-ACTIVE-01, AC-WO-ACTIVE-EMPTY-01, AC-WO-DETAIL-01, AC-WO-DETAIL-NOTFOUND-01, AC-WO-PLATES-01, AC-WO-PLATES-VALIDATION-01, AC-WO-PLATES-DETERMINISTIC-01, AC-WO-1RM-UPDATE-01, AC-WO-1RM-NO-DOWNGRADE-01, AC-WO-1RM-NO-COMPOUND-01, AC-WO-1RM-INCOMPLETE-SET-EXCLUDED-01, AC-WO-1RM-NULL-WEIGHT-EXCLUDED-01, AC-WO-1RM-FAILURE-ISOLATED-01, AC-WO-SECURITY-AUTH-01, AC-WO-SECURITY-OWNERSHIP-01/02, AC-WO-SECURITY-NO-USERID-IN-INPUT-01, AC-WO-ROUTE-01, AC-WO-PERF-01

## Exclusions
세션 통계, 휴식 타이머 서버 동기화, 공유/소셜, 외부 export, AI 분석, 다중 동시 진행, 푸시 알림, 자동 PR 알림, 데이터 백업, 다국어, 세션 템플릿, 세트 단위 메모, 시간 추적, 운동 강도 추천, isCompleted 일괄 토글

## Version
1.0.0 (draft, 2026-05-12, author: leederic9306)
