import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class DlqService {
    private readonly logger = new Logger(DlqService.name);

    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue('resume-processing-dlq') private readonly dlqQueue: Queue,
        @InjectQueue('resume-processing') private readonly processingQueue: Queue
    ) { }

    async getDlqJobs(page = 1, limit = 20) {
        const start = (page - 1) * limit;
        const end = start + limit - 1;
        const jobs = await this.dlqQueue.getJobs(['waiting'], start, end);
        return {
            page,
            limit,
            total: await this.dlqQueue.count(),
            jobs: jobs.map((j) => ({
                id: j.id,
                name: j.name,
                data: j.data,
                timestamp: j.timestamp,
            })),
        };
    }

    async getDlqStats() {
        const [waiting, failed, completed, total] = await Promise.all([
            this.dlqQueue.getWaitingCount(),
            this.dlqQueue.getFailedCount(),
            this.dlqQueue.getCompletedCount(),
            this.dlqQueue.count(),
        ]);
        return {
            queueName: 'resume-processing-dlq',
            totalDeadJobs: total,
            breakdown: { waiting, failed, completed }
        }
    }
    async retryJob(dlqJobId: string) {
        const dlqJob = await this.dlqQueue.getJob(dlqJobId);
        if (!dlqJob) {
            throw new NotFoundException(`dlq job ${dlqJobId} not found`);
        }
        const data = dlqJob.data;
        await this.prisma.resume.update({
            where: { id: data.resumeId },
            data: { parseStatus: 'PROCESSING' },
        });

        const newJob = await this.processingQueue.add('resume-processing', {
            resumeId: data.resumeId,
            fileKey: data.fileKey,
            originalName: data.originalName,    
        },
            {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
        await dlqJob.remove();
        this.logger.log(`retried job ${dlqJobId} and moved to processing queue`);
        return {
            retryCount: newJob.attemptsMade,
            newJobId: newJob.id,
        }
    }

    async retryAll() {
        const jobs = await this.dlqQueue.getJobs(['waiting']);
        const results :Array<{id?:string,status:string,newJobId?:string,error?:string}>=[];
        for (const job of jobs) {
            try {
                const res = await this.retryJob(job.id!);
                results.push({ id: job.id, status: 'REPLAYED', newJobId: res.newJobId });
            } catch (err) {
                results.push({ id: job.id, status: 'FAILED', error: err.message });
            }
        }
        return {
            total: jobs.length,
            replayedCount: results.filter((r) => r.status === 'REPLAYED').length,
            results,
        };
    }

    async dismissJob(dlqJobId: string) {
        const dlqJob = await this.dlqQueue.getJob(dlqJobId);
        if (!dlqJob) {
            throw new NotFoundException(`Dead-letter job ${dlqJobId} not found`);
        }
        await dlqJob.remove();
        return { success: true, message: `Job ${dlqJobId} permanently discarded` };     
    }
}