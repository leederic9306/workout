import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { CompoundType, OrmSource } from '@prisma/client';
import { Response } from 'express';
import { OneRepMaxController } from './one-rep-max.controller';
import { OneRepMaxService } from './one-rep-max.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('OneRepMaxController', () => {
  let controller: OneRepMaxController;
  let service: jest.Mocked<OneRepMaxService>;

  const USER_ID = 'user-1';
  const JWT_PAYLOAD = {
    sub: USER_ID,
    role: 'USER' as const,
    onboardingCompleted: true,
  };

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<OneRepMaxService>> = {
      getAll: jest.fn(),
      upsert: jest.fn(),
      estimate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OneRepMaxController],
      providers: [{ provide: OneRepMaxService, useValue: serviceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OneRepMaxController>(OneRepMaxController);
    service = module.get(OneRepMaxService);
  });

  describe('getAll', () => {
    it('JWT sub로 service.getAll 호출 후 결과 반환', async () => {
      const expected = {
        SQUAT: null,
        DEADLIFT: null,
        BENCH_PRESS: null,
        BARBELL_ROW: null,
        OVERHEAD_PRESS: null,
      };
      service.getAll.mockResolvedValue(expected);

      const result = await controller.getAll(JWT_PAYLOAD as any);

      expect(service.getAll).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('upsert', () => {
    function buildRes(): Response {
      const res: Partial<Response> = {
        status: jest.fn().mockReturnThis(),
      };
      return res as Response;
    }

    it('신규 입력 시 201 Created로 응답', async () => {
      const record = {
        exerciseType: CompoundType.SQUAT,
        value: 140,
        source: OrmSource.DIRECT_INPUT,
        updatedAt: '2026-05-11T10:00:00.000Z',
      };
      service.upsert.mockResolvedValue({ record, isNew: true });
      const res = buildRes();

      const result = await controller.upsert(
        CompoundType.SQUAT,
        { value: 140 },
        JWT_PAYLOAD as any,
        res,
      );

      expect(service.upsert).toHaveBeenCalledWith(
        USER_ID,
        CompoundType.SQUAT,
        140,
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(result).toEqual(record);
    });

    it('기존 갱신 시 200 OK로 응답', async () => {
      const record = {
        exerciseType: CompoundType.SQUAT,
        value: 145.5,
        source: OrmSource.DIRECT_INPUT,
        updatedAt: '2026-05-11T11:00:00.000Z',
      };
      service.upsert.mockResolvedValue({ record, isNew: false });
      const res = buildRes();

      await controller.upsert(
        CompoundType.SQUAT,
        { value: 145.5 },
        JWT_PAYLOAD as any,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    });
  });

  describe('estimate', () => {
    it('service.estimate 결과를 그대로 반환', async () => {
      const expected = { epley: 116.67, brzycki: 112.5, average: 114.58 };
      service.estimate.mockReturnValue(expected);

      const result = await controller.estimate({ weight: 100, reps: 5 });

      expect(service.estimate).toHaveBeenCalledWith(100, 5);
      expect(result).toEqual(expected);
    });
  });
});
