import { ProgramType } from '@prisma/client';

export class CatalogItemDto {
  id!: string;
  title!: string;
  description!: string;
  type!: ProgramType;
  level!: string;
  frequency!: number;
  dayCount!: number;
  exerciseSummary!: string;
  createdAt!: string;
}
