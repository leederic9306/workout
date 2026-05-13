import { ProgramDetailDto } from './program-detail.dto';

export class ActivateProgramResponseDto {
  id!: string;
  userId!: string;
  programId!: string;
  startedAt!: string;
  program!: ProgramDetailDto;
}
