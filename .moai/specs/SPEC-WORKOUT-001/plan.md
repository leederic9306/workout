# SPEC-WORKOUT-001 구현 계획 (Implementation Plan)

본 문서는 SPEC-WORKOUT-001(운동 세션 기록)의 구현 계획을 정의한다. 우선순위 기반(High/Medium/Low) 마일스톤으로 페이즈를 정의하며, 시간 예측은 포함하지 않는다 (Agent Common Protocol 준수).

전제:
- SPEC-AUTH-001 v1.0.1이 구현되어 있다 (`User` 모델, `UserRole` enum, `JwtAuthGuard`, `RolesGuard`, `@Roles()` 데코레이터, `@CurrentUser()` 데코레이터 존재).
- SPEC-USER-001 v1.0.1이 구현되어 있다 (`User.deletedAt` 컬럼 존재).
- SPEC-EXERCISE-001 v1.0.1이 구현되어 있다 (`Exercise` 모델, 800+ 운동 시드 완료, 5종 컴파운드 운동 포함).
- SPEC-1RM-001 v1.0.1이 구현되어 있다 (`OneRepMax` 모델, `CompoundType`/`OrmSource` enum, `packages/utils/src/1rm.ts` 공식 export).
- SPEC-PROGRAM-001 v1.0.2가 구현되어 있다 (`Program`, `ProgramDay`, `ProgramExercise`, `UserProgram`, `AiUsageLog` 모델, 6종 카탈로그 시드).
- `prisma/schema.prisma`의 `User`, `Exercise`, `Program`, `ProgramDay` 엔티티는 존재하나 `WorkoutSession`, `WorkoutSet`은 미정의 상태이다.

---

## 1. 기술 접근 (Technical Approach)

### 1.1 백엔드 모듈 구조 결정

본 SPEC은 두 가지 종류의 엔드포인트 그룹을 다룬다:
- `/workouts/*`: 세션 CRUD + 세트 CRUD + 완료/취소 (11개 엔드포인트).
- `/workouts/utils/plates`: 플레이트 계산기 (1개 엔드포인트, DB 의존 없음).

**옵션 A: 단일 `WorkoutsModule`에 모든 엔드포인트 통합**
- 장점: 단일 도메인(세션 기록)으로 응집. 모바일 UX에서 플레이트 계산기는 세션 진행 화면 내부에서 호출되므로 도메인 결합도가 자연스럽다.
- 단점: 플레이트 계산기는 DB 의존이 없어 도메인 격리를 원할 수 있음.

**옵션 B: `WorkoutsModule`(세션·세트) + `WorkoutUtilsModule`(플레이트) 분리**
- 장점: 순수 계산 유틸의 도메인 격리.
- 단점: 모듈 분할 비용. 단일 엔드포인트를 위한 모듈 분리는 과도하다.

**결정**: **옵션 A (단일 `WorkoutsModule`)**.

사유:
- 플레이트 계산기는 본 SPEC에서 1개 엔드포인트이며, 향후 세션 진행 보조 유틸(예: RPE 추천, 휴식 시간 추천)이 추가될 때 동일 `WorkoutsModule` 내부의 `utils` sub-router로 자연스럽게 확장된다.
- 모바일 클라이언트의 호출 패턴이 세션 진행 화면 → 플레이트 계산기로 도메인 인접성이 높다.
- 라우트 prefix `/workouts/utils/plates`로 의미적 분리는 유지하면서 모듈은 단일화한다.

모듈 위치: `apps/backend/src/workouts/`.

### 1.2 백엔드 아키텍처 상세

#### 폴더 구조

```
apps/backend/src/workouts/
├── workouts.module.ts
├── workouts.controller.ts         // 세션 CRUD + 완료/취소 + 플레이트 (route ordering 강제)
├── workouts.service.ts            // createSession, getSessionDetail, listSessions, getActiveSession, completeSession, cancelSession, updateNotes, deleteSession
├── workout-sets.service.ts        // addSet, updateSet, deleteSet (sessionId, setId 기반)
├── plates.service.ts              // calculate(weight, barWeight) — 순수 함수
├── one-rm-update.service.ts       // updateOneRepMaxFromSession (비동기 best-effort)
├── compound-exercise.map.ts       // CompoundType ↔ Exercise.id 정적 매핑 (옵션 A 선택, 1.4절 참조)
├── dto/
│   ├── create-workout-session.dto.ts   // { exerciseIds?: string[]; programDayId?: string }
│   ├── list-workouts-query.dto.ts      // { status?, startedAtFrom?, startedAtTo?, page?, limit? }
│   ├── update-workout-session.dto.ts   // { notes: string }
│   ├── add-workout-set.dto.ts          // { exerciseId, setNumber?, weight?, reps, rpe?, isCompleted? }
│   ├── update-workout-set.dto.ts       // partial of add (weight, reps, rpe, isCompleted)
│   ├── plate-query.dto.ts              // { weight: number; barWeight?: number }
│   ├── workout-session.response.dto.ts // 세션 상세 응답
│   ├── workout-set.response.dto.ts     // 세트 응답
│   └── plate-result.response.dto.ts    // { totalWeight, barWeight, plates, perSide, remainder }
└── tests/
    ├── workouts.service.spec.ts
    ├── workout-sets.service.spec.ts
    ├── plates.service.spec.ts
    ├── one-rm-update.service.spec.ts
    ├── workouts.controller.spec.ts
    └── workouts.e2e-spec.ts
```

#### 라우트 정의 순서 (REQ-WO-VAL-001)

NestJS `WorkoutsController`에서 메서드 정의 순서를 다음과 같이 강제한다(컬렉션 → 고정 경로 → 동적 경로 → 동적 + suffix → nested dynamic):

```typescript
@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  // 1. GET /workouts (collection list)
  @Get()
  async list(
    @CurrentUser('sub') userId: string,
    @Query() query: ListWorkoutsQueryDto,
  ) { ... }

  // 2. POST /workouts (collection create)
  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateWorkoutSessionDto,
  ) { ... }

  // 3. GET /workouts/active (static)
  @Get('active')
  async getActive(@CurrentUser('sub') userId: string) { ... }

  // 4. GET /workouts/utils/plates (static, nested prefix)
  @Get('utils/plates')
  async calculatePlates(@Query() query: PlateQueryDto) { ... }

  // 5. GET /workouts/:id (dynamic)
  @Get(':id')
  async getDetail(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) { ... }

  // 6. PATCH /workouts/:id (dynamic)
  @Patch(':id')
  async updateNotes(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateWorkoutSessionDto,
  ) { ... }

  // 7. DELETE /workouts/:id (dynamic)
  @Delete(':id')
  @HttpCode(204)
  async delete(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) { ... }

  // 8. POST /workouts/:id/complete (dynamic + static suffix)
  @Post(':id/complete')
  async complete(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) { ... }

  // 9. POST /workouts/:id/cancel
  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) { ... }

  // 10. POST /workouts/:id/sets
  @Post(':id/sets')
  @HttpCode(201)
  async addSet(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: AddWorkoutSetDto,
  ) { ... }

  // 11. PATCH /workouts/:id/sets/:setId (nested dynamic)
  @Patch(':id/sets/:setId')
  async updateSet(
    @Param('id') id: string,
    @Param('setId') setId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateWorkoutSetDto,
  ) { ... }

  // 12. DELETE /workouts/:id/sets/:setId
  @Delete(':id/sets/:setId')
  @HttpCode(204)
  async deleteSet(
    @Param('id') id: string,
    @Param('setId') setId: string,
    @CurrentUser('sub') userId: string,
  ) { ... }
}
```

`@MX:WARN` + `@MX:NOTE` 주석으로 컨트롤러 상단에 라우트 순서 정책을 명시. 자동 검증을 위해 `apps/backend/src/workouts/tests/route-order.spec.ts`에서 컨트롤러 메서드 정의 순서를 정적으로 검사하는 테스트 추가(SPEC-EXERCISE-001 / SPEC-PROGRAM-001 동일 패턴).

#### DTO 정의 (핵심 발췌)

**`create-workout-session.dto.ts`**:

```typescript
export class CreateWorkoutSessionDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  exerciseIds?: string[];

  @IsOptional()
  @IsString()
  programDayId?: string;
}
```

서비스에서 추가 검증: `(exerciseIds && programDayId) || (!exerciseIds && !programDayId)` → `400 Bad Request`.

**`add-workout-set.dto.ts`**:

```typescript
export class AddWorkoutSetDto {
  @IsString()
  exerciseId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  setNumber?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  weight?: number | null;

  @IsInt()
  @Min(1)
  @Max(200)
  reps!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rpe?: number;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
```

**`plate-query.dto.ts`**:

```typescript
export class PlateQueryDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(1000)
  weight!: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn([15, 20])
  barWeight?: number = 20;
}
```

### 1.3 진행 1개 제약 enforcement (REQ-WO-SESSION-003)

Prisma는 partial unique index(예: `WHERE status = IN_PROGRESS`)를 직접 지원하지 않으므로, application layer에서 enforce한다.

**옵션 A: 단순 사전 SELECT + INSERT**
```typescript
const active = await prisma.workoutSession.findFirst({
  where: { userId, status: 'IN_PROGRESS' }
});
if (active) throw new ConflictException(...);
await prisma.workoutSession.create({ ... });
```
- 장점: 단순.
- 단점: SELECT와 INSERT 사이 race condition으로 진행 2개 생성 가능.

**옵션 B: PostgreSQL advisory lock**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
  const active = await tx.workoutSession.findFirst({
    where: { userId, status: 'IN_PROGRESS' }
  });
  if (active) throw new ConflictException(...);
  await tx.workoutSession.create({ ... });
});
```
- 장점: 사용자별 직렬화로 race 차단.
- 단점: 약간의 복잡도.

**결정**: **옵션 B (advisory lock)**.

사유:
- 사용자가 동일 휴대폰에서 동시에 다중 요청을 보내는 경우는 드물지만, 모바일 클라이언트의 retry 로직(예: TanStack Query mutate)이나 빠른 더블 탭으로 발생 가능.
- PostgreSQL `pg_advisory_xact_lock`은 트랜잭션 종료 시 자동 해제되며 hashtext(userId)로 사용자별 lock key를 생성하여 다른 사용자에 영향 없음.
- @MX:WARN + @MX:REASON 주석으로 race 위험과 해결책 명시.

### 1.4 컴파운드 매핑 (REQ-WO-1RM-007)

**옵션 A: 백엔드 정적 매핑 테이블 `compound-exercise.map.ts`**
```typescript
// apps/backend/src/workouts/compound-exercise.map.ts
import { CompoundType } from '@prisma/client';

// Exercise.id를 직접 사용 (Exercise 시드 시 결정)
export const COMPOUND_EXERCISE_MAP: Record<string, CompoundType> = {
  [process.env.EXERCISE_ID_SQUAT ?? 'EXERCISE_ID_SQUAT_PLACEHOLDER']: 'SQUAT',
  [process.env.EXERCISE_ID_DEADLIFT ?? '...']: 'DEADLIFT',
  // ...
};

// 또는 더 안전한 방식: Exercise slug 기반 매핑
export const COMPOUND_EXERCISE_SLUG_MAP: Record<string, CompoundType> = {
  'barbell-back-squat': 'SQUAT',
  'conventional-deadlift': 'DEADLIFT',
  'barbell-bench-press': 'BENCH_PRESS',
  'barbell-row': 'BARBELL_ROW',
  'overhead-press': 'OVERHEAD_PRESS',
};
```

**옵션 B: `Exercise.compoundType: CompoundType?` 컬럼 추가**
- 장점: DB 레벨 매핑, 마이그레이션으로 안전.
- 단점: SPEC-EXERCISE-001 스키마 수정 필요.

**결정**: **옵션 A (slug 기반 정적 매핑)**.

사유:
- SPEC-EXERCISE-001 시드 데이터에 운동마다 고유 `slug`(예: `"barbell-back-squat"`)가 존재한다고 가정. 슬러그가 없다면 옵션 B로 전환.
- 정적 매핑은 변경이 드물고 PR로 추적되며 SPEC-EXERCISE-001 시드 스크립트와 같이 검토 가능.
- 시동 시점 assertion으로 5개 매핑이 모두 `Exercise` 테이블에 실존하는지 검증(`workouts.module.ts :: onModuleInit`).

**대체 경로**: 만약 SPEC-EXERCISE-001의 시드 데이터에 `slug` 필드가 없다면, 본 SPEC 구현 시 `Exercise` 테이블에 `slug: String @unique`를 추가하는 마이그레이션을 포함하거나, 옵션 B(`compoundType` 컬럼 추가)로 전환한다. plan.md의 본 결정은 SPEC-EXERCISE-001 시드의 실제 슬러그 존재 여부 확인 후 final.

### 1.5 1RM 자동 갱신 비동기 처리 (REQ-WO-1RM-001, REQ-WO-1RM-006, NFR-WO-PERF-008)

**옵션 A: `setImmediate` fire-and-forget**
```typescript
async completeSession(sessionId: string, userId: string) {
  const session = await this.prisma.$transaction(async (tx) => {
    // 세션 상태 전환
  });

  setImmediate(() => {
    this.oneRmUpdateService.updateOneRepMaxFromSession(sessionId)
      .catch(err => this.logger.error('1RM update failed', err));
  });

  return session;
}
```
- 장점: 단순, 별도 인프라 불필요.
- 단점: 프로세스 재시작 시 작업 손실(매우 짧은 작업이므로 영향 미미).

**옵션 B: Bull / BullMQ queue**
- 장점: 재시도, 모니터링 가능.
- 단점: Redis 인프라 추가 필요, 5명 사용자 규모에 과도.

**결정**: **옵션 A (`setImmediate` + try/catch 로깅)**.

사유:
- 본 프로젝트는 ~5명 사용자, EAS Build APK 직접 배포로 운영 부담 최소화가 목표.
- 1RM 갱신은 단순 계산 + 단일 upsert로 작업 시간 < 100ms 예상.
- 작업 손실이 발생해도 다음 세션 완료 시 다시 갱신되므로 비즈니스 영향 무.
- @MX:WARN + @MX:REASON으로 작업 손실 가능성 명시.

### 1.6 플레이트 계산 알고리즘 (REQ-WO-PLATES-001, REQ-WO-PLATES-003)

```typescript
// plates.service.ts
const STANDARD_PLATES = [20, 15, 10, 5, 2.5, 1.25] as const;

calculate(weight: number, barWeight: number = 20): PlateResult {
  // 1. 좌우 절반에 채울 무게
  let remaining = (weight - barWeight) / 2;
  if (remaining < 0) {
    throw new BadRequestException('weight must be >= barWeight');
  }

  // 2. 탐욕 알고리즘으로 한쪽 분배
  const perSide: Array<{ weight: number; count: number }> = [];
  for (const plate of STANDARD_PLATES) {
    const count = Math.floor(remaining / plate);
    if (count > 0) {
      perSide.push({ weight: plate, count });
      remaining -= count * plate;
    }
  }

  // 3. 양측 합계 plates (count × 2, 좌우 대칭)
  const plates = STANDARD_PLATES.map(p => {
    const found = perSide.find(s => s.weight === p);
    return { weight: p, count: (found?.count ?? 0) * 2 };
  });

  // 4. remainder 처리 (소수점 오차 보정)
  const remainder = Math.round(remaining * 100) / 100 * 2; // 양측 합산

  return { totalWeight: weight, barWeight, plates, perSide, remainder };
}
```

순수 함수, 결정성 보장(REQ-WO-PLATES-005). 단위 테스트로 모든 경계 케이스 검증.

### 1.7 모바일 화면 구조

```
apps/mobile/app/
├── (tabs)/
│   ├── workouts/
│   │   ├── index.tsx              // 세션 히스토리 (목록)
│   │   ├── start.tsx              // 세션 시작 (프로그램 추천 + 자유 선택)
│   │   └── [id].tsx               // 세션 상세 (완료/취소된 세션)
│   └── ...
├── workout-session/
│   └── [id].tsx                   // 세션 진행 화면 (modal stack, IN_PROGRESS 전용)
└── _layout.tsx
```

상태 관리: TanStack Query + Zustand(로컬 휴식 타이머).

API 클라이언트: `apps/mobile/src/api/workouts.ts` (백엔드 DTO 타입 import from `packages/types/src/workout.ts`).

---

## 2. Prisma Schema 변경 (Data Model Changes)

### 2.1 신규 enum

```prisma
enum SessionStatus {
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

### 2.2 WorkoutSession 모델 (신규)

```prisma
model WorkoutSession {
  id            String         @id @default(cuid())
  userId        String
  programId     String?
  programDayId  String?
  status        SessionStatus  @default(IN_PROGRESS)
  notes         String?
  startedAt     DateTime       @default(now())
  completedAt   DateTime?
  cancelledAt   DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  program       Program?       @relation(fields: [programId], references: [id], onDelete: SetNull)
  programDay    ProgramDay?    @relation(fields: [programDayId], references: [id], onDelete: SetNull)
  sets          WorkoutSet[]

  @@index([userId, status])
  @@index([userId, startedAt(sort: Desc)])
}
```

### 2.3 WorkoutSet 모델 (신규)

```prisma
model WorkoutSet {
  id           String          @id @default(cuid())
  sessionId    String
  exerciseId   String
  setNumber    Int
  weight       Decimal?        @db.Decimal(7, 2)
  reps         Int
  rpe          Int?
  isCompleted  Boolean         @default(false)
  completedAt  DateTime?
  orderIndex   Int
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  session      WorkoutSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  exercise     Exercise        @relation(fields: [exerciseId], references: [id])

  @@unique([sessionId, exerciseId, setNumber])
  @@index([sessionId, orderIndex])
  @@index([exerciseId])
}
```

### 2.4 기존 모델 역참조 추가

```prisma
model User {
  // ... existing fields
  workoutSessions   WorkoutSession[]
}

model Exercise {
  // ... existing fields
  workoutSets       WorkoutSet[]
}

model Program {
  // ... existing fields
  workoutSessions   WorkoutSession[]
}

model ProgramDay {
  // ... existing fields
  workoutSessions   WorkoutSession[]
}
```

### 2.5 마이그레이션 명령

```bash
pnpm --filter @workout/backend prisma migrate dev --name add_workout_sessions_and_sets
pnpm --filter @workout/backend prisma generate
```

마이그레이션 파일 검토 시 인덱스, cascade 정책, Decimal 정밀도 확인 필수.

---

## 3. 마일스톤 (Milestones)

### M1 — Schema & Foundation (Priority: High)

목표: DB 스키마 + Prisma 클라이언트 + 공유 타입 정의.

작업:
1. `prisma/schema.prisma`에 `SessionStatus` enum, `WorkoutSession`, `WorkoutSet` 모델 추가 + 역참조.
2. `pnpm prisma migrate dev --name add_workout_sessions_and_sets` 실행.
3. 마이그레이션 파일 검토: 인덱스(`(userId, status)`, `(userId, startedAt DESC)`, `(sessionId, exerciseId, setNumber)` UNIQUE) 및 cascade 정책 확인.
4. `packages/types/src/workout.ts` 생성: `SessionStatus`, `WorkoutSession`, `WorkoutSet`, 요청/응답 DTO 타입 export.
5. `packages/types/src/index.ts`에 re-export 추가.
6. `pnpm typecheck` 통과 확인.

완료 기준: Prisma 마이그레이션 성공, 공유 타입 빌드 통과.

### M2 — Compound Mapping & Verification (Priority: High)

목표: `CompoundType` ↔ `Exercise.id` 매핑 확립 + 시동 시점 검증.

작업:
1. SPEC-EXERCISE-001 시드 데이터에서 5종 컴파운드 운동의 `slug` 또는 식별자 확인.
2. `apps/backend/src/workouts/compound-exercise.map.ts` 생성: slug 기반 정적 매핑.
3. `WorkoutsModule.onModuleInit`에서 5개 매핑이 모두 DB에 실존하는지 assertion. 실패 시 기동 거부.
4. `compound-exercise.map.spec.ts` 단위 테스트: 모든 5종이 `CompoundType` enum 값과 1:1 대응.

완료 기준: 기동 시 매핑 검증 통과, 매핑 누락 시 명확한 에러 메시지.

대체 경로: SPEC-EXERCISE-001 시드에 slug가 없으면 SPEC-EXERCISE-001 시드 보강 PR을 선행하거나, `Exercise.compoundType: CompoundType?` 컬럼 추가 마이그레이션을 본 SPEC에 포함.

### M3 — Session CRUD (Priority: High)

목표: 세션 생성/조회/수정/삭제 5개 엔드포인트(`POST /workouts`, `GET /workouts`, `GET /workouts/active`, `GET /workouts/:id`, `PATCH /workouts/:id`, `DELETE /workouts/:id`).

작업:
1. `WorkoutsModule`, `WorkoutsController`, `WorkoutsService` 골격 생성.
2. DTO 5종 정의 (CreateWorkoutSessionDto, ListWorkoutsQueryDto, UpdateWorkoutSessionDto, WorkoutSessionResponseDto, WorkoutListResponseDto).
3. `createSession`: 진행 1개 제약(advisory lock + INSERT), 자유/프로그램 분기 검증, `exerciseIds` 실존 검증, `programDayId` 활성 프로그램 소속 검증.
4. `listSessions`: 페이지네이션 + 필터(status, 날짜 범위) + 정렬(`startedAt DESC`).
5. `getActive`: 진행 중 세션 조회, 부재 시 `{ active: null }`.
6. `getSessionDetail`: 본인 소유 검증(`userId == JWT.sub`), 세트 join + Exercise join.
7. `updateNotes`: 모든 status 허용, 1000자 검증.
8. `deleteSession`: `CANCELLED`만 허용, `IN_PROGRESS`/`COMPLETED`는 `409`.
9. 라우트 등록 순서 강제 + `route-order.spec.ts` 정적 검사.
10. 단위 테스트 + 통합 테스트(supertest).

완료 기준: AC-WO-SESSION-*, AC-WO-LIST-*, AC-WO-ACTIVE-*, AC-WO-DETAIL-*, AC-WO-DELETE-* 시나리오 모두 통과.

### M4 — Workout Sets CRUD (Priority: High)

목표: 세트 추가/수정/삭제 3개 엔드포인트(`POST /workouts/:id/sets`, `PATCH .../sets/:setId`, `DELETE .../sets/:setId`).

작업:
1. `WorkoutSetsService` 생성.
2. DTO 2종 정의 (AddWorkoutSetDto, UpdateWorkoutSetDto).
3. `addSet`: 진행 상태 검증, exerciseId 실존, `setNumber` 자동 추천(미지정 시 max+1), unique 위반 처리, `isCompleted` 시 `completedAt` 자동 설정, `orderIndex` 자동 부여(세션 내 max+1).
4. `updateSet`: 부분 수정, `isCompleted` 전환 시 `completedAt` 갱신.
5. `deleteSet`: 진행 상태 검증, 본인 소유 검증.
6. 단위 테스트 + 통합 테스트.

완료 기준: AC-WO-SET-* 시나리오 모두 통과.

### M5 — Session Complete/Cancel + 1RM Auto-Update (Priority: High)

목표: 완료/취소 2개 엔드포인트 + 1RM 비동기 갱신.

작업:
1. `completeSession`: 상태 전환(`IN_PROGRESS → COMPLETED`), `completedAt = now()`, 응답 후 `setImmediate`로 1RM 갱신 트리거.
2. `cancelSession`: 상태 전환(`IN_PROGRESS → CANCELLED`), `cancelledAt = now()`.
3. `OneRmUpdateService.updateOneRepMaxFromSession(sessionId)`:
   - 세션의 완료된 컴파운드 세트 추출.
   - `packages/utils/src/1rm.ts` 함수로 Epley/Brzycki 평균 추정 1RM 계산(컴파운드별 최댓값).
   - 기존 `OneRepMax` 조회 후 상향 갱신만(`upsert` with conditional `where: { value: { lt: estimated } }` 또는 사전 비교).
   - `source = AVERAGE_ESTIMATE`로 기록.
   - try/catch로 실패를 로깅만, 세션 완료 응답에 영향 없음.
4. 단위 테스트(공식 검증) + 통합 테스트(완료 후 OneRepMax 갱신 확인).

완료 기준: AC-WO-COMPLETE-*, AC-WO-CANCEL-*, AC-WO-1RM-* 시나리오 모두 통과.

### M6 — Plate Calculator (Priority: Medium)

목표: `GET /workouts/utils/plates` 엔드포인트.

작업:
1. `PlatesService.calculate(weight, barWeight)` 순수 함수 구현.
2. `PlateQueryDto` 정의 (`@Type(() => Number)` + `IsIn([15, 20])`).
3. 컨트롤러 라우트 등록(`utils/plates`, 라우트 순서에 따라 `:id` 이전 위치).
4. 단위 테스트: 경계 케이스(0, 20, 100, 102.5, 1000, 정확히 표현 가능/불가능).
5. 결정성 테스트: 동일 입력 → 동일 출력 10회 반복 검증.

완료 기준: AC-WO-PLATES-* 시나리오 모두 통과.

### M7 — Mobile Screens (Priority: Medium)

목표: 모바일 클라이언트 4개 화면.

작업:
1. API 클라이언트 `apps/mobile/src/api/workouts.ts` 작성 (TanStack Query mutation/query hooks).
2. 세션 시작 화면 `app/(tabs)/workouts/start.tsx`:
   - 활성 프로그램의 `ProgramDay` 추천 카드.
   - "자유 운동 시작" 버튼 → 운동 검색·다중 선택.
   - `POST /workouts` 호출, 진행 1개 충돌 시 토스트 표시.
3. 세션 진행 화면 `app/workout-session/[id].tsx`:
   - 운동별 세트 카드, 입력 폼(weight, reps, rpe, isCompleted).
   - Optimistic update + rollback on error.
   - 휴식 타이머(Zustand local state).
   - 플레이트 계산기 모달.
   - 완료/취소 버튼.
4. 세션 상세 화면 `app/(tabs)/workouts/[id].tsx`:
   - 완료된 세션 요약, 메모 편집, PR 시각적 피드백(클라이언트 측 비교).
   - `CANCELLED`만 삭제 버튼 활성화.
5. 세션 히스토리 화면 `app/(tabs)/workouts/index.tsx`:
   - 무한 스크롤 페이지네이션.
   - 필터(status, 날짜 범위).
6. EAS Build로 테스트 APK 생성 → 수동 검증 Section MV-WO-MOBILE-* 수행.

완료 기준: 4개 화면이 동작하며 수동 검증 시나리오 통과, EAS Build APK 산출.

### M8 — Testing & Performance (Priority: Medium)

목표: 자동화 테스트 커버리지 ≥ 85%, 성능 SLO 검증.

작업:
1. 단위 테스트: `workouts.service.spec.ts`, `workout-sets.service.spec.ts`, `plates.service.spec.ts`, `one-rm-update.service.spec.ts`.
2. 통합 테스트: `workouts.e2e-spec.ts` (supertest + 실제 Prisma + 테스트 DB).
3. AC 시나리오 매핑: 각 AC-WO-*-NN을 1개 이상의 테스트로 자동화.
4. 부하 테스트: `tests/perf/workouts.k6.js` 작성, 12개 엔드포인트의 P95 측정 → NFR-WO-PERF-001~008 검증.
5. 커버리지 보고: `pnpm test --coverage`로 백엔드 line coverage ≥ 85% 확인.

완료 기준: 모든 AC 자동화 통과, 커버리지 목표 달성, 부하 테스트 결과 보고서.

### M9 — Documentation & MX Tags (Priority: Low)

목표: 문서 동기화 + MX 주석 부착.

작업:
1. `.moai/docs/api-reference.md`에 12개 엔드포인트 추가(요청/응답 예시, 에러 코드).
2. `.moai/docs/architecture.md`에 세션 기록 도메인 추가.
3. mx_plan(spec.md Section 8)의 모든 ANCHOR/WARN/NOTE/TODO 대상에 주석 부착.
4. `moai mx scan` 또는 lint 룰로 MX 주석 검증 자동화.
5. CHANGELOG 항목 추가.

완료 기준: 문서 업데이트 commit, MX 주석 lint 통과.

---

## 4. 파일 구조 (File Structure)

### 4.1 백엔드 신규/수정 파일

```
apps/backend/
├── prisma/
│   ├── schema.prisma                                 [수정]
│   └── migrations/
│       └── YYYYMMDDHHMMSS_add_workout_sessions_and_sets/  [신규]
│           └── migration.sql
├── src/
│   ├── workouts/                                     [신규 디렉토리]
│   │   ├── workouts.module.ts
│   │   ├── workouts.controller.ts
│   │   ├── workouts.service.ts
│   │   ├── workout-sets.service.ts
│   │   ├── plates.service.ts
│   │   ├── one-rm-update.service.ts
│   │   ├── compound-exercise.map.ts
│   │   ├── dto/
│   │   │   ├── create-workout-session.dto.ts
│   │   │   ├── list-workouts-query.dto.ts
│   │   │   ├── update-workout-session.dto.ts
│   │   │   ├── add-workout-set.dto.ts
│   │   │   ├── update-workout-set.dto.ts
│   │   │   ├── plate-query.dto.ts
│   │   │   ├── workout-session.response.dto.ts
│   │   │   ├── workout-set.response.dto.ts
│   │   │   └── plate-result.response.dto.ts
│   │   └── tests/
│   │       ├── workouts.service.spec.ts
│   │       ├── workout-sets.service.spec.ts
│   │       ├── plates.service.spec.ts
│   │       ├── one-rm-update.service.spec.ts
│   │       ├── workouts.controller.spec.ts
│   │       ├── route-order.spec.ts
│   │       ├── compound-exercise.map.spec.ts
│   │       └── workouts.e2e-spec.ts
│   └── app.module.ts                                 [수정 — WorkoutsModule import]
└── tests/perf/
    └── workouts.k6.js                                [신규]
```

### 4.2 공유 타입 신규/수정 파일

```
packages/types/src/
├── workout.ts                                        [신규]
└── index.ts                                          [수정 — re-export]
```

### 4.3 모바일 신규/수정 파일

```
apps/mobile/
├── app/
│   ├── (tabs)/
│   │   └── workouts/
│   │       ├── index.tsx                             [신규 — 히스토리]
│   │       ├── start.tsx                             [신규 — 시작 화면]
│   │       └── [id].tsx                              [신규 — 상세]
│   └── workout-session/
│       └── [id].tsx                                  [신규 — 진행 화면]
└── src/
    ├── api/
    │   └── workouts.ts                               [신규]
    ├── components/
    │   └── workout/                                  [신규 — 공통 컴포넌트]
    │       ├── SetCard.tsx
    │       ├── RestTimer.tsx
    │       ├── PlateCalculatorModal.tsx
    │       └── WorkoutSessionCard.tsx
    └── stores/
        └── rest-timer.store.ts                       [신규 — Zustand]
```

### 4.4 문서 신규/수정 파일

```
.moai/
├── docs/
│   ├── api-reference.md                              [수정]
│   └── architecture.md                               [수정]
└── specs/SPEC-WORKOUT-001/
    ├── spec.md                                       [완료]
    ├── plan.md                                       [완료]
    ├── acceptance.md                                 [완료]
    └── spec-compact.md                               [완료]
```

---

## 5. 라우트 순서 및 매칭 규칙

본 SPEC은 SPEC-EXERCISE-001 REQ-EX-FAV-012 및 SPEC-PROGRAM-001 REQ-PROG-VAL-001과 동일한 라우트 매칭 패턴을 적용한다.

### 5.1 컨트롤러 메서드 정의 순서 (REQ-WO-VAL-001)

```
1. GET    /workouts                        (collection list)
2. POST   /workouts                        (collection create)
3. GET    /workouts/active                 (static)
4. GET    /workouts/utils/plates           (static, nested 2-segment)
5. GET    /workouts/:id                    (dynamic)
6. PATCH  /workouts/:id                    (dynamic)
7. DELETE /workouts/:id                    (dynamic)
8. POST   /workouts/:id/complete           (dynamic + static suffix)
9. POST   /workouts/:id/cancel             (dynamic + static suffix)
10. POST  /workouts/:id/sets               (dynamic + static suffix)
11. PATCH /workouts/:id/sets/:setId        (nested dynamic)
12. DELETE /workouts/:id/sets/:setId       (nested dynamic)
```

### 5.2 정적 검증 테스트

`apps/backend/src/workouts/tests/route-order.spec.ts`:
- TypeScript AST 또는 NestJS metadata reflection으로 `WorkoutsController` 메서드 정의 순서를 추출.
- 위 12개 순서가 정확히 일치하는지 assertion.
- CI에서 자동 실행.

### 5.3 NestJS 라우트 매칭 동작

NestJS는 컨트롤러 내 메서드 정의 순서에 따라 라우트를 등록하며, Express 기반 매칭은 first-match-wins. 따라서:
- `GET /workouts/active`가 `GET /workouts/:id`보다 먼저 정의되어야 `active`가 동적 `:id`로 매칭되지 않음.
- `GET /workouts/utils/plates`도 동일 원리.

---

## 6. 1RM 통합 상세 (1RM Integration Detail)

### 6.1 SPEC-1RM-001과의 인터페이스

본 SPEC은 SPEC-1RM-001의 다음 자원을 사용한다:
- `OneRepMax` 모델 (read + upsert)
- `CompoundType` enum (5종 컴파운드 식별자)
- `OrmSource` enum (`AVERAGE_ESTIMATE` 값 사용)
- `packages/utils/src/1rm.ts`의 `epley()`, `brzycki()`, `averageEstimate()` 함수

본 SPEC은 SPEC-1RM-001의 `OneRepMax` 테이블 스키마를 수정하지 않으며, 단순히 `prisma.oneRepMax.upsert(...)`로 갱신만 수행한다.

### 6.2 1RM 갱신 알고리즘 (REQ-WO-1RM-003)

```typescript
// one-rm-update.service.ts
import { averageEstimate } from '@workout/utils/1rm';
import { COMPOUND_EXERCISE_SLUG_MAP } from './compound-exercise.map';

async updateOneRepMaxFromSession(sessionId: string): Promise<void> {
  const session = await this.prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      sets: {
        where: { isCompleted: true, weight: { not: null } },
        include: { exercise: true },
      },
    },
  });

  if (!session || session.status !== 'COMPLETED') return;

  // 컴파운드별 적격 세트 그룹화
  const byCompound = new Map<CompoundType, Array<{ weight: number; reps: number }>>();
  for (const set of session.sets) {
    const compoundType = COMPOUND_EXERCISE_SLUG_MAP[set.exercise.slug];
    if (!compoundType) continue;
    if (set.reps < 1 || !set.weight || set.weight.toNumber() <= 0) continue;

    const list = byCompound.get(compoundType) ?? [];
    list.push({ weight: set.weight.toNumber(), reps: set.reps });
    byCompound.set(compoundType, list);
  }

  // 컴파운드별 최댓값 추정 및 상향 갱신
  for (const [compoundType, sets] of byCompound) {
    const estimates = sets.map(s => averageEstimate(s.weight, s.reps));
    const maxEstimate = Math.round(Math.max(...estimates) * 100) / 100;

    const existing = await this.prisma.oneRepMax.findUnique({
      where: { userId_exerciseType: { userId: session.userId, exerciseType: compoundType } },
    });

    if (!existing || maxEstimate > existing.value.toNumber()) {
      await this.prisma.oneRepMax.upsert({
        where: { userId_exerciseType: { userId: session.userId, exerciseType: compoundType } },
        create: {
          userId: session.userId,
          exerciseType: compoundType,
          value: maxEstimate,
          source: 'AVERAGE_ESTIMATE',
          estimatedDate: new Date(),
        },
        update: {
          value: maxEstimate,
          source: 'AVERAGE_ESTIMATE',
          estimatedDate: new Date(),
        },
      });
    }
  }
}
```

### 6.3 트랜잭션 격리 (REQ-WO-1RM-006)

세션 완료 트랜잭션과 1RM 갱신 트랜잭션은 분리된다:

```typescript
// workouts.service.ts
async completeSession(sessionId: string, userId: string) {
  const session = await this.prisma.$transaction(async (tx) => {
    // 세션 본인 소유 검증
    // status: IN_PROGRESS → COMPLETED 전환
    // completedAt = now()
    return tx.workoutSession.update({ ... include: { sets: { include: { exercise: true } } } });
  });

  // 트랜잭션 종료 후 비동기 트리거
  setImmediate(() => {
    this.oneRmUpdateService.updateOneRepMaxFromSession(sessionId)
      .catch(err => this.logger.error(`1RM update failed for session ${sessionId}`, err));
  });

  return session;
}
```

- `setImmediate` 콜백은 다음 이벤트 루프 tick에서 실행되므로 응답 반환을 차단하지 않음.
- 콜백 내부에서 예외 발생 시 `.catch`로 로깅만 수행, 세션 상태는 이미 COMPLETED로 commit됨.
- 본 패턴은 NFR-WO-PERF-006 (세션 완료 P95 ≤ 300ms) + NFR-WO-PERF-008 (1RM 갱신 < 1초) 충족.

### 6.4 Race Condition 고려

동일 세션을 두 번 `complete` 호출하는 경우:
- 첫 호출: 트랜잭션 내에서 `status: IN_PROGRESS → COMPLETED` 갱신 성공.
- 두 번째 호출: `status` 검증에서 `409 Conflict` 반환(REQ-WO-COMPLETE-003).
- 1RM 갱신은 첫 호출에서만 트리거되므로 중복 갱신 없음.

---

## 7. 위험 및 완화 전략 (Risks & Mitigations)

### 7.1 진행 1개 제약의 race condition

**위험**: 모바일 클라이언트의 빠른 더블 탭 또는 retry 로직으로 동일 사용자가 동시에 `POST /workouts` 요청 시 진행 2개 생성.

**완화**: PostgreSQL advisory lock(`pg_advisory_xact_lock(hashtext(userId))`)으로 사용자별 직렬화. 단위 테스트에서 동시 요청 시뮬레이션으로 검증.

### 7.2 setNumber 자동 부여 race condition

**위험**: 동일 운동에 대해 동시에 `setNumber` 미지정 POST 요청 시 동일 `setNumber`로 시도하여 unique 위반.

**완화**: 1) `addSet` 내부에서 `SELECT MAX(setNumber) + 1`을 명시적 트랜잭션 내에서 수행. 2) unique 위반 발생 시 1회 자동 재시도(`max + 1` 재계산). @MX:WARN 주석 명시.

### 7.3 1RM 자동 갱신 작업 손실

**위험**: 프로세스 재시작으로 `setImmediate` 콜백 손실.

**완화**: 1) 작업이 매우 짧음(<100ms 예상)으로 손실 가능성 낮음. 2) 다음 세션 완료 시 동일 사용자의 동일 컴파운드가 다시 갱신되므로 비즈니스 영향 최소. 3) 손실이 발생해도 사용자가 직접 입력(`PUT /users/me/1rm/:exerciseType`)으로 보정 가능. @MX:NOTE 주석 명시.

### 7.4 컴파운드 매핑 불일치

**위험**: SPEC-EXERCISE-001 시드 데이터의 slug 변경 또는 누락으로 매핑이 깨질 가능성.

**완화**: 1) 기동 시점 assertion으로 5개 매핑이 모두 DB에 실존하는지 검증, 실패 시 기동 거부. 2) `compound-exercise.map.spec.ts`로 CI에서 매핑 정합성 검증. 3) SPEC-EXERCISE-001 시드 변경 시 본 SPEC 매핑 동기화 필수(@MX:WARN 명시).

### 7.5 Decimal 정밀도 이슈

**위험**: `WorkoutSet.weight`가 `Decimal(7, 2)`이며 JS의 `number`로 변환 시 정밀도 오차 가능.

**완화**: 1) 1RM 계산은 `Decimal.toNumber()` 후 수행하되 결과는 소수 둘째 자리 반올림. 2) 응답 직렬화 시 Prisma의 `@db.Decimal` → JSON `number` 변환은 정확함(Prisma 5+). 3) 단위 테스트에서 경계 케이스(102.5, 102.55 등) 검증.

### 7.6 사용자 격리 정보 누설

**위험**: 타 사용자 세션 ID로 접근 시 `403`을 반환하면 "세션 존재"를 누설.

**완화**: 모든 ownership 위반을 `404 Not Found`로 통일하여 존재 자체를 숨김(REQ-WO-SESSION-008, AC-WO-SECURITY-OWNERSHIP-01).

---

## 8. CI 통과 기준 (CI Acceptance)

- `pnpm install` 성공 (workspace dependencies 정합).
- `pnpm typecheck` 성공 (모든 패키지 타입 통과).
- `pnpm lint` 성공 (ESLint + Prettier).
- `pnpm test` 성공:
  - 백엔드 단위/통합/e2e 테스트 통과.
  - 백엔드 라인 커버리지 ≥ 85%.
  - 라우트 순서 정적 검사 통과.
  - 컴파운드 매핑 검증 통과.
- `pnpm prisma migrate deploy` 성공 (마이그레이션 적용 가능).
- 모바일 EAS Build APK 산출 (개발 빌드 successful).

---

## 9. 후속 SPEC과의 관계

본 SPEC 완료 후 다음 SPEC이 자연스럽게 활성화된다:

- **SPEC-STATS-001** (가칭): 주별/월별 볼륨, 부위별 빈도, 1RM 진척도 그래프. 본 SPEC의 `WorkoutSession`/`WorkoutSet` 데이터를 집계.
- **SPEC-AI-001** (가칭): AI 세션 분석·피드백. 본 SPEC의 세션 기록을 입력으로 활용. SPEC-PROGRAM-001 `AiUsageLog.reevaluations`/`catalogRecs` 예약 컬럼 활용.
- **SPEC-WORKOUT-EXPORT-001** (가칭): 세션 기록 CSV/JSON export.
- **SPEC-WORKOUT-TEMPLATE-001** (가칭): 이전 세션 복제, 프리셋 세트 템플릿.

본 SPEC은 Phase 3의 마지막 SPEC으로 운동 트래커 앱의 기록·진행도 추적 레이어를 완성한다.

---

## 10. 참조 (References)

- spec.md (본 SPEC의 EARS 요구사항 + 데이터 모델)
- acceptance.md (Given-When-Then 시나리오)
- SPEC-AUTH-001 (JwtAuthGuard, @CurrentUser 등)
- SPEC-EXERCISE-001 (Exercise 모델 + 시드)
- SPEC-1RM-001 (OneRepMax, CompoundType, OrmSource, packages/utils/src/1rm.ts)
- SPEC-PROGRAM-001 (Program, ProgramDay, UserProgram + 라우트 순서 패턴)
- Prisma docs: Decimal type, partial unique index workarounds
- NestJS docs: ValidationPipe, custom decorators, route ordering
