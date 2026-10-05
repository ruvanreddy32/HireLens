import { Module } from '@nestjs/common';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MlModule } from 'src/ml/ml.module';

@Module({
  imports: [MlModule],
  controllers: [ResumesController],
  providers: [ResumesService, PrismaService],
  exports: [ResumesService],
})
export class ResumesModule {}
