import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OneRepMaxController } from './one-rep-max.controller';
import { OneRepMaxService } from './one-rep-max.service';

@Module({
  imports: [PrismaModule],
  controllers: [OneRepMaxController],
  providers: [OneRepMaxService],
})
export class OneRepMaxModule {}
