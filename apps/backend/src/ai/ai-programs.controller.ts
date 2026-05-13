import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { JwtPayload } from '@workout/types';
import { UserRole } from '@workout/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiProgramsService } from './ai-programs.service';
import { CreateAiProgramDto } from './dto/create-ai-program.dto';
import { ProgramDetailDto } from '../programs/dto/program-detail.dto';

@Controller('ai/programs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PREMIUM, UserRole.ADMIN)
export class AiProgramsController {
  constructor(private readonly service: AiProgramsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAiProgramDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ProgramDetailDto> {
    return this.service.create(user.sub, dto);
  }
}
