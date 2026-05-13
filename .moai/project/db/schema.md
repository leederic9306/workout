---
engine: postgresql
orm: prisma
last_synced_at: 2026-05-13
manifest_hash: prisma/schema.prisma
---

# Database Schema

**Engine**: PostgreSQL 15  
**ORM**: Prisma 5  
**Migration Tool**: Prisma Migrate  
**Multi-tenant**: 없음 (단일 테넌트)  
**Migration Path**: `apps/backend/prisma/migrations/**/*.sql`

---

## Tables

| Table | Description |
|-------|-------------|
| User | 사용자 계정 — 이메일/소셜 인증, RBAC 역할, 소프트 삭제 |
| InviteCode | 초대 코드 — Admin이 발급, 가입 제한용 |
| RoleChangeLog | 역할 변경 이력 — Admin 조작 감사 로그 |
| Exercise | 운동 도감 — free-exercise-db 기반 800+ 항목 |
| UserExerciseFavorite | 사용자 즐겨찾기 운동 — User ↔ Exercise 조인 |
| WorkoutSession | 운동 세션 기록 — 세션 단위 메타데이터 |
| WorkoutSet | 세트 기록 — 세션 내 운동별 무게/횟수/RPE |
| OneRepMax | 1RM 기록 — 컴파운드 5종 사용자별 최대 무게 |
| Program | 운동 프로그램 — 카탈로그 6종 + AI 생성 |
| ProgramDay | 프로그램 요일 — 프로그램 내 일별 구조 |
| ProgramExercise | 프로그램 운동 — 요일별 운동 목록 및 세트/횟수 |
| UserProgram | 활성 프로그램 — 사용자당 1개 강제 (@@unique) |
| AiUsageLog | AI 사용량 로그 — 월별 모드별 횟수 추적 |

---

## Enums

| Enum | Values | Usage |
|------|--------|-------|
| UserRole | ADMIN, PREMIUM, USER | User.role |
| SocialProvider | KAKAO, GOOGLE | User.socialProvider |
| Gender | MALE, FEMALE, OTHER | User.gender |
| ExperienceLevel | BEGINNER, INTERMEDIATE, ADVANCED | User.experienceLevel |
| SessionStatus | IN_PROGRESS, COMPLETED | WorkoutSession.status |
| CompoundType | SQUAT, DEADLIFT, BENCH_PRESS, BARBELL_ROW, OVERHEAD_PRESS | OneRepMax.exerciseType |
| OrmSource | DIRECT_INPUT, ESTIMATED | OneRepMax.source |
| ProgramType | CATALOG, AI_GENERATED | Program.type |

---

## Column Details

### User

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| email | TEXT | NO | — | UNIQUE |
| passwordHash | TEXT | YES | — | 이메일 로그인용, 소셜은 null |
| nickname | TEXT | YES | — | 온보딩 수집 |
| gender | Gender | YES | — | 온보딩 수집 |
| birthDate | TIMESTAMP | YES | — | 온보딩 수집 |
| height | FLOAT | YES | — | 온보딩 수집 (cm) |
| experienceLevel | ExperienceLevel | YES | — | 온보딩 수집 |
| role | UserRole | NO | USER | RBAC 역할 |
| socialProvider | SocialProvider | YES | — | Kakao/Google |
| socialId | TEXT | YES | — | 소셜 제공자 내부 ID |
| inviteCodeUsed | TEXT | YES | — | 가입 시 사용한 초대 코드 |
| refreshTokenHash | TEXT | YES | — | bcrypt 해시된 Refresh Token |
| emailVerified | BOOLEAN | NO | false | 이메일 인증 여부 |
| premiumExpiresAt | TIMESTAMP | YES | — | Premium 만료 일시 |
| deletedAt | TIMESTAMP | YES | — | 소프트 삭제 일시 |
| createdAt | TIMESTAMP | NO | now() | |
| updatedAt | TIMESTAMP | NO | @updatedAt | |

### InviteCode

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| code | TEXT | NO | — | UNIQUE, 가입 시 입력 코드 |
| createdAt | TIMESTAMP | NO | now() | |
| expiresAt | TIMESTAMP | NO | — | 코드 만료일 |
| usedBy | TEXT | YES | — | FK → User.id |
| usedAt | TIMESTAMP | YES | — | 사용 시각 |

### RoleChangeLog

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| targetUserId | TEXT | NO | — | FK → User.id |
| changedByUserId | TEXT | NO | — | FK → User.id (Admin) |
| fromRole | UserRole | NO | — | 변경 전 역할 |
| toRole | UserRole | NO | — | 변경 후 역할 |
| reason | TEXT | NO | — | 변경 사유 |
| createdAt | TIMESTAMP | NO | now() | |

### Exercise

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| externalId | TEXT | NO | — | UNIQUE, free-exercise-db 원본 ID |
| name | TEXT | NO | — | 운동 이름 |
| force | TEXT | YES | — | push/pull/static |
| level | TEXT | NO | — | beginner/intermediate/advanced |
| mechanic | TEXT | YES | — | compound/isolation |
| equipment | TEXT | YES | — | barbell/dumbbell/etc |
| primaryMuscles | TEXT[] | NO | — | 주동근 배열 |
| secondaryMuscles | TEXT[] | NO | — | 협력근 배열 |
| instructions | TEXT[] | NO | — | 수행 방법 단계 |
| category | TEXT | NO | — | 운동 카테고리 |
| images | TEXT[] | NO | — | 이미지/GIF URL 배열 |
| createdAt | TIMESTAMP | NO | now() | |
| updatedAt | TIMESTAMP | NO | @updatedAt | |

### UserExerciseFavorite

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| userId | TEXT | NO | — | FK → User.id (CASCADE DELETE) |
| exerciseId | TEXT | NO | — | FK → Exercise.id (CASCADE DELETE) |
| favoritedAt | TIMESTAMP | NO | now() | |

### WorkoutSession

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| userId | TEXT | NO | — | FK → User.id (CASCADE DELETE) |
| name | TEXT | YES | — | 세션 이름 (선택) |
| notes | TEXT | YES | — | 메모 |
| status | SessionStatus | NO | IN_PROGRESS | 세션 상태 |
| startedAt | TIMESTAMP | NO | now() | 세션 시작 시각 |
| completedAt | TIMESTAMP | YES | — | 세션 완료 시각 |

### WorkoutSet

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| sessionId | TEXT | NO | — | FK → WorkoutSession.id (CASCADE DELETE) |
| exerciseId | TEXT | NO | — | FK → Exercise.id |
| setNumber | INT | NO | — | 세션 내 세트 순서 |
| reps | INT | YES | — | 횟수 |
| weight | FLOAT | YES | — | 무게 (kg) |
| duration | INT | YES | — | 시간 (초, 타바타 등) |
| notes | TEXT | YES | — | 세트 메모 |
| recordedAt | TIMESTAMP | NO | now() | |

### OneRepMax

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| userId | TEXT | NO | — | FK → User.id (CASCADE DELETE) |
| exerciseType | CompoundType | NO | — | 컴파운드 운동 종류 |
| value | FLOAT | NO | — | 1RM 값 (kg) |
| source | OrmSource | NO | DIRECT_INPUT | 직접 입력 vs 추정 |
| createdAt | TIMESTAMP | NO | now() | |
| updatedAt | TIMESTAMP | NO | @updatedAt | |

### Program

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| title | TEXT | NO | — | 프로그램 이름 |
| description | TEXT | NO | — | 프로그램 설명 |
| type | ProgramType | NO | — | CATALOG or AI_GENERATED |
| level | TEXT | NO | — | beginner/intermediate/advanced |
| frequency | INT | NO | — | 주간 운동 일수 |
| createdBy | TEXT | YES | — | FK → User.id (AI 생성 시), CATALOG는 null |
| isPublic | BOOLEAN | NO | false | 공개 여부 |
| createdAt | TIMESTAMP | NO | now() | |
| updatedAt | TIMESTAMP | NO | @updatedAt | |

### ProgramDay

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| programId | TEXT | NO | — | FK → Program.id (CASCADE DELETE) |
| dayNumber | INT | NO | — | 요일 번호 (1부터) |
| name | TEXT | NO | — | 요일 이름 (예: "Push Day") |

### ProgramExercise

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| dayId | TEXT | NO | — | FK → ProgramDay.id (CASCADE DELETE) |
| exerciseId | TEXT | NO | — | FK → Exercise.id |
| orderIndex | INT | NO | — | 요일 내 순서 |
| sets | INT | NO | — | 세트 수 |
| reps | TEXT | NO | — | 횟수 (예: "5", "8-12") |
| weightNote | TEXT | YES | — | 무게 가이드 (예: "70% 1RM") |

### UserProgram

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| userId | TEXT | NO | — | FK → User.id (CASCADE DELETE), UNIQUE |
| programId | TEXT | NO | — | FK → Program.id |
| startedAt | TIMESTAMP | NO | now() | 프로그램 시작일 |

### AiUsageLog

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | TEXT | NO | cuid() | PK |
| userId | TEXT | NO | — | FK → User.id (CASCADE DELETE) |
| month | TEXT | NO | — | "YYYY-MM" 형식 |
| programCreations | INT | NO | 0 | AI 맞춤 프로그램 생성 횟수 (Premium: 월 10회) |
| catalogRecs | INT | NO | 0 | AI 카탈로그 추천 횟수 (User: 월 5회) |
| reevaluations | INT | NO | 0 | AI 프로그램 재평가 횟수 (Premium: 월 10회) |

---

## Relationships

| From | To | Cardinality | FK Column | Notes |
|------|----|-------------|-----------|-------|
| User | InviteCode | 1:N | InviteCode.usedBy | 사용자가 사용한 초대 코드 |
| User | RoleChangeLog | 1:N | RoleChangeLog.targetUserId | 역할 변경 대상 |
| User | RoleChangeLog | 1:N | RoleChangeLog.changedByUserId | 역할 변경 주체 (Admin) |
| User | UserExerciseFavorite | 1:N | UserExerciseFavorite.userId | CASCADE DELETE |
| User | WorkoutSession | 1:N | WorkoutSession.userId | CASCADE DELETE |
| User | OneRepMax | 1:N | OneRepMax.userId | CASCADE DELETE |
| User | Program | 1:N | Program.createdBy | AI 생성 프로그램 소유자 (nullable) |
| User | UserProgram | 1:1 | UserProgram.userId | @@unique — 활성 프로그램 1개 제한 |
| User | AiUsageLog | 1:N | AiUsageLog.userId | CASCADE DELETE |
| Exercise | UserExerciseFavorite | 1:N | UserExerciseFavorite.exerciseId | CASCADE DELETE |
| Exercise | WorkoutSet | 1:N | WorkoutSet.exerciseId | RESTRICT |
| Exercise | ProgramExercise | 1:N | ProgramExercise.exerciseId | RESTRICT |
| WorkoutSession | WorkoutSet | 1:N | WorkoutSet.sessionId | CASCADE DELETE |
| Program | ProgramDay | 1:N | ProgramDay.programId | CASCADE DELETE |
| Program | UserProgram | 1:N | UserProgram.programId | RESTRICT |
| ProgramDay | ProgramExercise | 1:N | ProgramExercise.dayId | CASCADE DELETE |

---

## Indexes

| Table | Columns | Type | Purpose |
|-------|---------|------|---------|
| User | email | UNIQUE | 이메일 로그인 중복 방지 |
| User | (socialProvider, socialId) | UNIQUE | 소셜 계정 중복 방지 |
| User | email | INDEX | 이메일 검색 성능 |
| User | deletedAt | INDEX | 소프트 삭제 필터 성능 |
| InviteCode | code | UNIQUE | 초대 코드 유일성 |
| InviteCode | code | INDEX | 코드 조회 성능 |
| RoleChangeLog | targetUserId | INDEX | 사용자별 이력 조회 |
| Exercise | externalId | UNIQUE | free-exercise-db ID 중복 방지 |
| Exercise | equipment | INDEX | 기구별 필터 |
| Exercise | category | INDEX | 카테고리별 필터 |
| UserExerciseFavorite | (userId, exerciseId) | UNIQUE | 중복 즐겨찾기 방지 |
| UserExerciseFavorite | userId | INDEX | 사용자 즐겨찾기 목록 조회 |
| WorkoutSession | (userId, status) | INDEX | 사용자별 진행 중 세션 조회 |
| WorkoutSession | (userId, startedAt DESC) | INDEX | 사용자별 최근 세션 페이지네이션 |
| WorkoutSet | sessionId | INDEX | 세션별 세트 조회 |
| OneRepMax | (userId, exerciseType) | UNIQUE | 사용자-운동 종류별 1RM 중복 방지 |
| OneRepMax | userId | INDEX | 사용자 1RM 목록 조회 |
| Program | type | INDEX | 카탈로그/AI 타입별 필터 |
| Program | createdBy | INDEX | 사용자 생성 프로그램 조회 |
| ProgramDay | (programId, dayNumber) | UNIQUE | 프로그램 내 요일 중복 방지 |
| ProgramExercise | (dayId, orderIndex) | UNIQUE | 요일 내 순서 중복 방지 |
| ProgramExercise | dayId | INDEX | 요일별 운동 목록 조회 |
| UserProgram | userId | UNIQUE | 사용자당 활성 프로그램 1개 강제 |
| AiUsageLog | (userId, month) | UNIQUE | 사용자-월별 중복 방지 |
| AiUsageLog | userId | INDEX | 사용자 AI 사용량 조회 |

---

## Constraints

| Table | Constraint | Type | Definition |
|-------|-----------|------|-----------|
| User | User_email_key | UNIQUE | email must be unique |
| User | User_socialProvider_socialId_key | UNIQUE | (socialProvider, socialId) pair |
| InviteCode | InviteCode_code_key | UNIQUE | code must be unique |
| UserExerciseFavorite | UserExerciseFavorite_userId_exerciseId_key | UNIQUE | (userId, exerciseId) pair |
| OneRepMax | OneRepMax_userId_exerciseType_key | UNIQUE | (userId, exerciseType) pair — 운동 종류별 1RM 1개 |
| ProgramDay | ProgramDay_programId_dayNumber_key | UNIQUE | (programId, dayNumber) pair |
| ProgramExercise | ProgramExercise_dayId_orderIndex_key | UNIQUE | (dayId, orderIndex) pair |
| UserProgram | UserProgram_userId_key | UNIQUE | userId — 활성 프로그램 1개 강제 |
| AiUsageLog | AiUsageLog_userId_month_key | UNIQUE | (userId, month) pair |
