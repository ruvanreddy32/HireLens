import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BullModule } from '@nestjs/bullmq';
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'resume-processing',
    }),
  ],
  controllers: [JobsController],
  providers: [JobsService, PrismaService],
})
export class JobsModule {}
