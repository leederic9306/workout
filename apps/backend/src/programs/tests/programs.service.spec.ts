import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProgramType } from '@prisma/client';
import { ProgramsService } from '../programs.service';
import { PrismaService } from '../../prisma/prisma.service';

const buildPrismaMock = () => ({
  program: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  userProgram: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const NOW = new Date('2026-05-12T00:00:00.000Z');

function makeProgram(overrides: any = {}): any {
  return {
    id: 'prog-1',
    title: 'StrongLifts 5x5',
    description: 'desc',
    type: ProgramType.CATALOG,
    level: 'beginner',
    frequency: 3,
    createdBy: null,
    isPublic: false,
    createdAt: NOW,
    updatedAt: NOW,
    days: [
      {
        id: 'day-1',
        dayNumber: 1,
        name: 'A',
        exercises: [
          {
            id: 'pe-1',
            exerciseId: 'ex-1',
            orderIndex: 1,
            sets: 5,
            reps: '5',
            weightNote: null,
            exercise: { name: 'Squat' },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('ProgramsService', () => {
  let service: ProgramsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgramsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ProgramsService);
  });

  describe('getCatalog', () => {
    it('CATALOG 타입만 조회하고 items 배열로 응답', async () => {
      prisma.program.findMany.mockResolvedValue([
        makeProgram({ id: 'p1', title: 'StrongLifts 5x5' }),
        makeProgram({ id: 'p2', title: 'Starting Strength' }),
      ]);

      const result = await service.getCatalog();

      expect(prisma.program.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: ProgramType.CATALOG },
        }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.items[0].title).toBe('StrongLifts 5x5');
    });

    it('exerciseSummary는 최대 3개 운동명을 콤마로 결합', async () => {
      prisma.program.findMany.mockResolvedValue([
        makeProgram({
          days: [
            {
              id: 'd1',
              dayNumber: 1,
              name: 'A',
              exercises: [
                { id: 'pe1', exerciseId: 'e1', orderIndex: 1, sets: 5, reps: '5', weightNote: null, exercise: { name: 'Squat' } },
                { id: 'pe2', exerciseId: 'e2', orderIndex: 2, sets: 5, reps: '5', weightNote: null, exercise: { name: 'Bench' } },
                { id: 'pe3', exerciseId: 'e3', orderIndex: 3, sets: 5, reps: '5', weightNote: null, exercise: { name: 'Row' } },
                { id: 'pe4', exerciseId: 'e4', orderIndex: 4, sets: 5, reps: '5', weightNote: null, exercise: { name: 'Deadlift' } },
              ],
            },
          ],
        }),
      ]);

      const result = await service.getCatalog();
      expect(result.items[0].exerciseSummary).toBe('Squat, Bench, Row');
    });

    it('dayCount는 days 개수와 일치', async () => {
      prisma.program.findMany.mockResolvedValue([
        makeProgram({
          days: [
            { id: 'd1', dayNumber: 1, name: 'A', exercises: [] },
            { id: 'd2', dayNumber: 2, name: 'B', exercises: [] },
            { id: 'd3', dayNumber: 3, name: 'C', exercises: [] },
          ],
        }),
      ]);
      const result = await service.getCatalog();
      expect(result.items[0].dayCount).toBe(3);
    });
  });

  describe('getDetail', () => {
    it('CATALOG 프로그램은 누구나 조회 가능', async () => {
      prisma.program.findUnique.mockResolvedValue(makeProgram());
      const result = await service.getDetail('prog-1', USER_ID);
      expect(result.id).toBe('prog-1');
      expect(result.days[0].exercises[0].exerciseName).toBe('Squat');
    });

    it('존재하지 않는 id는 404', async () => {
      prisma.program.findUnique.mockResolvedValue(null);
      await expect(service.getDetail('nonexistent-id-xx', USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('빈 id는 404 (별도 400 없음)', async () => {
      await expect(service.getDetail('', USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('AI_GENERATED는 createdBy 본인만 접근 (다른 사람은 404)', async () => {
      prisma.program.findUnique.mockResolvedValue(
        makeProgram({ type: ProgramType.AI_GENERATED, createdBy: OTHER_USER_ID }),
      );
      await expect(service.getDetail('prog-1', USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('AI_GENERATED 본인은 접근 가능', async () => {
      prisma.program.findUnique.mockResolvedValue(
        makeProgram({ type: ProgramType.AI_GENERATED, createdBy: USER_ID }),
      );
      const result = await service.getDetail('prog-1', USER_ID);
      expect(result.createdBy).toBe(USER_ID);
    });

    it('days/exercises가 정렬되어 응답', async () => {
      prisma.program.findUnique.mockResolvedValue(
        makeProgram({
          days: [
            {
              id: 'd2',
              dayNumber: 2,
              name: 'B',
              exercises: [
                { id: 'pe1', exerciseId: 'e1', orderIndex: 2, sets: 5, reps: '5', weightNote: null, exercise: { name: 'Bench' } },
                { id: 'pe2', exerciseId: 'e2', orderIndex: 1, sets: 5, reps: '5', weightNote: null, exercise: { name: 'Squat' } },
              ],
            },
            { id: 'd1', dayNumber: 1, name: 'A', exercises: [] },
          ],
        }),
      );
      const result = await service.getDetail('prog-1', USER_ID);
      expect(result.days.map((d) => d.dayNumber)).toEqual([1, 2]);
      expect(result.days[1].exercises.map((e) => e.orderIndex)).toEqual([1, 2]);
    });
  });

  describe('getActive', () => {
    it('활성 프로그램이 없으면 {active: null} 응답 (200, 404 아님)', async () => {
      prisma.userProgram.findUnique.mockResolvedValue(null);
      const result = await service.getActive(USER_ID);
      expect(result).toEqual({ active: null });
    });

    it('활성 프로그램이 있으면 ProgramDetailDto 응답', async () => {
      prisma.userProgram.findUnique.mockResolvedValue({
        id: 'up-1',
        userId: USER_ID,
        programId: 'prog-1',
        startedAt: NOW,
        program: makeProgram(),
      });
      const result = await service.getActive(USER_ID);
      expect(result.active).not.toBeNull();
      expect(result.active!.id).toBe('prog-1');
    });
  });

  describe('activate', () => {
    it('존재하지 않는 프로그램은 404', async () => {
      prisma.program.findUnique.mockResolvedValue(null);
      await expect(service.activate(USER_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('타인의 AI_GENERATED 프로그램은 403', async () => {
      prisma.program.findUnique.mockResolvedValue(
        makeProgram({ type: ProgramType.AI_GENERATED, createdBy: OTHER_USER_ID }),
      );
      await expect(service.activate(USER_ID, 'prog-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('신규 활성화 시 isNew=true', async () => {
      prisma.program.findUnique.mockResolvedValue(makeProgram());
      prisma.userProgram.findUnique.mockResolvedValue(null);
      prisma.userProgram.upsert.mockResolvedValue({
        id: 'up-1',
        userId: USER_ID,
        programId: 'prog-1',
        startedAt: NOW,
      });
      const { response, isNew } = await service.activate(USER_ID, 'prog-1');
      expect(isNew).toBe(true);
      expect(response.programId).toBe('prog-1');
    });

    it('이미 활성 프로그램이 있으면 isNew=false (교체)', async () => {
      prisma.program.findUnique.mockResolvedValue(makeProgram({ id: 'prog-2' }));
      prisma.userProgram.findUnique.mockResolvedValue({
        id: 'up-1',
        userId: USER_ID,
        programId: 'prog-1',
        startedAt: NOW,
      });
      prisma.userProgram.upsert.mockResolvedValue({
        id: 'up-1',
        userId: USER_ID,
        programId: 'prog-2',
        startedAt: NOW,
      });
      const { isNew } = await service.activate(USER_ID, 'prog-2');
      expect(isNew).toBe(false);
    });
  });

  describe('deactivate', () => {
    it('활성 프로그램 없어도 에러 없이 통과 (멱등)', async () => {
      prisma.userProgram.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.deactivate(USER_ID)).resolves.toBeUndefined();
      expect(prisma.userProgram.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
    });

    it('활성 프로그램이 있으면 삭제', async () => {
      prisma.userProgram.deleteMany.mockResolvedValue({ count: 1 });
      await service.deactivate(USER_ID);
      expect(prisma.userProgram.deleteMany).toHaveBeenCalled();
    });
  });
});
