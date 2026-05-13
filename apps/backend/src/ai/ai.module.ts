import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AiProgramsController } from './ai-programs.controller';
import { AiProgramsService } from './ai-programs.service';
import { OpenAiClient } from './openai.client';
import { AiValidationService } from './ai-validation.service';

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule],
  controllers: [AiProgramsController],
  providers: [AiProgramsService, OpenAiClient, AiValidationService],
})
export class AiModule {}
