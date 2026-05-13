# SPEC-EXERCISE-001 구현 계획 (Implementation Plan)

본 문서는 SPEC-EXERCISE-001(운동 도감)의 구현 계획을 정의한다. 우선순위 기반(High/Medium/Low)으로 페이즈가 정의되며, 시간 예측은 포함하지 않는다 (Agent Common Protocol 준수).

전제:
- SPEC-AUTH-001 v1.0.1이 이미 구현되어 있다 (`User` 모델, `JwtAuthGuard`, `JwtStrategy`, JWT payload, `@CurrentUser()` 데코레이터 존재).
- SPEC-USER-001 v1.0.1이 구현 중이거나 완료되어 `User.deletedAt` 컬럼이 존재한다.
- 백엔드 모듈 스켈레톤(`apps/backend/src/exercises/`의 module/controller/service 파일)이 프로젝트 구조에 이미 정의되어 있다.
- 모바일 화면 라우트(`app/(tabs)/workout/index.tsx`, `app/(tabs)/workout/[id].tsx`, `components/workout/ExerciseCard.tsx`)가 프로젝트 구조에 이미 계획되어 있다.

---

## 1. 기술 접근 (Technical Approach)

### 1.1 백엔드 아키텍처

#### 모듈 구조

- **`ExercisesModule`**: `ExercisesController` + `ExercisesService` + `PrismaModule` 의존성. SPEC-AUTH-001의 `JwtAuthGuard`를 글로벌 또는 컨트롤러 레벨에 적용.
- **단일 컨트롤러 전략**: `/exercises`, `/exercises/:id`, `/exercises/favorites`, `/exercises/:id/favorites` 모두 `ExercisesController`가 담당. `FavoritesController`로 분리하지 않음 (운동 도메인 응집성 우선).
- **단일 서비스 전략**: `ExercisesService`가 운동 조회와 즐겨찾기 토글을 모두 담당. 코드량 증가 시 `FavoritesService` 분리를 검토 (본 SPEC 범위 밖).

#### 라우트 순서 제어 (Critical)

NestJS는 `@Get('favorites')`와 `@Get(':id')`가 같은 컨트롤러에 있을 때 등록 순서에 따라 매칭이 결정된다.

```
controller method 정의 순서:
1. @Get('favorites')         ← 반드시 먼저
2. @Get(':id')                ← favorites가 :id로 잡히지 않도록 두 번째
3. @Post(':id/favorites')
4. @Delete(':id/favorites')
5. @Get()                     ← 마지막 (또는 첫 번째, 문제 없음)
```

`@MX:WARN` 주석을 컨트롤러 상단에 명시 (mx_plan §8.2).

#### 응답 변환 전략

- **`ExerciseResponseDto`**: `class-transformer`의 `@Exclude()`로 `externalId`, `createdAt`, `updatedAt`을 응답에서 제외. 정적 팩토리 `ExerciseResponseDto.fromEntity(exercise, isFavorite)`로 변환.
- **목록 vs 상세 분기**: `ExerciseListItemDto`(목록용, `images[0]`만)와 `ExerciseDetailDto`(상세용, 전체 `images` + `instructions`)를 별도 정의하여 페이로드 크기 최적화 (REQ-EX-LIST-003 vs REQ-EX-DETAIL-001).
- **`isFavorite` 계산**: `findAll()`에서 Prisma `include: { favoritedBy: { where: { userId } } }`로 N+1 회피, 결과의 `favoritedBy.length > 0`으로 boolean 도출.

#### 필터 쿼리 전략

- **`equipment` 필터**: `prisma.exercise.findMany({ where: { equipment: value } })`. `Exercise.equipment` 단일 컬럼 인덱스 사용.
- **`primaryMuscle` 필터**: PostgreSQL 배열 컬럼. Prisma의 `has` 연산자(`where: { primaryMuscles: { has: value } }`) 사용. 성능을 위해 `primaryMuscles` GIN 인덱스를 raw migration으로 추가.
- **복합 필터**: Prisma `AND` 절로 결합.

```typescript
where: {
  AND: [
    primaryMuscle ? { primaryMuscles: { has: primaryMuscle } } : {},
    equipment ? { equipment } : {},
  ],
}
```

#### 즐겨찾기 멱등성

- **`POST /exercises/:id/favorites`**: Prisma `upsert`를 사용하여 UNIQUE 제약 충돌 시 자동으로 기존 레코드 반환.

```typescript
await prisma.userExerciseFavorite.upsert({
  where: { userId_exerciseId: { userId, exerciseId } },
  create: { userId, exerciseId },
  update: {}, // 변경 없음
});
```

- **`DELETE /exercises/:id/favorites`**: `deleteMany` 사용 (없을 때 에러 안 남) 또는 `delete` + `P2025` 에러 캐치.

```typescript
await prisma.userExerciseFavorite.deleteMany({
  where: { userId, exerciseId },
});
```

### 1.2 모바일 아키텍처

#### 화면 구성

- **`app/(tabs)/workout/index.tsx`**: 운동 도감 목록 화면.
  - `useInfiniteQuery(["exercises", filters], ({ pageParam }) => fetchExercises({ ...filters, page: pageParam }))`.
  - 상단에 부위·기구 필터 칩 UI (수평 스크롤).
  - 카드 그리드 또는 리스트 (`FlatList` 활용, `onEndReached`로 다음 페이지 트리거).
- **`app/(tabs)/workout/[id].tsx`**: 운동 상세 화면.
  - `useQuery(["exercise", id], () => fetchExerciseDetail(id))`.
  - 이미지 carousel (`expo-image` + horizontal `FlatList`).
  - instructions를 numbered list로 렌더.
  - 즐겨찾기 토글 버튼 (heart icon).
- **`app/(tabs)/workout/favorites.tsx`** (신규, 필요 시): 즐겨찾기 목록 전용 화면. 또는 기존 목록 화면에 "Favorites" 탭 추가.

#### 컴포넌트

- **`components/workout/ExerciseCard.tsx`**: 카드 컴포넌트. `name`, `primaryMuscles`, `equipment` 뱃지, `images[0]` 썸네일, 즐겨찾기 하트 아이콘.
- **`components/workout/FilterChips.tsx`** (신규): 부위·기구 필터 칩 UI.
- **`components/workout/FavoriteButton.tsx`** (신규): 즐겨찾기 토글 버튼 (Optimistic Update 포함).

#### 상태 관리

- **TanStack Query**: 모든 서버 상태 (`useQuery`, `useInfiniteQuery`, `useMutation`).
- **Zustand**: 필터 상태(`primaryMuscle`, `equipment`)는 useState로 충분. 영속화가 필요하면 Zustand 도입.
- **Optimistic Update (즐겨찾기 토글)**:

```typescript
const toggleFavoriteMutation = useMutation({
  mutationFn: ({ id, isFavorite }) =>
    isFavorite ? removeFavorite(id) : addFavorite(id),
  onMutate: async ({ id }) => {
    await queryClient.cancelQueries(["exercise", id]);
    const previous = queryClient.getQueryData(["exercise", id]);
    queryClient.setQueryData(["exercise", id], (old) => ({
      ...old,
      isFavorite: !old.isFavorite,
    }));
    return { previous };
  },
  onError: (err, vars, context) => {
    queryClient.setQueryData(["exercise", vars.id], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries(["exercises"]);
    queryClient.invalidateQueries(["exercises", "favorites"]);
  },
});
```

#### 이미지 처리

- **Expo Image**: `import { Image } from "expo-image"`.
- `cachePolicy="disk"`로 디스크 캐싱.
- `placeholder` props로 운동 카테고리 기반 fallback (예: `category="strength"` → 덤벨 아이콘).
- `onError`로 이미지 로드 실패 시 fallback 표시.

### 1.3 공유 타입 (packages/types)

`packages/types/src/exercise.ts` 신규 생성:

```typescript
export type ExerciseLevel = "beginner" | "intermediate" | "expert";
export type ExerciseForce = "push" | "pull" | "static";
export type ExerciseMechanic = "compound" | "isolation";

export interface ExerciseListItem {
  id: string;
  name: string;
  primaryMuscles: string[];
  equipment: string | null;
  category: string;
  level: ExerciseLevel;
  images: string[]; // 목록은 [0]만 포함, 길이 1
  isFavorite: boolean;
}

export interface ExerciseDetail extends ExerciseListItem {
  force: ExerciseForce | null;
  mechanic: ExerciseMechanic | null;
  secondaryMuscles: string[];
  instructions: string[];
  images: string[]; // 상세는 전체 배열
}

export interface ExerciseListQuery {
  page?: number;
  limit?: number;
  primaryMuscle?: string;
  equipment?: string;
}

export interface PaginatedExercisesResponse {
  items: ExerciseListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FavoriteToggleResponse {
  exerciseId: string;
  favoritedAt: string; // ISO 8601
}
```

백엔드 응답 DTO가 위 타입을 구조적으로 만족하도록 정의.

### 1.4 시드 스크립트 전략

#### 데이터 소스 획득

- **방법 A (권장)**: `prisma/seed/exercises.json`을 Git 저장소에 복사하여 빌드 시점에 정적으로 포함. Free Exercise DB MIT 라이선스 표기 (README + LICENSE 노트).
- **방법 B**: 시드 실행 시점에 GitHub raw URL에서 fetch (`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json`). 오프라인/CI 환경에서 실패 위험.

본 SPEC은 **방법 A**를 채택한다 (안정성 우선).

#### 시드 스크립트 골격

```typescript
// prisma/seed.ts (또는 별도 prisma/seed/exercises.ts)
import { PrismaClient } from "@prisma/client";
import exercises from "./seed/exercises.json";

const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

async function seedExercises(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    for (const ex of exercises) {
      await tx.exercise.upsert({
        where: { externalId: ex.id },
        create: {
          externalId: ex.id,
          name: ex.name,
          force: ex.force,
          level: ex.level,
          mechanic: ex.mechanic,
          equipment: ex.equipment,
          primaryMuscles: ex.primaryMuscles,
          secondaryMuscles: ex.secondaryMuscles,
          instructions: ex.instructions,
          category: ex.category,
          images: ex.images.map((path) => `${IMAGE_BASE}${path}`),
        },
        update: {
          // 동일 externalId의 운동이 갱신되면 메타데이터를 최신화
          name: ex.name,
          force: ex.force,
          level: ex.level,
          mechanic: ex.mechanic,
          equipment: ex.equipment,
          primaryMuscles: ex.primaryMuscles,
          secondaryMuscles: ex.secondaryMuscles,
          instructions: ex.instructions,
          category: ex.category,
          images: ex.images.map((path) => `${IMAGE_BASE}${path}`),
        },
      });
    }
  });
}
```

#### 시드 성능 고려

- 800+ `upsert`를 단일 트랜잭션으로 처리하면 락 점유 시간이 길어진다. 100건 단위 배치로 분할하거나 `createMany({ skipDuplicates: true })` + 후속 update 패턴 검토.
- 첫 시드는 `prisma.exercise.count() === 0` 검사 후 `createMany` 사용, 이후 갱신만 `upsert` 사용 — 단순화 위해 본 SPEC은 `upsert` 통일.

---

## 2. 마일스톤 (Milestones, Priority-based)

### Phase 1 [Priority: High] — Prisma 스키마 및 시드

**목표**: 데이터 모델을 확정하고 800+ 운동을 DB에 적재한다.

**작업**:
1. `prisma/schema.prisma` 수정:
   - `Exercise` 모델에 `externalId String @unique`, `images Json`, `force String?`, `mechanic String?` 등 누락된 필드 확인 및 추가.
   - `UserExerciseFavorite` 모델 신규 추가 (Section 5.2 정의대로).
   - `User` 모델에 `favoriteExercises UserExerciseFavorite[]` 역참조 추가.
   - `@@index([equipment])`, `@@index([category])` 적용.
2. `prisma migrate dev --name add_exercise_library`로 마이그레이션 생성.
3. raw migration으로 GIN 인덱스 추가:
   ```sql
   CREATE INDEX exercise_primary_muscles_gin_idx ON "Exercise" USING GIN ("primaryMuscles");
   ```
   `prisma migrate dev --create-only` 후 SQL 편집.
4. `prisma/seed/exercises.json` 복사 (yuhonas/free-exercise-db `dist/exercises.json`).
5. `prisma/seed.ts` 작성 (Section 1.4 골격대로). `package.json`에 `"prisma": { "seed": "ts-node prisma/seed.ts" }` 등록.
6. `pnpm prisma db seed` 실행 후 `prisma.exercise.count() >= 800` 확인.
7. 라이선스 표기: README의 Acknowledgements 섹션 또는 `LICENSE_THIRD_PARTY.md`에 yuhonas/free-exercise-db MIT 라이선스 기재.

**완료 기준**: AC-SEED-01, AC-SEED-02, AC-SEED-03, AC-SEED-05 통과. `prisma migrate status` 클린.

**의존성**: 없음 (선행 작업).

### Phase 2 [Priority: High] — 백엔드 운동 목록/상세 API

**목표**: `GET /exercises`, `GET /exercises/:id` 구현.

**작업**:
1. `src/exercises/dto/list-exercises-query.dto.ts` 작성:
   - `page` (`@IsInt @Min(1) @IsOptional`, default 1, `@Type(() => Number)`).
   - `limit` (`@IsInt @Min(1) @Max(50) @IsOptional`, default 20).
   - `primaryMuscle` (`@IsString @IsOptional`).
   - `equipment` (`@IsString @IsOptional`).
2. `src/exercises/dto/exercise-list-item.dto.ts`, `src/exercises/dto/exercise-detail.dto.ts`, `src/exercises/dto/paginated-exercises-response.dto.ts` 작성.
3. `src/exercises/exercises.service.ts`에 `findAll(query, userId)`, `findOne(id, userId)` 추가:
   - `findAll`: Prisma `findMany` + `count`, `isFavorite`은 `favoritedBy` include로 N+1 회피.
   - `findOne`: 단일 조회, 미존재 시 `NotFoundException`.
4. `src/exercises/exercises.controller.ts`에 라우트 추가:
   - `@Get()` + `@UseGuards(JwtAuthGuard)` + `@CurrentUser('sub') userId`.
   - `@Get(':id')` + 동일 가드.
   - **주의**: `@Get('favorites')`를 Phase 3에서 추가할 때 `@Get(':id')`보다 먼저 정의해야 함 (Section 1.1 라우트 순서).
5. 컨트롤러 단위 테스트 + 서비스 단위 테스트 작성.

**완료 기준**: AC-LIST-01 ~ AC-LIST-06, AC-DETAIL-01 ~ AC-DETAIL-03, AC-FILTER-01 ~ AC-FILTER-05 통과.

**의존성**: Phase 1.

### Phase 3 [Priority: High] — 백엔드 즐겨찾기 API

**목표**: `POST /exercises/:id/favorites`, `DELETE /exercises/:id/favorites`, `GET /exercises/favorites` 구현.

**작업**:
1. `src/exercises/exercises.service.ts`에 즐겨찾기 메서드 추가:
   - `addFavorite(userId, exerciseId)`: Prisma `upsert` (멱등성, REQ-EX-FAV-002).
   - `removeFavorite(userId, exerciseId)`: `deleteMany` 사용 (멱등성, REQ-EX-FAV-005).
   - `findFavorites(userId, query)`: `UserExerciseFavorite`를 기준으로 join하여 `Exercise` 조회, `favoritedAt DESC` 정렬.
2. 운동 존재 검사: `addFavorite()` 진입 시 `prisma.exercise.findUnique({ where: { id } })` 호출 후 미존재 시 `NotFoundException` (REQ-EX-FAV-003).
3. `src/exercises/exercises.controller.ts`에 라우트 추가 (순서 주의):
   - `@Get('favorites')` ← 반드시 `@Get(':id')` 이전
   - `@Post(':id/favorites')`
   - `@Delete(':id/favorites')` + `@HttpCode(204)`
4. 단위 테스트 (멱등성 검증 포함) + E2E 테스트.

**완료 기준**: AC-FAV-ADD-01 ~ AC-FAV-ADD-03, AC-FAV-REMOVE-01 ~ AC-FAV-REMOVE-02, AC-FAV-LIST-01 ~ AC-FAV-LIST-03 통과.

**의존성**: Phase 1, Phase 2 (DTO 재사용).

### Phase 4 [Priority: High] — 공유 타입 정합

**목표**: `packages/types/src/exercise.ts`를 백엔드/모바일 양쪽에서 import 가능하게 한다.

**작업**:
1. `packages/types/src/exercise.ts` 작성 (Section 1.3 정의대로).
2. `packages/types/src/index.ts`에 export 추가.
3. 백엔드 DTO와 모바일 fetcher 함수의 타입을 `@workout/types`에서 import.
4. Turborepo dependency 확인 (`apps/backend/package.json`, `apps/mobile/package.json`).

**완료 기준**: 백엔드/모바일이 동일 타입을 import, tsc 빌드 에러 없음.

**의존성**: Phase 2 (DTO 정의 후 정확한 타입 추출).

### Phase 5 [Priority: Medium] — 모바일 운동 도감 목록 화면

**목표**: `app/(tabs)/workout/index.tsx` 구현.

**작업**:
1. `apps/mobile/services/exercises.ts` 작성:
   - `fetchExercises(query): Promise<PaginatedExercisesResponse>`
   - `fetchExerciseDetail(id): Promise<ExerciseDetail>`
   - `addFavorite(id)`, `removeFavorite(id)`, `fetchFavorites(query)`
2. `apps/mobile/hooks/useExercises.ts` 작성:
   - `useExercises(filters)`: `useInfiniteQuery`.
   - `useExerciseDetail(id)`: `useQuery`.
   - `useToggleFavorite()`: `useMutation` + Optimistic Update (Section 1.2).
   - `useFavoriteExercises()`: `useInfiniteQuery`.
3. `components/workout/ExerciseCard.tsx` 작성 (또는 기존 스켈레톤 채우기):
   - Props: `exercise: ExerciseListItem`, `onPress`, `onToggleFavorite`.
   - Expo Image로 `exercise.images[0]` 표시, `cachePolicy="disk"`.
4. `components/workout/FilterChips.tsx` 작성:
   - 부위 7종 + 기구 6종 칩 UI (수평 스크롤).
   - 선택 시 부모에 `primaryMuscle`/`equipment` 전달.
5. `app/(tabs)/workout/index.tsx` 작성:
   - 상단: 필터 칩.
   - 중간: `FlatList` + `ExerciseCard`, `onEndReached`로 `fetchNextPage` 호출.
   - 빈 결과: "조건에 맞는 운동이 없습니다" 표시.

**완료 기준**: 모바일에서 운동 목록이 페이지네이션과 필터링과 함께 정상 표시되며, 즐겨찾기 하트 토글이 Optimistic하게 반영된다.

**의존성**: Phase 2, Phase 3, Phase 4.

### Phase 6 [Priority: Medium] — 모바일 운동 상세 화면

**목표**: `app/(tabs)/workout/[id].tsx` 구현.

**작업**:
1. `app/(tabs)/workout/[id].tsx` 작성:
   - `useExerciseDetail(id)`로 데이터 fetch.
   - 이미지 carousel: 가로 `FlatList` + `expo-image` (snapToInterval 적용).
   - 운동 메타데이터: 부위/기구/카테고리 뱃지, level/mechanic/force 표시.
   - instructions: numbered list 렌더.
   - 즐겨찾기 토글 버튼: `useToggleFavorite()` 사용.
2. 로딩/에러 상태 UI (Skeleton 또는 ActivityIndicator).
3. 404 상태 처리: "운동을 찾을 수 없습니다" + 뒤로가기.

**완료 기준**: 모바일에서 운동 상세 정보가 정상 표시되며, 즐겨찾기 토글이 동작한다.

**의존성**: Phase 5.

### Phase 7 [Priority: Medium] — 모바일 즐겨찾기 목록 화면

**목표**: 즐겨찾기 운동 목록 진입점 제공.

**작업**:
1. 진입점 결정 (두 옵션):
   - **A**: 운동 도감 목록 화면 상단에 "즐겨찾기" 토글 (필터로 처리). `filters.favoritesOnly: true`일 때 `fetchFavorites` 호출.
   - **B**: 별도 라우트 `app/(tabs)/workout/favorites.tsx` 신설.
   - **권장**: A안 (UX 단순성, 화면 수 최소화). B안은 후속 SPEC 검토.
2. A안 구현: `app/(tabs)/workout/index.tsx`의 필터 칩에 "즐겨찾기만" 토글 추가, 활성화 시 `useFavoriteExercises()` 사용.

**완료 기준**: 모바일에서 본인 즐겨찾기 운동 목록이 별도 진입점에서 표시된다.

**의존성**: Phase 5.

### Phase 8 [Priority: Low] — 운영 문서 및 라이선스

**목표**: Free Exercise DB 라이선스 표기 및 시드 운영 가이드.

**작업**:
1. `README.md` 또는 `LICENSE_THIRD_PARTY.md`에 yuhonas/free-exercise-db MIT 라이선스 전문 또는 링크 추가.
2. `apps/backend/README.md`에 시드 실행 가이드:
   - 첫 실행: `pnpm prisma migrate deploy && pnpm prisma db seed`.
   - 운동 데이터 갱신: `prisma/seed/exercises.json` 교체 후 `pnpm prisma db seed` 재실행.
3. (선택) 시드 데이터 버전 추적: `Exercise` 모델에 `seedVersion String?` 추가 검토 (본 SPEC 범위 밖, 후속 SPEC).

**완료 기준**: 라이선스 표기 PR이 머지되고 시드 운영 가이드가 문서에 명시된다.

**의존성**: Phase 1.

---

## 3. 위험 요소 (Risks)

### Risk 1: 라우트 매칭 순서 (GET /exercises/favorites vs GET /exercises/:id)

- **상황**: NestJS Controller에서 `@Get('favorites')`가 `@Get(':id')`보다 늦게 정의되면 `favorites`가 `:id`로 매칭되어 `findOne('favorites')`이 호출되고 `404 Not Found`가 반환된다.
- **완화**: Phase 3에서 컨트롤러 메서드 순서를 명시적으로 제어. `@MX:WARN` 주석으로 표시. E2E 테스트에서 `GET /exercises/favorites`가 200을 반환하는지 검증.

### Risk 2: PostgreSQL 배열 필터 성능

- **상황**: `primaryMuscles` 배열 필터는 GIN 인덱스 없이는 풀스캔이 발생하여 NFR-EX-PERF-002(P95 ≤ 300ms)을 위반할 수 있다.
- **완화**: Phase 1에서 raw migration으로 GIN 인덱스 추가. 운동 수가 800+로 작아 인덱스 없이도 800ms 이내 동작할 가능성이 있으나, 안전 마진을 위해 인덱스를 적용한다.

### Risk 3: 시드 데이터 변경 시 cuid 변경

- **상황**: `Exercise.id`는 `cuid()` 자동 생성이므로 시드 재실행 시 `externalId`는 보존되지만 새로 생성되는 운동의 `id`는 매번 다르다. 사용자가 즐겨찾기한 운동의 `exerciseId`는 영구 보존되어야 한다.
- **완화**: `upsert`는 `externalId`를 키로 사용하므로 기존 레코드는 `id`가 보존된다. **즐겨찾기 안전성을 위해 운영자는 절대 `Exercise` 테이블을 truncate하고 재시드하면 안 된다** — `upsert`만 사용. 이를 시드 가이드(Phase 8)에 명시.

### Risk 4: GitHub raw URL 가용성

- **상황**: GitHub raw 도메인이 일시적으로 차단되거나 rate limit에 걸리면 이미지 로드 실패.
- **완화**: Expo Image의 `onError` 콜백으로 카테고리 기반 fallback 아이콘 표시 (REQ-EX-IMG-003). 본 SPEC은 자체 호스팅을 의도적으로 회피했으므로, GitHub 가용성 의존을 수용한다. 사용자 5명 규모에서 rate limit 가능성 극히 낮음 (GitHub raw는 인증 시 5,000/시간).

### Risk 5: 즐겨찾기 Race Condition

- **상황**: 사용자가 즐겨찾기 버튼을 빠르게 두 번 클릭하면 두 개의 `POST` 요청이 동시 처리되어 unique constraint 위반 가능.
- **완화**: `upsert` 사용 시 Prisma가 자동으로 race를 해결 (PostgreSQL의 `ON CONFLICT DO NOTHING` 또는 `UPDATE`). 모바일은 Optimistic Update + `mutation.isPending`으로 버튼 비활성화하여 추가 방어.

### Risk 6: 모바일 무한 스크롤 메모리

- **상황**: 800+ 운동을 모두 메모리에 로드 시 `FlatList` 렌더링 성능 저하.
- **완화**: `FlatList`의 `windowSize`, `removeClippedSubviews` 설정. 페이지당 20개씩 lazy load이므로 일반 사용 시 100개 이내. 필터 적용 후 결과는 더 작음.

### Risk 7: Free Exercise DB의 `null` 필드

- **상황**: 일부 운동의 `force`, `mechanic`, `equipment`가 `null`이다. Prisma 스키마에서 nullable 처리 누락 시 시드 실패.
- **완화**: Phase 1 스키마에서 `force String?`, `mechanic String?`, `equipment String?` 명시. REQ-EX-SEED-005로 명시적 요구사항화.

---

## 4. 의존성 (Dependencies)

### 4.1 선행 SPEC

- **SPEC-AUTH-001 v1.0.1**: 본 SPEC의 모든 엔드포인트가 `JwtAuthGuard`, `@CurrentUser()` 데코레이터에 의존.
- **SPEC-USER-001 v1.0.1**: `User.deletedAt`이 존재한다고 가정 (NFR-EX-DATA-003 cascade 정합성). 단, 본 SPEC은 소프트 삭제 사용자 정리를 능동적으로 수행하지 않음.

### 4.2 외부 데이터 소스

- **Free Exercise DB (yuhonas/free-exercise-db)**: MIT 라이선스. `dist/exercises.json` 파일을 본 프로젝트 저장소에 복사.

### 4.3 외부 라이브러리 (이미 설치)

- `@nestjs/common`, `@nestjs/jwt`, `@nestjs/passport`
- `@prisma/client`, `prisma` (v5)
- `class-validator`, `class-transformer`
- `@tanstack/react-query` (모바일)
- `zustand` (모바일, 본 SPEC에서는 선택적)

### 4.4 추가 라이브러리

- `expo-image`: 모바일 이미지 렌더링 및 디스크 캐싱 (이미 Expo SDK에 포함되어 있다면 신규 설치 불요).

### 4.5 후행 SPEC (본 SPEC 완료가 트리거)

- **SPEC-SUBSTITUTE-001**: 대체 운동 API (`GET /exercises/:id/substitutes`). 본 SPEC의 `Exercise` 모델과 `ExerciseRatio`(기존 스키마)를 활용.
- **SPEC-WORKOUT-001**: 운동 세션 기록. 본 SPEC의 `Exercise.id`를 외래키로 참조.
- **SPEC-EXERCISE-SEARCH-XXX**: 이름 검색 (후속).
- **SPEC-AI-RECOMMEND-XXX**: AI 운동 추천 (후속). 본 SPEC의 운동 데이터를 컨텍스트로 활용.

---

## 5. 검증 전략 (Verification Strategy)

### 5.1 단위 테스트 (Jest)

- `exercises.service.spec.ts`:
  - `findAll`: 필터 조합, 페이지네이션, `isFavorite` 계산.
  - `findOne`: 정상 조회, 미존재 시 `NotFoundException`.
  - `addFavorite`: 신규 생성, 중복 시 멱등 (`upsert`).
  - `removeFavorite`: 정상 삭제, 없을 때 멱등.
  - `findFavorites`: 정렬, 페이지네이션.
- `exercises.controller.spec.ts`: 가드 적용, 응답 형식.
- Prisma 모킹: `jest-mock-extended`.

### 5.2 통합 테스트 (NestJS Testing module + 실 PostgreSQL)

- `exercises.e2e-spec.ts`:
  - 시드 후 `GET /exercises` 페이지네이션 (AC-LIST-01).
  - `primaryMuscle` + `equipment` 복합 필터 (AC-FILTER-03).
  - 즐겨찾기 추가 → 목록에 `isFavorite=true` 반영 (AC-LIST-03).
  - 즐겨찾기 멱등성 (이중 POST, 이중 DELETE).
  - `GET /exercises/favorites`가 사용자 격리됨 (다른 사용자의 즐겨찾기 미노출, AC-FAV-LIST-02).
  - 라우트 순서 검증: `GET /exercises/favorites`가 `/exercises/:id`보다 먼저 매칭됨.

### 5.3 시드 검증

- 시드 직후 `prisma.exercise.count() >= 800` 단위 테스트.
- 동일 시드를 두 번 실행 후 운동 수가 동일한지 확인 (멱등성).

### 5.4 수동 검증 (모바일)

- Android 에뮬레이터에서 다음 흐름 점검:
  1. 운동 도감 진입 → 목록 표시 → 무한 스크롤 동작.
  2. 부위 필터 적용 → 결과 갱신.
  3. 부위 + 기구 동시 필터 → AND 결과.
  4. 운동 카드 탭 → 상세 화면 → 이미지 carousel, instructions.
  5. 즐겨찾기 하트 토글 → Optimistic 즉시 반영 → 새로고침 후 유지.
  6. 즐겨찾기 목록 화면 → 즐겨찾기한 운동만 표시.

### 5.5 보안 검증

- AC-SECURITY-01: 응답에서 다른 사용자의 즐겨찾기 데이터 노출 없음 확인.
- E2E에서 사용자 A 토큰으로 사용자 B의 즐겨찾기 데이터 조회 시도 → 본인 데이터만 반환 (REQ-EX-FAV-009).

---

## 6. 롤백 계획 (Rollback Plan)

### 6.1 마이그레이션 롤백

- `UserExerciseFavorite` 테이블 drop, `Exercise` 신규 컬럼(`externalId`, `images`) drop reverse migration 작성.
- 단, 이미 사용자가 즐겨찾기한 데이터가 있는 경우 손실되므로 prod 롤백은 신중히 결정 (백업 후 진행).

### 6.2 API 라우트 롤백

- `ExercisesController`의 신규 라우트를 주석 처리하거나 `git revert`.
- 모바일 화면은 라우트 비활성화 또는 빈 상태 UI로 fallback.

### 6.3 시드 데이터 롤백

- `TRUNCATE TABLE "UserExerciseFavorite", "Exercise" CASCADE` 후 이전 상태로 복원.
- 단, 즐겨찾기 데이터가 손실되므로 운영 환경에서는 권장하지 않음.

---

## 7. 운영 고려사항 (Operational Considerations)

### 7.1 로깅

- `info` 레벨: 시드 시작/완료, 시드 적재된 운동 수.
- `debug` 레벨: 필터 쿼리, 즐겨찾기 토글 (사용자 ID + 운동 ID).
- `error` 레벨: 시드 실패, 트랜잭션 롤백.

### 7.2 모니터링 지표

- `exercises_list_p95_ms`
- `exercises_detail_p95_ms`
- `exercises_filter_p95_ms` (primaryMuscle + equipment)
- `exercises_favorites_toggle_p95_ms`
- `exercises_total_count` (gauge, 시드 후 800+ 유지 검증)
- `exercise_favorites_total` (counter, 사용자 행동 분석용)

### 7.3 데이터 갱신 정책

- Free Exercise DB upstream이 갱신되면 `prisma/seed/exercises.json`을 업데이트 후 `pnpm prisma db seed` 재실행.
- **절대 `TRUNCATE TABLE "Exercise"` 후 재시드하지 않음** (즐겨찾기 cascade 삭제 위험, Risk 3 참조).
- `externalId`가 사라진 운동(upstream에서 삭제)에 대한 정책은 본 SPEC 범위 밖. 후속 운영 SPEC에서 다룸.

---

## 8. 페이즈 실행 순서 요약

```
Phase 1 (High) ────► Phase 2 (High) ────► Phase 3 (High)
                          │                      │
                          └────────►Phase 4 (High)
                                        │
                                        ├────► Phase 5 (Medium) ────► Phase 6 (Medium)
                                        │                                  │
                                        │                                  └────► Phase 7 (Medium)
                                        │
                                        └────► Phase 8 (Low)
```

- **High Priority 완료 후 백엔드 API 가용**: Phase 1+2+3+4까지 완료되면 API + 공유 타입이 갖춰져 모바일 통합 작업 가능.
- **Medium Priority는 모바일 UI**: Phase 5~7은 화면 단위로 점진적 출시 가능.

---

## 9. 완료 후 다음 단계 (Post-completion)

1. `/moai sync SPEC-EXERCISE-001`로 API 문서 및 README 동기화.
2. SPEC-WORKOUT-001(운동 세션 기록) 작성 — 본 SPEC의 `Exercise.id`를 외래키로 참조.
3. SPEC-SUBSTITUTE-001(대체 운동) 작성 — `ExerciseRatio` 모델 활용.
4. 운영 데이터 수집 후 캐싱 도입 여부 검토 (Redis 등). 본 SPEC은 캐싱 없이 시작.
5. 모바일 사용자 피드백 기반으로 한국어 localization, 이름 검색 SPEC 우선순위 결정.
