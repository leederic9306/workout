import { Module } from '@nestjs/common';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}

// 외부 모듈(예: dashboard)에서 컴파운드 매핑을 재사용할 수 있도록 재노출
export { COMPOUND_EXERCISE_SLUG_MAP } from './compound-exercises';
