## SPEC-EXERCISE-001 Progress

- Started: 2026-05-12
- Phase 0.9 complete: TypeScript (NestJS + Expo), moai-domain-backend + moai-domain-frontend
- Phase 0.95 complete: Full Pipeline mode (27+ files, 3 domains)
- Phase 1 complete: manager-strategy execution plan approved
- Plan approval: User confirmed "진행" — Backend (P1-P4) + Mobile (P5-P7)
- [2026-05-12] Backend P1-P4 COMPLETE (manager-tdd): 24 new tests pass, tsc clean
  - Prisma: Exercise + UserExerciseFavorite models, 2 migrations (table DDL + GIN index)
  - exercises.json: Downloaded to apps/backend/prisma/seed/ (1001472 bytes, 867 exercises)
  - NestJS: exercises module (controller/service/DTOs), registered in AppModule
  - main.ts: forbidNonWhitelisted changed false (REQ-EX-FILTER-005)
  - shared types: packages/types/src/index.ts updated
- [2026-05-12] Mobile P5-P7 COMPLETE (expert-frontend): all screens implemented
  - services/exercises.ts, hooks/useExercises.ts
  - components/workout: ExerciseCard, FilterChips, FavoriteButton
  - app/(tabs)/workout/: index.tsx (list + filters + infinite scroll), [id].tsx (detail + carousel)
  - app/index.tsx: redirects to /(tabs)/workout
  - package.json: expo-image ~2.0.0 added (pending pnpm install)
- PENDING: pnpm install + prisma migrate dev + prisma db seed (requires live DB)
