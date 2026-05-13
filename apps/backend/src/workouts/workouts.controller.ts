// @MX:WARN: [AUTO] 라우트 등록 순서 중요 — @Get('active')는 반드시 @Get(':id') 앞에 와야 함
// @MX:REASON: NestJS는 라우트를 등록 순서로 매칭하므로 ':id'가 먼저 오면 'active'가 id로 매칭됨
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { AddSetDto } from './dto/add-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '@workout/types';

@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  // 세션 생성 (이미 활성 세션이 있으면 409)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSessionDto,
  ) {
    return this.workoutsService.createSession(user.sub, dto);
  }

  // 활성 세션 조회 — 반드시 :id 라우트보다 먼저 정의
  @Get('active')
  async getActiveSession(@CurrentUser() user: JwtPayload) {
    return this.workoutsService.getActiveSession(user.sub);
  }

  // 세션 목록 (필터 + 페이지네이션)
  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListSessionsQueryDto,
  ) {
    return this.workoutsService.findAll(user.sub, query);
  }

  // 세션 상세
  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.workoutsService.findOne(user.sub, id);
  }

  // 세션 메타데이터 수정 (name/notes)
  @Patch(':id')
  async updateSession(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.workoutsService.updateSession(user.sub, id, dto);
  }

  // 세션 삭제
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.workoutsService.deleteSession(user.sub, id);
  }

  // 세션 완료
  @Post(':id/complete')
  async completeSession(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.workoutsService.completeSession(user.sub, id);
  }

  // 세트 추가
  @Post(':id/sets')
  @HttpCode(HttpStatus.CREATED)
  async addSet(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddSetDto,
  ) {
    return this.workoutsService.addSet(user.sub, id, dto);
  }

  // 세트 수정
  @Patch(':id/sets/:setId')
  async updateSet(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('setId') setId: string,
    @Body() dto: UpdateSetDto,
  ) {
    return this.workoutsService.updateSet(user.sub, id, setId, dto);
  }

  // 세트 삭제
  @Delete(':id/sets/:setId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSet(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('setId') setId: string,
  ) {
    await this.workoutsService.deleteSet(user.sub, id, setId);
  }
}
