# SPEC-PROGRAM-001 구현 계획 (Implementation Plan)

본 문서는 SPEC-PROGRAM-001(운동 프로그램)의 구현 계획을 정의한다. 우선순위 기반(High/Medium/Low) 마일스톤으로 페이즈를 정의하며, 시간 예측은 포함하지 않는다 (Agent Common Protocol 준수).

전제:
- SPEC-AUTH-001 v1.0.1이 구현되어 있다 (`User` 모델, `UserRole` enum(`USER`/`PREMIUM`/`ADMIN`), `JwtAuthGuard`, `RolesGuard`, `@Roles()` 데코레이터, `@CurrentUser()` 데코레이터 존재).
- SPEC-USER-001 v1.0.1이 구현되어 있다 (`User.deletedAt` 컬럼 존재).
- SPEC-EXERCISE-001 v1.0.1이 구현되어 있다 (`Exercise` 모델, 800+ 운동 시드 완료).
- SPEC-1RM-001 v1.0.1이 구현되어 있다 (선행 의존성 없음, 동시 진행 가능).
- 환경 변수 `ANTHROPIC_API_KEY`가 설정되어 있다.
- `prisma/schema.prisma`의 `User`, `Exercise` 엔티티는 존재하나 `Program`, `ProgramDay`, `ProgramExercise`, `UserProgram`, `AiUsageLog`는 미정의 상태이다.

---

## 1. 기술 접근 (Technical Approach)

### 1.1 백엔드 모듈 구조 결정

본 SPEC은 두 가지 종류의 엔드포인트 그룹을 다룬다:
- `/programs/*`: 카탈로그·상세·활성 관리 (5개 엔드포인트).
- `/ai/programs`: AI 생성 (1개 엔드포인트, RBAC 필요, 외부 API 의존).

**옵션 A: 단일 `ProgramsModule`에 모든 엔드포인트 통합**
- 장점: 단일 도메인(프로그램)으로 응집.
- 단점: AI 관련 외부 API 호출 의존성이 카탈로그·활성 관리와 섞임. 향후 AI 모드 2~3 추가 시 모듈이 비대해짐.

**옵션 B: `ProgramsModule`(catalog/active) + `AiModule`(또는 `AiProgramsModule`) 분리**
- 장점: 외부 API 의존성 격리. 후속 SPEC-AI-001에서 AI 모드 1, 3 추가 시 자연스러운 확장점.
- 단점: 작은 모듈 추가 발생.

**결정**: **옵션 B (ProgramsModule + AiModule 분리)**.

사유:
- AI 관련 외부 의존성, 비용 추적, 한도 관리 로직은 단일 모듈로 격리하는 것이 운영상 명료하다.
- 후속 SPEC-AI-001에서 AI 카탈로그 추천(모드 1), AI 재평가(모드 3) 엔드포인트가 추가될 때 `AiModule`이 확장의 자연스러운 호스트가 된다.
- `AiUsageLog`는 본 SPEC에서 `programCreations`만 사용하지만 향후 모드 1/3 추가 시 `AiModule` 내부에서 통일된 카운터 관리가 가능하다.

모듈 위치:
- `apps/backend/src/programs/`
- `apps/backend/src/ai/` (모듈 이름: `AiModule`, 본 SPEC에서는 `AiProgramsController`/`AiProgramsService`만 추가)

### 1.2 백엔드 아키텍처 상세

#### 폴더 구조

```
apps/backend/src/
├── programs/
│   ├── programs.module.ts
│   ├── programs.controller.ts          // GET /programs/catalog, /active, /:id, POST /:id/activate, DELETE /active
│   ├── programs.service.ts             // catalog, detail, activate, deactivate, getActive
│   ├── dto/
│   │   ├── catalog-item.dto.ts         // GET /programs/catalog 응답 항목
│   │   ├── catalog-response.dto.ts     // { programs: CatalogItemDto[] }
│   │   ├── program-detail.dto.ts       // 프로그램 상세 (days + exercises)
│   │   ├── active-response.dto.ts      // { active: ... | null }
│   │   └── activate-response.dto.ts    // { userProgramId, programId, startedAt }
│   └── tests/
│       ├── programs.service.spec.ts
│       ├── programs.controller.spec.ts
│       └── programs.e2e-spec.ts
└── ai/
    ├── ai.module.ts
    ├── ai-programs.controller.ts       // POST /ai/programs
    ├── ai-programs.service.ts          // create AI program
    ├── anthropic.client.ts             // Anthropic API 호출 래퍼
    ├── ai-validation.service.ts        // AI 응답 7단계 검증
    ├── dto/
    │   ├── create-ai-program.dto.ts    // POST 요청 본문
    │   └── ai-response.schema.ts       // AI 응답 JSON 스키마 (class-validator 또는 zod)
    └── tests/
        ├── ai-programs.service.spec.ts
        ├── ai-validation.service.spec.ts
        ├── anthropic.client.spec.ts    // mocked
        └── ai-programs.e2e-spec.ts
```

#### 라우트 정의 순서 (REQ-PROG-VAL-001)

NestJS `ProgramsController`에서 메서드 정의 순서를 다음과 같이 강제한다(고정 경로 → 동적 경로 + suffix → 동적 경로):

```typescript
@Controller('programs')
@UseGuards(JwtAuthGuard)
export class ProgramsController {
  // 1. GET /programs/catalog (static)
  @Get('catalog')
  async getCatalog() { ... }

  // 2. GET /programs/active (static)
  @Get('active')
  async getActive(@CurrentUser('sub') userId: string) { ... }

  // 3. DELETE /programs/active (static)
  @Delete('active')
  @HttpCode(204)
  async deactivate(@CurrentUser('sub') userId: string) { ... }

  // 4. POST /programs/:id/activate (param + static suffix)
  @Post(':id/activate')
  async activate(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) { ... }

  // 5. GET /programs/:id (dynamic, last)
  @Get(':id')
  async getDetail(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) { ... }
}
```

`@MX:WARN` + `@MX:NOTE` 주석으로 컨트롤러 상단에 라우트 순서 정책을 명시.

#### DTO 정의

**`create-ai-program.dto.ts`** (POST /ai/programs):
```typescript
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateAiProgramDto {
  @IsIn(['muscle_gain', 'strength', 'endurance'])
  goal!: 'muscle_gain' | 'strength' | 'endurance';

  @IsInt()
  @Min(3)
  @Max(6)
  daysPerWeek!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  availableEquipment!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusAreas?: string[];
}
```

**`active-response.dto.ts`**:
```typescript
export class ActiveResponseDto {
  active: ProgramDetailDto | null = null; // null when user has no active program
}
```

**`activate-response.dto.ts`**:
```typescript
export class ActivateResponseDto {
  userProgramId!: string;
  programId!: string;
  startedAt!: string; // ISO 8601
}
```

#### Service 구현 전략

**ProgramsService**:

```typescript
@Injectable()
export class ProgramsService {
  constructor(private prisma: PrismaService) {}

  // REQ-PROG-CATALOG-001
  async getCatalog(): Promise<CatalogResponseDto> {
    const programs = await this.prisma.program.findMany({
      where: { type: 'CATALOG' },
      include: { days: { include: { exercises: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      programs: programs.map(p => toCatalogItem(p)),
    };
  }

  // REQ-PROG-DETAIL-001, REQ-PROG-DETAIL-004
  async getDetail(id: string, userId: string): Promise<ProgramDetailDto> {
    const program = await this.prisma.program.findUnique({
      where: { id },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            exercises: {
              orderBy: { orderIndex: 'asc' },
              include: { exercise: true },
            },
          },
        },
      },
    });
    if (!program) throw new NotFoundException();
    // 권한 검사: AI_GENERATED + 본인 소유 아니면 404
    if (program.type === 'AI_GENERATED' && program.createdBy !== userId) {
      throw new NotFoundException();
    }
    return toProgramDetail(program);
  }

  // REQ-PROG-ACTIVE-001, REQ-PROG-ACTIVE-002, REQ-PROG-ACTIVE-003, REQ-PROG-ACTIVE-008
  async activate(userId: string, programId: string): Promise<{ result: ActivateResponseDto; isNew: boolean }> {
    // 프로그램 존재 및 권한 확인
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException();
    if (program.type === 'AI_GENERATED' && program.createdBy !== userId) {
      throw new NotFoundException();
    }
    // 기존 활성 여부 판별
    const existing = await this.prisma.userProgram.findUnique({ where: { userId } });
    const isNew = existing === null;
    const userProgram = await this.prisma.userProgram.upsert({
      where: { userId },
      create: { userId, programId },
      update: { programId, startedAt: new Date() },
    });
    return {
      result: { userProgramId: userProgram.id, programId: userProgram.programId, startedAt: userProgram.startedAt.toISOString() },
      isNew,
    };
  }

  // REQ-PROG-ACTIVE-004, REQ-PROG-ACTIVE-005
  async deactivate(userId: string): Promise<void> {
    await this.prisma.userProgram.deleteMany({ where: { userId } });
    // deleteMany는 레코드가 없어도 에러 없이 0건 영향
  }

  // REQ-PROG-ACTIVE-006, REQ-PROG-ACTIVE-007
  async getActive(userId: string): Promise<ActiveResponseDto> {
    const userProgram = await this.prisma.userProgram.findUnique({
      where: { userId },
      include: {
        program: {
          include: {
            days: {
              orderBy: { dayNumber: 'asc' },
              include: {
                exercises: { orderBy: { orderIndex: 'asc' }, include: { exercise: true } },
              },
            },
          },
        },
      },
    });
    if (!userProgram) return { active: null };
    return { active: toActiveProgram(userProgram) };
  }
}
```

**AiProgramsService**:

```typescript
@Injectable()
export class AiProgramsService {
  constructor(
    private prisma: PrismaService,
    private anthropic: AnthropicClient,
    private validator: AiValidationService,
  ) {}

  // REQ-PROG-AI-001, REQ-PROG-AI-003, REQ-PROG-AI-004, REQ-PROG-AI-005
  async create(userId: string, dto: CreateAiProgramDto): Promise<ProgramDetailDto> {
    const month = currentMonthKey(); // "YYYY-MM"

    // 1. 한도 사전 점검 (REQ-PROG-AI-003)
    const usage = await this.prisma.aiUsageLog.findUnique({
      where: { userId_month: { userId, month } },
    });
    if (usage && usage.programCreations >= 10) {
      throw new TooManyRequestsException();
    }

    // 2. Anthropic API 호출 (REQ-PROG-AI-012 — timeout/장애 처리)
    let aiResponse;
    try {
      aiResponse = await this.anthropic.generateProgram(dto);
    } catch (err) {
      if (err.code === 'TIMEOUT') throw new GatewayTimeoutException();
      throw new BadGatewayException();
    }

    // 3. 응답 검증 (REQ-PROG-AI-005) — 실패 시 422, 카운터 미증가
    const validated = await this.validator.validate(aiResponse, dto);

    // 4. 트랜잭션으로 Program 저장 + 카운터 증가 (REQ-PROG-AI-004, REQ-PROG-AI-009)
    return await this.prisma.$transaction(async tx => {
      const program = await tx.program.create({
        data: {
          title: validated.title,
          description: validated.description,
          type: 'AI_GENERATED',
          level: validated.level,
          frequency: dto.daysPerWeek,
          createdBy: userId,
          isPublic: false,
          days: {
            create: validated.days.map(d => ({
              dayNumber: d.dayNumber,
              name: d.name,
              exercises: {
                create: d.exercises.map(e => ({
                  exerciseId: e.exerciseId,
                  orderIndex: e.orderIndex,
                  sets: e.sets,
                  reps: e.reps,
                  weightNote: e.weightNote ?? null,
                })),
              },
            })),
          },
        },
        include: { days: { include: { exercises: { include: { exercise: true } } } } },
      });
      await tx.aiUsageLog.upsert({
        where: { userId_month: { userId, month } },
        create: { userId, month, programCreations: 1 },
        update: { programCreations: { increment: 1 } },
      });
      return toProgramDetail(program);
    });
  }
}
```

**AiValidationService**:

7단계 검증을 순서대로 수행. 각 단계 실패 시 `UnprocessableEntityException`(422)을 throw.

```typescript
async validate(raw: unknown, request: CreateAiProgramDto): Promise<ValidatedAiResponse> {
  // 1. JSON 파싱은 anthropic.client에서 완료, 여기서는 객체로 시작
  // 2. 스키마 검증 (zod 또는 class-validator)
  // 3. days.length === request.daysPerWeek
  // 4. 모든 sets ∈ [1, 10]
  // 5. 모든 reps matches ^\d+(-\d+)?$
  // 6. level ∈ {beginner, intermediate, advanced}
  // 7. 모든 exerciseId가 Exercise 테이블에 존재
}
```

#### 권한 가드 — POST /ai/programs

```typescript
@Controller('ai/programs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PREMIUM, UserRole.ADMIN)
export class AiProgramsController {
  @Post()
  async create(@Body() dto: CreateAiProgramDto, @CurrentUser('sub') userId: string) {
    return await this.service.create(userId, dto);
  }
}
```

### 1.3 AI 프롬프트 템플릿 (개요)

본 SPEC에서는 프롬프트 본문 전문을 정의하지 않고 구조만 명시한다(상세 프롬프트는 구현 시 점진 튜닝, 후속 운영 SPEC에서 관리).

**시스템 프롬프트 구조**:
1. 역할 선언: "당신은 근력 운동 프로그램 설계자입니다."
2. 출력 규칙: "응답은 반드시 다음 JSON 스키마를 따라야 합니다." + 스키마 명시.
3. 운동 선택 제약: "exerciseId는 반드시 제공된 화이트리스트에서 선택하세요." + Exercise 카탈로그 일부(또는 전체) 전달.
4. 안전 가이드: "초보자에게 위험한 조합 금지", "단일 일에 동일 부위 과부하 금지" 등.

**사용자 프롬프트 구조**:
- `goal`, `daysPerWeek`, `availableEquipment`, `focusAreas`를 자연어로 변환하여 전달.
- 예: "목표는 근비대, 주 4일, 보유 장비는 바벨/덤벨/케이블, 가슴과 등을 집중하고 싶습니다."

**Exercise 컨텍스트 전달 전략**:
- 옵션 A: Exercise 카탈로그 전체(800+ id + name)를 시스템 프롬프트에 포함 → 토큰 비용 큼.
- 옵션 B: `availableEquipment`로 사전 필터링한 Exercise 목록(예: 100~200건)만 전달 → 권장.
- 결정: **옵션 B**. plan.md 구현 시 `availableEquipment` 기반 Exercise 화이트리스트 사전 조회 후 프롬프트 주입.

**Anthropic API 파라미터**:
- `model`: `claude-haiku-4-5` (정확한 모델 ID는 빌드 시점에 확정)
- `max_tokens`: 4096 (NFR-PROG-AI-COST-003)
- `temperature`: 0.7 (일정 다양성 보장하되 일관된 구조 유지)
- `timeout`: 30,000 ms (NFR-PROG-PERF-006)

### 1.4 시드 전략 — 6종 카탈로그

`prisma/seed/programs.ts` 신규 생성. SPEC-EXERCISE-001 시드 패턴(`prisma/seed/exercises.ts`)을 참고하여 다음 흐름:

```typescript
// prisma/seed/programs.ts
export async function seedCatalogPrograms(prisma: PrismaClient) {
  const programs = [
    // 1. StrongLifts 5x5
    {
      slug: 'stronglifts-5x5',
      title: 'StrongLifts 5x5',
      description: '초급자를 위한 전신 풀바디 프로그램 ...',
      type: 'CATALOG',
      level: 'beginner',
      frequency: 3,
      days: [
        {
          dayNumber: 1, name: 'Workout A',
          exercises: [
            { exerciseSlug: 'barbell-squat', sets: 5, reps: '5', weightNote: 'start light' },
            { exerciseSlug: 'barbell-bench-press', sets: 5, reps: '5' },
            { exerciseSlug: 'bent-over-barbell-row', sets: 5, reps: '5' },
          ],
        },
        // ... Workout B
      ],
    },
    // 2~6 ...
  ];

  for (const p of programs) {
    // idempotency: 이미 존재하면 skip
    const existing = await prisma.program.findFirst({
      where: { title: p.title, type: 'CATALOG' },
    });
    if (existing) continue;

    // Exercise slug → Exercise.id 변환
    const exerciseSlugs = p.days.flatMap(d => d.exercises.map(e => e.exerciseSlug));
    const exercises = await prisma.exercise.findMany({
      where: { slug: { in: exerciseSlugs } }, // SPEC-EXERCISE-001의 Exercise.slug 사용 가정
    });
    if (exercises.length !== new Set(exerciseSlugs).size) {
      throw new Error(`Missing exercises for program "${p.title}"`);
    }
    const slugToId = new Map(exercises.map(e => [e.slug, e.id]));

    // 단일 트랜잭션으로 Program + ProgramDay + ProgramExercise 생성
    await prisma.program.create({
      data: {
        title: p.title, description: p.description, type: 'CATALOG', level: p.level, frequency: p.frequency, isPublic: false,
        days: {
          create: p.days.map(d => ({
            dayNumber: d.dayNumber, name: d.name,
            exercises: {
              create: d.exercises.map((e, idx) => ({
                exerciseId: slugToId.get(e.exerciseSlug)!, orderIndex: idx + 1,
                sets: e.sets, reps: e.reps, weightNote: e.weightNote,
              })),
            },
          })),
        },
      },
    });
  }
}
```

**시드 정책**:
- `prisma/seed/index.ts`에서 `seedExercises()` → `seedCatalogPrograms()` 순으로 호출(REQ-PROG-SEED-003 의존성 순서).
- idempotency: 동일 `title` + `type = CATALOG`인 프로그램이 존재하면 skip (REQ-PROG-SEED-001, REQ-PROG-SEED-005).
- 시드 후 검증: `prisma.program.count({ where: { type: 'CATALOG' } })`가 정확히 6이어야 함(검증 스크립트 또는 시드 끝에 assertion).

**시드 데이터 작성 가이드(개략)**:
- 각 프로그램의 운동 선택은 운동 도감(SPEC-EXERCISE-001)의 표준 운동(Barbell Squat, Barbell Bench Press, Deadlift, Barbell Row, Overhead Press, Pull-up, Dip 등)을 우선 사용.
- 카탈로그 내용은 본 SPEC 범위에서 운동학적 정확성을 1차로 검증(예: PPL은 3일 분할 × 2주, Arnold Split은 3일 분할 × 2주, Upper/Lower는 2일 분할 × 2주 등).
- `description`은 한국어로 작성, 영문 원본 명칭은 `title`에 유지.

### 1.5 모바일 아키텍처

#### 화면 구성

**`app/(tabs)/programs/index.tsx`** (프로그램 목록 화면 — 카탈로그):
- 상단: "추천 프로그램 카탈로그" 헤더.
- 6개 카드 리스트(`ProgramCard`): 제목, 분할 방식, 대상 수준, 주 빈도.
- 카드 탭 → 상세 화면 이동.
- 우상단: "AI 맞춤 프로그램 만들기" 버튼(Premium/Admin만 표시 또는 무권한 사용자에게는 안내 모달).

**`app/(tabs)/programs/[id].tsx`** (프로그램 상세 화면):
- 상단: 프로그램 메타(제목, 분할, 수준, 주 빈도).
- 일별 섹션: `ProgramDay` 카드 → 각 일의 `ProgramExercise` 리스트(운동명, 세트×렙, weightNote, 이미지).
- 하단: "이 프로그램 활성화" 버튼.
- 활성화 상태이면 "활성화됨" 표시 + "해제" 버튼.

**`app/(tabs)/programs/active.tsx`** (현재 활성 프로그램 화면):
- 활성 프로그램이 있으면 상세 표시 + "해제" 버튼.
- 활성 없으면 "활성 프로그램이 없습니다. 카탈로그에서 선택하세요" 안내.

**`app/(tabs)/programs/ai-create.tsx`** (AI 맞춤 생성 화면 — Premium/Admin):
- 입력 폼: `goal` (라디오), `daysPerWeek` (스테퍼 3~6), `availableEquipment` (체크박스 다중 선택), `focusAreas` (선택, 다중 선택).
- 현재 월 사용량 표시: "이번 달 X/10회 사용".
- "생성" 버튼: 한도 미달이고 폼 유효성 통과 시 활성. 한도 도달 시 비활성 + 안내.
- 제출 시: 로딩 인디케이터(최대 30초), 성공 시 생성된 프로그램 상세 화면으로 이동.

#### 컴포넌트

- `components/programs/ProgramCard.tsx`: 카탈로그/상세 공용 카드.
- `components/programs/ProgramDaySection.tsx`: 상세 화면의 일별 섹션.
- `components/programs/ProgramExerciseRow.tsx`: 상세 화면의 운동 행.
- `components/programs/AiProgramForm.tsx`: AI 생성 폼.
- `components/programs/AiUsageBadge.tsx`: AI 사용량 배지(X/10).

#### 상태 관리

- **TanStack Query**:
  - `useCatalog()`: `GET /programs/catalog` (staleTime 무한대, 카탈로그는 자주 변경 안 됨).
  - `useProgramDetail(id)`: `GET /programs/:id`.
  - `useActiveProgram()`: `GET /programs/active`.
  - `useActivate()`: `POST /programs/:id/activate` mutation → invalidate `['programs', 'active']`.
  - `useDeactivate()`: `DELETE /programs/active` mutation → invalidate `['programs', 'active']`.
  - `useCreateAiProgram()`: `POST /ai/programs` mutation → invalidate `['ai', 'usage']` + `['programs', 'me']`(향후).
  - `useAiUsage()`: 현재 월 사용량 조회. **본 SPEC에서는 별도 GET 엔드포인트를 제공하지 않으므로 클라이언트 측 추정 또는 후속 SPEC에서 GET 엔드포인트 추가**.

**의사 결정 — AI 사용량 조회 엔드포인트**: 본 SPEC은 사용량 조회를 위한 GET 엔드포인트를 명시하지 않는다. 모바일 측 `useAiUsage`는:
- 옵션 A: 클라이언트에서 추적(로컬 상태) — 부정확.
- 옵션 B: 본 SPEC에 `GET /ai/usage` 엔드포인트 추가.
- 옵션 C: AI 생성 성공/실패 응답에 현재 카운터 값을 포함.
- **결정**: 옵션 C(현재 응답에 사용량 포함) — 후속 SPEC에서 정식 `GET /ai/usage` 엔드포인트로 격상. 본 SPEC에서는 `POST /ai/programs` 성공 응답에 메타 필드(`usage: { programCreations, limit: 10 }`)를 추가하는 것을 plan.md 수준에서 권장. **이 추가는 spec.md REQ-PROG-AI-001/REQ-PROG-AI-009와 모순되지 않는 확장이며, 실제 구현 시 응답 DTO에 선택적 필드로 포함한다**.

### 1.6 공유 타입 (`packages/types/src/program.ts`)

```typescript
export const PROGRAM_TYPES = ['CATALOG', 'AI_GENERATED'] as const;
export type ProgramType = typeof PROGRAM_TYPES[number];

export const GOALS = ['muscle_gain', 'strength', 'endurance'] as const;
export type Goal = typeof GOALS[number];

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = typeof LEVELS[number];

export interface ProgramExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
  sets: number;
  reps: string;
  weightNote: string | null;
  exercise?: {
    name: string;
    primaryMuscles: string[];
    image: string | null;
  };
}

export interface ProgramDay {
  id: string;
  dayNumber: number;
  name: string;
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  title: string;
  description: string;
  type: ProgramType;
  level: Level;
  frequency: number;
  createdBy: string | null;
  isPublic: boolean;
  createdAt: string;
  days?: ProgramDay[];
}

export interface CatalogItem {
  id: string;
  title: string;
  description: string;
  type: 'CATALOG';
  level: Level;
  frequency: number;
  dayCount: number;
  exerciseSummary: { averagePerDay: number; totalExercises: number };
  createdAt: string;
}

export interface CreateAiProgramRequest {
  goal: Goal;
  daysPerWeek: number;          // 3~6
  availableEquipment: string[];
  focusAreas?: string[];
}

export interface AiUsage {
  programCreations: number;
  limit: number;                 // 10 in this SPEC
}
```

---

## 2. 마일스톤 (Milestones, Priority-based)

### Phase 1 [Priority: High] — Prisma 스키마 및 마이그레이션

**목표**: 데이터 모델을 확정하고 마이그레이션을 적용한다.

**작업**:
1. `prisma/schema.prisma` 수정:
   - `ProgramType` enum 신규.
   - `Program`, `ProgramDay`, `ProgramExercise`, `UserProgram`, `AiUsageLog` 모델 신규.
   - `User` 모델에 `aiPrograms`, `userProgram`, `aiUsageLogs` 역참조 추가.
   - `Exercise` 모델에 `programExercises` 역참조 추가.
   - 모든 UNIQUE/INDEX 제약 적용(NFR-PROG-DATA-001~004).
2. `pnpm prisma migrate dev --name add_program_models`로 마이그레이션 생성.
3. `pnpm prisma generate`로 Prisma Client 재생성.
4. `prisma validate` 통과 확인.

**완료 기준**: 마이그레이션 commit, `prisma migrate status` 클린, Prisma Client에서 새 모델이 type-safe하게 사용 가능.

**의존성**: SPEC-AUTH-001, SPEC-EXERCISE-001 마이그레이션 완료(`User`, `Exercise` 존재).

### Phase 2 [Priority: High] — 카탈로그 시드

**목표**: 6종 카탈로그 프로그램을 시드 스크립트로 삽입.

**작업**:
1. `prisma/seed/programs.ts` 신규 생성:
   - 6종 프로그램 데이터 정의(한국어 description 포함, REQ-PROG-SEED-004).
   - idempotency 로직(REQ-PROG-SEED-001, REQ-PROG-SEED-005).
   - Exercise slug → Exercise.id 변환 매핑(SPEC-EXERCISE-001 슬러그 의존, FK 위반 방지 REQ-PROG-SEED-003).
2. `prisma/seed/index.ts`에 `seedExercises()` 다음으로 `seedCatalogPrograms()` 호출 추가.
3. `pnpm prisma db seed` 실행 검증:
   - `prisma.program.count({ where: { type: 'CATALOG' } })` === 6.
   - 두 번 실행해도 6건 유지(idempotency).
4. 시드 단위 테스트 추가(`prisma/seed/programs.spec.ts`): 6건 정확성, 한국어 description, 모든 exerciseId 실존.

**완료 기준**: AC-PROG-SEED-01, AC-PROG-SEED-02 통과.

**의존성**: Phase 1, SPEC-EXERCISE-001 시드 완료.

### Phase 3 [Priority: High] — ProgramsModule 골격 + GET /programs/catalog

**목표**: 모듈 등록 및 카탈로그 조회 엔드포인트 구현.

**작업**:
1. `src/programs/programs.module.ts` 작성: `imports: [PrismaModule]`, `controllers: [ProgramsController]`, `providers: [ProgramsService]`.
2. `src/programs/programs.controller.ts` 골격 작성(라우트 순서 명시 + `@MX:WARN`/`@MX:NOTE` 주석).
3. `src/programs/programs.service.ts`의 `getCatalog()` 구현.
4. `CatalogItemDto`, `CatalogResponseDto` 작성.
5. `app.module.ts`에 `ProgramsModule` 등록.
6. 단위 테스트: getCatalog 응답 구조, AI 프로그램 제외 검증.
7. E2E 테스트: AC-PROG-CATALOG-01.

**완료 기준**: AC-PROG-CATALOG-01 통과.

**의존성**: Phase 1, Phase 2.

### Phase 4 [Priority: High] — GET /programs/:id + GET /programs/active

**목표**: 프로그램 상세 조회 및 활성 프로그램 조회 엔드포인트.

**작업**:
1. `programs.service.ts`의 `getDetail()`, `getActive()` 구현.
2. `ProgramDetailDto`, `ActiveResponseDto` 작성.
3. 라우트 등록 순서 검증: `catalog` → `active` → `:id`(REQ-PROG-VAL-001).
4. 권한 검사 로직(`AI_GENERATED` + 본인 소유 아니면 404, REQ-PROG-DETAIL-004).
5. 단위 테스트: 카탈로그 상세, 본인 AI 프로그램 상세, 타인 AI 프로그램 404, 비-cuid `:id` 404.
6. E2E 테스트: AC-PROG-DETAIL-01, AC-PROG-DETAIL-NOTFOUND-01, AC-PROG-ACTIVE-GET-01, AC-PROG-ACTIVE-EMPTY-01, AC-PROG-SECURITY-OWNERSHIP-01.

**완료 기준**: 해당 AC 모두 통과.

**의존성**: Phase 3.

### Phase 5 [Priority: High] — POST /programs/:id/activate + DELETE /programs/active

**목표**: 활성 프로그램 관리 mutation 엔드포인트.

**작업**:
1. `programs.service.ts`의 `activate()`, `deactivate()` 구현.
2. `ActivateResponseDto` 작성.
3. `activate`의 신규/기존 분기 응답 코드(201/200, REQ-PROG-ACTIVE-001).
4. `deactivate`의 멱등성 처리(`deleteMany`로 0건 영향도 정상, REQ-PROG-ACTIVE-005).
5. AI 프로그램 권한 검사(REQ-PROG-ACTIVE-003).
6. 단위 테스트: upsert 멱등성, 권한 격리, 신규/기존 분기.
7. E2E 테스트: AC-PROG-ACTIVATE-01, AC-PROG-ACTIVATE-02, AC-PROG-ACTIVATE-NOTFOUND-01, AC-PROG-DEACTIVATE-01, AC-PROG-DEACTIVATE-02, AC-PROG-SECURITY-OWNERSHIP-02, AC-PROG-SECURITY-OWNERSHIP-03.

**완료 기준**: 해당 AC 모두 통과.

**의존성**: Phase 4.

### Phase 6 [Priority: High] — AiModule + POST /ai/programs

**목표**: AI 맞춤 프로그램 생성 엔드포인트.

**작업**:
1. `src/ai/ai.module.ts` 작성: `imports: [PrismaModule, AuthModule(for guards)]`, `controllers: [AiProgramsController]`, `providers: [AiProgramsService, AnthropicClient, AiValidationService]`.
2. `src/ai/anthropic.client.ts` 작성:
   - Anthropic Messages API 호출 래퍼.
   - `ANTHROPIC_API_KEY` 환경 변수 로드.
   - 30초 timeout 설정(NFR-PROG-PERF-006).
   - 모델: `claude-haiku-4-5`, `max_tokens: 4096` (NFR-PROG-AI-COST-003).
   - Exercise 화이트리스트 사전 조회 후 프롬프트 주입(`availableEquipment` 기반 필터).
3. `src/ai/ai-validation.service.ts` 작성(7단계 검증, REQ-PROG-AI-005).
4. `src/ai/ai-programs.service.ts` 작성:
   - 한도 사전 점검(REQ-PROG-AI-003).
   - API 호출 → 검증 → 트랜잭션 저장 + 카운터 증가(REQ-PROG-AI-004, REQ-PROG-AI-009).
5. `src/ai/ai-programs.controller.ts` 작성: `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.PREMIUM, UserRole.ADMIN)`.
6. `CreateAiProgramDto` 작성 (REQ-PROG-AI-008).
7. `app.module.ts`에 `AiModule` 등록.
8. 단위 테스트:
   - DTO 검증(잘못된 goal/daysPerWeek/equipment).
   - 검증 서비스 7단계(각 단계 실패 케이스).
   - 서비스: 한도 사전 점검, 422 시 카운터 미증가(REQ-PROG-AI-004), 검증 통과 시 카운터 +1.
   - Mocked Anthropic 클라이언트(타임아웃, 5xx).
9. E2E 테스트: AC-PROG-AI-SUCCESS-01, AC-PROG-AI-RBAC-01, AC-PROG-AI-LIMIT-01, AC-PROG-AI-INVALID-AI-RESPONSE-01, AC-PROG-AI-VALIDATION-01, AC-PROG-AI-UPSTREAM-FAIL-01.

**완료 기준**: 해당 AC 모두 통과. Anthropic API는 unit/integration 테스트에서 모킹, 실제 호출은 staging에서 1회 검증.

**의존성**: Phase 1, Phase 5(권한 검사 로직 공유 가능), SPEC-AUTH-001(RolesGuard).

### Phase 7 [Priority: High] — 공유 타입 정합

**목표**: `packages/types/src/program.ts`를 백엔드/모바일이 동일하게 사용.

**작업**:
1. `packages/types/src/program.ts` 작성(Section 1.6 정의대로).
2. `packages/types/src/index.ts`에 export 추가.
3. 모바일 fetcher 타입을 `@workout/types`에서 import.
4. 백엔드 DTO와 `@workout/types` 호환성 검증(빌드 통과).

**완료 기준**: 백엔드/모바일이 동일 enum/타입 참조, tsc 빌드 에러 없음.

**의존성**: Phase 1(Prisma enum 생성 후).

### Phase 8 [Priority: Medium] — 모바일 프로그램 화면

**목표**: 카탈로그 목록·상세·활성·AI 생성 화면 구현.

**작업**:
1. `apps/mobile/services/programs.ts` 작성:
   - `fetchCatalog()`, `fetchProgramDetail(id)`, `fetchActiveProgram()`.
   - `activateProgram(id)`, `deactivateProgram()`.
   - `createAiProgram(dto)`.
2. `apps/mobile/hooks/usePrograms.ts` 작성:
   - `useCatalog`, `useProgramDetail`, `useActiveProgram`, `useActivate`, `useDeactivate`, `useCreateAiProgram`.
3. `components/programs/*` 컴포넌트 구현(Section 1.5).
4. `app/(tabs)/programs/index.tsx`, `[id].tsx`, `active.tsx`, `ai-create.tsx` 화면 구현.
5. 로딩/에러/한도 도달 UI(NFR-PROG-MOBILE-003, NFR-PROG-MOBILE-004).

**완료 기준**: 수동 검증 시나리오 MV-PROG-MOBILE-01~04 통과(QA 체크리스트).

**의존성**: Phase 3~7.

### Phase 9 [Priority: Low] — 문서화 및 운영 가이드

**목표**: API 문서 및 운영 가이드 보강.

**작업**:
1. `apps/backend/README.md`에 프로그램·AI 엔드포인트 사용 가이드 추가.
2. `docs/api/programs.md`, `docs/api/ai-programs.md` 작성(또는 NestJS Swagger 자동 생성 검토).
3. AI 비용 추적 운영 가이드: 월별 `programCreations` 합계 모니터링 SQL/대시보드 예시.
4. Anthropic API 키 회전 절차 문서.

**완료 기준**: 문서 PR 머지.

**의존성**: Phase 6, Phase 8.

---

## 3. 위험 요소 (Risks)

### Risk 1: AI 응답 품질 변동성

- **상황**: Claude Haiku 4.5는 동일 입력에 대해서도 응답이 변동될 수 있으며 운동학적으로 부적절한 조합을 생성할 수 있다(예: 동일 일에 가슴 운동 5개 몰림, 데드리프트와 스쿼트를 같은 날 고강도로 배치).
- **완화**:
  - 본 SPEC의 검증 단계는 구조와 ID 실존만 검증하며 의학적/운동학적 적절성은 검증하지 않음(out of scope).
  - 시스템 프롬프트에 안전 가이드 명시("초보자에게 위험한 조합 금지", "단일 일 동일 부위 과부하 금지").
  - 후속 SPEC에서 휴리스틱 검증 추가(예: 같은 부위 운동 수 상한) 검토.
  - 사용자에게 "AI 생성 결과는 참고용입니다" 안내 표시.

### Risk 2: Anthropic API 비용 폭증

- **상황**: AI 호출 비용은 외부 환경에 의존하며 한도(월 10회/사용자)를 우회하는 race condition으로 비용이 폭증할 가능성.
- **완화**:
  - `AiUsageLog`의 카운터 증가를 `prisma.$transaction` + `aiUsageLog.upsert({ update: { programCreations: { increment: 1 } } })`로 원자적 처리.
  - 한도 점검과 카운터 증가가 분리되어 race가 발생할 수 있으나, `programCreations`는 `increment`로 안전하게 누적된다. 다만 동시 11번째 요청이 통과될 가능성 존재 → advisory lock 또는 Redis 기반 분산 락 검토(후속 운영 SPEC).
  - Anthropic API `max_tokens: 4096` 상한으로 단일 호출 비용 통제(NFR-PROG-AI-COST-003).
  - 사용자 권한 게이팅(Premium/Admin만, REQ-PROG-AI-002)으로 무권한 호출 차단.

### Risk 3: Exercise 슬러그/ID 변경 시 시드 데이터 깨짐

- **상황**: SPEC-EXERCISE-001 시드가 갱신되어 슬러그 또는 ID가 변경되면 본 SPEC의 카탈로그 프로그램이 깨지는 FK 위반 발생.
- **완화**:
  - 시드 스크립트는 `Exercise.slug`(또는 `Exercise.name` 정규화)로 사전 조회 후 ID 변환(REQ-PROG-SEED-003).
  - Exercise 슬러그 변경 시 본 SPEC 시드도 업데이트하는 정책을 운영 가이드에 명시.
  - CI에서 시드 실행 후 카탈로그 프로그램 6건 정확성 검증(AC-PROG-SEED-01) → 깨짐 즉시 감지.

### Risk 4: 라우트 충돌 (catalog/active vs :id)

- **상황**: `GET /programs/catalog`이 `GET /programs/:id` 핸들러로 잘못 라우팅되어 `:id="catalog"`로 404 반환.
- **완화**:
  - REQ-PROG-VAL-001로 컨트롤러 메서드 정의 순서 강제.
  - E2E 테스트로 `GET /programs/catalog`, `GET /programs/active`, `DELETE /programs/active`가 모두 정상 동작하는지 검증(AC-PROG-ROUTE-01).
  - SPEC-EXERCISE-001 REQ-EX-FAV-012의 교훈 적용.

### Risk 5: 활성 프로그램 교체 시 race condition

- **상황**: 사용자가 동시에 두 프로그램을 활성화 요청하면 UNIQUE 제약 위반 가능.
- **완화**: Prisma `upsert` on `@@unique([userId])`는 PostgreSQL `ON CONFLICT`로 race를 자동 해결. 모바일은 mutation `isPending`으로 버튼 비활성화 추가 방어.

### Risk 6: AI 생성된 AI 프로그램의 누적

- **상황**: 사용자가 매월 10회 한도 내에서 AI 프로그램을 생성하면 `Program(type=AI_GENERATED, createdBy=userId)` 레코드가 누적된다. 본 SPEC은 자동 정리 정책을 명시하지 않음(제외 사항 13).
- **완화**:
  - 본 SPEC 범위에서는 누적을 허용. 활성화 시 기존 `UserProgram`만 교체되며 과거 AI 프로그램의 `Program` 레코드는 유지.
  - 사용자가 본인의 비활성 AI 프로그램을 조회할 방법은 본 SPEC에서 제공하지 않음(REQ-PROG-DETAIL-004의 권한 검사로 본인 ID 기반 조회만 가능). 후속 SPEC에서 "내 AI 프로그램 목록" 엔드포인트 검토.
  - 운영 메트릭으로 사용자당 AI 프로그램 수 모니터링.

### Risk 7: AI 응답에서 운동 부족 / 과다 발생

- **상황**: AI가 일별 운동을 0개 또는 매우 많이(예: 20개) 생성할 가능성.
- **완화**:
  - 본 SPEC은 `exercises.length`의 상하한을 명시하지 않음(검증 실패 사유 아님). 다만 시스템 프롬프트에 "일별 운동은 4~8개 권장"을 명시.
  - 검증 단계에서 비현실적 케이스(0개) 차단 여부는 plan.md 구현 시 결정(권장: `>= 1` 요구). 후속 SPEC에서 휴리스틱 검증 강화.

### Risk 8: 모바일에서 AI 사용량 표시 정확성

- **상황**: 모바일이 클라이언트 측에서 사용량을 추적하면 실제 서버 카운터와 어긋날 수 있음.
- **완화**:
  - Section 1.5의 결정: `POST /ai/programs` 응답에 `usage` 메타 필드 포함하여 매 호출 후 정확한 카운터 동기화.
  - 후속 SPEC에서 정식 `GET /ai/usage` 엔드포인트 도입.

---

## 4. 의존성 (Dependencies)

### 4.1 선행 SPEC

- **SPEC-AUTH-001 v1.0.1**: 본 SPEC의 모든 엔드포인트는 `JwtAuthGuard`, `@CurrentUser('sub')`, `UserRole` enum, `RolesGuard`, `@Roles()` 데코레이터에 의존.
- **SPEC-USER-001 v1.0.1**: `User` 모델 존재. 소프트 삭제는 본 SPEC에서 능동 처리하지 않음.
- **SPEC-EXERCISE-001 v1.0.1**: `Exercise` 모델 및 800+ 운동 시드 완료 필수. 본 SPEC의 `ProgramExercise.exerciseId` FK 의존.

### 4.2 기존 코드

- **`packages/utils`**: 본 SPEC에서 신규 유틸 추가 없음(시간 변환 `currentMonthKey()` 등은 백엔드 로컬 함수로 충분).
- **`apps/mobile/services/api.ts`**: 기존 axios/fetch 인스턴스 재사용.
- **`prisma/schema.prisma`**: `User`, `Exercise` 엔티티 존재. `Program`, `ProgramDay`, `ProgramExercise`, `UserProgram`, `AiUsageLog`는 본 SPEC에서 신설.

### 4.3 외부 라이브러리

- **이미 설치**: `@nestjs/common`, `@nestjs/jwt`, `@nestjs/passport`, `@prisma/client`, `prisma` v5, `class-validator`, `class-transformer`, `@tanstack/react-query`.
- **신규 설치 검토**:
  - `@anthropic-ai/sdk` (Anthropic 공식 SDK) — Anthropic API 호출 래퍼에서 사용.
  - 또는 `node-fetch`/`axios`로 직접 호출(이미 존재 시 재사용).
  - 결정: **`@anthropic-ai/sdk` 추가 권장** (Anthropic 공식 SDK가 모델 ID, retry, error handling을 안정적으로 제공).
- **선택**: `zod` (AI 응답 JSON 스키마 검증) — `class-validator`만으로도 가능하나 `zod`가 동적 검증에 유리.

### 4.4 환경 변수

- `ANTHROPIC_API_KEY`: 필수. 누락 시 부트스트랩 실패 또는 `POST /ai/programs`에서 500 반환.
- `ANTHROPIC_MODEL` (선택): 기본 `claude-haiku-4-5`, 환경 변수로 override 가능.

### 4.5 후행 SPEC (본 SPEC 완료가 트리거)

- **SPEC-WORKOUT-001**: 운동 세션 기록. 본 SPEC의 `UserProgram` 활성 프로그램을 진행도 추적의 기준으로 사용.
- **SPEC-AI-001**: AI 카탈로그 추천(모드 1), AI 재평가(모드 3). 본 SPEC의 `AiUsageLog.catalogRecs`, `reevaluations` 컬럼 활용.
- **SPEC-PROG-EXT-XXX**: 사용자 프로그램 히스토리 목록, Admin 카탈로그 운영 엔드포인트, AI 프로그램 정리 정책.

---

## 5. 검증 전략 (Verification Strategy)

### 5.1 단위 테스트 (Jest)

- `programs.service.spec.ts`:
  - `getCatalog`: 6건 정확성, AI 프로그램 제외.
  - `getDetail`: 카탈로그/본인 AI/타인 AI/존재하지 않는 ID 4가지 케이스.
  - `activate`: 신규/기존 분기, 권한 거부, 존재하지 않는 ID.
  - `deactivate`: 활성 있음/없음 모두 정상 종료(멱등성).
  - `getActive`: 활성 있음/없음 응답 형식.
- `programs.controller.spec.ts`:
  - 라우트 순서 검증(컨트롤러 메서드 정의 순서 정적 검사).
  - 응답 코드 분기(201 vs 200 for activate).
- `ai-programs.service.spec.ts`:
  - 한도 사전 점검(`programCreations = 10` → 429, API 호출 없음).
  - 권한 미달 → 403, API 호출 없음, 카운터 미증가.
  - 검증 통과 → 트랜잭션으로 Program + 카운터 +1.
  - 검증 실패 → 422, 카운터 미증가.
  - Anthropic API 모킹: 정상/타임아웃/5xx 3가지 케이스.
- `ai-validation.service.spec.ts`:
  - 7단계 검증 각각의 실패 케이스 단위 테스트(스키마, 일수, sets 범위, reps 정규식, level, exerciseId 실존).

### 5.2 통합 테스트 (NestJS Testing module + 실 PostgreSQL)

- `programs.e2e-spec.ts`:
  - 시드된 6종 카탈로그 검증(AC-PROG-CATALOG-01, AC-PROG-SEED-01).
  - 카탈로그 상세 조회(AC-PROG-DETAIL-01).
  - 본인이 생성하지 않은 AI 프로그램 404(AC-PROG-SECURITY-OWNERSHIP-01).
  - 활성화 신규/기존(AC-PROG-ACTIVATE-01, AC-PROG-ACTIVATE-02).
  - 비활성화 멱등성(AC-PROG-DEACTIVATE-01, AC-PROG-DEACTIVATE-02).
  - 활성 조회 빈 상태(AC-PROG-ACTIVE-EMPTY-01).
  - 라우트 순서(AC-PROG-ROUTE-01).
  - 사용자 격리(AC-PROG-SECURITY-OWNERSHIP-02, 03).
- `ai-programs.e2e-spec.ts`:
  - 권한 게이팅(AC-PROG-AI-RBAC-01).
  - 입력 검증(AC-PROG-AI-VALIDATION-01).
  - 월 한도 초과(AC-PROG-AI-LIMIT-01) — `AiUsageLog`를 사전 시드하여 카운터 10 상태 만들기.
  - AI 응답 검증 실패 → 422 + 카운터 미증가(AC-PROG-AI-INVALID-AI-RESPONSE-01) — Anthropic 클라이언트를 모킹하여 잘못된 응답 주입.
  - 정상 생성 → 201 + 카운터 +1(AC-PROG-AI-SUCCESS-01) — Anthropic 클라이언트를 모킹하여 유효 응답 주입.
  - Anthropic 5xx → 502 + 카운터 미증가(AC-PROG-AI-UPSTREAM-FAIL-01).

### 5.3 시드 검증 테스트

- `prisma/seed/programs.spec.ts`:
  - 시드 실행 후 `program.count({ where: { type: 'CATALOG' } })` === 6.
  - 두 번 실행해도 6 유지(idempotency).
  - 모든 카탈로그 프로그램의 `description`이 한국어(예: `/[가-힣]/`를 1자 이상 포함).
  - 모든 `ProgramExercise.exerciseId`가 `Exercise` 테이블에 존재.

### 5.4 성능 테스트

- AC-PROG-PERF-01:
  - 각 엔드포인트를 100회 반복 호출하여 P95 측정.
  - GET catalog ≤ 200ms, GET :id ≤ 300ms, GET active ≤ 300ms, POST activate ≤ 200ms, DELETE active ≤ 150ms.
  - POST /ai/programs는 외부 API 의존이므로 staging에서 별도 검증, 단위 테스트에서는 Anthropic 모킹.

### 5.5 수동 검증 (모바일)

- MV-PROG-MOBILE-01~04 시나리오(acceptance.md Section 11). 출시 전 1회 이상 QA 체크리스트로 수행.

### 5.6 AI 프롬프트 품질 수동 검증

- MV-PROG-AI-PROMPT-01: staging 환경에서 다양한 입력 조합(goal × daysPerWeek × equipment × focusAreas)로 실제 AI 호출 → 응답 품질 시각 검토(운동학적 적절성, 한국어 description의 자연스러움).

---

## 6. 롤백 계획 (Rollback Plan)

### 6.1 마이그레이션 롤백

- `Program`, `ProgramDay`, `ProgramExercise`, `UserProgram`, `AiUsageLog` 테이블 drop, `ProgramType` enum drop reverse migration.
- 카탈로그 시드 데이터 및 사용자 생성 AI 프로그램, 활성 프로그램 정보가 손실됨 → prod 롤백 전 백업 필수.

### 6.2 API 라우트 롤백

- `ProgramsModule`, `AiModule`을 `AppModule`에서 제거 또는 `git revert`.
- 모바일은 화면 비활성화 또는 빈 상태 UI fallback.

### 6.3 부분 롤백 시나리오

- AI 엔드포인트만 비활성화 가능: `AiModule`만 제거, `ProgramsModule`은 유지 → 카탈로그/활성 기능은 그대로 동작.
- 시드 갱신 롤백: 카탈로그 프로그램 내용만 바꾸려면 새 시드 스크립트 작성 + 기존 카탈로그 데이터 마이그레이션.

---

## 7. 운영 고려사항 (Operational Considerations)

### 7.1 로깅

- `info` 레벨: 카탈로그 조회, 프로그램 활성화/비활성화, AI 프로그램 생성 성공(사용자 ID, programId).
- `debug` 레벨: AI 입력 DTO(개인정보 없음), 검증 단계별 통과 여부.
- `warn` 레벨: AI 응답 검증 실패(어느 단계에서 실패했는지).
- `error` 레벨: Anthropic API 5xx/timeout, 시드 실패, 트랜잭션 실패.
- **민감 정보 마스킹**: `ANTHROPIC_API_KEY`는 어떤 로그에도 노출 금지(NFR-PROG-SEC-006).

### 7.2 모니터링 지표

- `programs_catalog_get_p95_ms`, `programs_detail_get_p95_ms`, `programs_active_get_p95_ms`
- `programs_activate_post_p95_ms`, `programs_deactivate_delete_p95_ms`
- `ai_programs_post_p95_ms` (외부 API 의존)
- `ai_programs_validation_failure_count` (422 빈도)
- `ai_programs_anthropic_failure_count` (502/503/504 빈도)
- `ai_programs_monthly_usage_per_user` (histogram, 사용자별 월 호출 수)
- `active_programs_total` (gauge, 현재 활성 프로그램 수)
- `ai_programs_total_per_user_lifetime` (gauge, 사용자별 누적 AI 프로그램 수 — Risk 6 관찰)

### 7.3 비용 추적

- Anthropic API 호출별 토큰 사용량을 응답 메타에서 추출하여 별도 로그/메트릭으로 수집(`input_tokens`, `output_tokens`).
- 월별 총 호출 수 × 평균 토큰 × 단가로 비용 산정. 운영 대시보드에 표시.

### 7.4 카탈로그 데이터 정합성

- 정기적으로 `prisma.program.count({ where: { type: 'CATALOG' } })` === 6 확인. 6이 아니면 시드 누락 또는 비정상 삭제 감지.
- 각 카탈로그 프로그램의 `ProgramExercise.exerciseId`가 `Exercise.id`에 모두 존재하는지 정기 점검.

---

## 8. 페이즈 실행 순서 요약

```
Phase 1 (High, Prisma) ──► Phase 2 (High, Seed) ──► Phase 3 (High, GET catalog)
                                                      │
                                                      ├──► Phase 4 (High, GET :id + GET active)
                                                      │                              │
                                                      │                              └──► Phase 5 (High, activate/deactivate)
                                                      │                                                       │
                                                      └──► Phase 7 (High, packages/types, parallel)            └──► Phase 6 (High, AI)
                                                                                                                              │
                                                                                                              Phase 8 (Medium, Mobile) ──► Phase 9 (Low, Docs)
```

- High Priority 완료(Phase 1~7) 후 백엔드 API 가용.
- Medium Priority(Phase 8)는 모바일 UI.
- Low Priority(Phase 9)는 문서화.

---

## 9. 완료 후 다음 단계 (Post-completion)

1. `/moai sync SPEC-PROGRAM-001`로 API 문서, README, CHANGELOG 동기화.
2. **SPEC-WORKOUT-001 작성**: 운동 세션 기록. 본 SPEC의 `UserProgram` 활성 프로그램을 진행도 추적의 기준으로 사용.
3. **SPEC-AI-001 작성**: AI 카탈로그 추천(모드 1), AI 재평가(모드 3). 본 SPEC의 `AiUsageLog.catalogRecs`, `reevaluations` 컬럼 활용.
4. AI 응답 품질 운영 데이터 수집 후 시스템 프롬프트 튜닝 가이드 작성.
5. 사용자 AI 프로그램 누적량 모니터링 → 자동 정리 정책 필요성 재평가(Risk 6).
6. AI 호출 비용 실측 후 한도 조정(월 10회) 재평가.

---

## 10. MX Tag 적용 체크리스트

본 SPEC의 mx_plan(`spec.md` Section 8)에 정의된 MX 태그를 Run Phase에서 실제 코드에 적용한다:

### @MX:ANCHOR

- [ ] `programs.service.ts :: getCatalog()` 함수에 `@MX:ANCHOR SPEC-PROGRAM-001 REQ-PROG-CATALOG-001`
- [ ] `programs.service.ts :: getDetail()` 함수에 `@MX:ANCHOR SPEC-PROGRAM-001 REQ-PROG-DETAIL-001 REQ-PROG-DETAIL-004`
- [ ] `programs.service.ts :: activate()` 함수에 `@MX:ANCHOR SPEC-PROGRAM-001 REQ-PROG-ACTIVE-001 REQ-PROG-ACTIVE-002`
- [ ] `programs.service.ts :: deactivate()` 함수에 `@MX:ANCHOR SPEC-PROGRAM-001 REQ-PROG-ACTIVE-004 REQ-PROG-ACTIVE-005`
- [ ] `programs.service.ts :: getActive()` 함수에 `@MX:ANCHOR SPEC-PROGRAM-001 REQ-PROG-ACTIVE-006 REQ-PROG-ACTIVE-007`
- [ ] `ai-programs.service.ts :: create()` 함수에 `@MX:ANCHOR SPEC-PROGRAM-001 REQ-PROG-AI-001 REQ-PROG-AI-004`
- [ ] `ai-validation.service.ts :: validate()` 함수에 `@MX:ANCHOR SPEC-PROGRAM-001 REQ-PROG-AI-005`
- [ ] `prisma/seed/programs.ts :: seedCatalogPrograms()` 함수에 `@MX:ANCHOR SPEC-PROGRAM-001 REQ-PROG-SEED-001 REQ-PROG-SEED-002`

### @MX:WARN

- [ ] `programs.service.ts :: activate()`에 `@MX:WARN race condition / @MX:REASON Prisma upsert handles INSERT ON CONFLICT for @@unique([userId])`
- [ ] `ai-programs.service.ts :: create()`에 `@MX:WARN limit-check vs increment race / @MX:REASON transaction + increment atomic; consider advisory lock in future SPEC`
- [ ] `anthropic.client.ts :: generateProgram()`에 `@MX:WARN external API + cost / @MX:REASON 30s timeout, max_tokens 4096, NFR-PROG-PERF-006 + NFR-PROG-AI-COST-003`
- [ ] `programs.controller.ts` 클래스 상단에 `@MX:WARN route ordering / @MX:REASON static routes (catalog, active) before dynamic (:id) per REQ-PROG-VAL-001; SPEC-EXERCISE-001 REQ-EX-FAV-012 precedent`
- [ ] `prisma/seed/programs.ts :: seedCatalogPrograms()`에 `@MX:WARN Exercise FK dependency / @MX:REASON SPEC-EXERCISE-001 seed must complete first per REQ-PROG-SEED-003`

### @MX:NOTE

- [ ] `prisma/schema.prisma :: AiUsageLog`에 `@MX:NOTE catalogRecs and reevaluations reserved for SPEC-AI-001`
- [ ] `prisma/schema.prisma :: UserProgram`에 `@MX:NOTE @@unique([userId]) enforces single active program`
- [ ] `programs.controller.ts`에 `@MX:NOTE route definition order: catalog (static) → active (static) → :id/activate (param+suffix) → :id (dynamic)`
- [ ] `ai-validation.service.ts :: validate()`에 `@MX:NOTE 7-step validation order: parsing → schema → daysPerWeek → sets → reps → level → exerciseId existence`
- [ ] `ai-programs.service.ts :: create()`에 `@MX:NOTE usage counter incremented only on validated AI response (REQ-PROG-AI-004)`

### @MX:TODO

- [ ] `ai-programs.service.ts :: create()`에 `@MX:TODO advisory lock to prevent 11th request race condition (SPEC-PROG-EXT-XXX)`
- [ ] `programs.service.ts`에 `@MX:TODO add GET /me/ai-programs (user's AI program history) — SPEC-PROG-EXT-XXX`
- [ ] `prisma/schema.prisma :: AiUsageLog.catalogRecs`에 `@MX:TODO activate in SPEC-AI-001 (AI mode 1: catalog recommendation)`
- [ ] `prisma/schema.prisma :: AiUsageLog.reevaluations`에 `@MX:TODO activate in SPEC-AI-001 (AI mode 3: program re-evaluation)`
