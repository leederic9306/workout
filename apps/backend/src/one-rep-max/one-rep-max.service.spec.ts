import { Test, TestingModule } from '@nestjs/testing';
import { CompoundType, OrmSource } from '@prisma/client';
import { OneRepMaxService } from './one-rep-max.service';
import { PrismaService } from '../prisma/prisma.service';

const buildPrismaMock = () => ({
  oneRepMax: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

describe('OneRepMaxService', () => {
  let service: OneRepMaxService;
  let prisma: PrismaMock;

  const USER_ID = 'user-1';

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OneRepMaxService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OneRepMaxService>(OneRepMaxService);
  });

  describe('getAll', () => {
    it('5종 컴파운드 키가 항상 존재하며, 미설정은 null', async () => {
      const updatedAt = new Date('2026-05-11T09:30:00.000Z');
      prisma.oneRepMax.findMany.mockResolvedValue([
        {
          id: 'id-1',
          userId: USER_ID,
          exerciseType: CompoundType.SQUAT,
          value: 140,
          source: OrmSource.DIRECT_INPUT,
          updatedAt,
          createdAt: updatedAt,
        },
      ]);

      const result = await service.getAll(USER_ID);

      expect(Object.keys(result).sort()).toEqual(
        ['BARBELL_ROW', 'BENCH_PRESS', 'DEADLIFT', 'OVERHEAD_PRESS', 'SQUAT'].sort(),
      );
      expect(result.SQUAT).toEqual({
        exerciseType: CompoundType.SQUAT,
        value: 140,
        source: OrmSource.DIRECT_INPUT,
        updatedAt: '2026-05-11T09:30:00.000Z',
      });
      expect(result.DEADLIFT).toBeNull();
      expect(result.BENCH_PRESS).toBeNull();
      expect(result.BARBELL_ROW).toBeNull();
      expect(result.OVERHEAD_PRESS).toBeNull();
    });

    it('전무 상태에서는 모든 키가 null', async () => {
      prisma.oneRepMax.findMany.mockResolvedValue([]);

      const result = await service.getAll(USER_ID);

      expect(result.SQUAT).toBeNull();
      expect(result.DEADLIFT).toBeNull();
      expect(result.BENCH_PRESS).toBeNull();
      expect(result.BARBELL_ROW).toBeNull();
      expect(result.OVERHEAD_PRESS).toBeNull();
    });

    it('userId로만 조회 (사용자 격리)', async () => {
      prisma.oneRepMax.findMany.mockResolvedValue([]);

      await service.getAll(USER_ID);

      expect(prisma.oneRepMax.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
    });

    it('응답에 id/userId/createdAt 노출 없음 (보안)', async () => {
      const updatedAt = new Date('2026-05-11T09:30:00.000Z');
      prisma.oneRepMax.findMany.mockResolvedValue([
        {
          id: 'secret-id',
          userId: 'secret-user',
          exerciseType: CompoundType.SQUAT,
          value: 140,
          source: OrmSource.DIRECT_INPUT,
          updatedAt,
          createdAt: updatedAt,
        },
      ]);

      const result = await service.getAll(USER_ID);

      expect(result.SQUAT).not.toHaveProperty('id');
      expect(result.SQUAT).not.toHaveProperty('userId');
      expect(result.SQUAT).not.toHaveProperty('createdAt');
    });
  });

  describe('upsert', () => {
    it('신규 입력 시 isNew=true, source=DIRECT_INPUT', async () => {
      const updatedAt = new Date('2026-05-11T10:00:00.000Z');
      prisma.oneRepMax.findUnique.mockResolvedValue(null);
      prisma.oneRepMax.upsert.mockResolvedValue({
        id: 'new-id',
        userId: USER_ID,
        exerciseType: CompoundType.SQUAT,
        value: 140,
        source: OrmSource.DIRECT_INPUT,
        updatedAt,
        createdAt: updatedAt,
      });

      const { record, isNew } = await service.upsert(
        USER_ID,
        CompoundType.SQUAT,
        140,
      );

      expect(isNew).toBe(true);
      expect(record.value).toBe(140);
      expect(record.source).toBe(OrmSource.DIRECT_INPUT);
      expect(record.exerciseType).toBe(CompoundType.SQUAT);
    });

    it('기존 갱신 시 isNew=false', async () => {
      const updatedAt = new Date('2026-05-11T10:00:00.000Z');
      prisma.oneRepMax.findUnique.mockResolvedValue({
        id: 'existing',
        userId: USER_ID,
        exerciseType: CompoundType.SQUAT,
        value: 140,
        source: OrmSource.DIRECT_INPUT,
        updatedAt,
        createdAt: updatedAt,
      });
      prisma.oneRepMax.upsert.mockResolvedValue({
        id: 'existing',
        userId: USER_ID,
        exerciseType: CompoundType.SQUAT,
        value: 145.5,
        source: OrmSource.DIRECT_INPUT,
        updatedAt: new Date('2026-05-11T11:00:00.000Z'),
        createdAt: updatedAt,
      });

      const { record, isNew } = await service.upsert(
        USER_ID,
        CompoundType.SQUAT,
        145.5,
      );

      expect(isNew).toBe(false);
      expect(record.value).toBe(145.5);
    });

    it('Prisma upsert 호출 시 userId+exerciseType 복합키 사용', async () => {
      const updatedAt = new Date();
      prisma.oneRepMax.findUnique.mockResolvedValue(null);
      prisma.oneRepMax.upsert.mockResolvedValue({
        id: 'id',
        userId: USER_ID,
        exerciseType: CompoundType.DEADLIFT,
        value: 200,
        source: OrmSource.DIRECT_INPUT,
        updatedAt,
        createdAt: updatedAt,
      });

      await service.upsert(USER_ID, CompoundType.DEADLIFT, 200);

      expect(prisma.oneRepMax.upsert).toHaveBeenCalledWith({
        where: {
          userId_exerciseType: {
            userId: USER_ID,
            exerciseType: CompoundType.DEADLIFT,
          },
        },
        create: {
          userId: USER_ID,
          exerciseType: CompoundType.DEADLIFT,
          value: 200,
          source: OrmSource.DIRECT_INPUT,
        },
        update: {
          value: 200,
          source: OrmSource.DIRECT_INPUT,
        },
      });
    });
  });

  describe('estimate', () => {
    it('weight=100, reps=5 -> epley=116.67, brzycki=112.5, average=114.58', () => {
      const result = service.estimate(100, 5);
      expect(result.epley).toBe(116.67);
      expect(result.brzycki).toBe(112.5);
      expect(result.average).toBe(114.58);
    });

    it('average는 114.59가 아니라 114.58 (반올림 전 평균을 반올림)', () => {
      const result = service.estimate(100, 5);
      expect(result.average).toBe(114.58);
      expect(result.average).not.toBe(114.59);
    });

    it('DB 호출이 발생하지 않음 (순수 계산)', () => {
      service.estimate(100, 5);
      service.estimate(80, 3);
      service.estimate(150, 8);

      expect(prisma.oneRepMax.findMany).not.toHaveBeenCalled();
      expect(prisma.oneRepMax.findUnique).not.toHaveBeenCalled();
      expect(prisma.oneRepMax.upsert).not.toHaveBeenCalled();
      expect(prisma.oneRepMax.create).not.toHaveBeenCalled();
      expect(prisma.oneRepMax.update).not.toHaveBeenCalled();
      expect(prisma.oneRepMax.delete).not.toHaveBeenCalled();
    });

    it('reps=1 일 때 brzycki는 weight와 동일', () => {
      const result = service.estimate(100, 1);
      expect(result.brzycki).toBe(100);
    });
  });
});
