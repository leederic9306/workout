import {
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ProgramType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramDetailDto, toProgramDetail } from '../programs/dto/program-detail.dto';
import { CreateAiProgramDto } from './dto/create-ai-program.dto';
import { OpenAiClient } from './openai.client';
import { AiValidationService } from './ai-validation.service';

const MAX_AI_PROGRAMS_PER_MONTH = 10;

// NestJS는 TooManyRequestsException가 없음 — HttpException 직접 사용
class TooManyAiRequestsException extends HttpException {
  constructor() {
    super('월 AI 프로그램 생성 한도(10회) 초과', 429);
  }
}

@Injectable()
export class AiProgramsService {
  private readonly logger = new Logger(AiProgramsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: OpenAiClient,
    private readonly validator: AiValidationService,
  ) {}

  private currentMonth(): string {
    const now = new Date();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${now.getUTCFullYear()}-${m}`;
  }

  // @MX:ANCHOR: SPEC-PROGRAM-001 REQ-PROG-AI-001 REQ-PROG-AI-004
  // @MX:WARN: 한도 점검과 카운터 증가 사이 race 가능 — transaction + increment로 원자적 처리
  // @MX:REASON: 동시 요청 11번째 통과 가능성 존재; advisory lock은 SPEC-PROG-EXT-XXX에서 검토
  // @MX:NOTE: FOR UPDATE 재확인으로 동시 요청 직렬화 처리 (잠금 없는 첫 요청 월 기록은 허용 오차)
  async create(
    userId: string,
    dto: CreateAiProgramDto,
  ): Promise<ProgramDetailDto> {
    const month = this.currentMonth();

    // 1. Anthropic 호출 전 사용 한도 점검 (REQ-PROG-AI-007)
    const usage = await this.prisma.aiUsageLog.findUnique({
      where: { userId_month: { userId, month } },
    });
    if (usage && usage.programCreations >= MAX_AI_PROGRAMS_PER_MONTH) {
      throw new TooManyAiRequestsException();
    }

    // 2. 운동 후보 로드 (AI에게 선택지로 제공)
    const exercises = await this.prisma.exercise.findMany({
      select: { id: true, name: true },
      take: 200,
      orderBy: { name: 'asc' },
    });

    // 3. AI 호출 (502/504/422 분기는 client 내부)
    const rawJson = await this.anthropic.generateProgram(dto, exercises);

    // 4. 7단계 검증 (422 throw)
    const validated = await this.validator.validate(rawJson, dto.daysPerWeek);

    // 5. transaction: program 생성 + 카운터 증가
    const created = await this.prisma.$transaction(async (tx) => {
      // FOR UPDATE로 행 잠금 → 동시 요청 직렬화 (race condition 방지)
      const lockRows = await tx.$queryRaw<Array<{ programCreations: number }>>`
        SELECT "programCreations" FROM "AiUsageLog"
        WHERE "userId" = ${userId} AND "month" = ${month}
        FOR UPDATE
      `;
      const lockedCount = lockRows[0]?.programCreations ?? 0;
      if (lockedCount >= MAX_AI_PROGRAMS_PER_MONTH) {
        throw new TooManyAiRequestsException();
      }

      const program = await tx.program.create({
        data: {
          title: validated.title,
          description: validated.description,
          type: ProgramType.AI_GENERATED,
          level: validated.level,
          frequency: dto.daysPerWeek,
          createdBy: userId,
          isPublic: false,
          days: {
            create: validated.days.map((d) => ({
              dayNumber: d.dayNumber,
              name: d.name,
              exercises: {
                create: d.exercises.map((ex) => ({
                  exerciseId: ex.exerciseId,
                  orderIndex: ex.orderIndex,
                  sets: ex.sets,
                  reps: ex.reps,
                  weightNote: ex.weightNote,
                })),
              },
            })),
          },
        },
        include: {
          days: {
            include: {
              exercises: {
                include: { exercise: true },
                orderBy: { orderIndex: 'asc' },
              },
            },
            orderBy: { dayNumber: 'asc' },
          },
        },
      });

      await tx.aiUsageLog.upsert({
        where: { userId_month: { userId, month } },
        create: { userId, month, programCreations: 1 },
        update: { programCreations: { increment: 1 } },
      });

      return program;
    });

    return toProgramDetail(created);
  }
}
