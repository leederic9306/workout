# Seed Data

**Seed Command**: `cd apps/backend && pnpm prisma db seed`  
**Seed File**: `apps/backend/prisma/seed.ts`

---

## Seed Strategy

**Strategy**: Script (Prisma seed script) + 오픈소스 데이터셋

**Seeding tool**: Prisma (`prisma db seed`)

**When seeds run**:
- [x] `pnpm prisma migrate dev` 이후 로컬 개발 셋업 시
- [x] CI 통합 테스트 전
- [ ] Staging 환경 리셋 시 (Exercise 데이터만)
- [ ] Production (Exercise + 카탈로그 프로그램은 prod 배포 시 1회 실행)

**Seed order** (FK 제약 순서):

1. Exercise (~800개) — free-exercise-db 오픈소스 데이터
2. Program (카탈로그 6종) — 수작업 정의
3. ProgramDay — 각 프로그램의 요일 구조
4. ProgramExercise — 요일별 운동 항목 (Exercise FK 필요)

---

## Fixture Locations

| Environment | Path | Format | Notes |
|-------------|------|--------|-------|
| Development | apps/backend/prisma/seed.ts | TypeScript script | Exercise + 카탈로그 전체 |
| Test / CI | apps/backend/prisma/seed.ts | TypeScript script | 동일 (소규모 앱) |
| Production | apps/backend/prisma/seed.ts | TypeScript script | Exercise + 카탈로그만 (사용자 데이터 제외) |

---

## Seed Datasets

### 1. Exercise Library (~800개)

| 항목 | 내용 |
|------|------|
| 출처 | `yuhonas/free-exercise-db` GitHub 오픈소스 |
| 규모 | 800+ 운동 항목 |
| 라이선스 | Creative Commons |
| 포함 데이터 | name, force, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions, category, images |
| 적재 방식 | JSON 파싱 후 `prisma.exercise.createMany()` |

### 2. Catalog Programs (6종)

| 프로그램 | 주당 횟수 | 난이도 |
|----------|-----------|--------|
| 5x5 풀바디 | 3일 | beginner |
| 선형 진행 | 3일 | beginner |
| PPL (Push-Pull-Legs) | 6일 | intermediate |
| Arnold Split | 6일 | advanced |
| Upper-Lower | 4일 | intermediate |
| 풀바디 3일 | 3일 | beginner |

---

## Dev vs Prod Data

**항상 시드 (dev/test + production)**:

- Exercise 데이터 (~800개) — 앱 핵심 기능, prod에도 필수
- 카탈로그 Program 6종 — CATALOG 타입, prod에도 필수
- ProgramDay, ProgramExercise (카탈로그 연결)

**절대 프로덕션에 시드하지 않는 것**:

- 테스트 User 계정 (alice@example.com 등)
- 테스트 InviteCode
- 더미 WorkoutSession, WorkoutSet
- 더미 OneRepMax 기록

**Production 안전 시드 (참조/정적 데이터)**:

- Exercise 테이블 전체
- 카탈로그 Program + ProgramDay + ProgramExercise
