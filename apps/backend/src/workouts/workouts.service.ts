import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { AddSetDto } from './dto/add-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';

// 운동 세션 도메인 타입 (서비스 내부 + 컨트롤러 응답)
export interface WorkoutSetItemResponse {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  duration: number | null;
  notes: string | null;
  recordedAt: string;
}

export interface WorkoutSessionSummaryResponse {
  id: string;
  name: string | null;
  notes: string | null;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  totalSets: number;
  totalVolume: number;
  totalExercises: number;
  totalDuration: number;
}

export interface WorkoutSessionDetailResponse
  extends WorkoutSessionSummaryResponse {
  sets: WorkoutSetItemResponse[];
}

export interface PaginatedSessionsResponse {
  items: WorkoutSessionSummaryResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActiveSessionResponse {
  active: WorkoutSessionDetailResponse | null;
}

// @MX:ANCHOR: [AUTO] 운동 세션 도메인 서비스 (CRUD + 세트 관리 + 활성 세션)
// @MX:REASON: 컨트롤러의 10개 엔드포인트가 모두 호출하는 핵심 도메인 진입점 (fan_in >= 10)
@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  // 세션 생성 — 이미 IN_PROGRESS 세션이 있으면 409
  async createSession(
    userId: string,
    dto: CreateSessionDto,
  ): Promise<WorkoutSessionDetailResponse> {
    const existing = await this.prisma.workoutSession.findFirst({
      where: { userId, status: SessionStatus.IN_PROGRESS },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An active workout session already exists',
      );
    }

    const created = await this.prisma.workoutSession.create({
      data: {
        userId,
        name: dto.name ?? null,
      },
    });

    return this.buildDetail(created, []);
  }

  // 활성(IN_PROGRESS) 세션 조회
  async getActiveSession(userId: string): Promise<ActiveSessionResponse> {
    const session = await this.prisma.workoutSession.findFirst({
      where: { userId, status: SessionStatus.IN_PROGRESS },
      include: {
        sets: {
          include: { exercise: { select: { name: true, category: true } } },
          orderBy: [{ recordedAt: 'asc' }],
        },
      },
    });

    if (!session) {
      return { active: null };
    }
    return { active: this.buildDetail(session, session.sets) };
  }

  // 세션 목록 (필터 + 페이지네이션)
  async findAll(
    userId: string,
    query: ListSessionsQueryDto,
  ): Promise<PaginatedSessionsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkoutSessionWhereInput = { userId };
    if (query.status) where.status = query.status;
    if (query.startedAtFrom || query.startedAtTo) {
      where.startedAt = {};
      if (query.startedAtFrom) {
        where.startedAt.gte = new Date(query.startedAtFrom);
      }
      if (query.startedAtTo) {
        where.startedAt.lte = new Date(query.startedAtTo);
      }
    }

    const [sessions, total] = await Promise.all([
      this.prisma.workoutSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          sets: {
            select: {
              exerciseId: true,
              reps: true,
              weight: true,
              duration: true,
            },
          },
        },
      }),
      this.prisma.workoutSession.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items: sessions.map((s) => this.buildSummary(s, s.sets)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  // 세션 상세 (세트 + 운동 정보 포함)
  async findOne(
    userId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailResponse> {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        sets: {
          include: { exercise: { select: { name: true, category: true } } },
          orderBy: [{ recordedAt: 'asc' }],
        },
      },
    });
    if (!session) {
      throw new NotFoundException(`Workout session ${sessionId} not found`);
    }
    return this.buildDetail(session, session.sets);
  }

  // 세션 메타데이터(name/notes) 업데이트 — 상태와 무관
  async updateSession(
    userId: string,
    sessionId: string,
    dto: UpdateSessionDto,
  ): Promise<WorkoutSessionDetailResponse> {
    await this.assertSessionOwned(userId, sessionId);

    await this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    return this.findOne(userId, sessionId);
  }

  // 세션 삭제 (cascade로 세트 자동 삭제)
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    await this.assertSessionOwned(userId, sessionId);
    await this.prisma.workoutSession.delete({ where: { id: sessionId } });
  }

  // 세션 완료 처리
  async completeSession(
    userId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailResponse> {
    const session = await this.assertSessionOwned(userId, sessionId);
    if (session.status === SessionStatus.COMPLETED) {
      throw new BadRequestException('Session is already completed');
    }

    await this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    return this.findOne(userId, sessionId);
  }

  // 세트 추가 — IN_PROGRESS 세션에서만 허용
  async addSet(
    userId: string,
    sessionId: string,
    dto: AddSetDto,
  ): Promise<WorkoutSetItemResponse> {
    const session = await this.assertSessionInProgress(userId, sessionId);

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: dto.exerciseId },
      select: { id: true, name: true, category: true },
    });
    if (!exercise) {
      throw new NotFoundException(`Exercise ${dto.exerciseId} not found`);
    }

    const set = await this.prisma.workoutSet.create({
      data: {
        sessionId: session.id,
        exerciseId: dto.exerciseId,
        setNumber: dto.setNumber,
        reps: dto.reps ?? null,
        weight: dto.weight ?? null,
        duration: dto.duration ?? null,
        notes: dto.notes ?? null,
      },
    });

    return {
      id: set.id,
      exerciseId: set.exerciseId,
      exerciseName: exercise.name,
      exerciseCategory: exercise.category,
      setNumber: set.setNumber,
      reps: set.reps,
      weight: set.weight,
      duration: set.duration,
      notes: set.notes,
      recordedAt: set.recordedAt.toISOString(),
    };
  }

  // 세트 수정 — IN_PROGRESS 세션에서만 허용
  async updateSet(
    userId: string,
    sessionId: string,
    setId: string,
    dto: UpdateSetDto,
  ): Promise<WorkoutSetItemResponse> {
    await this.assertSessionInProgress(userId, sessionId);

    const existing = await this.prisma.workoutSet.findFirst({
      where: { id: setId, sessionId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Workout set ${setId} not found in session ${sessionId}`,
      );
    }

    if (dto.exerciseId && dto.exerciseId !== existing.exerciseId) {
      const exercise = await this.prisma.exercise.findUnique({
        where: { id: dto.exerciseId },
        select: { id: true },
      });
      if (!exercise) {
        throw new NotFoundException(`Exercise ${dto.exerciseId} not found`);
      }
    }

    const updated = await this.prisma.workoutSet.update({
      where: { id: setId },
      data: {
        ...(dto.exerciseId !== undefined ? { exerciseId: dto.exerciseId } : {}),
        ...(dto.setNumber !== undefined ? { setNumber: dto.setNumber } : {}),
        ...(dto.reps !== undefined ? { reps: dto.reps } : {}),
        ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
        ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { exercise: { select: { name: true, category: true } } },
    });

    return {
      id: updated.id,
      exerciseId: updated.exerciseId,
      exerciseName: updated.exercise.name,
      exerciseCategory: updated.exercise.category,
      setNumber: updated.setNumber,
      reps: updated.reps,
      weight: updated.weight,
      duration: updated.duration,
      notes: updated.notes,
      recordedAt: updated.recordedAt.toISOString(),
    };
  }

  // 세트 삭제 — IN_PROGRESS 세션에서만 허용
  async deleteSet(
    userId: string,
    sessionId: string,
    setId: string,
  ): Promise<void> {
    await this.assertSessionInProgress(userId, sessionId);

    const result = await this.prisma.workoutSet.deleteMany({
      where: { id: setId, sessionId },
    });
    if (result.count === 0) {
      throw new NotFoundException(
        `Workout set ${setId} not found in session ${sessionId}`,
      );
    }
  }

  // ---------------------- 내부 헬퍼 ----------------------

  // 세션 소유권 검증 (없거나 다른 사용자 소유면 404)
  private async assertSessionOwned(userId: string, sessionId: string) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException(`Workout session ${sessionId} not found`);
    }
    return session;
  }

  // 세션이 IN_PROGRESS인지 추가 검증 (완료된 세션은 400)
  private async assertSessionInProgress(userId: string, sessionId: string) {
    const session = await this.assertSessionOwned(userId, sessionId);
    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Cannot modify sets of a completed session',
      );
    }
    return session;
  }

  // 집계값 계산 (set 배열에서 totalSets/totalVolume/totalExercises/totalDuration)
  private aggregate(
    sets: Array<{
      exerciseId: string;
      reps: number | null;
      weight: number | null;
      duration: number | null;
    }>,
  ) {
    const exerciseIds = new Set<string>();
    let totalVolume = 0;
    let totalDuration = 0;
    for (const s of sets) {
      exerciseIds.add(s.exerciseId);
      if (s.reps != null && s.weight != null) {
        totalVolume += s.reps * s.weight;
      }
      if (s.duration != null) {
        totalDuration += s.duration;
      }
    }
    return {
      totalSets: sets.length,
      totalVolume,
      totalExercises: exerciseIds.size,
      totalDuration,
    };
  }

  // 요약 DTO 빌더
  private buildSummary(
    session: {
      id: string;
      name: string | null;
      notes: string | null;
      status: SessionStatus;
      startedAt: Date;
      completedAt: Date | null;
    },
    sets: Array<{
      exerciseId: string;
      reps: number | null;
      weight: number | null;
      duration: number | null;
    }>,
  ): WorkoutSessionSummaryResponse {
    const agg = this.aggregate(sets);
    return {
      id: session.id,
      name: session.name,
      notes: session.notes,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt
        ? session.completedAt.toISOString()
        : null,
      ...agg,
    };
  }

  // 상세 DTO 빌더 (세트 + 운동 정보 포함)
  private buildDetail(
    session: {
      id: string;
      name: string | null;
      notes: string | null;
      status: SessionStatus;
      startedAt: Date;
      completedAt: Date | null;
    },
    sets: Array<{
      id: string;
      exerciseId: string;
      setNumber: number;
      reps: number | null;
      weight: number | null;
      duration: number | null;
      notes: string | null;
      recordedAt: Date;
      exercise?: { name: string; category: string };
    }>,
  ): WorkoutSessionDetailResponse {
    const summary = this.buildSummary(session, sets);
    return {
      ...summary,
      sets: sets.map((s) => ({
        id: s.id,
        exerciseId: s.exerciseId,
        exerciseName: s.exercise?.name ?? '',
        exerciseCategory: s.exercise?.category ?? '',
        setNumber: s.setNumber,
        reps: s.reps,
        weight: s.weight,
        duration: s.duration,
        notes: s.notes,
        recordedAt: s.recordedAt.toISOString(),
      })),
    };
  }
}
