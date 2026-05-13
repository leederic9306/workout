import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBodyCompositionDto } from './dto/create-body-composition.dto';
import { ListBodyCompositionDto } from './dto/list-body-composition.dto';
import {
  BodyCompositionResponseDto,
  PaginatedBodyCompositionDto,
  toBodyCompositionResponse,
} from './dto/body-composition-response.dto';

// @MX:ANCHOR: [AUTO] 체성분 도메인 서비스 (생성/목록/삭제)
// @MX:REASON: SPEC-DASHBOARD-001 - 컨트롤러 3개 엔드포인트가 모두 호출 (fan_in >= 3)
@Injectable()
export class BodyCompositionService {
  constructor(private readonly prisma: PrismaService) {}

  // 체성분 기록 생성
  // REQ-DASH-BODY-009 ~ 013: weight 범위, muscleMass ≤ weight, recordedAt 미래 불가 검증
  async create(
    userId: string,
    dto: CreateBodyCompositionDto,
  ): Promise<BodyCompositionResponseDto> {
    // muscleMass ≤ weight 검증
    if (dto.muscleMass !== undefined && dto.muscleMass > dto.weight) {
      throw new BadRequestException(
        'muscleMass must be less than or equal to weight',
      );
    }

    // recordedAt 미래 시각 불가
    let recordedAt: Date | undefined = undefined;
    if (dto.recordedAt !== undefined) {
      const parsed = new Date(dto.recordedAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('recordedAt must be a valid ISO 8601 date');
      }
      if (parsed.getTime() > Date.now()) {
        throw new BadRequestException('recordedAt must not be in the future');
      }
      recordedAt = parsed;
    }

    const created = await this.prisma.bodyComposition.create({
      data: {
        userId,
        weight: dto.weight,
        muscleMass: dto.muscleMass ?? null,
        bodyFatPct: dto.bodyFatPct ?? null,
        ...(recordedAt ? { recordedAt } : {}),
      },
    });

    return toBodyCompositionResponse(created);
  }

  // 커서 페이지네이션 목록 — recordedAt DESC
  async findAll(
    userId: string,
    query: ListBodyCompositionDto,
  ): Promise<PaginatedBodyCompositionDto> {
    const limit = query.limit ?? 20;

    // cursor가 있으면 해당 시각보다 더 이전 데이터만 조회 (DESC 정렬에서 다음 페이지)
    const where: {
      userId: string;
      recordedAt?: { lt: Date };
    } = { userId };
    if (query.cursor) {
      const cursorDate = new Date(query.cursor);
      if (Number.isNaN(cursorDate.getTime())) {
        throw new BadRequestException('cursor must be a valid ISO 8601 date');
      }
      where.recordedAt = { lt: cursorDate };
    }

    // limit + 1 페치로 다음 페이지 존재 여부 판단
    const rows = await this.prisma.bodyComposition.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    let items = rows;
    if (rows.length > limit) {
      items = rows.slice(0, limit);
      nextCursor = items[items.length - 1].recordedAt.toISOString();
    }

    return {
      items: items.map(toBodyCompositionResponse),
      nextCursor,
    };
  }

  // 삭제 — 다른 사용자 소유 또는 존재하지 않으면 404 (OWASP A01: 정보 노출 방지)
  async remove(userId: string, id: string): Promise<void> {
    const result = await this.prisma.bodyComposition.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException(`BodyComposition ${id} not found`);
    }
  }
}
