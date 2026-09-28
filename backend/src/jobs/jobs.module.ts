import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MlModule } from 'src/ml/ml.module';

@Module({
  imports:[MlModule],
  controllers: [JobsController],
  providers: [JobsService,PrismaService]
})
export class JobsModule {}
