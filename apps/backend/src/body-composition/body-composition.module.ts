import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BodyCompositionController } from './body-composition.controller';
import { BodyCompositionService } from './body-composition.service';

@Module({
  imports: [PrismaModule],
  controllers: [BodyCompositionController],
  providers: [BodyCompositionService],
  exports: [BodyCompositionService],
})
export class BodyCompositionModule {}
