import { Module } from '@nestjs/common';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MlModule } from 'src/ml/ml.module';
import { BullModule } from '@nestjs/bullmq';
import { ResumeProcessor } from './resume.processor';
import { AdminDlqController } from './admin-dlq.controller';
import { DlqService } from './dlq.service';

@Module({
  imports: [BullModule.registerQueue(
    {name:'resume-processing'},
    {name:'resume-processing-dlq'}
  ),
    MlModule],
  controllers: [ResumesController,AdminDlqController],
  providers: [ResumesService, PrismaService,ResumeProcessor,DlqService],
  exports: [ResumesService,DlqService], 
})
export class ResumesModule {}
