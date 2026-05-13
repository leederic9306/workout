import { Test, TestingModule } from '@nestjs/testing';
import { SessionStatus } from '@prisma/client';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// WorkoutsService 모의 — 모든 메서드를 jest.fn()으로 대체
const buildServiceMock = () => ({
  createSession: jest.fn(),
  getActiveSession: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
  completeSession: jest.fn(),
  addSet: jest.fn(),
  updateSet: jest.fn(),
  deleteSet: jest.fn(),
});

type ServiceMock = ReturnType<typeof buildServiceMock>;

describe('WorkoutsController', () => {
  let controller: WorkoutsController;
  let serviceMock: ServiceMock;

  // CurrentUser 데코레이터가 주입하는 JwtPayload 형태
  const user = { sub: 'user-1', email: 'u@example.com' } as any;
  const SESSION_ID = 'session-1';
  const SET_ID = 'set-1';

  beforeEach(async () => {
    serviceMock = buildServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkoutsController],
      providers: [{ provide: WorkoutsService, useValue: serviceMock }],
    })
      // JwtAuthGuard 무력화 (인증 통과)
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WorkoutsController>(WorkoutsController);
  });

  describe('createSession', () => {
    it('user.sub와 dto를 service.createSession에 위임', async () => {
      const dto = { name: '아침 운동' };
      const expected = { id: SESSION_ID };
      serviceMock.createSession.mockResolvedValue(expected);

      const result = await controller.createSession(user, dto);

      expect(serviceMock.createSession).toHaveBeenCalledWith(user.sub, dto);
      expect(result).toBe(expected);
    });
  });

  describe('getActiveSession', () => {
    it('user.sub로 service.getActiveSession 호출', async () => {
      const expected = { active: null };
      serviceMock.getActiveSession.mockResolvedValue(expected);

      const result = await controller.getActiveSession(user);

      expect(serviceMock.getActiveSession).toHaveBeenCalledWith(user.sub);
      expect(result).toBe(expected);
    });
  });

  describe('findAll', () => {
    it('user.sub와 query를 service.findAll에 위임', async () => {
      const query = { page: 1, limit: 10, status: SessionStatus.COMPLETED };
      const expected = {
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };
      serviceMock.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(user, query as any);

      expect(serviceMock.findAll).toHaveBeenCalledWith(user.sub, query);
      expect(result).toBe(expected);
    });
  });

  describe('findOne', () => {
    it('user.sub와 id를 service.findOne에 위임', async () => {
      const expected = { id: SESSION_ID };
      serviceMock.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(user, SESSION_ID);

      expect(serviceMock.findOne).toHaveBeenCalledWith(user.sub, SESSION_ID);
      expect(result).toBe(expected);
    });
  });

  describe('updateSession', () => {
    it('user.sub, id, dto를 service.updateSession에 위임', async () => {
      const dto = { name: '저녁 운동' };
      const expected = { id: SESSION_ID };
      serviceMock.updateSession.mockResolvedValue(expected);

      const result = await controller.updateSession(user, SESSION_ID, dto);

      expect(serviceMock.updateSession).toHaveBeenCalledWith(
        user.sub,
        SESSION_ID,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('deleteSession', () => {
    it('user.sub와 id를 service.deleteSession에 위임 (반환값 없음)', async () => {
      serviceMock.deleteSession.mockResolvedValue(undefined);

      const result = await controller.deleteSession(user, SESSION_ID);

      expect(serviceMock.deleteSession).toHaveBeenCalledWith(
        user.sub,
        SESSION_ID,
      );
      expect(result).toBeUndefined();
    });
  });

  describe('completeSession', () => {
    it('user.sub와 id를 service.completeSession에 위임', async () => {
      const expected = { id: SESSION_ID, status: SessionStatus.COMPLETED };
      serviceMock.completeSession.mockResolvedValue(expected);

      const result = await controller.completeSession(user, SESSION_ID);

      expect(serviceMock.completeSession).toHaveBeenCalledWith(
        user.sub,
        SESSION_ID,
      );
      expect(result).toBe(expected);
    });
  });

  describe('addSet', () => {
    it('user.sub, id, dto를 service.addSet에 위임', async () => {
      const dto = { exerciseId: 'ex-1', setNumber: 1, reps: 5, weight: 100 };
      const expected = { id: SET_ID };
      serviceMock.addSet.mockResolvedValue(expected);

      const result = await controller.addSet(user, SESSION_ID, dto);

      expect(serviceMock.addSet).toHaveBeenCalledWith(
        user.sub,
        SESSION_ID,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('updateSet', () => {
    it('user.sub, id, setId, dto를 service.updateSet에 위임', async () => {
      const dto = { reps: 6 };
      const expected = { id: SET_ID };
      serviceMock.updateSet.mockResolvedValue(expected);

      const result = await controller.updateSet(user, SESSION_ID, SET_ID, dto);

      expect(serviceMock.updateSet).toHaveBeenCalledWith(
        user.sub,
        SESSION_ID,
        SET_ID,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('deleteSet', () => {
    it('user.sub, id, setId를 service.deleteSet에 위임 (반환값 없음)', async () => {
      serviceMock.deleteSet.mockResolvedValue(undefined);

      const result = await controller.deleteSet(user, SESSION_ID, SET_ID);

      expect(serviceMock.deleteSet).toHaveBeenCalledWith(
        user.sub,
        SESSION_ID,
        SET_ID,
      );
      expect(result).toBeUndefined();
    });
  });
});
