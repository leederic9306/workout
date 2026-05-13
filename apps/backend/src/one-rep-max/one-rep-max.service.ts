import { Injectable } from '@nestjs/common';
import { CompoundType, OrmSource } from '@prisma/client';
import {
  calculateEpley,
  calculateBrzycki,
  calculateAverage1RM,
} from '@workout/utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  OneRepMaxCollectionDto,
  OneRepMaxEstimateResponseDto,
  OneRepMaxResponseDto,
  toOneRepMaxResponse,
} from './dto/one-rep-max-response.dto';

// @MX:ANCHOR: [AUTO] 1RM 도메인 서비스 (getAll/upsert/estimate)
// @MX:REASON: SPEC-1RM-001 - 컨트롤러 3개 엔드포인트가 모두 호출하는 핵심 도메인 (fan_in >= 3)
@Injectable()
export class OneRepMaxService {
  constructor(private readonly prisma: PrismaService) {}

  // @MX:NOTE: [AUTO] 5종 컴파운드 키를 항상 응답에 포함 - 미설정 컴파운드는 null
  // REQ-ORM-READ-001, REQ-ORM-READ-002
  async getAll(userId: string): Promise<OneRepMaxCollectionDto> {
    const records = await this.prisma.oneRepMax.findMany({
      where: { userId },
    });

    const byType = new Map(records.map((r) => [r.exerciseType, r]));

    const result: OneRepMaxCollectionDto = {
      SQUAT: null,
      DEADLIFT: null,
      BENCH_PRESS: null,
      BARBELL_ROW: null,
      OVERHEAD_PRESS: null,
    };

    for (const type of Object.values(CompoundType)) {
      const record = byType.get(type);
      result[type] = record ? toOneRepMaxResponse(record) : null;
    }

    return result;
  }

  // @MX:WARN: [AUTO] 동일 사용자가 같은 컴파운드를 동시 PUT 시 race condition 가능
  // @MX:REASON: Prisma upsert는 PostgreSQL INSERT ON CONFLICT DO UPDATE를 사용하여 자동 해결 (REQ-ORM-INPUT-004)
  // REQ-ORM-INPUT-001: 신규=isNew:true (201), 기존=isNew:false (200)
  async upsert(
    userId: string,
    exerciseType: CompoundType,
    value: number,
  ): Promise<{ record: OneRepMaxResponseDto; isNew: boolean }> {
    const existing = await this.prisma.oneRepMax.findUnique({
      where: {
        userId_exerciseType: { userId, exerciseType },
      },
    });
    const isNew = existing === null;

    const record = await this.prisma.oneRepMax.upsert({
      where: {
        userId_exerciseType: { userId, exerciseType },
      },
      create: {
        userId,
        exerciseType,
        value,
        source: OrmSource.DIRECT_INPUT,
      },
      update: {
        value,
        source: OrmSource.DIRECT_INPUT,
      },
    });

    return { record: toOneRepMaxResponse(record), isNew };
  }

  // @MX:NOTE: [AUTO] DB 쓰기 없는 순수 계산 - packages/utils/src/1rm.ts 위임
  // REQ-ORM-CALC-001, REQ-ORM-CALC-003
  estimate(weight: number, reps: number): OneRepMaxEstimateResponseDto {
    return {
      epley: calculateEpley(weight, reps),
      brzycki: calculateBrzycki(weight, reps),
      average: calculateAverage1RM(weight, reps),
    };
  }
}
