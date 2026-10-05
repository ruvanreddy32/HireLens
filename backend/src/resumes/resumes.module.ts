import { Module } from '@nestjs/common';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MlModule } from 'src/ml/ml.module';
import { BullModule } from '@nestjs/bullmq';
import { ResumeProcessor } from './resume.processor';

@Module({
  imports: [BullModule.registerQueue({
    name:'resume-processing',
  }),
    MlModule],
  controllers: [ResumesController],
  providers: [ResumesService, PrismaService,ResumeProcessor],
  exports: [ResumesService],
})
export class ResumesModule {}
