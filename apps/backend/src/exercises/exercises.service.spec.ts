import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { PrismaService } from '../prisma/prisma.service';

// Prisma 모킹 헬퍼
const buildPrismaMock = () => ({
  exercise: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  userExerciseFavorite: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

describe('ExercisesService', () => {
  let service: ExercisesService;
  let prisma: PrismaMock;

  const USER_ID = 'user-1';

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExercisesService>(ExercisesService);
  });

  describe('findAll', () => {
    it('페이지네이션과 정렬을 적용하고 isFavorite을 매핑한다', async () => {
      prisma.exercise.findMany.mockResolvedValue([
        {
          id: 'ex-1',
          name: 'Bench Press',
          primaryMuscles: ['chest'],
          equipment: 'barbell',
          category: 'strength',
          level: 'intermediate',
          images: ['img1.jpg', 'img2.jpg'],
          favoritedBy: [{ id: 'fav-1' }],
        },
        {
          id: 'ex-2',
          name: 'Squat',
          primaryMuscles: ['quadriceps'],
          equipment: 'barbell',
          category: 'strength',
          level: 'beginner',
          images: [],
          favoritedBy: [],
        },
      ]);
      prisma.exercise.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 20 }, USER_ID);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].isFavorite).toBe(true);
      expect(result.items[0].images).toEqual(['img1.jpg']); // 썸네일 1장만
      expect(result.items[1].isFavorite).toBe(false);
      expect(result.items[1].images).toEqual([]);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);

      expect(prisma.exercise.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('primaryMuscle 필터를 적용한다', async () => {
      prisma.exercise.findMany.mockResolvedValue([]);
      prisma.exercise.count.mockResolvedValue(0);

      await service.findAll(
        { page: 1, limit: 20, primaryMuscle: 'chest' },
        USER_ID,
      );

      const args = prisma.exercise.findMany.mock.calls[0][0];
      expect(args.where.AND[0]).toEqual({ primaryMuscles: { has: 'chest' } });
    });

    it('equipment 필터를 적용한다', async () => {
      prisma.exercise.findMany.mockResolvedValue([]);
      prisma.exercise.count.mockResolvedValue(0);

      await service.findAll(
        { page: 1, limit: 20, equipment: 'dumbbell' },
        USER_ID,
      );

      const args = prisma.exercise.findMany.mock.calls[0][0];
      expect(args.where.AND[1]).toEqual({ equipment: 'dumbbell' });
    });

    it('primaryMuscle과 equipment를 AND 조합으로 적용한다', async () => {
      prisma.exercise.findMany.mockResolvedValue([]);
      prisma.exercise.count.mockResolvedValue(0);

      await service.findAll(
        { page: 1, limit: 20, primaryMuscle: 'chest', equipment: 'barbell' },
        USER_ID,
      );

      const args = prisma.exercise.findMany.mock.calls[0][0];
      expect(args.where.AND).toEqual([
        { primaryMuscles: { has: 'chest' } },
        { equipment: 'barbell' },
      ]);
    });

    it('빈 결과를 처리한다 (totalPages=0)', async () => {
      prisma.exercise.findMany.mockResolvedValue([]);
      prisma.exercise.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 20 }, USER_ID);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('두 번째 페이지 skip을 올바르게 계산한다', async () => {
      prisma.exercise.findMany.mockResolvedValue([]);
      prisma.exercise.count.mockResolvedValue(50);

      await service.findAll({ page: 3, limit: 20 }, USER_ID);

      expect(prisma.exercise.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });
  });

  describe('findOne', () => {
    it('운동을 찾고 isFavorite을 반환한다', async () => {
      prisma.exercise.findUnique.mockResolvedValue({
        id: 'ex-1',
        name: 'Bench Press',
        force: 'push',
        level: 'intermediate',
        mechanic: 'compound',
        equipment: 'barbell',
        primaryMuscles: ['chest'],
        secondaryMuscles: ['triceps'],
        instructions: ['Lie on bench', 'Press up'],
        category: 'strength',
        images: ['a.jpg', 'b.jpg'],
        favoritedBy: [{ id: 'fav-1' }],
      });

      const result = await service.findOne('ex-1', USER_ID);

      expect(result.id).toBe('ex-1');
      expect(result.isFavorite).toBe(true);
      expect(result.images).toEqual(['a.jpg', 'b.jpg']); // 전체 이미지
      expect(result.instructions).toHaveLength(2);
    });

    it('운동이 없으면 NotFoundException을 throw한다', async () => {
      prisma.exercise.findUnique.mockResolvedValue(null);

      await expect(service.findOne('unknown', USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('즐겨찾기하지 않은 운동은 isFavorite=false', async () => {
      prisma.exercise.findUnique.mockResolvedValue({
        id: 'ex-1',
        name: 'Test',
        force: null,
        level: 'beginner',
        mechanic: null,
        equipment: null,
        primaryMuscles: [],
        secondaryMuscles: [],
        instructions: [],
        category: 'cardio',
        images: [],
        favoritedBy: [],
      });

      const result = await service.findOne('ex-1', USER_ID);
      expect(result.isFavorite).toBe(false);
    });
  });

  describe('addFavorite', () => {
    it('신규 즐겨찾기 추가 시 created=true와 함께 반환한다 (201 경로)', async () => {
      prisma.exercise.findUnique.mockResolvedValue({ id: 'ex-1' });
      prisma.userExerciseFavorite.findUnique.mockResolvedValue(null);
      const favoritedAt = new Date('2026-05-12T10:00:00.000Z');
      prisma.userExerciseFavorite.create.mockResolvedValue({
        id: 'fav-1',
        userId: USER_ID,
        exerciseId: 'ex-1',
        favoritedAt,
      });

      const result = await service.addFavorite(USER_ID, 'ex-1');

      expect(result.created).toBe(true);
      expect(result.dto.exerciseId).toBe('ex-1');
      expect(result.dto.favoritedAt).toBe(favoritedAt.toISOString());
      expect(prisma.userExerciseFavorite.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, exerciseId: 'ex-1' },
      });
    });

    it('이미 즐겨찾기된 항목이면 created=false (200 경로, 멱등)', async () => {
      prisma.exercise.findUnique.mockResolvedValue({ id: 'ex-1' });
      const favoritedAt = new Date('2026-05-10T10:00:00.000Z');
      prisma.userExerciseFavorite.findUnique.mockResolvedValue({
        id: 'fav-1',
        userId: USER_ID,
        exerciseId: 'ex-1',
        favoritedAt,
      });

      const result = await service.addFavorite(USER_ID, 'ex-1');

      expect(result.created).toBe(false);
      expect(result.dto.favoritedAt).toBe(favoritedAt.toISOString());
      expect(prisma.userExerciseFavorite.create).not.toHaveBeenCalled();
    });

    it('존재하지 않는 운동에 대해 NotFoundException', async () => {
      prisma.exercise.findUnique.mockResolvedValue(null);

      await expect(
        service.addFavorite(USER_ID, 'unknown'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeFavorite', () => {
    it('즐겨찾기를 제거한다', async () => {
      prisma.userExerciseFavorite.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeFavorite(USER_ID, 'ex-1');

      expect(prisma.userExerciseFavorite.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, exerciseId: 'ex-1' },
      });
    });

    it('존재하지 않아도 throw하지 않는다 (멱등)', async () => {
      prisma.userExerciseFavorite.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.removeFavorite(USER_ID, 'unknown'),
      ).resolves.toBeUndefined();
    });
  });

  describe('findFavorites', () => {
    it('favoritedAt DESC로 정렬하여 반환한다', async () => {
      prisma.userExerciseFavorite.findMany.mockResolvedValue([
        {
          id: 'fav-1',
          favoritedAt: new Date('2026-05-12'),
          exercise: {
            id: 'ex-1',
            name: 'Bench',
            primaryMuscles: ['chest'],
            equipment: 'barbell',
            category: 'strength',
            level: 'intermediate',
            images: ['x.jpg'],
          },
        },
      ]);
      prisma.userExerciseFavorite.count.mockResolvedValue(1);

      const result = await service.findFavorites(USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].isFavorite).toBe(true);
      expect(result.items[0].images).toEqual(['x.jpg']);
      expect(prisma.userExerciseFavorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID },
          orderBy: { favoritedAt: 'desc' },
        }),
      );
    });

    it('사용자별로 격리된 결과만 조회한다', async () => {
      prisma.userExerciseFavorite.findMany.mockResolvedValue([]);
      prisma.userExerciseFavorite.count.mockResolvedValue(0);

      await service.findFavorites('user-X', { page: 1, limit: 20 });

      expect(prisma.userExerciseFavorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-X' } }),
      );
      expect(prisma.userExerciseFavorite.count).toHaveBeenCalledWith({
        where: { userId: 'user-X' },
      });
    });
  });
});
