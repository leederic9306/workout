// @MX:WARN: [AUTO] 라우트 등록 순서가 중요 — @Get('favorites')는 반드시 @Get(':id') 앞에 와야 함
// @MX:REASON: NestJS는 라우트를 등록 순서대로 매칭하므로 ':id'가 먼저 오면 'favorites'가 id로 잡힘 (AC-FAV-LIST-04)
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ExercisesService } from './exercises.service';
import { ListExercisesQueryDto } from './dto/list-exercises-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '@workout/types';

@Controller('exercises')
@UseGuards(JwtAuthGuard)
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  // 즐겨찾기 목록 — 반드시 :id 라우트보다 먼저 정의
  @Get('favorites')
  async getFavorites(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListExercisesQueryDto,
  ) {
    return this.exercisesService.findFavorites(user.sub, query);
  }

  @Get(':id')
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.exercisesService.findOne(id, user.sub);
  }

  // 즐겨찾기 추가: 신규=201, 기존=200
  @Post(':id/favorites')
  async addFavorite(
    @Param('id') exerciseId: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const { dto, created } = await this.exercisesService.addFavorite(
      user.sub,
      exerciseId,
    );
    return res
      .status(created ? HttpStatus.CREATED : HttpStatus.OK)
      .json(dto);
  }

  // 즐겨찾기 제거: 204 (멱등)
  @Delete(':id/favorites')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFavorite(
    @Param('id') exerciseId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.exercisesService.removeFavorite(user.sub, exerciseId);
  }

  @Get()
  async getAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListExercisesQueryDto,
  ) {
    return this.exercisesService.findAll(query, user.sub);
  }
}
