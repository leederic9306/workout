import { Test } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { AiValidationService } from './ai-validation.service';
import { PrismaService } from '../prisma/prisma.service';

const buildPrismaMock = () => ({
  exercise: { findMany: jest.fn() },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

function validProgram(overrides: any = {}) {
  return {
    title: 'My Program',
    description: 'desc',
    level: 'beginner',
    days: [
      {
        dayNumber: 1,
        name: 'A',
        exercises: [
          {
            exerciseId: 'ex-1',
            orderIndex: 1,
            sets: 5,
            reps: '5',
            weightNote: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('AiValidationService', () => {
  let service: AiValidationService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        AiValidationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AiValidationService);
    prisma.exercise.findMany.mockResolvedValue([{ id: 'ex-1' }]);
  });

  it('정상 케이스: 검증 통과', async () => {
    await expect(service.validate(validProgram(), 1)).resolves.toBeDefined();
  });

  it('1. 객체가 아니면 422', async () => {
    await expect(service.validate('string', 1)).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(service.validate(null, 1)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('2. title 누락 시 422', async () => {
    await expect(
      service.validate(validProgram({ title: undefined }), 1),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('2. days 누락 시 422', async () => {
    await expect(
      service.validate(validProgram({ days: [] }), 1),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('3. daysPerWeek 불일치 시 422', async () => {
    await expect(service.validate(validProgram(), 3)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('4. sets가 0 또는 11이면 422', async () => {
    await expect(
      service.validate(
        validProgram({
          days: [
            {
              dayNumber: 1,
              name: 'A',
              exercises: [
                { exerciseId: 'ex-1', orderIndex: 1, sets: 0, reps: '5', weightNote: null },
              ],
            },
          ],
        }),
        1,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('5. reps regex 불일치 시 422', async () => {
    await expect(
      service.validate(
        validProgram({
          days: [
            {
              dayNumber: 1,
              name: 'A',
              exercises: [
                { exerciseId: 'ex-1', orderIndex: 1, sets: 5, reps: '5x', weightNote: null },
              ],
            },
          ],
        }),
        1,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('5. reps "8-12" 형식은 통과', async () => {
    await expect(
      service.validate(
        validProgram({
          days: [
            {
              dayNumber: 1,
              name: 'A',
              exercises: [
                { exerciseId: 'ex-1', orderIndex: 1, sets: 5, reps: '8-12', weightNote: null },
              ],
            },
          ],
        }),
        1,
      ),
    ).resolves.toBeDefined();
  });

  it('6. level이 enum 외 값이면 422', async () => {
    await expect(
      service.validate(validProgram({ level: 'expert' }), 1),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('7. exerciseId가 DB에 없으면 422', async () => {
    prisma.exercise.findMany.mockResolvedValue([]); // DB에서 못 찾음
    await expect(service.validate(validProgram(), 1)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});
