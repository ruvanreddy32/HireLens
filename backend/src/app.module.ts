import { Module, NestModule } from '@nestjs/common';
import { MiddlewareConsumer } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';
import { MlModule } from './ml/ml.module';
import { LoggerMiddleWare } from './common/middleware/logger.middleware';
import { StorageModule } from './storage/storage.module';
import { ResumesModule } from './resumes/resumes.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [ BullModule.forRoot({
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  }),
    AuthModule, PrismaModule, StorageModule, JobsModule, MlModule, ResumesModule],
  controllers: [],
  providers: [],
})
export class AppModule{
  // configure(consumer: MiddlewareConsumer) {
  //   consumer.apply(LoggerMiddleWare).forRoutes('*');
  // }
}
