import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { WorkoutsService } from './workouts.service';
import { PrismaService } from '../prisma/prisma.service';

// Prisma 모의 빌더 — 순수 jest.fn() 기반, 실제 DB 사용 안 함
const buildPrismaMock = () => ({
  workoutSession: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  workoutSet: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  exercise: {
    findUnique: jest.fn(),
  },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

describe('WorkoutsService', () => {
  let service: WorkoutsService;
  let prisma: PrismaMock;

  const USER_ID = 'user-1';
  const SESSION_ID = 'session-1';
  const SET_ID = 'set-1';
  const EXERCISE_ID = 'exercise-1';

  const baseSession = {
    id: SESSION_ID,
    userId: USER_ID,
    name: '아침 운동',
    notes: null,
    status: SessionStatus.IN_PROGRESS,
    startedAt: new Date('2026-05-11T08:00:00.000Z'),
    completedAt: null,
  };

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WorkoutsService>(WorkoutsService);
  });

  describe('createSession', () => {
    it('활성 세션이 없으면 새 세션 생성 후 detail 반환', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);
      prisma.workoutSession.create.mockResolvedValue(baseSession);

      const result = await service.createSession(USER_ID, { name: '아침 운동' });

      expect(result.id).toBe(SESSION_ID);
      expect(result.status).toBe(SessionStatus.IN_PROGRESS);
      expect(result.sets).toEqual([]);
      expect(result.totalSets).toBe(0);
      expect(result.totalVolume).toBe(0);
    });

    it('이미 IN_PROGRESS 세션이 있으면 ConflictException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createSession(USER_ID, { name: '아침 운동' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.workoutSession.create).not.toHaveBeenCalled();
    });
  });

  describe('getActiveSession', () => {
    it('활성 세션 발견 시 { active: detail }', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        sets: [
          {
            id: 'set-a',
            exerciseId: EXERCISE_ID,
            setNumber: 1,
            reps: 5,
            weight: 100,
            duration: null,
            notes: null,
            recordedAt: new Date('2026-05-11T08:10:00.000Z'),
            exercise: { name: '스쿼트', category: 'COMPOUND' },
          },
        ],
      });

      const result = await service.getActiveSession(USER_ID);

      expect(result.active).not.toBeNull();
      expect(result.active?.totalSets).toBe(1);
      expect(result.active?.totalVolume).toBe(500);
      expect(result.active?.sets[0].exerciseName).toBe('스쿼트');
    });

    it('활성 세션 없으면 { active: null }', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);

      const result = await service.getActiveSession(USER_ID);

      expect(result.active).toBeNull();
    });
  });

  describe('findAll', () => {
    it('페이지네이션 + totalPages 계산', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([
        { ...baseSession, sets: [] },
      ]);
      prisma.workoutSession.count.mockResolvedValue(25);

      const result = await service.findAll(USER_ID, { page: 1, limit: 10 });

      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.items).toHaveLength(1);
    });

    it('total=0 이면 totalPages=0', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([]);
      prisma.workoutSession.count.mockResolvedValue(0);

      const result = await service.findAll(USER_ID, {});

      expect(result.totalPages).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('status 필터 적용', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([]);
      prisma.workoutSession.count.mockResolvedValue(0);

      await service.findAll(USER_ID, { status: SessionStatus.COMPLETED });

      expect(prisma.workoutSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: USER_ID,
            status: SessionStatus.COMPLETED,
          }),
        }),
      );
    });

    it('startedAtFrom/To 필터 적용', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([]);
      prisma.workoutSession.count.mockResolvedValue(0);

      await service.findAll(USER_ID, {
        startedAtFrom: '2026-01-01',
        startedAtTo: '2026-12-31',
      });

      const callArg = prisma.workoutSession.findMany.mock.calls[0][0];
      expect(callArg.where.startedAt.gte).toBeInstanceOf(Date);
      expect(callArg.where.startedAt.lte).toBeInstanceOf(Date);
    });

    it('기본 page=1, limit=20 사용', async () => {
      prisma.workoutSession.findMany.mockResolvedValue([]);
      prisma.workoutSession.count.mockResolvedValue(0);

      const result = await service.findAll(USER_ID, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('findOne', () => {
    it('세션 발견 시 detail 반환', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        sets: [],
      });

      const result = await service.findOne(USER_ID, SESSION_ID);

      expect(result.id).toBe(SESSION_ID);
    });

    it('세션 없으면 NotFoundException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);

      await expect(service.findOne(USER_ID, SESSION_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateSession', () => {
    it('소유한 세션 업데이트 후 detail 반환', async () => {
      // assertSessionOwned + findOne 모두 같은 findFirst 호출
      prisma.workoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        sets: [],
      });
      prisma.workoutSession.update.mockResolvedValue(baseSession);

      const result = await service.updateSession(USER_ID, SESSION_ID, {
        name: '저녁 운동',
        notes: '컨디션 좋음',
      });

      expect(result.id).toBe(SESSION_ID);
      expect(prisma.workoutSession.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: { name: '저녁 운동', notes: '컨디션 좋음' },
      });
    });

    it('세션 미소유 시 NotFoundException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSession(USER_ID, SESSION_ID, { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.workoutSession.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteSession', () => {
    it('소유한 세션 삭제', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(baseSession);
      prisma.workoutSession.delete.mockResolvedValue(baseSession);

      await service.deleteSession(USER_ID, SESSION_ID);

      expect(prisma.workoutSession.delete).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
      });
    });

    it('세션 미소유 시 NotFoundException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteSession(USER_ID, SESSION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.workoutSession.delete).not.toHaveBeenCalled();
    });
  });

  describe('completeSession', () => {
    it('IN_PROGRESS 세션 완료 처리', async () => {
      // 첫 호출(assertSessionOwned), 두 번째 호출(findOne)
      prisma.workoutSession.findFirst
        .mockResolvedValueOnce(baseSession)
        .mockResolvedValueOnce({
          ...baseSession,
          status: SessionStatus.COMPLETED,
          completedAt: new Date(),
          sets: [],
        });
      prisma.workoutSession.update.mockResolvedValue({
        ...baseSession,
        status: SessionStatus.COMPLETED,
      });

      const result = await service.completeSession(USER_ID, SESSION_ID);

      expect(result.status).toBe(SessionStatus.COMPLETED);
      expect(prisma.workoutSession.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: expect.objectContaining({ status: SessionStatus.COMPLETED }),
      });
    });

    it('이미 COMPLETED 세션은 BadRequestException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        status: SessionStatus.COMPLETED,
      });

      await expect(
        service.completeSession(USER_ID, SESSION_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.workoutSession.update).not.toHaveBeenCalled();
    });

    it('미소유 세션은 NotFoundException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);

      await expect(
        service.completeSession(USER_ID, SESSION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('addSet', () => {
    const addSetDto = {
      exerciseId: EXERCISE_ID,
      setNumber: 1,
      reps: 5,
      weight: 100,
    };

    it('IN_PROGRESS 세션에 세트 추가 성공', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(baseSession);
      prisma.exercise.findUnique.mockResolvedValue({
        id: EXERCISE_ID,
        name: '스쿼트',
        category: 'COMPOUND',
      });
      prisma.workoutSet.create.mockResolvedValue({
        id: SET_ID,
        exerciseId: EXERCISE_ID,
        setNumber: 1,
        reps: 5,
        weight: 100,
        duration: null,
        notes: null,
        recordedAt: new Date('2026-05-11T08:30:00.000Z'),
      });

      const result = await service.addSet(USER_ID, SESSION_ID, addSetDto);

      expect(result.id).toBe(SET_ID);
      expect(result.exerciseName).toBe('스쿼트');
      expect(result.exerciseCategory).toBe('COMPOUND');
      expect(result.reps).toBe(5);
      expect(result.weight).toBe(100);
    });

    it('완료된 세션에는 BadRequestException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        status: SessionStatus.COMPLETED,
      });

      await expect(
        service.addSet(USER_ID, SESSION_ID, addSetDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.workoutSet.create).not.toHaveBeenCalled();
    });

    it('세션 미소유 시 NotFoundException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(null);

      await expect(
        service.addSet(USER_ID, SESSION_ID, addSetDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('운동 종목 없을 시 NotFoundException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(baseSession);
      prisma.exercise.findUnique.mockResolvedValue(null);

      await expect(
        service.addSet(USER_ID, SESSION_ID, addSetDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.workoutSet.create).not.toHaveBeenCalled();
    });
  });

  describe('updateSet', () => {
    const updateSetDto = { reps: 6, weight: 105 };

    it('세트 업데이트 성공', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(baseSession);
      prisma.workoutSet.findFirst.mockResolvedValue({
        id: SET_ID,
        sessionId: SESSION_ID,
        exerciseId: EXERCISE_ID,
        setNumber: 1,
        reps: 5,
        weight: 100,
        duration: null,
        notes: null,
        recordedAt: new Date(),
      });
      prisma.workoutSet.update.mockResolvedValue({
        id: SET_ID,
        exerciseId: EXERCISE_ID,
        setNumber: 1,
        reps: 6,
        weight: 105,
        duration: null,
        notes: null,
        recordedAt: new Date('2026-05-11T08:30:00.000Z'),
        exercise: { name: '스쿼트', category: 'COMPOUND' },
      });

      const result = await service.updateSet(
        USER_ID,
        SESSION_ID,
        SET_ID,
        updateSetDto,
      );

      expect(result.reps).toBe(6);
      expect(result.weight).toBe(105);
      expect(result.exerciseName).toBe('스쿼트');
    });

    it('exerciseId 변경 시 새 운동 존재 검증 — 없으면 NotFoundException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(baseSession);
      prisma.workoutSet.findFirst.mockResolvedValue({
        id: SET_ID,
        sessionId: SESSION_ID,
        exerciseId: EXERCISE_ID,
        setNumber: 1,
        reps: 5,
        weight: 100,
        duration: null,
        notes: null,
        recordedAt: new Date(),
      });
      prisma.exercise.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSet(USER_ID, SESSION_ID, SET_ID, {
          exerciseId: 'new-exercise',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('완료된 세션은 BadRequestException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        status: SessionStatus.COMPLETED,
      });

      await expect(
        service.updateSet(USER_ID, SESSION_ID, SET_ID, updateSetDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('세트 없으면 NotFoundException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(baseSession);
      prisma.workoutSet.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSet(USER_ID, SESSION_ID, SET_ID, updateSetDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.workoutSet.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteSet', () => {
    it('세트 삭제 성공', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(baseSession);
      prisma.workoutSet.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteSet(USER_ID, SESSION_ID, SET_ID);

      expect(prisma.workoutSet.deleteMany).toHaveBeenCalledWith({
        where: { id: SET_ID, sessionId: SESSION_ID },
      });
    });

    it('완료된 세션은 BadRequestException', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        status: SessionStatus.COMPLETED,
      });

      await expect(
        service.deleteSet(USER_ID, SESSION_ID, SET_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.workoutSet.deleteMany).not.toHaveBeenCalled();
    });

    it('세트 없으면 NotFoundException (count=0)', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue(baseSession);
      prisma.workoutSet.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.deleteSet(USER_ID, SESSION_ID, SET_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('aggregate (via getActiveSession detail)', () => {
    it('totalVolume = sum(reps × weight), null 세트 스킵', async () => {
      prisma.workoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        sets: [
          {
            id: 's1',
            exerciseId: 'ex1',
            setNumber: 1,
            reps: 5,
            weight: 100,
            duration: 60,
            notes: null,
            recordedAt: new Date(),
            exercise: { name: 'A', category: 'C' },
          },
          {
            id: 's2',
            exerciseId: 'ex1',
            setNumber: 2,
            reps: 3,
            weight: 120,
            duration: 30,
            notes: null,
            recordedAt: new Date(),
            exercise: { name: 'A', category: 'C' },
          },
          {
            // null reps/weight 는 totalVolume 에서 제외
            id: 's3',
            exerciseId: 'ex2',
            setNumber: 1,
            reps: null,
            weight: null,
            duration: 90,
            notes: null,
            recordedAt: new Date(),
            exercise: { name: 'B', category: 'C' },
          },
        ],
      });

      const result = await service.getActiveSession(USER_ID);

      expect(result.active?.totalSets).toBe(3);
      expect(result.active?.totalVolume).toBe(5 * 100 + 3 * 120); // 860
      expect(result.active?.totalExercises).toBe(2); // ex1, ex2
      expect(result.active?.totalDuration).toBe(180);
    });
  });
});
