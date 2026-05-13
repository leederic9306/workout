import { Test, TestingModule } from '@nestjs/testing';
import { BodyCompositionController } from './body-composition.controller';
import { BodyCompositionService } from './body-composition.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const buildServiceMock = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  remove: jest.fn(),
});

type ServiceMock = ReturnType<typeof buildServiceMock>;

describe('BodyCompositionController', () => {
  let controller: BodyCompositionController;
  let serviceMock: ServiceMock;
  const user = { sub: 'user-1' } as any;

  beforeEach(async () => {
    serviceMock = buildServiceMock();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BodyCompositionController],
      providers: [
        { provide: BodyCompositionService, useValue: serviceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(BodyCompositionController);
  });

  it('create: user.sub와 dto를 service.create에 위임', async () => {
    const dto = { weight: 75 } as any;
    serviceMock.create.mockResolvedValue({ id: 'bc-1' });
    const result = await controller.create(user, dto);
    expect(serviceMock.create).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'bc-1' });
  });

  it('findAll: user.sub와 query를 service.findAll에 위임', async () => {
    const query = { limit: 10 } as any;
    serviceMock.findAll.mockResolvedValue({ items: [], nextCursor: null });
    await controller.findAll(user, query);
    expect(serviceMock.findAll).toHaveBeenCalledWith('user-1', query);
  });

  it('remove: user.sub와 id를 service.remove에 위임 (반환값 없음)', async () => {
    serviceMock.remove.mockResolvedValue(undefined);
    const result = await controller.remove(user, 'bc-1');
    expect(serviceMock.remove).toHaveBeenCalledWith('user-1', 'bc-1');
    expect(result).toBeUndefined();
  });
});
