# Migrations

**Migration Tool**: Prisma Migrate  
**Migration Path**: `apps/backend/prisma/migrations/`  
**Total Migrations**: 8

---

## Applied Migrations

| Filename | Applied At | Summary |
|----------|-----------|---------|
| 20260512000000_init_auth | 2026-05-12 | User, InviteCode, RoleChangeLog 테이블 생성 + UserRole/SocialProvider/Gender/ExperienceLevel enum |
| 20260512000001_add_exercise_library | 2026-05-12 | Exercise, UserExerciseFavorite 테이블 생성 |
| 20260512000002_add_exercise_gin_index | 2026-05-12 | Exercise.primaryMuscles GIN 인덱스 추가 |
| 20260512000003_add_one_rep_max | 2026-05-12 | OneRepMax 테이블 생성 + CompoundType/OrmSource enum |
| 20260512131408_add_exercise_library | 2026-05-12 | Exercise GIN 인덱스 제거 (재정의 준비) |
| 20260512132818_add_workout_session | 2026-05-12 | WorkoutSession, WorkoutSet 테이블 생성 + SessionStatus enum |
| 20260512135322_add_program_models | 2026-05-12 | Program, ProgramDay, ProgramExercise, UserProgram, AiUsageLog 테이블 생성 + ProgramType enum |
| 20260513000000_add_user_deleted_at | 2026-05-13 | User.deletedAt 컬럼 추가 (소프트 삭제) + 인덱스 |

---

## Pending Migrations

현재 없음. `schema.prisma`와 마이그레이션 상태 동기화됨.

---

## Rollback Notes

| Migration | Risk Level | Rollback Steps | Data Loss? |
|-----------|-----------|----------------|------------|
| 20260512000000_init_auth | Critical | DROP TABLE "User", "InviteCode", "RoleChangeLog"; DROP TYPE enum들 | YES — 사용자 데이터 전체 소실 |
| 20260512000001_add_exercise_library | High | DROP TABLE "UserExerciseFavorite", "Exercise" | YES — 운동 도감 시드 데이터 소실 |
| 20260512000002_add_exercise_gin_index | Low | DROP INDEX "exercise_primary_muscles_gin_idx" | No |
| 20260512000003_add_one_rep_max | Medium | DROP TABLE "OneRepMax"; DROP TYPE "CompoundType", "OrmSource" | YES — 1RM 기록 소실 |
| 20260512131408_add_exercise_library | Low | RECREATE GIN index | No |
| 20260512132818_add_workout_session | High | DROP TABLE "WorkoutSet", "WorkoutSession"; DROP TYPE "SessionStatus" | YES — 운동 세션 기록 소실 |
| 20260512135322_add_program_models | High | DROP TABLE "AiUsageLog", "UserProgram", "ProgramExercise", "ProgramDay", "Program"; DROP TYPE "ProgramType" | YES — 프로그램 데이터 소실 |
| 20260513000000_add_user_deleted_at | Low | ALTER TABLE "User" DROP COLUMN "deletedAt"; DROP INDEX "User_deletedAt_idx" | No (소프트 삭제 이력만) |
