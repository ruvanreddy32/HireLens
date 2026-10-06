import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { MlService } from "src/ml/ml.service";
import { PrismaService } from "src/prisma/prisma.service";
import { StorageService } from "src/storage/storage.service";

@Processor('resume-processing')
export class ResumeProcessor extends WorkerHost {
  private readonly logger = new Logger(ResumeProcessor.name);
  constructor(
    @InjectQueue('resume-processing-dlq') private readonly dlqQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly ml: MlService,
    private readonly storage: StorageService,

  ) { super(); }
  async process(job: Job<{ resumeId: string; fileKey: string; originalName: string }>): Promise<any> {
    const { resumeId, fileKey, originalName } = job.data;
    this.logger.log(`Processing job ${job.id} for resume ${resumeId} (Attempt ${job.attemptsMade + 1})`);


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
  }
  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ resumeId: string; fileKey: string; originalName: string }> | undefined, error: Error) {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    const attemptsMade = job.attemptsMade;
    if (attemptsMade >= maxAttempts) {
      this.logger.error(`Maximum attempts (${maxAttempts}) reached for job ${job.id}`);

      await this.dlqQueue.add('dlq-letter-resume', {
        originalJobId: job.id,
        resumeId: job.data.resumeId,
        fileKey: job.data.fileKey,
        originalName: job.data.originalName,
        attemptsMade: job.attemptsMade,
        failedReason: error.message,
        stackTrace: error.stack,
        failedAt: new Date().toISOString(),
      },
        { removeOnComplete: true, removeOnFail: false }
      );

      await this.prisma.resume
        .update({
          where: { id: job.data.resumeId },
          data: {
            parseStatus: 'FAILED',
            parsedData: {
              parseError: error.message,
              failedAt: new Date().toISOString(),
              attemptsMade: job.attemptsMade,
            },
          },
        })
        .catch((e) => this.logger.warn(`Failed to update resume status: ${e.message}`));
    } else {
      this.logger.warn(
        `Job ${job.id} for resume ${job.data.resumeId} failed attempt ${job.attemptsMade}/${maxAttempts}: ${error.message}. Scheduling exponential backoff retry...`,
      );
    }
  }

}

