import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { JwtPayload } from '@workout/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import {
  OneRepMaxHistoryQueryDto,
  PeriodQueryDto,
  WeeksQueryDto,
} from './dto/dashboard-query.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  // 체성분 추이 (Step A)
  @Get('body-composition')
  async bodyComposition(
    @CurrentUser() user: JwtPayload,
    @Query() query: PeriodQueryDto,
  ) {
    return this.service.getBodyCompositionTrend(user.sub, query);
  }

  // 1RM 히스토리 (Step B)
  @Get('1rm-history')
  async oneRepMaxHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: OneRepMaxHistoryQueryDto,
  ) {
    return this.service.getOneRepMaxHistory(user.sub, query);
  }

  // 주간 볼륨 (Step B)
  @Get('weekly-volume')
  async weeklyVolume(
    @CurrentUser() user: JwtPayload,
    @Query() query: WeeksQueryDto,
  ) {
    return this.service.getWeeklyVolume(user.sub, query);
  }

  // 주간 운동 빈도 (Step B)
  @Get('workout-frequency')
  async workoutFrequency(
    @CurrentUser() user: JwtPayload,
    @Query() query: WeeksQueryDto,
  ) {
    return this.service.getWorkoutFrequency(user.sub, query);
  }
}
