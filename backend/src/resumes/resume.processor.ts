import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { MlService } from 'src/ml/ml.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { ApplicationStatus } from '@prisma/client';

@Processor('resume-processing')
export class ResumeProcessor extends WorkerHost {
  private readonly logger = new Logger(ResumeProcessor.name);

  constructor(
    @InjectQueue('resume-processing-dlq') private readonly dlqQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly ml: MlService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    if (job.name === 'score-application') {
      return this.processApplication(job);
    }
    return this.processResume(job);
  }

  /**
   * Pipeline 1: Standalone Resume Parsing (Resume Manager upload)
   */
  private async processResume(
    job: Job<{ resumeId: string; fileKey: string; originalName: string }>,
  ) {
    const { resumeId, fileKey, originalName } = job.data;
    this.logger.log(
      `Processing resume parse job ${job.id} for resume ${resumeId} (Attempt ${job.attemptsMade + 1})`,
    );

    const fileStream = await this.storage.getFileStream(fileKey);
    const chunks: Buffer[] = [];
    for await (const chunk of fileStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const parsed = await this.ml.parseResume(buffer, originalName);
    if (!parsed || parsed.status === 'error') {
      const errorMsg =
        parsed?.message || 'ML service returned an invalid parse response';
      throw new Error(`Parse failed for resume ${resumeId}: ${errorMsg}`);
    }

    const parsedData = parsed?.candidate || parsed;

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

  /**
   * Pipeline 2: Job Application Scoring (Apply flow)
   */
  private async processApplication(
    job: Job<{
      applicationId: string;
      jobId: string;
      applicantId: string;
      resumeId?: string | null;
      fileKey: string;
      fileName: string;
    }>,
  ) {
    const { applicationId, jobId, resumeId, fileKey, fileName } = job.data;
    this.logger.log(
      `Evaluating application ${applicationId} for job ${jobId} (Attempt ${job.attemptsMade + 1})`,
    );

    const [application, jobRecord] = await Promise.all([
      this.prisma.jobApplication.findUnique({ where: { id: applicationId } }),
      this.prisma.job.findUnique({ where: { id: jobId } }),
    ]);

    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }
    if (!jobRecord) {
      throw new Error(`Job ${jobId} not found`);
    }

    const jdProfile = this.ml.jobToJdProfile(jobRecord);
    let parsedCandidate: any = null;
    let evaluation: any = null;

    // 1. If resume is already parsed, score-only (fast)
    if (resumeId) {
      const resume = await this.prisma.resume.findUnique({
        where: { id: resumeId },
      });
      if (
        resume?.parsedData &&
        typeof resume.parsedData === 'object' &&
        Object.keys(resume.parsedData as object).length > 0 &&
        (resume.parsedData as any).status !== 'error'
      ) {
        parsedCandidate = resume.parsedData;
        try {
          evaluation = await this.ml.scoreCandidate(parsedCandidate, jdProfile);
        } catch (err: any) {
          this.logger.warn(
            `Score-only call failed: ${err.message}. Retrying with full parse.`,
          );
        }
      }
    }

    // 2. If not yet evaluated, stream file & parseAndScore
    if (!evaluation) {
      const fileStream = await this.storage.getFileStream(fileKey);
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      const mlResult = await this.ml.parseAndScore(buffer, fileName, jdProfile);
      if (!mlResult || mlResult.status === 'error') {
        throw new Error(
          `ML parse-and-score failed: ${mlResult?.message || 'Empty response'}`,
        );
      }

      evaluation = mlResult?.evaluation || null;
      parsedCandidate = mlResult?.parsed_resume || null;

      // Backfill resume parsed data if linked
      if (resumeId && parsedCandidate) {
        await this.prisma.resume
          .update({
            where: { id: resumeId },
            data: {
              parsedData: parsedCandidate,
              parseStatus: 'COMPLETED',
            },
          })
          .catch((e) =>
            this.logger.warn(`Failed to backfill resume: ${e.message}`),
          );
      }
    }

    // 3. Extract 4-pillar scores
    const pillarScores = evaluation?.pillar_scores || {};
    const skillsScore =
      typeof pillarScores.skills === 'number' ? pillarScores.skills : 0;
    const experienceScore =
      typeof pillarScores.experience === 'number' ? pillarScores.experience : 0;
    const projectScore =
      typeof pillarScores.projects === 'number' ? pillarScores.projects : 0;
    const proofOfWorkScore =
      typeof pillarScores.proof_of_work === 'number'
        ? pillarScores.proof_of_work
        : 0;
    const isKnockedOut = Boolean(evaluation?.is_knocked_out);
    const knockedOutReasons = Array.isArray(evaluation?.knockout_reasons)
      ? evaluation.knockout_reasons
      : [];

    const existingParsed =
      (application.parsedInfo as Record<string, any>) || {};

    // 4. Update application status to APPLIED with scores
    await this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.APPLIED,
        skillsScore,
        experienceScore,
        projectScore,
        proofOfWorkScore,
        isKnockedOut,
        knockedOutReasons,
        parsedInfo: {
          ...existingParsed,
          ...(parsedCandidate || {}),
          evaluation: evaluation || null,
        },
      },
    });

    this.logger.log(
      `Application ${applicationId} successfully scored and transitioned to APPLIED`,
    );
    return { success: true };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<any> | undefined, error: Error) {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Maximum attempts (${maxAttempts}) reached for job ${job.id} (${job.name})`,
      );

      // Route failed job to DLQ
      await this.dlqQueue.add(
        'dlq-letter-resume',
        {
          originalJobId: job.id,
          jobName: job.name,
          jobData: job.data,
          failedReason: error.message,
          stackTrace: error.stack,
          failedAt: new Date().toISOString(),
        },
        { removeOnComplete: true, removeOnFail: false },
      );

      // Handle fallback database updates depending on job type
      if (job.name === 'score-application') {
        await this.prisma.jobApplication
          .update({
            where: { id: job.data.applicationId },
            data: {
              status: ApplicationStatus.APPLIED,
              parsedInfo: {
                scoringError: error.message,
                failedAt: new Date().toISOString(),
              },
            },
          })
          .catch((e) =>
            this.logger.warn(
              `Failed to update application fallback status: ${e.message}`,
            ),
          );
      } else {
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
          .catch((e) =>
            this.logger.warn(`Failed to update resume status: ${e.message}`),
          );
      }
    } else {
      this.logger.warn(
        `Job ${job.id} (${job.name}) failed attempt ${job.attemptsMade}/${maxAttempts}: ${error.message}. Scheduling retry...`,
      );
    }
  }
}
