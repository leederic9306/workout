import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_LEVELS = ['beginner', 'intermediate', 'advanced'];
const REPS_REGEX = /^\d+(-\d+)?$/;

export interface ValidatedProgram {
  title: string;
  description: string;
  level: string;
  days: Array<{
    dayNumber: number;
    name: string;
    exercises: Array<{
      exerciseId: string;
      orderIndex: number;
      sets: number;
      reps: string;
      weightNote: string | null;
    }>;
  }>;
}

@Injectable()
export class AiValidationService {
  constructor(private readonly prisma: PrismaService) {}

  // @MX:ANCHOR: SPEC-PROGRAM-001 REQ-PROG-AI-005
  // @MX:NOTE: 7단계 검증 순서: 파싱 → 스키마 → daysPerWeek → sets → reps → level → exerciseId 실존
  async validate(
    rawJson: unknown,
    expectedDaysPerWeek: number,
  ): Promise<ValidatedProgram> {
    // 2. 스키마 검증
    if (typeof rawJson !== 'object' || rawJson === null) {
      throw new UnprocessableEntityException('AI 응답이 객체가 아닙니다');
    }
    const obj = rawJson as any;

    if (typeof obj.title !== 'string' || obj.title.length === 0) {
      throw new UnprocessableEntityException('title 필드 누락 또는 잘못된 형식');
    }
    if (typeof obj.description !== 'string') {
      throw new UnprocessableEntityException('description 필드 누락');
    }
    if (typeof obj.level !== 'string') {
      throw new UnprocessableEntityException('level 필드 누락');
    }
    if (!Array.isArray(obj.days) || obj.days.length === 0) {
      throw new UnprocessableEntityException('days 배열 누락');
    }

    // 3. daysPerWeek 일치 검증
    if (obj.days.length !== expectedDaysPerWeek) {
      throw new UnprocessableEntityException(
        `요청 daysPerWeek=${expectedDaysPerWeek}와 응답 days.length=${obj.days.length} 불일치`,
      );
    }

    // 6. level enum 검증
    if (!ALLOWED_LEVELS.includes(obj.level)) {
      throw new UnprocessableEntityException(
        `level은 ${ALLOWED_LEVELS.join('|')} 중 하나여야 함`,
      );
    }

    // exerciseId 수집
    const allExerciseIds = new Set<string>();
    for (const day of obj.days) {
      if (typeof day !== 'object' || day === null) {
        throw new UnprocessableEntityException('day가 객체가 아님');
      }
      if (typeof day.dayNumber !== 'number' || typeof day.name !== 'string') {
        throw new UnprocessableEntityException('day.dayNumber/name 형식 오류');
      }
      if (!Array.isArray(day.exercises)) {
        throw new UnprocessableEntityException('day.exercises 배열 누락');
      }
      for (const ex of day.exercises) {
        if (typeof ex !== 'object' || ex === null) {
          throw new UnprocessableEntityException('exercise가 객체가 아님');
        }
        // 4. sets 검증 [1-10]
        if (typeof ex.sets !== 'number' || ex.sets < 1 || ex.sets > 10) {
          throw new UnprocessableEntityException('sets는 1~10 사이 정수여야 함');
        }
        // 5. reps regex
        if (typeof ex.reps !== 'string' || !REPS_REGEX.test(ex.reps)) {
          throw new UnprocessableEntityException(
            `reps 형식 오류: ${ex.reps} (예: "5" 또는 "8-12")`,
          );
        }
        if (typeof ex.exerciseId !== 'string') {
          throw new UnprocessableEntityException('exerciseId 누락');
        }
        if (typeof ex.orderIndex !== 'number') {
          throw new UnprocessableEntityException('orderIndex 누락');
        }
        allExerciseIds.add(ex.exerciseId);
      }
    }

    // 7. exerciseId 실존 검증
    const found = await this.prisma.exercise.findMany({
      where: { id: { in: Array.from(allExerciseIds) } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((e) => e.id));
    for (const id of allExerciseIds) {
      if (!foundIds.has(id)) {
        throw new UnprocessableEntityException(
          `존재하지 않는 exerciseId: ${id}`,
        );
      }
    }

    return obj as ValidatedProgram;
  }
}
