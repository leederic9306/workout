import { Test, TestingModule } from '@nestjs/testing';
import { CompoundType } from '@prisma/client';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardPeriod } from './dto/dashboard-query.dto';

const buildServiceMock = () => ({
  getBodyCompositionTrend: jest.fn(),
  getOneRepMaxHistory: jest.fn(),
  getWeeklyVolume: jest.fn(),
  getWorkoutFrequency: jest.fn(),
});
type ServiceMock = ReturnType<typeof buildServiceMock>;

describe('DashboardController', () => {
  let controller: DashboardController;
  let serviceMock: ServiceMock;
  const user = { sub: 'user-1' } as any;

  beforeEach(async () => {
    serviceMock = buildServiceMock();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: serviceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(DashboardController);
  });

  it('bodyComposition 위임', async () => {
    serviceMock.getBodyCompositionTrend.mockResolvedValue({ period: '3m', points: [] });
    const q = { period: DashboardPeriod.THREE_MONTHS };
    await controller.bodyComposition(user, q);
    expect(serviceMock.getBodyCompositionTrend).toHaveBeenCalledWith('user-1', q);
  });

  it('oneRepMaxHistory 위임', async () => {
    serviceMock.getOneRepMaxHistory.mockResolvedValue({ points: [] });
    const q = {
      exerciseType: CompoundType.SQUAT,
      period: DashboardPeriod.THREE_MONTHS,
    };
    await controller.oneRepMaxHistory(user, q);
    expect(serviceMock.getOneRepMaxHistory).toHaveBeenCalledWith('user-1', q);
  });

  it('weeklyVolume 위임', async () => {
    serviceMock.getWeeklyVolume.mockResolvedValue({ weeks: 12, points: [] });
    await controller.weeklyVolume(user, { weeks: 12 });
    expect(serviceMock.getWeeklyVolume).toHaveBeenCalledWith('user-1', { weeks: 12 });
  });

  it('workoutFrequency 위임', async () => {
    serviceMock.getWorkoutFrequency.mockResolvedValue({ weeks: 12, points: [] });
    await controller.workoutFrequency(user, { weeks: 12 });
    expect(serviceMock.getWorkoutFrequency).toHaveBeenCalledWith('user-1', { weeks: 12 });
  });
});
