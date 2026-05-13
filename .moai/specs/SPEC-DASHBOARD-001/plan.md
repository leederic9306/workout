# SPEC-DASHBOARD-001 구현 계획 (Plan)

본 문서는 SPEC-DASHBOARD-001(대시보드 및 체성분 관리)의 구체적 구현 계획이다. EARS 요구사항을 어떻게 코드로 옮길지, 어떤 결정 분기에서 어느 옵션을 선택하는지, 그리고 어떤 위험과 마일스톤이 있는지를 정의한다.

전제:
- SPEC-AUTH-001, SPEC-USER-001, SPEC-EXERCISE-001, SPEC-1RM-001은 구현 완료 상태.
- SPEC-WORKOUT-001은 RUN이 본 SPEC보다 먼저 완료된 상태(또는 본 SPEC을 Step A/B로 분리하여 진행).
- 백엔드는 NestJS 10 + Prisma 5 + PostgreSQL 15. 모바일은 React Native + Expo SDK 51 + TypeScript + TanStack Query + Zustand.
- 모노레포는 Turborepo + pnpm.

---

## 1. 마일스톤 (Priority-Based Phase Ordering)

본 SPEC은 백엔드 → 모바일 순으로 진행하며, 각 마일스톤은 독립적으로 RUN 가능하도록 분리한다. 시간 추정치는 사용하지 않으며 우선순위 라벨(High/Medium/Low)과 단계 순서를 사용한다.

### Milestone M1 — Prisma 스키마 + 마이그레이션 (Priority: High)

목표: `BodyComposition` 모델을 schema에 추가하고 마이그레이션을 적용한다.

순서:
1. `apps/backend/prisma/schema.prisma`에 `BodyComposition` 모델 추가 (Section 4.1 참조).
2. `User` 모델에 `bodyCompositions BodyComposition[]` 역참조 추가.
3. `pnpm --filter @workout/backend prisma migrate dev --name add_body_composition` 실행.
4. `pnpm --filter @workout/backend prisma generate`로 Prisma Client 재생성.
5. 생성된 마이그레이션 SQL을 리뷰하여 `Decimal(5,2)`, `Decimal(4,1)` 컬럼 타입과 `@@index` DDL이 의도대로 생성되었는지 확인.

산출물: `apps/backend/prisma/migrations/{TIMESTAMP}_add_body_composition/migration.sql`

### Milestone M2 — BodyCompositionModule (Priority: High)

목표: 체성분 CRUD 3개 엔드포인트와 단위/통합 테스트.

순서:
1. `apps/backend/src/body-composition/` 디렉터리 생성, `module/controller/service` 스캐폴드.
2. DTO 작성: `CreateBodyCompositionDto`, `ListBodyCompositionQueryDto`, `BodyCompositionResponseDto`.
3. `body-composition.service.ts` 구현: `create()`, `findManyByUser()`, `deleteByOwner()`.
4. `body-composition.controller.ts` 구현: 3개 라우트, `@UseGuards(JwtAuthGuard)`, `@CurrentUser()` 데코레이터로 `userId` 주입.
5. `BodyCompositionModule`을 `app.module.ts`에 등록.
6. 단위 테스트(`*.service.spec.ts`): 입력 검증, 권한 격리, 페이지네이션.
7. E2E 테스트(`*.e2e-spec.ts`): 7개 시나리오(AC-DASH-BODY-*) 자동화.

산출물: 5.1, 5.2, 5.3절 엔드포인트 동작.

### Milestone M3 — DashboardModule: 체성분 추세 (Priority: High)

목표: `GET /dashboard/body-composition` 엔드포인트. SPEC-WORKOUT-001과 무관하므로 M2 직후 진행 가능.

순서:
1. `apps/backend/src/dashboard/` 디렉터리 생성.
2. `dashboard.service.ts`의 `getBodyCompositionTrend(userId, period)` 구현: `BodyComposition` 단순 조회 + period 필터.
3. 라우트, DTO, 응답 타입 정의.
4. E2E 시나리오 AC-DASH-BTREND-* 자동화.

### Milestone M4 — DashboardModule: 운동 빈도 (Priority: High, depends on SPEC-WORKOUT-001)

목표: `GET /dashboard/workout-frequency` 엔드포인트.

순서:
1. `dashboard.service.ts`의 `getWorkoutFrequency(userId, weeks)` 구현 — 4.1절 SQL 사용.
2. E2E 시나리오 AC-DASH-FREQ-* 자동화.

### Milestone M5 — DashboardModule: 주간 볼륨 (Priority: High, depends on SPEC-WORKOUT-001)

목표: `GET /dashboard/weekly-volume` 엔드포인트.

순서:
1. `dashboard.service.ts`의 `getWeeklyVolume(userId, weeks)` 구현 — 4.2절 SQL 사용.
2. E2E 시나리오 AC-DASH-VOL-* 자동화.

### Milestone M6 — DashboardModule: 1RM 이력 (Priority: High, depends on SPEC-WORKOUT-001)

목표: `GET /dashboard/1rm-history` 엔드포인트. 가장 복잡한 쿼리.

순서:
1. SPEC-WORKOUT-001의 `compound-exercise.map.ts`에서 `COMPOUND_EXERCISE_SLUG_MAP` import 가능 여부 확인.
2. `dashboard.service.ts`의 `get1RMHistory(userId, exerciseType, period)` 구현 — 4.3절 SQL 사용.
3. Epley 계산은 `packages/utils/src/1rm.ts`의 `calculateEpley` 또는 동등 코드 사용.
4. E2E 시나리오 AC-DASH-1RM-* 자동화.

### Milestone M7 — 모바일 체성분 화면 (Priority: Medium, depends on M2)

목표: `app/(tabs)/my/body.tsx` 화면 구현.

순서:
1. `services/body-composition.ts` API 클라이언트 작성.
2. `hooks/useBodyComposition.ts`: TanStack Query 훅 3종(`useBodyCompositionList`, `useCreateBodyComposition`, `useDeleteBodyComposition`).
3. `body.tsx` 화면: 입력 폼 + 이력 리스트 + 삭제 버튼.
4. invalidate 체인: POST/DELETE 성공 시 `['body-composition']` + `['dashboard', 'body-composition']` 무효화.

### Milestone M8 — 모바일 차트 컴포넌트 (Priority: Medium, depends on M3~M6)

목표: 4종 차트 컴포넌트 + 대시보드 화면.

순서:
1. `react-native-gifted-charts` 의존성 추가: `pnpm --filter @workout/mobile add react-native-gifted-charts`.
2. 4개 차트 컴포넌트(`OneRepMaxChart`, `BodyCompositionChart`, `WeeklyVolumeChart`, `WorkoutFrequencyChart`) 구현 — Section 6.2 매핑 참조.
3. `services/dashboard.ts` API 클라이언트.
4. `hooks/useDashboard.ts`: TanStack Query 훅 4종.
5. `app/(tabs)/my/dashboard.tsx`: 4개 차트 한 화면 + 기간 필터(`1m`/`3m`/`6m`/`1y` 토글).
6. 빈 데이터(`points: []`) 처리: 안내 메시지 표시 (REQ-DASH-MOBILE-006).

### Milestone M9 — 통합 검증 (Priority: High)

목표: 모든 AC 시나리오 통과 + 성능 SLO 검증.

순서:
1. Backend E2E suite 실행: 모든 AC 자동화 통과.
2. 성능 측정: AC-DASH-PERF-01 — 사용자당 500개 세션, 12주 데이터로 P95 ≤ 500ms 검증.
3. 모바일 빌드: Android (Expo Go + EAS Development Build) 동작 확인.
4. 수동 검증: REQ-DASH-MOBILE-* 시나리오(차트 렌더링, 기간 필터, 입력/삭제 흐름).

---

## 2. Prisma 스키마 변경 상세

### 2.1 BodyComposition 모델 (확정)

```prisma
model BodyComposition {
  id         String   @id @default(cuid())
  userId     String
  weight     Decimal  @db.Decimal(5, 2)
  muscleMass Decimal? @db.Decimal(5, 2)
  bodyFatPct Decimal? @db.Decimal(4, 1)
  recordedAt DateTime @default(now())
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, recordedAt(sort: Desc)])
}
```

### 2.2 User 모델 역참조 추가

```prisma
model User {
  // ... existing fields
  bodyCompositions  BodyComposition[]
}
```

### 2.3 마이그레이션 SQL 검증

Prisma migrate가 생성할 SQL 의도:
```sql
CREATE TABLE "BodyComposition" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weight" DECIMAL(5,2) NOT NULL,
  "muscleMass" DECIMAL(5,2),
  "bodyFatPct" DECIMAL(4,1),
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BodyComposition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BodyComposition_userId_recordedAt_idx"
  ON "BodyComposition"("userId", "recordedAt" DESC);

ALTER TABLE "BodyComposition" ADD CONSTRAINT "BodyComposition_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### 2.4 Decimal 처리 정책

Prisma의 `Decimal` 타입은 JS에서 `Prisma.Decimal` 객체로 반환된다. 응답 직렬화 시 `Number()` 또는 `.toNumber()`로 변환하여 클라이언트에는 `number`로 노출한다. 책임 위치: `body-composition-response.dto.ts`의 `toResponse()` 변환 함수.

### 2.5 소수점 자릿수 검증 정책 (REQ-DASH-BODY-013)

선택: `class-validator`의 `@IsNumber({ maxDecimalPlaces: N })` 데코레이터 사용.
- `weight`: `@IsNumber({ maxDecimalPlaces: 2 })`, `@Min(40)`, `@Max(300)`
- `muscleMass`: `@IsNumber({ maxDecimalPlaces: 2 })`, `@IsPositive()`, `@ValidateIf((dto) => dto.muscleMass != null)` (조건부)
- `bodyFatPct`: `@IsNumber({ maxDecimalPlaces: 1 })`, `@Min(1.0)`, `@Max(60.0)`
- `muscleMass <= weight` 교차 검증: 커스텀 validator(`@Validate(MuscleMassNotGreaterThanWeight)`) 또는 service-layer 검증.

---

## 3. SQL/Prisma 쿼리 전략

### 3.1 GET /dashboard/workout-frequency (가장 단순)

```sql
SELECT
  DATE_TRUNC('week', "completedAt") AS week_start,
  COUNT(*)::int                      AS session_count
FROM "WorkoutSession"
WHERE "userId" = $1
  AND "status" = 'COMPLETED'
  AND "completedAt" IS NOT NULL
  AND "completedAt" >= $2  -- now() - INTERVAL '$3 weeks'
GROUP BY week_start
ORDER BY week_start ASC;
```

Prisma 표현: `prisma.$queryRaw` 사용. JS 측에서 0인 주(week)를 채우기 위해 `$2` ~ `now()` 사이의 주차를 생성하고 `LEFT JOIN`처럼 합성한다 (REQ-DASH-VOL-002/FREQ-002).

선택: 0인 주 채움을 JS에서 처리할지 SQL `generate_series`로 처리할지 — **JS 처리 채택**(로직 단순, 테스트 용이).

### 3.2 GET /dashboard/weekly-volume

```sql
SELECT
  DATE_TRUNC('week', ws."completedAt") AS week_start,
  SUM(wset."weight" * wset."reps")     AS total_volume,
  COUNT(DISTINCT ws."id")::int          AS session_count
FROM "WorkoutSession" ws
JOIN "WorkoutSet" wset ON wset."sessionId" = ws."id"
WHERE ws."userId" = $1
  AND ws."status" = 'COMPLETED'
  AND ws."completedAt" IS NOT NULL
  AND ws."completedAt" >= $2
  AND wset."isCompleted" = TRUE
  AND wset."weight" IS NOT NULL    -- REQ-DASH-VOL-004: 보디웨이트 제외
  AND wset."reps" IS NOT NULL
GROUP BY week_start
ORDER BY week_start ASC;
```

`SUM(weight * reps)` 결과는 `Decimal`(Prisma) 또는 `numeric`(PostgreSQL). JS에서 `Number()` 변환 후 `Math.round(x * 100) / 100` 적용 (REQ-DASH-VOL-005).

### 3.3 GET /dashboard/1rm-history (가장 복잡)

논리적 흐름:
1. 컴파운드 운동의 `Exercise.id`를 SPEC-WORKOUT-001의 `COMPOUND_EXERCISE_SLUG_MAP`에서 역인덱싱:
   ```ts
   const slugToCompound = COMPOUND_EXERCISE_SLUG_MAP; // { 'barbell-squat': 'SQUAT', ... }
   const compoundToSlugs = invertMap(slugToCompound); // { 'SQUAT': ['barbell-squat', ...], ... }
   ```
2. `exerciseType`(예: `SQUAT`)에 해당하는 slug 배열 결정 → `Exercise.id` 배열을 한 번 조회하거나, JOIN으로 처리.
3. 완료된 컴파운드 세트 조회:
   ```sql
   SELECT
     ws."id"          AS session_id,
     ws."completedAt" AS completed_at,
     wset."weight"    AS weight,
     wset."reps"      AS reps
   FROM "WorkoutSession" ws
   JOIN "WorkoutSet" wset ON wset."sessionId" = ws."id"
   JOIN "Exercise"   ex   ON ex."id"          = wset."exerciseId"
   WHERE ws."userId" = $1
     AND ws."status" = 'COMPLETED'
     AND ws."completedAt" >= $2
     AND wset."isCompleted" = TRUE
     AND wset."weight" IS NOT NULL
     AND wset."reps"   IS NOT NULL
     AND wset."reps"  BETWEEN 1 AND 10   -- REQ-DASH-1RM-009
     AND ex."slug"  = ANY($3::text[]);   -- 컴파운드 slug 배열
   ```
4. JS 측에서 세션별 그룹화 후 best Epley 1RM 채택 (REQ-DASH-1RM-002):
   ```ts
   const epley = (w: number, r: number) => w * (1 + r / 30);
   const grouped = groupBy(rows, r => r.session_id);
   const points = Object.values(grouped).map(setsInSession => {
     const best = Math.max(...setsInSession.map(s => epley(s.weight, s.reps)));
     return {
       sessionId: setsInSession[0].session_id,
       completedAt: setsInSession[0].completed_at,
       estimated1RM: round2(best),
     };
   }).sort((a, b) => a.completedAt < b.completedAt ? -1 : 1);
   ```

선택: SQL 단에서 `MAX(weight * (1 + reps::numeric / 30))`로 처리할지 JS에서 처리할지 — **JS 처리 채택**(`packages/utils/src/1rm.ts`와 일관성 보장, NFR-DASH-CONSISTENCY-001).

### 3.4 GET /dashboard/body-composition (가장 단순)

```ts
const since = computeSince(period);
const rows = await prisma.bodyComposition.findMany({
  where: { userId, recordedAt: { gte: since } },
  orderBy: { recordedAt: 'asc' },
  select: { recordedAt: true, weight: true, muscleMass: true, bodyFatPct: true },
});
return {
  period,
  points: rows.map(r => ({
    recordedAt: r.recordedAt.toISOString(),
    weight: Number(r.weight),
    muscleMass: r.muscleMass != null ? Number(r.muscleMass) : null,
    bodyFatPct: r.bodyFatPct != null ? Number(r.bodyFatPct) : null,
  })),
};
```

`@@index([userId, recordedAt(sort: Desc)])`가 `WHERE userId AND recordedAt >= since`에도 사용된다(Postgres B-tree는 역방향 스캔 가능).

### 3.5 period → since 변환 유틸

```ts
const PERIOD_TO_DAYS: Record<'1m' | '3m' | '6m' | '1y', number> = {
  '1m': 30, '3m': 90, '6m': 180, '1y': 365,
};
function computeSince(period: '1m' | '3m' | '6m' | '1y'): Date {
  const days = PERIOD_TO_DAYS[period];
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  return since;
}
```

---

## 4. NestJS 컨트롤러/서비스 구조

### 4.1 BodyCompositionController

```ts
@Controller('users/me/body-composition')
@UseGuards(JwtAuthGuard)
export class BodyCompositionController {
  constructor(private readonly service: BodyCompositionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBodyCompositionDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() query: ListBodyCompositionQueryDto) {
    return this.service.findManyByUser(user.id, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.service.deleteByOwner(user.id, id);
  }
}
```

### 4.2 DashboardController

```ts
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('1rm-history')
  get1RMHistory(@CurrentUser() user: AuthUser, @Query() query: OneRMHistoryQueryDto) {
    return this.service.get1RMHistory(user.id, query.exerciseType, query.period ?? '3m');
  }

  @Get('body-composition')
  getBodyCompositionTrend(@CurrentUser() user: AuthUser, @Query() query: BodyTrendQueryDto) {
    return this.service.getBodyCompositionTrend(user.id, query.period ?? '3m');
  }

  @Get('weekly-volume')
  getWeeklyVolume(@CurrentUser() user: AuthUser, @Query() query: WeeklyVolumeQueryDto) {
    return this.service.getWeeklyVolume(user.id, query.weeks ?? 12);
  }

  @Get('workout-frequency')
  getWorkoutFrequency(@CurrentUser() user: AuthUser, @Query() query: WorkoutFrequencyQueryDto) {
    return this.service.getWorkoutFrequency(user.id, query.weeks ?? 12);
  }
}
```

라우트 매칭: 모든 4개 라우트는 고정 경로이므로 동적 path parameter 충돌(SPEC-EXERCISE-001 REQ-EX-FAV-012 / SPEC-1RM-001 REQ-ORM-VAL-007 패턴)이 적용되지 않는다. 단, BodyCompositionController의 `Delete(':id')`는 컨트롤러 내 다른 라우트가 없으므로 충돌이 없다.

### 4.3 deleteByOwner의 404 처리

```ts
async deleteByOwner(userId: string, id: string): Promise<void> {
  const result = await this.prisma.bodyComposition.deleteMany({
    where: { id, userId },  // 본인 소유 + id 일치 모두 만족할 때만 삭제
  });
  if (result.count === 0) {
    throw new NotFoundException('Body composition record not found');
  }
}
```

본인 소유가 아니거나 존재하지 않으면 `deleteMany.count = 0` → `404`. 두 경우를 동일한 응답으로 통합하여 존재 여부 노출을 차단한다 (NFR-DASH-SEC-005).

---

## 5. 차트 라이브러리 통합

### 5.1 의존성 추가

```bash
pnpm --filter @workout/mobile add react-native-gifted-charts
```

Expo Managed Workflow에서 별도 prebuild 불필요. `react-native-gifted-charts`는 `react-native-linear-gradient`를 필수 peerDep로 요구하므로 동시 설치:

```bash
pnpm --filter @workout/mobile add react-native-linear-gradient
```

(Expo SDK 51 기준 `expo-linear-gradient` 대체 가능성도 plan.md 검토 대상. M8 진입 시 라이브러리 docs 재확인.)

### 5.2 차트 컴포넌트 패턴 (예: OneRepMaxChart)

```tsx
import { LineChart } from 'react-native-gifted-charts';

interface Props {
  points: Array<{ sessionId: string; completedAt: string; estimated1RM: number }>;
}

export function OneRepMaxChart({ points }: Props) {
  if (points.length === 0) {
    return <Text>기록된 데이터가 없습니다</Text>;
  }
  const data = points.map(p => ({
    value: p.estimated1RM,
    label: formatDate(p.completedAt),
  }));
  return <LineChart data={data} thickness={2} />;
}
```

REQ-DASH-MOBILE-006: 빈 배열 케이스는 컴포넌트 진입부에서 분기하여 안내 메시지 표시.

### 5.3 기간 필터 동기화

`dashboard.tsx` 화면 상태로 `period: '1m' | '3m' | '6m' | '1y'`를 보유하고, 모든 useDashboard 훅에 `period`를 전달한다. period 변경 시 TanStack Query는 새 Query Key로 자동 재조회한다.

---

## 6. 위험 분석 (Risk Analysis)

### 6.1 [HIGH] 현재 schema에 `WorkoutSet.isCompleted` / `rpe` / `orderIndex` 부재

현재 `prisma/schema.prisma`는 SPEC-WORKOUT-001의 plan 단계이며, `WorkoutSet`에 `isCompleted`/`rpe`/`orderIndex` 필드가 아직 추가되지 않았다. 본 SPEC의 RUN 시작 시점에는 SPEC-WORKOUT-001 RUN이 완료된 상태여야 한다.

완화책:
- 본 SPEC RUN은 SPEC-WORKOUT-001 RUN 완료 후에 진행한다.
- 부득이 병행 진행이 필요하면 본 SPEC을 Step A/B로 분리:
  - Step A: `BodyComposition` CRUD + `GET /dashboard/body-composition` (SPEC-WORKOUT-001 무관, 즉시 진행 가능).
  - Step B: 1RM 이력 / 주간 볼륨 / 운동 빈도 (SPEC-WORKOUT-001 의존).
- 모바일도 동일하게 분리: M7(체성분 화면) → M8(차트 화면).

### 6.2 [HIGH] 컴파운드 운동 식별 매핑

`COMPOUND_EXERCISE_SLUG_MAP`은 SPEC-WORKOUT-001 plan.md Section 1.4 "옵션 A 채택"에서 정의된다. 본 SPEC의 1RM 이력 산출은 이 매핑에 강하게 의존한다.

완화책:
- M6 진입 시점에 `compound-exercise.map.ts` 파일 존재를 verify (Glob/Read).
- import 가능하면 직접 import하여 사용, 그렇지 않으면 SPEC-WORKOUT-001 plan을 참고하여 동일한 매핑 정의를 본 SPEC에 임시 사본을 두지 않고 SPEC-WORKOUT-001 RUN 완료를 기다린다(중복 정의 금지, NFR-DASH-CONSISTENCY-002).
- SPEC-WORKOUT-001의 매핑이 수정되어 컴파운드 운동 set이 변경되면 본 SPEC의 1RM 이력 차트가 자동으로 영향받음. 이는 의도된 동작.

### 6.3 [MEDIUM] 대시보드 집계 쿼리의 성능

사용자당 누적 세션이 많아질수록(>500건) 집계 쿼리 비용이 커진다. 특히 1RM 이력 쿼리는 JOIN 3개 테이블 + slug ANY 필터로 인덱스 사용이 중요하다.

완화책:
- NFR-DASH-DATA-004: SPEC-WORKOUT-001에서 정의된 `WorkoutSession(userId, completedAt)` 인덱스 사용 확인.
- 필요 시 `WorkoutSet(sessionId, isCompleted, weight)` 부분 인덱스 추가를 plan.md에서 보류 → M9 성능 측정 시 EXPLAIN으로 확인 후 결정.
- `Exercise.slug`에 unique index가 SPEC-EXERCISE-001에 이미 존재해야 함 — verify 필요.

### 6.4 [MEDIUM] PostgreSQL `DATE_TRUNC('week', ...)` 타임존 처리

`DATE_TRUNC('week', ...)`는 PostgreSQL 세션 타임존에 따라 주의 경계가 달라질 수 있다. 사용자가 KST(UTC+9)에서 일요일 23시에 운동을 완료한 경우 UTC로는 월요일 14시이므로 다른 주에 속한다.

완화책:
- 본 SPEC은 **UTC 기준 통일** 채택 (REQ-DASH-VOL-001, REQ-DASH-FREQ-001 명시).
- 백엔드 시작 시점에 `SET TIME ZONE 'UTC'`로 통일 또는 쿼리에 `DATE_TRUNC('week', "completedAt" AT TIME ZONE 'UTC')` 명시.
- 모바일 차트 라벨은 KST 표시를 위해 클라이언트 측에서 변환 적용.
- 후속 SPEC에서 사용자별 timezone 설정이 추가되면 본 정책 재검토.

### 6.5 [MEDIUM] Decimal → number 직렬화 정밀도 손실

`Decimal(5,2)` 값을 JS `number`로 변환하면 IEEE 754 부동소수점으로 인해 `75.20`이 `75.2`로 표현되거나 미세한 오차가 발생할 수 있다.

완화책:
- 응답에 노출되는 값은 모두 명시적으로 `Math.round(x * 100) / 100`(소수 2자리) 또는 `Math.round(x * 10) / 10`(체지방률) 적용.
- 단위 테스트로 경계 케이스 검증 (`75.25`, `99.99`, `100.00` 등).

### 6.6 [LOW] `react-native-gifted-charts` 메인테이너 정책 변경

선정 시점(2026-05) 기준 활발히 메인테이닝되나, 향후 호환성 깨질 가능성 존재.

완화책:
- M8 진입 시점에 v1.4.x 최신 안정 버전 재확인.
- 빌드 실패 시 `victory-native` 또는 `react-native-chart-kit`로 폴백 가능 (Section 6.1 평가 표 참조).

### 6.7 [LOW] 모바일 빈 차트 렌더링 안전성

`react-native-gifted-charts`에 빈 배열 `[]` 전달 시 일부 차트는 크래시하거나 빈 영역만 그릴 수 있다.

완화책:
- 컴포넌트 진입부에서 `points.length === 0` 분기로 라이브러리 호출 자체를 회피 (REQ-DASH-MOBILE-006 명시).

---

## 7. 테스트 전략

### 7.1 백엔드 단위 테스트

- `body-composition.service.spec.ts`: 입력 검증 boundary(40/300/60.0), `muscleMass > weight` 거부, `recordedAt` 미래 차단, 권한 격리.
- `dashboard.service.spec.ts`: period → since 변환, best-set 채택 로직, 빈 결과 처리, 0인 주 채움.

### 7.2 백엔드 E2E 테스트

- `body-composition.e2e-spec.ts`: AC-DASH-BODY-* 시나리오 자동화.
- `dashboard.e2e-spec.ts`: AC-DASH-1RM-*, AC-DASH-VOL-*, AC-DASH-FREQ-*, AC-DASH-BTREND-* 시나리오 자동화.
- 시드 데이터: U1에 12주 분량 세션(약 50건) 생성, 컴파운드 4종 분포, 체성분 10건.

### 7.3 성능 검증 (AC-DASH-PERF-01)

- 단일 사용자에게 500개 세션, 2500개 세트, 50건 체성분 시드.
- `autocannon` 또는 NestJS 자체 부하 테스트로 4종 대시보드 엔드포인트 각 100 req 측정 → P95 ≤ 500ms 검증.

### 7.4 모바일 수동 검증

- Expo Go (Android)에서:
  - 체성분 입력/이력 화면 동작.
  - 대시보드 화면 4종 차트 렌더링.
  - 기간 필터(`1m`/`3m`/`6m`/`1y`) 토글 시 차트 새로고침.
  - 빈 데이터(`points: []`) 시 안내 메시지 표시.

---

## 8. 운영 및 모니터링

- 본 SPEC은 새로운 운영 메트릭(예: 대시보드 호출 횟수)을 추가하지 않는다.
- DB 마이그레이션은 무중단으로 가능(테이블 신설만, 기존 테이블 변경 없음).
- 롤백 정책: `BodyComposition` 테이블 drop으로 안전하게 롤백 가능(외부 의존 없음).

---

## 9. 결정 분기 요약 (Decision Summary)

| 결정 분기 | 선택 옵션 | 사유 |
|---|---|---|
| 1RM 이력 저장 방식 | WorkoutSet에서 계산 (NO history table) | SPEC-1RM-001과 일관, 데이터 모델 단순화 |
| 컴파운드 매핑 위치 | SPEC-WORKOUT-001의 `COMPOUND_EXERCISE_SLUG_MAP` 재사용 | NFR-DASH-CONSISTENCY-002, 중복 정의 금지 |
| 0인 주 채움 | JS 측에서 처리 | 테스트 용이, SQL 단순화 |
| 1RM best-set 채택 | JS 측에서 Math.max | NFR-DASH-CONSISTENCY-001, `calculateEpley` 재사용 |
| 차트 라이브러리 | `react-native-gifted-charts` v1.4.x | Expo 호환, pure JS, 추가 네이티브 모듈 불필요 |
| 주의 시작일 | 월요일 UTC (`DATE_TRUNC('week', ...)`) | PostgreSQL 기본, ISO 8601 |
| 삭제 권한 위반 응답 | `404 Not Found` (NOT 403) | OWASP A01, 존재 여부 노출 차단 |
| 체성분 수정 | 본 SPEC 범위 밖 (POST/GET/DELETE만) | 사용 패턴 단순화 |
| Decimal → number 변환 | `Number(decimal)` + 명시적 round | 정밀도 관리 |
| period 기본값 | `3m` (90일) | UX 사용성, 대시보드 화면 첫 진입 시 |
| weeks 기본값 | `12` | 약 3개월, period와 일관 |
| weeks 범위 | `4~52` | 1년 이내 합리적 시각화 |

---

본 plan.md는 acceptance.md의 시나리오를 충족시키기 위한 구현 지침이다. 모든 EARS 요구사항과 NFR은 spec.md에 정의되어 있으며, 본 문서는 그 구현 방식을 결정한다.
