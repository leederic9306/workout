import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ExercisesModule } from './exercises/exercises.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { OneRepMaxModule } from './one-rep-max/one-rep-max.module';
import { ProgramsModule } from './programs/programs.module';
import { AiModule } from './ai/ai.module';
import { BodyCompositionModule } from './body-composition/body-composition.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ExercisesModule,
    WorkoutsModule,
    OneRepMaxModule,
    ProgramsModule,
    AiModule,
    BodyCompositionModule,
    DashboardModule,
  ],
})
export class AppModule {}
