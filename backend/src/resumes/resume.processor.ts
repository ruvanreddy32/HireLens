import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { MlService } from "src/ml/ml.service";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

@Processor('resume-processing')
export class ResumeProcessor extends WorkerHost{
    private readonly logger=new Logger(ResumeProcessor.name);
    constructor(
        private readonly prisma:PrismaService,
        private readonly ml:MlService,
        private readonly storage:StorageService,

    ){super();}
    async process(job: Job<{ resumeId: string; fileKey: string; originalName: string }>): Promise<any> {
        const { resumeId, fileKey, originalName } = job.data;
        this.logger.log(`Processing job ${job.id} for resume ${resumeId}`);
        try {
          // 1. Get file stream from Storage (S3 or local)
          const fileStream = await this.storage.getFileStream(fileKey);
          
          // Convert stream to Buffer
          const chunks: Buffer[] = [];
          for await (const chunk of fileStream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const buffer = Buffer.concat(chunks);
          // 2. Call ML Service
          const parsed = await this.ml.parseResume(buffer, originalName);
          const parsedData = parsed?.candidate || parsed || null;
          // 3. Update database record with parsed data
          await this.prisma.resume.update({
            where: { id: resumeId },
            data: {
              parsedData,
              parseStatus: 'COMPLETED',
            },
          });
          this.logger.log(`Successfully parsed resume ${resumeId}`);
          return { success: true };
        } catch (error) {
          this.logger.error(`Failed to process resume ${resumeId}: ${error.message}`);
          // Mark as failed in DB
          await this.prisma.resume.update({
            where: { id: resumeId },
            data: { parseStatus: 'FAILED' },
          }).catch(() => null);
          throw error; // Re-throw so BullMQ records retry/failure
        }
      }

}