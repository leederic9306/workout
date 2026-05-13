import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProgramType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogItemDto } from './dto/catalog-item.dto';
import { CatalogResponseDto } from './dto/catalog-response.dto';
import { ProgramDetailDto, toProgramDetail } from './dto/program-detail.dto';
import { ActiveProgramResponseDto } from './dto/active-response.dto';
import { ActivateProgramResponseDto } from './dto/activate-response.dto';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  // @MX:ANCHOR: SPEC-PROGRAM-001 REQ-PROG-CATALOG-001
  // @MX:REASON: 카탈로그 6종 고정 응답 - 컨트롤러 단일 진입점
  async getCatalog(): Promise<CatalogResponseDto> {
    const programs = await this.prisma.program.findMany({
      where: { type: ProgramType.CATALOG },
      orderBy: { createdAt: 'asc' },
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

    const items: CatalogItemDto[] = programs.map((p) => {
      const dayCount = p.days.length;
      const exerciseNames = new Set<string>();
      for (const day of p.days) {
        for (const ex of day.exercises) {
          if (exerciseNames.size < 3) exerciseNames.add(ex.exercise.name);
        }
      }
      const exerciseSummary = Array.from(exerciseNames).join(', ');
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        type: p.type,
        level: p.level,
        frequency: p.frequency,
        dayCount,
        exerciseSummary,
        createdAt: p.createdAt.toISOString(),
      };
    });

    return { items };
  }

  // @MX:ANCHOR: SPEC-PROGRAM-001 REQ-PROG-DETAIL-001 REQ-PROG-DETAIL-004
  // @MX:REASON: 프로그램 상세 조회 - AI_GENERATED 권한 검증 단일 진입점
  async getDetail(id: string, userId: string): Promise<ProgramDetailDto> {
    // 빈 문자열은 404 (별도 400 없음 - REQ-PROG-DETAIL-002)
    if (typeof id !== 'string' || id.length === 0) {
      throw new NotFoundException('Program not found');
    }

    const program = await this.prisma.program.findUnique({
      where: { id },
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

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    // AI_GENERATED는 createdBy === userId만 접근 가능
    if (program.type === ProgramType.AI_GENERATED && program.createdBy !== userId) {
      throw new NotFoundException('Program not found');
    }

    return toProgramDetail(program);
  }

  // @MX:ANCHOR: SPEC-PROGRAM-001 REQ-PROG-ACTIVE-006 REQ-PROG-ACTIVE-007
  // @MX:REASON: 활성 프로그램 조회 - null 응답이 200으로 처리되는 분기 핵심
  async getActive(userId: string): Promise<ActiveProgramResponseDto> {
    const userProgram = await this.prisma.userProgram.findUnique({
      where: { userId },
      include: {
        program: {
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
        },
      },
    });

    if (!userProgram) return { active: null };
    return { active: toProgramDetail(userProgram.program) };
  }

  // @MX:ANCHOR: SPEC-PROGRAM-001 REQ-PROG-ACTIVE-001 REQ-PROG-ACTIVE-002
  // @MX:WARN: race condition — Prisma upsert가 @@unique([userId])에 대해 INSERT ON CONFLICT로 처리
  // @MX:REASON: UserProgram.@@unique([userId])로 단일 활성 프로그램 보장
  async activate(
    userId: string,
    programId: string,
  ): Promise<{ response: ActivateProgramResponseDto; isNew: boolean }> {
    // 프로그램 존재 검증 (없으면 404)
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
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

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    // AI_GENERATED는 본인이 만든 것만 활성화 가능
    if (program.type === ProgramType.AI_GENERATED && program.createdBy !== userId) {
      throw new ForbiddenException('Cannot activate this program');
    }

    const existing = await this.prisma.userProgram.findUnique({
      where: { userId },
    });
    const isNew = existing === null;

    const userProgram = await this.prisma.userProgram.upsert({
      where: { userId },
      create: { userId, programId },
      update: { programId, startedAt: new Date() },
    });

    return {
      response: {
        id: userProgram.id,
        userId: userProgram.userId,
        programId: userProgram.programId,
        startedAt: userProgram.startedAt.toISOString(),
        program: toProgramDetail(program),
      },
      isNew,
    };
  }

  // @MX:ANCHOR: SPEC-PROGRAM-001 REQ-PROG-ACTIVE-004 REQ-PROG-ACTIVE-005
  // @MX:REASON: 멱등 해제 - deleteMany로 0건도 정상 처리
  async deactivate(userId: string): Promise<void> {
    await this.prisma.userProgram.deleteMany({ where: { userId } });
  }
}
