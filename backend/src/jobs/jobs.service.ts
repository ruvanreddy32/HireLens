import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { createJobInput } from './schema/create-job.schema';
import { updateJobInput } from './schema/update-job.schema';
import 'multer';
import { ApplicationStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue('resume-processing') private readonly resumeQueue: Queue,
  ) {}

  async createJob(recruiterId: string, data: createJobInput) {
    const status =
      data.status ?? (data.isActive === false ? 'PAUSED' : 'ACTIVE');
    const isActive = status === 'ACTIVE';

    return this.prisma.job.create({
      data: {
        recruiterId,
        title: data.title,
        description: data.description ?? '',
        location: data.location ?? '',
        workMode: data.workMode ?? 'HYBRID',
        employmentType: data.employmentType ?? 'FULL_TIME',
        minExperience: data.minExperience ?? 0,
        maxExperience: data.maxExperience,
        education: data.education,
        requiredSkills: data.requiredSkills ?? [],
        preferredSkills: data.preferredSkills ?? [],
        minSalary: data.minSalary,
        maxSalary: data.maxSalary,
        status,
        isActive,
      },
    });
  }

  async getRecruiterJobs(recruiterId: string) {
    return this.prisma.job.findMany({
      where: {
        recruiterId,
      },
      include: {
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getActiveJobs() {
    return this.prisma.job.findMany({
      where: {
        status: 'ACTIVE',
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getJob(
    jobId: string,
    user: {
      userId: string;
      email: string;
      role: string;
    },
  ) {
    const job = await this.prisma.job.findUnique({
      where: {
        id: jobId,
      },
    });
    if (!job) {
      throw new NotFoundException('job not found');
    }
    if (user.role === 'JOB_SEEKER') {
      if (job.status === 'DRAFT') {
        throw new NotFoundException('job not found');
      }
      return job;
    }
    if (user.role === 'RECRUITER') {
      if (job.recruiterId !== user.userId) {
        throw new ForbiddenException('You do not have access to this job');
      }

      return job;
    }

    throw new ForbiddenException(
      'You do not have permission to access this job',
    );
  }

  async updateJob(jobId: string, recruiterId: string, data: updateJobInput) {
    const job = await this.prisma.job.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.recruiterId !== recruiterId) {
      throw new ForbiddenException(
        'You do not have permission to update this job',
      );
    }

    const minExperience = data.minExperience ?? job.minExperience;
    const maxExperience = data.maxExperience ?? job.maxExperience;

    if (
      maxExperience !== null &&
      maxExperience !== undefined &&
      maxExperience < minExperience
    ) {
      throw new BadRequestException(
        'Maximum experience cannot be less than minimum experience',
      );
    }

    const minSalary = data.minSalary ?? job.minSalary;
    const maxSalary = data.maxSalary ?? job.maxSalary;

    if (
      minSalary !== null &&
      minSalary !== undefined &&
      maxSalary !== null &&
      maxSalary !== undefined &&
      maxSalary < minSalary
    ) {
      throw new BadRequestException(
        'Maximum salary cannot be less than minimum salary',
      );
    }

    const updateData: any = { ...data };

    if (data.status !== undefined) {
      updateData.status = data.status;
      updateData.isActive = data.status === 'ACTIVE';
    } else if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
      if (data.isActive) {
        updateData.status = 'ACTIVE';
      } else {
        updateData.status = job.status === 'DRAFT' ? 'DRAFT' : 'PAUSED';
      }
    }

    return this.prisma.job.update({
      where: {
        id: jobId,
      },
      data: updateData,
    });
  }

  async deleteJob(jobId: string, recruiterId: string) {
    const job = await this.prisma.job.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.recruiterId !== recruiterId) {
      throw new ForbiddenException(
        'You do not have permission to delete this job',
      );
    }

    return this.prisma.job.delete({
      where: {
        id: jobId,
      },
    });
  }

  /**
   * Apply to Job:
   * Supports two paths:
   * 1. resumeId provided: checks if resume is pre-parsed in Resume Manager -> scoreCandidate (score-only).
   *    If not yet parsed, fallback to streaming PDF from storage -> parseAndScore.
   * 2. file provided: uploads fresh PDF to storage -> parseAndScore.
   * Always persists scores and full evaluation inside parsedInfo.
   */
  async applyToJob(
    jobId: string,
    applicantId: string,
    file?: Express.Multer.File,
    resumeId?: string,
  ) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status === 'DRAFT') {
      throw new NotFoundException('Job not found');
    }
    if (job.status === 'CLOSED') {
      throw new BadRequestException(
        'This job is closed and no longer accepting applications',
      );
    }
    if (job.status === 'PAUSED' || !job.isActive) {
      throw new BadRequestException(
        'Applications for this job are currently paused',
      );
    }

    const existingApplication = await this.prisma.jobApplication.findFirst({
      where: { jobId, applicantId },
    });
    if (existingApplication) {
      throw new BadRequestException('You have already applied for this job');
    }

    let targetResumeId: string | null = null;
    let resumeUrl: string | null = null;
    let resumeFileName: string | null = null;
    let targetFileKey: string | null = null;

    if (resumeId) {
      const resume = await this.prisma.resume.findUnique({
        where: { id: resumeId },
      });
      if (!resume) {
        throw new NotFoundException('Resume not found');
      }
      if (resume.userId !== applicantId) {
        throw new ForbiddenException(
          'You do not have permission to use this resume',
        );
      }

      targetResumeId = resume.id;
      resumeUrl = resume.fileUrl;
      resumeFileName = resume.fileName;
      targetFileKey = resume.fileKey;
    } else if (file) {
      const stored = await this.storage.saveFile(
        file.buffer,
        file.originalname,
      );
      resumeUrl = stored.fileUrl;
      resumeFileName = stored.fileName;
      targetFileKey = stored.fileKey;
    } else {
      throw new BadRequestException(
        'Either a resume file or resumeId is required',
      );
    }

    // 1. Create application record immediately with status PROCESSING
    const application = await this.prisma.jobApplication.create({
      data: {
        jobId,
        applicantId,
        resumeId: targetResumeId,
        resumeUrl,
        resumeFileName,
        status: ApplicationStatus.PROCESSING,
        skillsScore: 0,
        experienceScore: 0,
        projectScore: 0,
        proofOfWorkScore: 0,
        isKnockedOut: false,
        knockedOutReasons: [],
        parsedInfo: {
          fileKey: targetFileKey,
          fileName: resumeFileName,
        },
      },
    });

    // 2. Queue background evaluation via BullMQ
    await this.resumeQueue.add(
      'score-application',
      {
        applicationId: application.id,
        jobId,
        applicantId,
        resumeId: targetResumeId,
        fileKey: targetFileKey,
        fileName: resumeFileName,
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

    this.logger.log(
      `Application ${application.id} queued for background evaluation`,
    );
    return application;
  }

  /**
   * Withdraw an application (Job Seeker)
   */
  async withdrawApplication(
    applicationId: string,
    applicantId: string,
    reason?: string,
  ) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.applicantId !== applicantId) {
      throw new ForbiddenException(
        'You do not have permission to withdraw this application',
      );
    }

    if (application.status === 'WITHDRAWN') {
      throw new BadRequestException('Application is already withdrawn');
    }

    if (application.status === 'REJECTED') {
      throw new BadRequestException(
        'Cannot withdraw an application that has already been closed',
      );
    }

    const currentParsed = (application.parsedInfo as Record<string, any>) || {};

    return this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.WITHDRAWN,
        parsedInfo: {
          ...currentParsed,
          withdrawalReason: reason || 'Voluntarily withdrawn by applicant',
          withdrawnAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Get all applications for a job (Recruiter view with notes & bookmark status)
   */
  async getJobApplications(jobId: string, recruiterId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (job.recruiterId !== recruiterId) {
      throw new ForbiddenException('Forbidden to access this resource');
    }

    return this.prisma.jobApplication.findMany({
      where: { jobId },
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        bookmarks: {
          where: { recruiterId },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get application by ID (Recruiter view)
   */
  async getApplicationById(
    recruiterId: string,
    jobId: string,
    applicationId: string,
  ) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (job.recruiterId !== recruiterId) {
      throw new ForbiddenException('Do not have access');
    }

    const application = await this.prisma.jobApplication.findFirst({
      where: {
        id: applicationId,
        jobId,
      },
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resume: true,
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        bookmarks: {
          where: { recruiterId },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  /**
   * Stream or generate pre-signed URL for candidate resume PDF
   */
  async getApplicationResume(
    jobId: string,
    applicationId: string,
    recruiterId: string,
  ) {
    const application = await this.getApplicationById(
      recruiterId,
      jobId,
      applicationId,
    );

    const parsedInfo = (application.parsedInfo as Record<string, any>) || {};
    const fileKey = application.resume?.fileKey || parsedInfo.fileKey;

    if (!fileKey) {
      throw new NotFoundException('Resume document file not found on storage');
    }

    const fileName =
      application.resumeFileName || parsedInfo.fileName || 'resume.pdf';

    if (this.storage.isS3Enabled) {
      const presignedUrl = await this.storage.getPresignedViewUrl(fileKey);
      return { presignedUrl, isS3: true, fileName };
    }

    if (!this.storage.fileExists(fileKey)) {
      throw new NotFoundException('Resume document file not found on storage');
    }

    const stream = await this.storage.getFileStream(fileKey);
    return { stream, isS3: false, fileName };
  }

  /**
   * Change application status (Recruiter)
   */
  async changeStatus(
    jobId: string,
    applicationId: string,
    status: ApplicationStatus,
    recruiterId: string,
  ) {
    await this.getApplicationById(recruiterId, jobId, applicationId);

    return this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status },
    });
  }

  /**
   * Candidate Notes: Add note (Recruiter)
   */
  async addCandidateNote(
    jobId: string,
    applicationId: string,
    recruiterId: string,
    noteText: string,
  ) {
    await this.getApplicationById(recruiterId, jobId, applicationId);

    const recruiter = await this.prisma.user.findUnique({
      where: { id: recruiterId },
    });

    return this.prisma.applicationNote.create({
      data: {
        applicationId,
        authorId: recruiterId,
        authorName: recruiter?.name || 'Recruiter',
        noteText,
      },
    });
  }

  /**
   * Candidate Notes: Get notes for application
   */
  async getCandidateNotes(
    jobId: string,
    applicationId: string,
    recruiterId: string,
  ) {
    await this.getApplicationById(recruiterId, jobId, applicationId);

    return this.prisma.applicationNote.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Candidate Notes: Delete note
   */
  async deleteCandidateNote(
    jobId: string,
    applicationId: string,
    noteId: string,
    recruiterId: string,
  ) {
    await this.getApplicationById(recruiterId, jobId, applicationId);

    const note = await this.prisma.applicationNote.findUnique({
      where: { id: noteId },
    });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    if (note.authorId !== recruiterId) {
      throw new ForbiddenException('You can only delete your own notes');
    }

    return this.prisma.applicationNote.delete({ where: { id: noteId } });
  }

  /**
   * Candidate Bookmarks: Toggle bookmark state
   */
  async toggleBookmark(
    jobId: string,
    applicationId: string,
    recruiterId: string,
  ) {
    await this.getApplicationById(recruiterId, jobId, applicationId);

    const existing = await this.prisma.candidateBookmark.findUnique({
      where: {
        recruiterId_applicationId: {
          recruiterId,
          applicationId,
        },
      },
    });

    if (existing) {
      await this.prisma.candidateBookmark.delete({
        where: { id: existing.id },
      });
      return { bookmarked: false, applicationId };
    } else {
      await this.prisma.candidateBookmark.create({
        data: {
          recruiterId,
          applicationId,
        },
      });
      return { bookmarked: true, applicationId };
    }
  }

  /**
   * Candidate Bookmarks: Get all bookmarked application IDs for a recruiter
   */
  async getBookmarks(recruiterId: string) {
    const bookmarks = await this.prisma.candidateBookmark.findMany({
      where: { recruiterId },
      select: { applicationId: true },
    });
    return bookmarks.map((b) => b.applicationId);
  }

  /**
   * Get applications for logged-in job seeker
   */
  async getMyApplications(applicantId: string) {
    return this.prisma.jobApplication.findMany({
      where: {
        applicantId,
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            workMode: true,
            employmentType: true,
            isActive: true,
            recruiter: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
