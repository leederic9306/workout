import { Test } from '@nestjs/testing';
import { HttpException, UnprocessableEntityException } from '@nestjs/common';
import { ProgramType } from '@prisma/client';
import { AiProgramsService } from './ai-programs.service';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiClient } from './openai.client';
import { AiValidationService } from './ai-validation.service';

const USER_ID = 'user-1';

const buildPrismaMock = () => {
  const tx = {
    program: { create: jest.fn() },
    aiUsageLog: { upsert: jest.fn() },
    $queryRaw: jest.fn(),
  };
  return {
    _tx: tx,
    exercise: { findMany: jest.fn() },
    aiUsageLog: { findUnique: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
};

type PrismaMock = ReturnType<typeof buildPrismaMock> & {
  _tx: {
    program: { create: jest.Mock };
    aiUsageLog: { upsert: jest.Mock };
    $queryRaw: jest.Mock;
  };
};

describe('AiProgramsService', () => {
  let service: AiProgramsService;
  let prisma: PrismaMock;
  let anthropic: { generateProgram: jest.Mock };
  let validator: { validate: jest.Mock };

  const dto = {
    goal: '근육량 증가',
    daysPerWeek: 3,
    availableEquipment: ['barbell', 'dumbbell'],
  };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    anthropic = { generateProgram: jest.fn() };
    validator = { validate: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AiProgramsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAiClient, useValue: anthropic },
        { provide: AiValidationService, useValue: validator },
      ],
    }).compile();

    service = module.get(AiProgramsService);

    prisma.exercise.findMany.mockResolvedValue([{ id: 'ex-1', name: 'Squat' }]);
    // 기본: FOR UPDATE 재확인이 한도 미만(0회)을 반환 → 진행 허용
    prisma._tx.$queryRaw.mockResolvedValue([{ programCreations: 0 }]);
  });

  it('월 10회 초과 시 429 (Anthropic 호출 전 차단)', async () => {
    prisma.aiUsageLog.findUnique.mockResolvedValue({
      id: 'u1',
      userId: USER_ID,
      month: '2026-05',
      programCreations: 10,
      catalogRecs: 0,
      reevaluations: 0,
    });

    await expect(service.create(USER_ID, dto)).rejects.toThrow(HttpException);
    await expect(service.create(USER_ID, dto)).rejects.toMatchObject({
      status: 429,
    });
    expect(anthropic.generateProgram).not.toHaveBeenCalled();
  });

  it('정상 생성: program.create와 aiUsageLog.upsert가 transaction 내 호출', async () => {
    prisma.aiUsageLog.findUnique.mockResolvedValue(null);
    anthropic.generateProgram.mockResolvedValue({ raw: true });
    validator.validate.mockResolvedValue({
      title: 'AI Program',
      description: 'AI',
      level: 'beginner',
      days: [
        {
          dayNumber: 1,
          name: 'A',
          exercises: [
            { exerciseId: 'ex-1', orderIndex: 1, sets: 5, reps: '5', weightNote: null },
          ],
        },
      ],
    });
    const createdProgram = {
      id: 'p-new',
      title: 'AI Program',
      description: 'AI',
      type: ProgramType.AI_GENERATED,
      level: 'beginner',
      frequency: 3,
      createdBy: USER_ID,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      days: [],
    };
    prisma._tx.program.create.mockResolvedValue(createdProgram);
    prisma._tx.aiUsageLog.upsert.mockResolvedValue({});

    const result = await service.create(USER_ID, dto);

    expect(result.id).toBe('p-new');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma._tx.program.create).toHaveBeenCalled();
    expect(prisma._tx.aiUsageLog.upsert).toHaveBeenCalled();
  });

  it('검증 실패 시 카운터 증가하지 않음', async () => {
    prisma.aiUsageLog.findUnique.mockResolvedValue(null);
    anthropic.generateProgram.mockResolvedValue({ raw: true });
    validator.validate.mockRejectedValue(
      new UnprocessableEntityException('schema fail'),
    );

    await expect(service.create(USER_ID, dto)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(prisma._tx.aiUsageLog.upsert).not.toHaveBeenCalled();
    expect(prisma._tx.program.create).not.toHaveBeenCalled();
  });

  it('AI 호출 실패 시 transaction 진입 안 함', async () => {
    prisma.aiUsageLog.findUnique.mockResolvedValue(null);
    anthropic.generateProgram.mockRejectedValue(new Error('502'));

    await expect(service.create(USER_ID, dto)).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('FOR UPDATE 재확인에서 한도 초과 시 429 (transaction 내 차단)', async () => {
    // 사전 점검은 통과 (사용 기록 없음)
    prisma.aiUsageLog.findUnique.mockResolvedValue(null);
    anthropic.generateProgram.mockResolvedValue({ raw: true });
    validator.validate.mockResolvedValue({
      title: 'AI Program',
      description: 'AI',
      level: 'beginner',
      days: [
        {
          dayNumber: 1,
          name: 'A',
          exercises: [
            { exerciseId: 'ex-1', orderIndex: 1, sets: 5, reps: '5', weightNote: null },
          ],
        },
      ],
    });
    // FOR UPDATE 락 시점에서는 이미 10회 도달 (동시 요청이 먼저 커밋된 상황)
    prisma._tx.$queryRaw.mockResolvedValue([{ programCreations: 10 }]);

    await expect(service.create(USER_ID, dto)).rejects.toMatchObject({
      status: 429,
    });
    expect(prisma._tx.program.create).not.toHaveBeenCalled();
    expect(prisma._tx.aiUsageLog.upsert).not.toHaveBeenCalled();
  });

  it('FOR UPDATE 재확인에서 첫 요청(레코드 없음)은 통과', async () => {
    prisma.aiUsageLog.findUnique.mockResolvedValue(null);
    anthropic.generateProgram.mockResolvedValue({ raw: true });
    validator.validate.mockResolvedValue({
      title: 'AI Program',
      description: 'AI',
      level: 'beginner',
      days: [
        {
          dayNumber: 1,
          name: 'A',
          exercises: [
            { exerciseId: 'ex-1', orderIndex: 1, sets: 5, reps: '5', weightNote: null },
          ],
        },
      ],
    });
    // 이번 달 첫 요청 → AiUsageLog 행이 아직 없음
    prisma._tx.$queryRaw.mockResolvedValue([]);

    const createdProgram = {
      id: 'p-first',
      title: 'AI Program',
      description: 'AI',
      type: ProgramType.AI_GENERATED,
      level: 'beginner',
      frequency: 3,
      createdBy: USER_ID,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      days: [],
    };
    prisma._tx.program.create.mockResolvedValue(createdProgram);
    prisma._tx.aiUsageLog.upsert.mockResolvedValue({});

    const result = await service.create(USER_ID, dto);

    expect(result.id).toBe('p-first');
    expect(prisma._tx.program.create).toHaveBeenCalled();
    expect(prisma._tx.aiUsageLog.upsert).toHaveBeenCalled();
  });
});
