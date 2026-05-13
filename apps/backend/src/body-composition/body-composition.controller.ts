import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { JwtPayload } from '@workout/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BodyCompositionService } from './body-composition.service';
import { CreateBodyCompositionDto } from './dto/create-body-composition.dto';
import { ListBodyCompositionDto } from './dto/list-body-composition.dto';
import {
  BodyCompositionResponseDto,
  PaginatedBodyCompositionDto,
} from './dto/body-composition-response.dto';

@Controller('users/me/body-composition')
@UseGuards(JwtAuthGuard)
export class BodyCompositionController {
  constructor(private readonly service: BodyCompositionService) {}

  // 체성분 기록 생성
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBodyCompositionDto,
  ): Promise<BodyCompositionResponseDto> {
    return this.service.create(user.sub, dto);
  }

  // 체성분 목록 (커서 페이지네이션)
  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListBodyCompositionDto,
  ): Promise<PaginatedBodyCompositionDto> {
    return this.service.findAll(user.sub, query);
  }

  // 체성분 삭제 — 본인 소유만 (404 응답으로 정보 노출 방지)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(user.sub, id);
  }
}
