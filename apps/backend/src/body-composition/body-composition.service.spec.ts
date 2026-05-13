import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BodyCompositionService } from './body-composition.service';
import { PrismaService } from '../prisma/prisma.service';

// Prisma 모의 — 실제 DB 사용 안 함
const buildPrismaMock = () => ({
  bodyComposition: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

// Decimal 시뮬레이션용 헬퍼 (Number()로 변환되는지만 확인)
const dec = (n: number) => n;

describe('BodyCompositionService', () => {
  let service: BodyCompositionService;
  let prisma: PrismaMock;

  const USER_ID = 'user-1';

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BodyCompositionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<BodyCompositionService>(BodyCompositionService);
  });

  describe('create', () => {
    it('정상 입력 시 체성분을 생성하고 응답 DTO를 반환', async () => {
      const now = new Date('2026-05-10T08:00:00.000Z');
      prisma.bodyComposition.create.mockResolvedValue({
        id: 'bc-1',
        weight: dec(75.5),
        muscleMass: dec(35.2),
        bodyFatPct: dec(18.5),
        recordedAt: now,
        createdAt: now,
      });

      const result = await service.create(USER_ID, {
        weight: 75.5,
        muscleMass: 35.2,
        bodyFatPct: 18.5,
      });

      expect(result.id).toBe('bc-1');
      expect(result.weight).toBe(75.5);
      expect(result.muscleMass).toBe(35.2);
      expect(result.bodyFatPct).toBe(18.5);
      expect(prisma.bodyComposition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: USER_ID, weight: 75.5 }),
      });
    });

    it('muscleMass > weight면 BadRequest', async () => {
      await expect(
        service.create(USER_ID, { weight: 70, muscleMass: 80 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.bodyComposition.create).not.toHaveBeenCalled();
    });

    it('recordedAt이 미래면 BadRequest', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await expect(
        service.create(USER_ID, { weight: 70, recordedAt: future }),
      ).rejects.toThrow(BadRequestException);
    });

    it('optional 필드 생략 시 null 저장', async () => {
      const now = new Date();
      prisma.bodyComposition.create.mockResolvedValue({
        id: 'bc-2',
        weight: dec(70),
        muscleMass: null,
        bodyFatPct: null,
        recordedAt: now,
        createdAt: now,
      });

      const result = await service.create(USER_ID, { weight: 70 });

      expect(result.muscleMass).toBeNull();
      expect(result.bodyFatPct).toBeNull();
    });
  });

  describe('findAll', () => {
    it('limit 기본 20, 결과가 limit 이하면 nextCursor=null', async () => {
      const now = new Date('2026-05-10T08:00:00.000Z');
      prisma.bodyComposition.findMany.mockResolvedValue([
        {
          id: 'bc-1',
          weight: dec(75),
          muscleMass: null,
          bodyFatPct: null,
          recordedAt: now,
          createdAt: now,
        },
      ]);

      const result = await service.findAll(USER_ID, {});

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
      expect(prisma.bodyComposition.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: { recordedAt: 'desc' },
        take: 21,
      });
    });

    it('limit 초과 시 마지막 항목 recordedAt을 nextCursor로 반환', async () => {
      // limit=2일 때 3개를 받으면 nextCursor 발생
      const mk = (i: number, t: string) => ({
        id: `bc-${i}`,
        weight: dec(70 + i),
        muscleMass: null,
        bodyFatPct: null,
        recordedAt: new Date(t),
        createdAt: new Date(t),
      });
      prisma.bodyComposition.findMany.mockResolvedValue([
        mk(1, '2026-05-12T00:00:00.000Z'),
        mk(2, '2026-05-11T00:00:00.000Z'),
        mk(3, '2026-05-10T00:00:00.000Z'),
      ]);

      const result = await service.findAll(USER_ID, { limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('2026-05-11T00:00:00.000Z');
    });

    it('cursor 지정 시 where.recordedAt.lt 적용', async () => {
      prisma.bodyComposition.findMany.mockResolvedValue([]);
      await service.findAll(USER_ID, {
        limit: 10,
        cursor: '2026-05-10T00:00:00.000Z',
      });
      expect(prisma.bodyComposition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: USER_ID,
            recordedAt: { lt: new Date('2026-05-10T00:00:00.000Z') },
          },
        }),
      );
    });
  });

  describe('remove', () => {
    it('본인 소유 삭제 성공', async () => {
      prisma.bodyComposition.deleteMany.mockResolvedValue({ count: 1 });
      await expect(service.remove(USER_ID, 'bc-1')).resolves.toBeUndefined();
      expect(prisma.bodyComposition.deleteMany).toHaveBeenCalledWith({
        where: { id: 'bc-1', userId: USER_ID },
      });
    });

    it('존재하지 않거나 다른 사용자 소유면 NotFound (OWASP A01)', async () => {
      prisma.bodyComposition.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove(USER_ID, 'bc-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
