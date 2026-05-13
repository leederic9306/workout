// @MX:WARN: 라우트 순서 중요 — catalog/active 고정 경로가 :id 동적 경로보다 반드시 먼저 정의되어야 함
// @MX:REASON: SPEC-PROGRAM-001 REQ-PROG-VAL-001; SPEC-EXERCISE-001 REQ-EX-FAV-012 선례 적용
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import type { JwtPayload } from '@workout/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProgramsService } from './programs.service';
import { CatalogResponseDto } from './dto/catalog-response.dto';
import { ProgramDetailDto } from './dto/program-detail.dto';
import { ActiveProgramResponseDto } from './dto/active-response.dto';
import { ActivateProgramResponseDto } from './dto/activate-response.dto';

@Controller('programs')
@UseGuards(JwtAuthGuard)
export class ProgramsController {
  constructor(private readonly service: ProgramsService) {}

  // 1. GET /programs/catalog — 고정 경로 (최우선)
  @Get('catalog')
  async getCatalog(): Promise<CatalogResponseDto> {
    return this.service.getCatalog();
  }

  // 2. GET /programs/active — 고정 경로
  @Get('active')
  async getActive(
    @CurrentUser() user: JwtPayload,
  ): Promise<ActiveProgramResponseDto> {
    return this.service.getActive(user.sub);
  }

  // 3. DELETE /programs/active — 고정 경로 (멱등 204)
  @Delete('active')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.service.deactivate(user.sub);
  }

  // 4. POST /programs/:id/activate — 신규=201, 갱신=200
  @Post(':id/activate')
  async activate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ActivateProgramResponseDto> {
    const { response, isNew } = await this.service.activate(user.sub, id);
    res.status(isNew ? HttpStatus.CREATED : HttpStatus.OK);
    return response;
  }

  // 5. GET /programs/:id — 동적 경로 (가장 마지막)
  @Get(':id')
  async getDetail(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ProgramDetailDto> {
    return this.service.getDetail(id, user.sub);
  }
}
