# SPEC-1RM-001 구현 계획 (Implementation Plan)

본 문서는 SPEC-1RM-001(1RM 관리)의 구현 계획을 정의한다. 우선순위 기반(High/Medium/Low)으로 페이즈가 정의되며, 시간 예측은 포함하지 않는다 (Agent Common Protocol 준수).

전제:
- SPEC-AUTH-001 v1.0.1이 이미 구현되어 있다 (`User` 모델, `JwtAuthGuard`, `JwtStrategy`, `@CurrentUser()` 데코레이터 존재).
- SPEC-USER-001 v1.0.1이 구현되어 있다 (`User.deletedAt` 컬럼 존재).
- `packages/utils/src/1rm.ts`에 Epley/Brzycki 공식이 이미 구현되어 있다 (계산 함수 재구현 불요, import만 처리).
- 모바일 화면 라우트(`app/(tabs)/my/1rm.tsx`)가 프로젝트 구조에 이미 계획되어 있다.
- `prisma/schema.prisma`의 `User` 엔티티는 존재하나 `OneRepMax` 엔티티는 미정의 상태이다 (tech.md에서 1:N 관계만 언급).

---

## 1. 기술 접근 (Technical Approach)

### 1.1 백엔드 모듈 구조 — UsersModule 확장 vs OrmModule 신설 결정

본 SPEC의 모든 엔드포인트는 `/users/me/1rm` 하위 경로이다. 두 옵션이 있다.

**옵션 A: `UsersModule`에 1RM 라우트를 통합**
- `UsersController`에 `@Get('me/1rm')`, `@Put('me/1rm/:exerciseType')`, `@Post('me/1rm/estimate')` 추가.
- 장점: 단일 사용자 자원으로 응집. 라우팅 단순.
- 단점: `UsersController`가 비대해짐. 1RM 도메인 로직이 사용자 프로필 로직과 섞임.

**옵션 B: 별도 `OneRepMaxModule` 신설**
- `src/one-rep-max/` 폴더에 module/controller/service 분리.
- `OneRepMaxController`의 routePrefix를 `users/me/1rm`으로 설정.
- 장점: 도메인 응집성 (1RM 로직은 1RM 모듈에 격리). 후속 SPEC-WORKOUT-001에서 1RM 자동 추정 로직 추가 시 자연스러운 확장점.
- 단점: 작은 모듈이 추가됨 (3 엔드포인트만 담음).

**결정**: **옵션 B (OneRepMaxModule 신설)**.

사유:
- 도메인 응집성 우선. 1RM은 운동 강도의 핵심 메트릭으로 향후 SPEC-WORKOUT-001(운동 세션 기록)과 강하게 결합될 도메인이다.
- `UsersController`가 SPEC-USER-001에서 이미 프로필/온보딩 로직을 담고 있어, 1RM까지 추가하면 단일 책임 원칙 위배.
- 후속 SPEC에서 RPE 기반 자동 1RM 추정, 1RM 이력 등이 추가되면 별도 모듈이 자연스럽다.

모듈 위치: `apps/backend/src/one-rep-max/`

### 1.2 백엔드 아키텍처 상세

#### 폴더 구조

```
apps/backend/src/one-rep-max/
├── one-rep-max.module.ts
├── one-rep-max.controller.ts
├── one-rep-max.service.ts
├── dto/
│   ├── upsert-one-rep-max.dto.ts          // PUT body: { value }
│   ├── estimate-one-rep-max.dto.ts        // POST estimate body: { weight, reps }
│   ├── one-rep-max-response.dto.ts        // 단일 레코드 응답
│   ├── one-rep-max-collection.dto.ts      // GET 응답 (5종 키 객체)
│   └── one-rep-max-estimate-response.dto.ts // POST estimate 응답
└── tests/
    ├── one-rep-max.service.spec.ts
    ├── one-rep-max.controller.spec.ts
    └── one-rep-max.e2e-spec.ts
```

#### 라우트 정의 순서 (REQ-ORM-VAL-007)

NestJS Controller에서 `@Post('estimate')`와 `@Put(':exerciseType')`는 HTTP 메서드가 다르므로 자체 충돌은 없다. 그러나 안전 마진을 위해 controller 메서드 정의 순서를 다음과 같이 강제한다:

```typescript
@Controller('users/me/1rm')
@UseGuards(JwtAuthGuard)
export class OneRepMaxController {
  // 1. 고정 경로 POST estimate (먼저 정의)
  @Post('estimate')
  async estimate(@Body() dto: EstimateOneRepMaxDto) { ... }

  // 2. 컬렉션 조회
  @Get()
  async getAll(@CurrentUser('sub') userId: string) { ... }

  // 3. 동적 경로 PUT :exerciseType (마지막)
  @Put(':exerciseType')
  async upsert(
    @Param('exerciseType', new ParseEnumPipe(CompoundType)) exerciseType: CompoundType,
    @Body() dto: UpsertOneRepMaxDto,
    @CurrentUser('sub') userId: string,
  ) { ... }
}
```

`@MX:NOTE` 주석으로 컨트롤러 상단에 라우트 순서 정책 명시.

#### DTO 정의

**`upsert-one-rep-max.dto.ts`** (PUT body):
```typescript
import { IsNumber, IsPositive, Max } from 'class-validator';

export class UpsertOneRepMaxDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(500)
  value!: number;
}
```

**`estimate-one-rep-max.dto.ts`** (POST estimate body):
```typescript
import { IsInt, IsNumber, IsPositive, Max, Min } from 'class-validator';

export class EstimateOneRepMaxDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(500)
  weight!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  reps!: number;
}
```

**`one-rep-max-response.dto.ts`** (단일 레코드):
```typescript
export class OneRepMaxResponseDto {
  exerciseType!: CompoundType;
  value!: number;
  source!: OrmSource;
  updatedAt!: string; // ISO 8601
}
```

**`one-rep-max-collection.dto.ts`** (GET 응답, 5종 키 객체):
```typescript
export class OneRepMaxCollectionDto {
  SQUAT!: OneRepMaxResponseDto | null;
  DEADLIFT!: OneRepMaxResponseDto | null;
  BENCH_PRESS!: OneRepMaxResponseDto | null;
  BARBELL_ROW!: OneRepMaxResponseDto | null;
  OVERHEAD_PRESS!: OneRepMaxResponseDto | null;
}
```

**`one-rep-max-estimate-response.dto.ts`** (POST estimate 응답):
```typescript
export class OneRepMaxEstimateResponseDto {
  epley!: number;   // 소수 2자리 반올림
  brzycki!: number;
  average!: number;
}
```

#### Service 구현 전략

```typescript
@Injectable()
export class OneRepMaxService {
  constructor(private prisma: PrismaService) {}

  // REQ-ORM-READ-001, REQ-ORM-READ-002
  async getAll(userId: string): Promise<OneRepMaxCollectionDto> {
    const records = await this.prisma.oneRepMax.findMany({ where: { userId } });
    const byType = new Map(records.map(r => [r.exerciseType, r]));

    const result: OneRepMaxCollectionDto = {
      SQUAT: null,
      DEADLIFT: null,
      BENCH_PRESS: null,
      BARBELL_ROW: null,
      OVERHEAD_PRESS: null,
    };
    for (const type of Object.values(CompoundType)) {
      const record = byType.get(type);
      result[type] = record ? toResponse(record) : null;
    }
    return result;
  }

  // REQ-ORM-INPUT-001, REQ-ORM-INPUT-004 (멱등성)
  async upsert(
    userId: string,
    exerciseType: CompoundType,
    value: number,
  ): Promise<{ record: OneRepMaxResponseDto; isNew: boolean }> {
    const existing = await this.prisma.oneRepMax.findUnique({
      where: { userId_exerciseType: { userId, exerciseType } },
    });
    const isNew = existing === null;
    const record = await this.prisma.oneRepMax.upsert({
      where: { userId_exerciseType: { userId, exerciseType } },
      create: { userId, exerciseType, value, source: OrmSource.DIRECT_INPUT },
      update: { value, source: OrmSource.DIRECT_INPUT },
    });
    return { record: toResponse(record), isNew };
  }

  // REQ-ORM-CALC-001, REQ-ORM-CALC-003 (DB 쓰기 없음)
  estimate(weight: number, reps: number): OneRepMaxEstimateResponseDto {
    // packages/utils/src/1rm.ts의 함수 사용
    const epley = calculateEpley(weight, reps);
    const brzycki = calculateBrzycki(weight, reps);
    const average = calculateAverage1RM(weight, reps);
    return {
      epley: round2(epley),
      brzycki: round2(brzycki),
      average: round2(average),
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
```

#### Controller 응답 코드 분기 (REQ-ORM-INPUT-001)

```typescript
@Put(':exerciseType')
async upsert(
  @Param('exerciseType', new ParseEnumPipe(CompoundType)) exerciseType: CompoundType,
  @Body() dto: UpsertOneRepMaxDto,
  @CurrentUser('sub') userId: string,
  @Res({ passthrough: true }) res: Response,
): Promise<OneRepMaxResponseDto> {
  const { record, isNew } = await this.service.upsert(userId, exerciseType, dto.value);
  res.status(isNew ? HttpStatus.CREATED : HttpStatus.OK);
  return record;
}
```

### 1.3 모바일 아키텍처

#### 화면 구성

**`app/(tabs)/my/1rm.tsx`** (1RM 관리 화면):

```
┌─────────────────────────────────────┐
│  1RM 관리                            │
├─────────────────────────────────────┤
│  스쿼트 (SQUAT)                      │
│  현재: 140 kg          [편집]        │
├─────────────────────────────────────┤
│  데드리프트 (DEADLIFT)               │
│  현재: 180 kg          [편집]        │
├─────────────────────────────────────┤
│  벤치프레스 (BENCH_PRESS)            │
│  현재: 100 kg          [편집]        │
├─────────────────────────────────────┤
│  바벨 로우 (BARBELL_ROW)             │
│  미설정              [+ 추가]        │
├─────────────────────────────────────┤
│  오버헤드프레스 (OVERHEAD_PRESS)     │
│  미설정              [+ 추가]        │
├─────────────────────────────────────┤
│  [추정 계산 도구]                    │
│  무게: ___  반복: ___                │
│  → Epley: __ / Brzycki: __ / 평균: __│
└─────────────────────────────────────┘
```

#### 컴포넌트

- **`components/my/OneRepMaxList.tsx`** (신규): 5종 컴파운드 카드 리스트.
- **`components/my/OneRepMaxCard.tsx`** (신규): 단일 컴파운드 카드 (현재값 + 편집 버튼 + 모달 트리거).
- **`components/my/OneRepMaxEditModal.tsx`** (신규): 1RM 값 입력 모달. 추정 계산 보조 UI 포함.
- **`components/my/OneRepMaxEstimateForm.tsx`** (신규): weight/reps 입력 → 추정값 표시. 모달 내부 또는 별도 화면.

#### 상태 관리

- **TanStack Query**:
  - `useOneRepMaxes()`: `GET /users/me/1rm` 조회 → `OneRepMaxCollectionDto`.
  - `useUpsertOneRepMax()`: `PUT /users/me/1rm/:exerciseType` mutation.
  - `useEstimateOneRepMax()`: `POST /users/me/1rm/estimate` mutation (또는 클라이언트 로컬 계산 옵션).
- **로컬 상태(useState)**: 입력 폼 상태(value, weight, reps).
- **Optimistic Update**: PUT 성공 즉시 캐시 갱신 (`queryClient.setQueryData(['1rm'], ...)`).

#### 클라이언트 로컬 계산 vs 서버 추정 호출

`POST /users/me/1rm/estimate`는 순수 계산 엔드포인트이므로 모바일에서 두 가지 방식을 선택할 수 있다:

- **방식 1**: 매 입력마다 서버 `POST /estimate` 호출 → 네트워크 비용 발생.
- **방식 2 (권장)**: 모바일 측 `apps/mobile/utils/1rm.ts`(또는 `packages/utils/src/1rm.ts`)로 클라이언트 로컬 계산 → 즉시 응답 + 오프라인 동작 가능.

권장: **방식 2 (클라이언트 로컬 계산)**. 서버 엔드포인트는 동등성 검증용 및 클라이언트 환경 비신뢰 케이스(예: 웹뷰 외부) 대비로 유지한다.

### 1.4 공유 유틸 (packages/utils/src/1rm.ts)

이미 구현되어 있다고 가정. 본 SPEC에서는 다음을 보장한다:

```typescript
// packages/utils/src/1rm.ts (기존)
export function calculateEpley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export function calculateBrzycki(weight: number, reps: number): number {
  return weight * (36 / (37 - reps));
}

export function calculateAverage1RM(weight: number, reps: number): number {
  return (calculateEpley(weight, reps) + calculateBrzycki(weight, reps)) / 2;
}
```

본 SPEC에서 추가 작업:
- 백엔드 `OneRepMaxService.estimate()`에서 위 함수를 import하여 사용 (Turborepo workspace 내부 패키지 import).
- 백엔드 import가 모노레포 빌드 제약(예: tsconfig path 미설정)으로 불가하면 동일 알고리즘을 백엔드에 재구현하되 단위 테스트로 동등성 검증 (REQ-ORM-CALC-005).
- 모바일 측 `apps/mobile/utils/1rm.ts`는 `packages/utils/src/1rm.ts`를 re-export 또는 동일 구현 유지. 본 SPEC에서는 둘 중 어느 쪽이든 결과 동등성이 핵심이며 코드 중복 제거는 권장사항.

### 1.5 공유 타입 (packages/types)

`packages/types/src/one-rep-max.ts` 신규 생성:

```typescript
export const COMPOUND_TYPES = [
  'SQUAT',
  'DEADLIFT',
  'BENCH_PRESS',
  'BARBELL_ROW',
  'OVERHEAD_PRESS',
] as const;
export type CompoundType = typeof COMPOUND_TYPES[number];

export const ORM_SOURCES = [
  'DIRECT_INPUT',
  'EPLEY_ESTIMATE',
  'BRZYCKI_ESTIMATE',
  'AVERAGE_ESTIMATE',
] as const;
export type OrmSource = typeof ORM_SOURCES[number];

export interface OneRepMaxRecord {
  exerciseType: CompoundType;
  value: number;
  source: OrmSource;
  updatedAt: string; // ISO 8601
}

export type OneRepMaxCollection = {
  [K in CompoundType]: OneRepMaxRecord | null;
};

export interface UpsertOneRepMaxRequest {
  value: number;
}

export interface EstimateOneRepMaxRequest {
  weight: number;
  reps: number;
}

export interface OneRepMaxEstimateResponse {
  epley: number;
  brzycki: number;
  average: number;
}

// 한국어 표시 매핑 (모바일 UI용)
export const COMPOUND_LABELS_KO: Record<CompoundType, string> = {
  SQUAT: '스쿼트',
  DEADLIFT: '데드리프트',
  BENCH_PRESS: '벤치프레스',
  BARBELL_ROW: '바벨 로우',
  OVERHEAD_PRESS: '오버헤드프레스',
};
```

백엔드는 Prisma 생성 enum을 우선 사용하고, 모바일은 본 타입을 사용. 양쪽이 호환되도록 enum 값(`SQUAT` 등)은 정확히 일치해야 한다.

---

## 2. 마일스톤 (Milestones, Priority-based)

### Phase 1 [Priority: High] — Prisma 스키마 및 마이그레이션

**목표**: 데이터 모델을 확정하고 마이그레이션을 적용한다.

**작업**:
1. `prisma/schema.prisma` 수정:
   - `CompoundType` enum 신규 추가 (5종 컴파운드).
   - `OrmSource` enum 신규 추가 (4종 출처).
   - `OneRepMax` 모델 신규 추가 (spec.md Section 4.1 정의대로).
   - `User` 모델에 `oneRepMaxes OneRepMax[]` 역참조 추가.
   - `@@unique([userId, exerciseType])` 복합 UNIQUE 적용.
   - `@@index([userId])` 인덱스 적용.
2. `pnpm prisma migrate dev --name add_one_rep_max`로 마이그레이션 생성.
3. `pnpm prisma generate`로 Prisma Client 재생성.
4. `prisma validate` 통과 확인.

**완료 기준**: 마이그레이션이 commit되고, `prisma migrate status` 클린, Prisma Client에서 `OneRepMax`, `CompoundType`, `OrmSource`가 type-safe하게 사용 가능.

**의존성**: 없음 (선행 작업).

### Phase 2 [Priority: High] — 백엔드 OneRepMaxModule 골격

**목표**: 모듈/컨트롤러/서비스 스켈레톤을 생성하고 `AppModule`에 등록한다.

**작업**:
1. `src/one-rep-max/one-rep-max.module.ts` 작성:
   - `imports: [PrismaModule]`
   - `controllers: [OneRepMaxController]`
   - `providers: [OneRepMaxService]`
2. `src/one-rep-max/one-rep-max.controller.ts` 골격 작성 (라우트 순서 명시 + `@MX:NOTE` 주석).
3. `src/one-rep-max/one-rep-max.service.ts` 골격 작성.
4. `src/app.module.ts`에 `OneRepMaxModule` 등록.
5. 빈 컨트롤러/서비스에 대한 단위 테스트 스켈레톤 (`exercises.service.spec.ts` 패턴 참고).

**완료 기준**: NestJS 앱 부트스트랩 시 본 모듈이 정상 등록되며, `tsc --noEmit` 0 error.

**의존성**: Phase 1.

### Phase 3 [Priority: High] — 백엔드 GET /users/me/1rm 구현

**목표**: 1RM 컬렉션 조회 엔드포인트 구현.

**작업**:
1. `OneRepMaxResponseDto`, `OneRepMaxCollectionDto` 작성.
2. `OneRepMaxService.getAll(userId)` 구현 (spec.md Section 1.2 코드 골격).
3. `OneRepMaxController.@Get()` 라우트 추가:
   - `@UseGuards(JwtAuthGuard)`, `@CurrentUser('sub') userId`
4. 단위 테스트:
   - 사용자가 5종 모두 설정 → 5건 모두 반환.
   - 사용자가 3종만 설정 → 3건 + 2건 `null`.
   - 사용자가 미설정 → 5건 모두 `null`.
5. E2E 테스트: AC-ORM-READ-01, AC-ORM-EMPTY-01.

**완료 기준**: AC-ORM-READ-01, AC-ORM-EMPTY-01, AC-ORM-SECURITY-01 (READ 부분) 통과.

**의존성**: Phase 1, Phase 2.

### Phase 4 [Priority: High] — 백엔드 PUT /users/me/1rm/:exerciseType 구현

**목표**: 1RM 직접 입력 (upsert) 엔드포인트 구현.

**작업**:
1. `UpsertOneRepMaxDto` 작성 (`@IsNumber`, `@IsPositive`, `@Max(500)`).
2. `OneRepMaxService.upsert(userId, exerciseType, value)` 구현:
   - Prisma `upsert` 사용 (멱등성, REQ-ORM-INPUT-004).
   - 신규/기존 분기 판별 → `{ record, isNew }` 반환.
3. `OneRepMaxController.@Put(':exerciseType')` 라우트 추가:
   - `@Param('exerciseType', new ParseEnumPipe(CompoundType))`로 enum 검증 (REQ-ORM-INPUT-003 → 400).
   - `@Body() dto: UpsertOneRepMaxDto`.
   - `@CurrentUser('sub') userId` (REQ-ORM-INPUT-006 권한 격리).
   - `@Res({ passthrough: true })`로 응답 코드 분기 (201 vs 200, REQ-ORM-INPUT-001).
4. 단위 테스트:
   - 신규 입력 → DB에 레코드 생성, 201 응답.
   - 기존 값 갱신 → DB 레코드 1건 유지, 200 응답.
   - 잘못된 `exerciseType` (e.g., `PULL_UP`) → 400.
   - `value <= 0` 또는 `value > 500` → 400.
   - 다른 사용자의 데이터 접근 시도 → 자신의 데이터만 영향 (JWT sub 사용).
5. E2E 테스트: AC-ORM-INPUT-01, AC-ORM-INPUT-02, AC-ORM-UPSERT-01, AC-ORM-VALIDATION-01/02, AC-ORM-SECURITY-02.

**완료 기준**: Phase 4의 모든 AC 통과.

**의존성**: Phase 1, Phase 2, Phase 3 (DTO 공유).

### Phase 5 [Priority: High] — 백엔드 POST /users/me/1rm/estimate 구현

**목표**: 1RM 추정 계산 엔드포인트 구현 (DB 쓰기 없음).

**작업**:
1. `EstimateOneRepMaxDto` 작성 (`weight`: number > 0, ≤ 500; `reps`: int ≥ 1, ≤ 10).
2. `OneRepMaxService.estimate(weight, reps)` 구현:
   - `packages/utils/src/1rm.ts`의 `calculateEpley`, `calculateBrzycki`, `calculateAverage1RM` import 시도.
   - import 불가 시 동일 알고리즘 백엔드 재구현 + 동등성 단위 테스트로 보장 (NFR-ORM-CONSISTENCY-001, REQ-ORM-CALC-005).
   - 결과를 소수 2자리 반올림 (`round2()`).
   - **반드시 DB 쓰기 작업 없음** (REQ-ORM-CALC-003).
3. `OneRepMaxController.@Post('estimate')` 라우트 추가:
   - 반드시 `@Put(':exerciseType')`보다 **먼저** 메서드 정의 (REQ-ORM-VAL-007).
   - `@Body() dto: EstimateOneRepMaxDto`.
4. 단위 테스트:
   - `weight=100, reps=5` → `epley=116.67, brzycki=112.5, average=114.58` (수학적 정확성).
   - `weight=100, reps=1` → 모든 값이 100과 매우 가까움 (reps=1은 weight = 1RM).
   - `weight=0` → 400.
   - `weight=501` → 400.
   - `reps=0` → 400.
   - `reps=11` → 400.
   - `reps=5.5` (비정수) → 400.
   - DB 호출이 발생하지 않음 검증 (Prisma 모킹에서 `oneRepMax.upsert` 등이 호출되지 않음).
5. E2E 테스트: AC-ORM-CALC-01, AC-ORM-CALC-02, AC-ORM-CALC-INVALID-01/02/03.

**완료 기준**: Phase 5의 모든 AC 통과. 백엔드와 모바일 측 추정 결과가 일치 (AC-ORM-CONSISTENCY-01).

**의존성**: Phase 2 (모듈 골격), Phase 4 (라우트 순서 확정).

### Phase 6 [Priority: High] — 공유 타입 정합

**목표**: `packages/types/src/one-rep-max.ts`를 백엔드/모바일 양쪽에서 import 가능하게 한다.

**작업**:
1. `packages/types/src/one-rep-max.ts` 작성 (Section 1.5 정의대로).
2. `packages/types/src/index.ts`에 export 추가.
3. 모바일 fetcher 함수의 타입을 `@workout/types`(또는 프로젝트 alias)에서 import.
4. 백엔드 DTO는 Prisma 생성 enum과 `@workout/types`의 타입이 호환되는지 검증.
5. Turborepo dependency 확인 (`apps/backend/package.json`, `apps/mobile/package.json`).

**완료 기준**: 백엔드/모바일이 동일 enum 값을 참조, tsc 빌드 에러 없음.

**의존성**: Phase 1 (Prisma enum 생성 후).

### Phase 7 [Priority: Medium] — 모바일 1RM 관리 화면

**목표**: `app/(tabs)/my/1rm.tsx` 구현.

**작업**:
1. `apps/mobile/services/one-rep-max.ts` 작성:
   - `fetchOneRepMaxes(): Promise<OneRepMaxCollection>`
   - `upsertOneRepMax(exerciseType, value): Promise<OneRepMaxRecord>`
   - `estimateOneRepMax(weight, reps): Promise<OneRepMaxEstimateResponse>` (선택, 서버 호출용)
2. `apps/mobile/hooks/useOneRepMax.ts` 작성:
   - `useOneRepMaxes()`: `useQuery(['1rm'], fetchOneRepMaxes)`.
   - `useUpsertOneRepMax()`: `useMutation` + `queryClient.invalidateQueries(['1rm'])`.
   - `useEstimate1RMLocal(weight, reps)`: `packages/utils/src/1rm.ts`로 클라이언트 로컬 계산 훅 (옵션).
3. `components/my/OneRepMaxCard.tsx` 작성:
   - Props: `exerciseType: CompoundType`, `record: OneRepMaxRecord | null`, `onPress`.
   - 현재값 표시 또는 "미설정" 표시 + "편집"/"추가" 버튼.
4. `components/my/OneRepMaxEditModal.tsx` 작성:
   - 모달 내부에 `value` 입력 폼 + 추정 보조 토글.
   - 추정 보조 활성화 시 weight/reps 입력 → 클라이언트 로컬 계산값 미리보기.
   - 저장 시 `useUpsertOneRepMax()` 호출.
5. `app/(tabs)/my/1rm.tsx` 작성:
   - `useOneRepMaxes()`로 데이터 fetch.
   - 5종 컴파운드를 `OneRepMaxCard` 리스트로 렌더.
   - 카드 탭 시 `OneRepMaxEditModal` 오픈.
6. 로딩/에러 상태 UI.

**완료 기준**: 모바일에서 5종 1RM 표시·입력이 정상 동작하며, 추정 계산 보조 UI가 정확한 값을 표시한다.

**의존성**: Phase 3, 4, 5, 6.

### Phase 8 [Priority: Low] — 운영 문서 및 검증

**목표**: 운영 가이드 보강.

**작업**:
1. `apps/backend/README.md`에 1RM 엔드포인트 사용 가이드 추가.
2. `docs/api/one-rep-max.md` (또는 NestJS Swagger 자동 생성)로 API 명세 문서화.
3. 백엔드 측 1RM 추정 결과가 모바일 측 클라이언트 계산 결과와 일치함을 검증하는 통합 테스트 작성 (NFR-ORM-CONSISTENCY-001).

**완료 기준**: 문서 PR 머지, 동등성 검증 테스트 통과.

**의존성**: Phase 5, 6, 7.

---

## 3. 위험 요소 (Risks)

### Risk 1: `packages/utils/src/1rm.ts` 백엔드 import 가능 여부

- **상황**: Turborepo 모노레포에서 `packages/utils`가 `apps/backend`의 `tsconfig.json`/`package.json`에 workspace dependency로 등록되어 있어야 import 가능. 미설정 시 빌드 에러.
- **완화**:
  - Phase 5 시작 전 `apps/backend/package.json`의 `dependencies`에 `"@workout/utils": "workspace:*"` 존재 여부 확인.
  - 미설정 시 옵션 (a) workspace 설정 추가, 또는 옵션 (b) 백엔드에 동일 알고리즘 재구현 + 단위 테스트로 동등성 검증 (REQ-ORM-CALC-005).
  - 어느 쪽이든 단위 테스트(`weight=100, reps=5` → 정확한 수학적 결과)로 정확성을 보장.

### Risk 2: Prisma upsert race condition

- **상황**: 동일 사용자가 같은 컴파운드의 PUT 요청을 동시에 두 번 보내면 UNIQUE 제약 위반 가능.
- **완화**: Prisma `upsert`는 PostgreSQL의 `INSERT ... ON CONFLICT DO UPDATE`를 사용하므로 race를 자동 해결. 모바일은 mutation의 `isPending`으로 버튼 비활성화하여 추가 방어 (Optimistic Update 정책).

### Risk 3: 클라이언트 측 weight/reps 입력의 NaN

- **상황**: 모바일에서 사용자가 weight 입력 중 잘못된 문자열(예: 한글)을 입력하면 `parseFloat` 결과가 `NaN`이 되어 계산 결과도 `NaN`.
- **완화**: 입력 필드 `keyboardType="decimal-pad"` 사용 + `parseFloat` 결과 `Number.isFinite()` 검사. 서버 검증은 ValidationPipe로 백업.

### Risk 4: 1RM 추정 정확도 오해

- **상황**: 사용자가 추정 계산 결과를 실제 1RM으로 잘못 인식할 위험. 추정은 어디까지나 가이드 수치.
- **완화**:
  - 모바일 UI에서 "추정값" 라벨 명확히 표시.
  - 저장 시 `OneRepMax.source`는 `DIRECT_INPUT`으로 기록되며, 추정 출처 enum(`EPLEY_ESTIMATE` 등)은 본 SPEC에서 저장하지 않음 (REQ-ORM-INPUT-007).
  - 후속 SPEC-WORKOUT-001에서 RPE 기반 자동 추정 시 출처를 명확히 구분하여 저장.

### Risk 5: reps=1일 때 추정값의 의미

- **상황**: reps=1은 정의상 1RM과 동일하므로 추정 결과가 weight와 거의 같다 (Epley: `weight * (1 + 1/30) ≈ weight * 1.033`, Brzycki: `weight * (36/36) = weight`). 사용자가 reps=1로 추정을 시도하면 "왜 weight와 비슷한 값이 나오지?" 혼란 가능.
- **완화**:
  - 모바일 UI에서 reps=1 입력 시 "1RM 자체를 입력하시는 것이라면 직접 입력 기능을 사용하세요" 안내 표시 (UX 가이드).
  - reps=1도 본 SPEC에서 허용 (REQ-ORM-VAL-004의 `1 ≤ reps ≤ 10`).

### Risk 6: 모바일 미러 유틸 (`apps/mobile/utils/1rm.ts`) 동기화

- **상황**: 모바일 측에 별도 유틸 파일이 존재하면 `packages/utils/src/1rm.ts`와 구현이 어긋날 위험.
- **완화**:
  - 권장: `apps/mobile/utils/1rm.ts`를 삭제하고 `packages/utils`에서 re-export하여 단일 진실 공급원 유지.
  - 차선: 두 파일을 모두 유지하되 단위 테스트로 동일 입력에 대한 동일 결과를 검증.
  - 본 SPEC 범위에서는 모바일 측 코드 변경은 Phase 7의 일부로 처리.

### Risk 7: `source` enum 미사용 값의 노이즈

- **상황**: `OrmSource` enum에 `EPLEY_ESTIMATE`, `BRZYCKI_ESTIMATE`, `AVERAGE_ESTIMATE` 3종이 본 SPEC에서 저장되지 않으나 enum에 존재.
- **완화**:
  - Prisma 스키마 주석에 "후속 SPEC-WORKOUT-001에서 사용 예약" 명시.
  - 응답 DTO 타입에 `source: OrmSource`로 type-safe하게 노출 (현재 SPEC에서는 항상 `DIRECT_INPUT`).
  - 후속 SPEC에서 마이그레이션을 다시 만들 필요 없이 즉시 사용 가능.

---

## 4. 의존성 (Dependencies)

### 4.1 선행 SPEC

- **SPEC-AUTH-001 v1.0.1**: 본 SPEC의 모든 엔드포인트가 `JwtAuthGuard`, `@CurrentUser('sub')` 데코레이터에 의존.
- **SPEC-USER-001 v1.0.1**: `User` 모델 존재 가정 (`onDelete: Cascade` 외래키 설정). 소프트 삭제는 본 SPEC에서 능동 처리하지 않음.

### 4.2 기존 코드

- **`packages/utils/src/1rm.ts`**: Epley/Brzycki/Average 공식 구현 (이미 존재). 본 SPEC에서 재구현하지 않고 재사용.
- **`apps/mobile/utils/1rm.ts`**: 모바일 측 동일 구현 (이미 존재). 권장: `packages/utils`로 통합.
- **`app/(tabs)/my/1rm.tsx`**: 화면 라우트 계획됨 (구현은 Phase 7).
- **`prisma/schema.prisma`**: `User` 엔티티 존재, `OneRepMax`는 본 SPEC에서 신설.

### 4.3 외부 라이브러리 (이미 설치)

- `@nestjs/common`, `@nestjs/jwt`, `@nestjs/passport`
- `@prisma/client`, `prisma` (v5)
- `class-validator`, `class-transformer`
- `@tanstack/react-query` (모바일)
- `zustand` (모바일, 본 SPEC에서는 선택적)

### 4.4 후행 SPEC (본 SPEC 완료가 트리거)

- **SPEC-WORKOUT-001**: 운동 세션 기록 및 RPE 기반 자동 1RM 추정. 본 SPEC의 `OneRepMax` 모델과 `OrmSource` enum(`EPLEY_ESTIMATE` 등)을 직접 사용.
- **SPEC-EXERCISE-EXT-XXX**: 운동 상세 화면에 1RM 표시 (예: 벤치프레스 상세 진입 시 사용자의 1RM 노출).
- **SPEC-AI-RECOMMEND-XXX**: 1RM 기반 운동 강도 추천 (`1RM의 70%로 8reps` 등).

---

## 5. 검증 전략 (Verification Strategy)

### 5.1 단위 테스트 (Jest)

- `one-rep-max.service.spec.ts`:
  - `getAll`: 5종 모두 / 부분 / 전무 케이스. 응답 객체에 5종 키 모두 존재 검증.
  - `upsert`: 신규/기존 분기, `isNew` flag 정확성, `source=DIRECT_INPUT` 고정.
  - `estimate`: 수학적 정확성 검증 (`weight=100, reps=5` → `epley=116.67, brzycki=112.5, average=114.58`).
  - `estimate`: DB 호출이 발생하지 않음 검증 (Prisma 모킹에서 `oneRepMax.*` 호출 없음).
- `one-rep-max.controller.spec.ts`:
  - 가드 적용, ParseEnumPipe 동작 (잘못된 enum → 400).
  - 응답 코드 분기 (201 vs 200).
- Prisma 모킹: `jest-mock-extended`.

### 5.2 통합 테스트 (NestJS Testing module + 실 PostgreSQL)

- `one-rep-max.e2e-spec.ts`:
  - GET 5종 응답 구조 (AC-ORM-READ-01, AC-ORM-EMPTY-01).
  - PUT upsert 멱등성 (신규 → 201, 재호출 → 200, AC-ORM-UPSERT-01).
  - 잘못된 enum (`PULL_UP`) → 400 (AC-ORM-INPUT-02).
  - 잘못된 value (음수, 0, 501, NaN) → 400 (AC-ORM-VALIDATION-01/02).
  - 잘못된 weight/reps → 400 (AC-ORM-CALC-INVALID-01/02/03).
  - POST estimate가 DB 상태를 변경하지 않음 확인 (`prisma.oneRepMax.count()` before/after 비교).
  - 사용자 격리: U1 토큰으로 U2의 1RM에 접근 불가 (자기 데이터만 영향, AC-ORM-SECURITY-02).
  - 라우트 순서: `POST /users/me/1rm/estimate`가 `PUT /users/me/1rm/:exerciseType`의 `:exerciseType`로 잘못 해석되지 않음 (자체적으로는 메서드가 달라 안전하나 명시적 검증).

### 5.3 동등성 테스트 (백엔드 vs 공유 유틸)

- 백엔드 `OneRepMaxService.estimate(weight, reps)` 결과와 `packages/utils/src/1rm.ts`의 함수 결과가 동일 입력에 대해 일치함을 검증 (AC-ORM-CONSISTENCY-01).
- 입력 매트릭스: `weight ∈ {50, 100, 150, 200}`, `reps ∈ {1, 3, 5, 8, 10}` → 20개 케이스.

### 5.4 성능 테스트

- AC-ORM-PERF-01:
  - `GET /users/me/1rm` 100회 반복 → P95 ≤ 100ms.
  - `PUT /users/me/1rm/SQUAT` 100회 반복 → P95 ≤ 150ms.
  - `POST /users/me/1rm/estimate` 100회 반복 → P95 ≤ 50ms.

### 5.5 수동 검증 (모바일)

- Android 에뮬레이터에서 다음 흐름 점검:
  1. 1RM 관리 화면 진입 → 5종 카드 표시 (미설정/설정 케이스).
  2. 스쿼트 카드 탭 → 편집 모달 → 값 입력 → 저장 → 목록 즉시 반영.
  3. 추정 보조 토글 활성화 → weight/reps 입력 → Epley/Brzycki/Average 미리보기.
  4. 추정값 중 하나 선택 → 1RM 값에 자동 채우기 → 저장.
  5. 잘못된 입력 (음수, 빈 값) → 에러 메시지 + 저장 버튼 비활성화.
  6. 네트워크 오프라인 → 추정 계산은 로컬에서 동작 (저장은 실패 시 사용자 알림).

### 5.6 보안 검증

- AC-ORM-SECURITY-01: 응답에서 `id`, `userId`, 다른 사용자 데이터 노출 없음.
- E2E에서 사용자 A 토큰으로 사용자 B의 1RM 데이터 접근 시도 → 본인 데이터만 반환 (REQ-ORM-INPUT-006, REQ-ORM-READ-005).

---

## 6. 롤백 계획 (Rollback Plan)

### 6.1 마이그레이션 롤백

- `OneRepMax` 테이블 drop, `CompoundType` / `OrmSource` enum drop reverse migration 작성.
- 사용자 1RM 데이터가 있는 경우 손실되므로 prod 롤백은 백업 후 신중히 결정.

### 6.2 API 라우트 롤백

- `OneRepMaxModule`을 `AppModule`에서 제거하거나 `git revert`.
- 모바일 화면은 라우트 비활성화 또는 빈 상태 UI fallback.

### 6.3 부분 롤백 시나리오

- POST estimate만 비활성화하고 GET/PUT은 유지 → controller 메서드 단위로 가능.
- 모바일은 클라이언트 로컬 계산으로 fallback 가능 (`packages/utils/src/1rm.ts` 그대로 사용).

---

## 7. 운영 고려사항 (Operational Considerations)

### 7.1 로깅

- `info` 레벨: 1RM upsert 성공 (사용자 ID + 컴파운드 + 값).
- `debug` 레벨: 추정 계산 요청 (사용자 ID + weight/reps + 결과).
- `error` 레벨: upsert 실패 (race condition, DB 오류).

### 7.2 모니터링 지표

- `one_rep_max_get_p95_ms`
- `one_rep_max_put_p95_ms`
- `one_rep_max_estimate_p95_ms`
- `one_rep_max_records_total` (gauge, 전체 1RM 레코드 수)
- `one_rep_max_set_per_user` (histogram, 사용자별 1RM 설정 컴파운드 수, 0~5)

### 7.3 데이터 정합성 점검

- 정기적으로 `OneRepMax.source IN ('EPLEY_ESTIMATE', 'BRZYCKI_ESTIMATE', 'AVERAGE_ESTIMATE')` 레코드 수 모니터링.
- 본 SPEC 단독 운영 시 추정 출처 레코드는 0건이어야 함. 0이 아니면 SPEC-WORKOUT-001 작업이 시작된 상태 → 의도적 데이터인지 확인.

---

## 8. 페이즈 실행 순서 요약

```
Phase 1 (High) ────► Phase 2 (High) ────► Phase 3 (High) ────┐
                                                              │
                                                              ├─► Phase 4 (High)
                                                              │
                                                              └─► Phase 5 (High)
                                                                       │
Phase 6 (High, parallel with Phase 3~5 after Phase 1) ─────────────────┤
                                                                       │
                                                                       └─► Phase 7 (Medium) ───► Phase 8 (Low)
```

- **High Priority 완료 후 백엔드 API 가용**: Phase 1+2+3+4+5+6까지 완료되면 API + 공유 타입이 갖춰져 모바일 통합 가능.
- **Medium Priority는 모바일 UI**: Phase 7은 단일 화면이므로 단일 단위.

---

## 9. 완료 후 다음 단계 (Post-completion)

1. `/moai sync SPEC-1RM-001`로 API 문서 및 README 동기화.
2. SPEC-WORKOUT-001(운동 세션 기록) 작성 — 본 SPEC의 `OneRepMax` 모델과 `OrmSource` enum의 추정 출처 값 활용.
3. 모바일 사용자 피드백 기반으로 1RM 입력 UX 개선 검토 (예: 슬라이더 vs 숫자 키패드, 추정 보조의 진입 위치).
4. 운영 데이터 수집 후 컴파운드별 1RM 분포 분석 → 후속 SPEC의 운동 강도 추천 기본값 설계 참고.
5. 1RM 이력 추적 필요성 재평가 — SPEC-WORKOUT-001 완료 후 사용자 피드백 기반으로 SPEC-WORKOUT-EXT-XXX 검토.

---

## 10. MX Tag 적용 체크리스트

본 SPEC의 mx_plan(`spec.md` Section 8)에 정의된 MX 태그를 Run Phase에서 실제 코드에 적용한다:

### @MX:ANCHOR

- [ ] `one-rep-max.service.ts :: getAll(userId)` 함수에 `@MX:ANCHOR SPEC-1RM-001 REQ-ORM-READ-001`
- [ ] `one-rep-max.service.ts :: upsert(...)` 함수에 `@MX:ANCHOR SPEC-1RM-001 REQ-ORM-INPUT-001`
- [ ] `one-rep-max.service.ts :: estimate(...)` 함수에 `@MX:ANCHOR SPEC-1RM-001 REQ-ORM-CALC-001`
- [ ] `one-rep-max-response.dto.ts :: toResponse()` 함수에 `@MX:ANCHOR SPEC-1RM-001 REQ-ORM-READ-003`

### @MX:WARN

- [ ] `one-rep-max.service.ts :: upsert()`에 `@MX:WARN race condition / @MX:REASON Prisma upsert handles INSERT ON CONFLICT`
- [ ] `one-rep-max.controller.ts` 클래스 상단에 `@MX:WARN route ordering / @MX:REASON future-proofing per REQ-ORM-VAL-007`
- [ ] `packages/utils/src/1rm.ts :: calculateBrzycki()`에 `@MX:WARN reps >= 37 causes division by zero / @MX:REASON callers must validate reps <= 10`

### @MX:NOTE

- [ ] `one-rep-max.service.ts :: getAll()`에 `@MX:NOTE 5-compound key population logic`
- [ ] `one-rep-max.controller.ts`에 `@MX:NOTE route definition order: estimate (POST) before :exerciseType (PUT)`
- [ ] `prisma/schema.prisma :: OrmSource`에 `@MX:NOTE estimate sources reserved for SPEC-WORKOUT-001`
