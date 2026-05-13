// @MX:WARN: [AUTO] 라우트 정의 순서가 중요 - @Post('estimate')는 반드시 @Put(':exerciseType')보다 먼저 정의
// @MX:REASON: SPEC-1RM-001 REQ-ORM-VAL-007 - HTTP 메서드가 다르더라도 향후 동일 메서드 라우트 추가 대비 (SPEC-EXERCISE-001 교훈)
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CompoundType } from '@prisma/client';
import { Response } from 'express';
import type { JwtPayload } from '@workout/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OneRepMaxService } from './one-rep-max.service';
import { UpsertOneRepMaxDto } from './dto/upsert-one-rep-max.dto';
import { EstimateOneRepMaxDto } from './dto/estimate-one-rep-max.dto';
import {
  OneRepMaxCollectionDto,
  OneRepMaxEstimateResponseDto,
  OneRepMaxResponseDto,
} from './dto/one-rep-max-response.dto';

@Controller('users/me/1rm')
@UseGuards(JwtAuthGuard)
export class OneRepMaxController {
  constructor(private readonly service: OneRepMaxService) {}

  // 1. 고정 경로 POST estimate (먼저 정의 - REQ-ORM-VAL-007)
  @Post('estimate')
  async estimate(
    @Body() dto: EstimateOneRepMaxDto,
  ): Promise<OneRepMaxEstimateResponseDto> {
    return this.service.estimate(dto.weight, dto.reps);
  }

  // 2. 컬렉션 조회
  @Get()
  async getAll(
    @CurrentUser() user: JwtPayload,
  ): Promise<OneRepMaxCollectionDto> {
    return this.service.getAll(user.sub);
  }

  // 3. 동적 경로 PUT :exerciseType (마지막 정의)
  // ParseEnumPipe로 enum 검증 (REQ-ORM-INPUT-003 - 잘못된 값은 400)
  @Put(':exerciseType')
  async upsert(
    @Param('exerciseType', new ParseEnumPipe(CompoundType))
    exerciseType: CompoundType,
    @Body() dto: UpsertOneRepMaxDto,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OneRepMaxResponseDto> {
    const { record, isNew } = await this.service.upsert(
      user.sub,
      exerciseType,
      dto.value,
    );
    res.status(isNew ? HttpStatus.CREATED : HttpStatus.OK);
    return record;
  }
}
