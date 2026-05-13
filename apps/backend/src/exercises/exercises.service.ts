import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListExercisesQueryDto } from './dto/list-exercises-query.dto';
import { ExerciseDetailDto } from './dto/exercise-detail.dto';
import { PaginatedExercisesResponseDto } from './dto/paginated-exercises-response.dto';
import { FavoriteToggleResponseDto } from './dto/favorite-toggle-response.dto';

// @MX:ANCHOR: [AUTO] 운동 라이브러리 서비스 (목록/상세/즐겨찾기)
// @MX:REASON: 컨트롤러 5개 엔드포인트가 모두 호출하는 핵심 도메인 서비스 (fan_in >= 5)
@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  // 운동 목록 조회 (페이지네이션 + 필터 + 즐겨찾기 여부)
  async findAll(
    query: ListExercisesQueryDto,
    userId: string,
  ): Promise<PaginatedExercisesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [
        query.primaryMuscle
          ? { primaryMuscles: { has: query.primaryMuscle } }
          : {},
        query.equipment ? { equipment: query.equipment } : {},
      ],
    };

    const [exercises, total] = await Promise.all([
      this.prisma.exercise.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          favoritedBy: {
            where: { userId },
            select: { id: true },
          },
        },
      }),
      this.prisma.exercise.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items: exercises.map((ex: any) => ({
        id: ex.id,
        name: ex.name,
        primaryMuscles: ex.primaryMuscles,
        equipment: ex.equipment,
        category: ex.category,
        level: ex.level,
        images: ex.images.length > 0 ? [ex.images[0]] : [],
        isFavorite: ex.favoritedBy.length > 0,
      })),
      total,
      page,
      limit,
      totalPages,
    };
  }

  // 운동 상세 조회 (404 throw)
  async findOne(id: string, userId: string): Promise<ExerciseDetailDto> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
      include: {
        favoritedBy: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with id ${id} not found`);
    }

    return {
      id: exercise.id,
      name: exercise.name,
      force: exercise.force,
      level: exercise.level,
      mechanic: exercise.mechanic,
      equipment: exercise.equipment,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: exercise.secondaryMuscles,
      instructions: exercise.instructions,
      category: exercise.category,
      images: exercise.images,
      isFavorite: (exercise as any).favoritedBy.length > 0,
    };
  }

  // 즐겨찾기 추가 (멱등: 기존 존재 시 created=false)
  async addFavorite(
    userId: string,
    exerciseId: string,
  ): Promise<{ dto: FavoriteToggleResponseDto; created: boolean }> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });
    if (!exercise) {
      throw new NotFoundException(
        `Exercise with id ${exerciseId} not found`,
      );
    }

    const existing = await this.prisma.userExerciseFavorite.findUnique({
      where: { userId_exerciseId: { userId, exerciseId } },
    });

    if (existing) {
      return {
        dto: {
          exerciseId,
          favoritedAt: existing.favoritedAt.toISOString(),
        },
        created: false,
      };
    }

    const record = await this.prisma.userExerciseFavorite.create({
      data: { userId, exerciseId },
    });

    return {
      dto: { exerciseId, favoritedAt: record.favoritedAt.toISOString() },
      created: true,
    };
  }

  // 즐겨찾기 제거 (멱등: 존재하지 않아도 throw 안 함)
  async removeFavorite(userId: string, exerciseId: string): Promise<void> {
    await this.prisma.userExerciseFavorite.deleteMany({
      where: { userId, exerciseId },
    });
  }

  // 사용자별 즐겨찾기 목록 (favoritedAt DESC)
  async findFavorites(
    userId: string,
    query: ListExercisesQueryDto,
  ): Promise<PaginatedExercisesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      this.prisma.userExerciseFavorite.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { favoritedAt: 'desc' },
        include: { exercise: true },
      }),
      this.prisma.userExerciseFavorite.count({ where: { userId } }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items: favorites.map((fav: any) => ({
        id: fav.exercise.id,
        name: fav.exercise.name,
        primaryMuscles: fav.exercise.primaryMuscles,
        equipment: fav.exercise.equipment,
        category: fav.exercise.category,
        level: fav.exercise.level,
        images:
          fav.exercise.images.length > 0 ? [fav.exercise.images[0]] : [],
        isFavorite: true,
      })),
      total,
      page,
      limit,
      totalPages,
    };
  }
}
