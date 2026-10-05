import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import 'multer';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const MAX_RESUMES = 5;

@Injectable()
export class ResumesService {
  private readonly logger = new Logger(ResumesService.name);

  constructor(
    @InjectQueue('resume-processing') private readonly resumeQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Upload & parse a new resume variant (Max 5 per user)
   */
  async uploadResume(
    userId: string,
    file: Express.Multer.File,
    data?: {
      title?: string;
      targetRole?: string;
      isPrimary?: boolean;
    },
  ) {
    // 1. Enforce max 5 resumes per job seeker
    const currentCount = await this.prisma.resume.count({ where: { userId } });
    if (currentCount >= MAX_RESUMES) {
      throw new BadRequestException(
        `Maximum limit of ${MAX_RESUMES} resumes reached. Please delete an older variant first.`,
      );
    }

    // 2. Save file to storage
    const stored = await this.storage.saveFile(file.buffer, file.originalname);

    const isFirst = currentCount === 0;
    const shouldBePrimary = isFirst || Boolean(data?.isPrimary);

    // If setting as primary, reset existing primaries
    if (shouldBePrimary) {
      await this.prisma.resume.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }

    const title =
      data?.title?.trim() ||
      file.originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    const resume = await this.prisma.resume.create({
      data: {
        userId,
        title,
        fileName: stored.fileName,
        fileUrl: stored.fileUrl,
        fileKey: stored.fileKey,
        fileSize: stored.fileSize,
        targetRole: data?.targetRole || null,
        isPrimary: shouldBePrimary,
        parseStatus: "PROCESSING",
        parsedData: undefined,
      },
    });
    await this.resumeQueue.add(
      'parse-resume',
      {
        resumeId:resume.id,
        fileKey:stored.fileKey,
        originalName:stored.fileName,
      },
      {
        attempts:3,
        backoff:{
          type:'exponential',
          delay:1000,
        },
        removeOnComplete:true,
        removeOnFail:false,
      },
    );
    this.logger.log(`Resume queued for parsing: ${resume.id}`);
    return resume;
  }

  /**
   * Get all resumes for job seeker
   */
  async getUserResumes(userId: string) {
    return this.prisma.resume.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Set a resume as primary
   */
  async setPrimaryResume(resumeId: string, userId: string) {
    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      throw new NotFoundException('Resume not found');
    }
    if (resume.userId !== userId) {
      throw new ForbiddenException('You do not have access to this resume');
    }

    // Reset all others
    await this.prisma.resume.updateMany({
      where: { userId },
      data: { isPrimary: false },
    });

    return this.prisma.resume.update({
      where: { id: resumeId },
      data: { isPrimary: true },
    });
  }

  /**
   * Delete a resume
   */
  async deleteResume(resumeId: string, userId: string) {
    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      throw new NotFoundException('Resume not found');
    }
    if (resume.userId !== userId) {
      throw new ForbiddenException('You do not have access to this resume');
    }

    // Delete file from disk
    if (resume.fileKey) {
      await this.storage.deleteFile(resume.fileKey);
    }

    await this.prisma.resume.delete({ where: { id: resumeId } });

    // If the deleted resume was primary, designate the latest remaining resume as primary
    if (resume.isPrimary) {
      const remaining = await this.prisma.resume.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (remaining) {
        await this.prisma.resume.update({
          where: { id: remaining.id },
          data: { isPrimary: true },
        });
      }
    }

    return { success: true, message: 'Resume deleted successfully' };
  }

  /**
   * Stream or generate pre-signed URL for resume PDF
   */
  async getResumeFile(resumeId: string, userId: string) {
    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      throw new NotFoundException('Resume not found');
    }
    if (resume.userId !== userId) {
      throw new ForbiddenException('You do not have access to this resume');
    }

    if (!resume.fileKey) {
      throw new NotFoundException('Resume file not found in storage');
    }

    if (this.storage.isS3Enabled) {
      const presignedUrl = await this.storage.getPresignedViewUrl(resume.fileKey);
      return { presignedUrl, isS3: true, fileName: resume.fileName };
    }

    if (!this.storage.fileExists(resume.fileKey)) {
      throw new NotFoundException('Resume file not found in storage');
    }

    const stream = await this.storage.getFileStream(resume.fileKey);
    return { stream, isS3: false, fileName: resume.fileName };
  }
}
