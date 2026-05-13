import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '@workout/types';
import { UserRole } from '@workout/types';

const buildServiceMock = () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  addFavorite: jest.fn(),
  removeFavorite: jest.fn(),
  findFavorites: jest.fn(),
});

const buildResMock = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildUser = (sub = 'user-1'): JwtPayload => ({
  sub,
  role: UserRole.USER,
  onboardingCompleted: true,
});

describe('ExercisesController', () => {
  let controller: ExercisesController;
  let service: ReturnType<typeof buildServiceMock>;

  beforeEach(async () => {
    service = buildServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExercisesController],
      providers: [{ provide: ExercisesService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExercisesController>(ExercisesController);
  });

  describe('route registration order (AC-FAV-LIST-04)', () => {
    // 'favorites' 라우트가 ':id' 라우트보다 먼저 등록되어야 함
    it("@Get('favorites')가 @Get(':id')보다 먼저 정의되어야 한다", () => {
      // 컨트롤러 메서드 정의 순서 검증 (NestJS는 메서드 데코레이터 등록 순서대로 매칭)
      const proto = ExercisesController.prototype;
      const methods = Object.getOwnPropertyNames(proto).filter(
        (n) => n !== 'constructor',
      );
      const favIdx = methods.indexOf('getFavorites');
      const oneIdx = methods.indexOf('getOne');
      expect(favIdx).toBeGreaterThanOrEqual(0);
      expect(oneIdx).toBeGreaterThanOrEqual(0);
      expect(favIdx).toBeLessThan(oneIdx);
    });
  });

  describe('addFavorite', () => {
    it('신규 즐겨찾기 시 201 CREATED를 반환한다', async () => {
      const res = buildResMock();
      service.addFavorite.mockResolvedValue({
        dto: { exerciseId: 'ex-1', favoritedAt: '2026-05-12T10:00:00.000Z' },
        created: true,
      });

      await controller.addFavorite('ex-1', buildUser(), res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(res.json).toHaveBeenCalledWith({
        exerciseId: 'ex-1',
        favoritedAt: '2026-05-12T10:00:00.000Z',
      });
    });

    it('기존 즐겨찾기 시 200 OK를 반환한다 (멱등)', async () => {
      const res = buildResMock();
      service.addFavorite.mockResolvedValue({
        dto: { exerciseId: 'ex-1', favoritedAt: '2026-05-10T10:00:00.000Z' },
        created: false,
      });

      await controller.addFavorite('ex-1', buildUser(), res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    });

    it('서비스에 user.sub를 전달한다', async () => {
      const res = buildResMock();
      service.addFavorite.mockResolvedValue({
        dto: { exerciseId: 'ex-1', favoritedAt: 'x' },
        created: true,
      });

      await controller.addFavorite('ex-1', buildUser('user-XYZ'), res);

      expect(service.addFavorite).toHaveBeenCalledWith('user-XYZ', 'ex-1');
    });
  });

  describe('removeFavorite', () => {
    it('204 NO_CONTENT 처리 (메서드는 void 반환, 데코레이터로 상태코드 지정)', async () => {
      service.removeFavorite.mockResolvedValue(undefined);

      const result = await controller.removeFavorite('ex-1', buildUser());

      expect(result).toBeUndefined();
      expect(service.removeFavorite).toHaveBeenCalledWith('user-1', 'ex-1');
    });
  });

  describe('getFavorites', () => {
    it('사용자별 즐겨찾기 목록을 위임한다', async () => {
      const expected = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      service.findFavorites.mockResolvedValue(expected);

      const result = await controller.getFavorites(buildUser(), {
        page: 1,
        limit: 20,
      });

      expect(result).toBe(expected);
      expect(service.findFavorites).toHaveBeenCalledWith('user-1', {
        page: 1,
        limit: 20,
      });
    });
  });

  describe('getOne', () => {
    it('id와 user.sub를 서비스에 전달한다', async () => {
      service.findOne.mockResolvedValue({ id: 'ex-1' });

      await controller.getOne('ex-1', buildUser('user-Q'));

      expect(service.findOne).toHaveBeenCalledWith('ex-1', 'user-Q');
    });
  });

  describe('getAll', () => {
    it('쿼리와 user.sub를 서비스에 전달한다', async () => {
      service.findAll.mockResolvedValue({ items: [] });

      await controller.getAll(buildUser('user-A'), {
        page: 2,
        limit: 10,
        primaryMuscle: 'chest',
      });

      expect(service.findAll).toHaveBeenCalledWith(
        { page: 2, limit: 10, primaryMuscle: 'chest' },
        'user-A',
      );
    });
  });
});
