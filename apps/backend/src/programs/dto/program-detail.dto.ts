import { ProgramType } from '@prisma/client';

export class ProgramExerciseDto {
  id!: string;
  exerciseId!: string;
  exerciseName!: string;
  orderIndex!: number;
  sets!: number;
  reps!: string;
  weightNote!: string | null;
}

export class ProgramDayDto {
  id!: string;
  dayNumber!: number;
  name!: string;
  exercises!: ProgramExerciseDto[];
}

export class ProgramDetailDto {
  id!: string;
  title!: string;
  description!: string;
  type!: ProgramType;
  level!: string;
  frequency!: number;
  createdBy!: string | null;
  isPublic!: boolean;
  days!: ProgramDayDto[];
  createdAt!: string;
  updatedAt!: string;
}

// Prisma → DTO 변환 함수
export function toProgramDetail(program: any): ProgramDetailDto {
  return {
    id: program.id,
    title: program.title,
    description: program.description,
    type: program.type,
    level: program.level,
    frequency: program.frequency,
    createdBy: program.createdBy,
    isPublic: program.isPublic,
    days: (program.days ?? [])
      .slice()
      .sort((a: any, b: any) => a.dayNumber - b.dayNumber)
      .map((d: any) => ({
        id: d.id,
        dayNumber: d.dayNumber,
        name: d.name,
        exercises: (d.exercises ?? [])
          .slice()
          .sort((a: any, b: any) => a.orderIndex - b.orderIndex)
          .map((ex: any) => ({
            id: ex.id,
            exerciseId: ex.exerciseId,
            exerciseName: ex.exercise?.name ?? '',
            orderIndex: ex.orderIndex,
            sets: ex.sets,
            reps: ex.reps,
            weightNote: ex.weightNote ?? null,
          })),
      })),
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
  };
}
