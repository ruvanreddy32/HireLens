import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { JobsService } from './jobs.service';
import { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { ZodValidationPipe } from 'src/common/pipes/zod-validator.pipe';
import { createJob, createJobInput } from './schema/create-job.schema';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { jobIdSchema, jobIdInput } from './schema/job-id.schema';
import { updateJobInput, updateJobSchema } from './schema/update-job.schema';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  applicationParamsInput,
  applicationParamsSchema,
} from './schema/application-params.schema';
import {
  applicationStatusInput,
  applicationStatusSchema,
} from './schema/application-status.schema';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async createJob(
    @Req() req: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createJob)) body: createJobInput,
  ) {
    return this.jobsService.createJob(req.user.userId, body);
  }

  @Get('recruiter/jobs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async getRecruiterJobs(@Req() req: AuthenticatedRequest) {
    return this.jobsService.getRecruiterJobs(req.user.userId);
  }

  @Get('recruiter/bookmarks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async getBookmarks(@Req() req: AuthenticatedRequest) {
    return this.jobsService.getBookmarks(req.user.userId);
  }

  @Get('applications/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  async getMyApplications(@Req() req: AuthenticatedRequest) {
    return await this.jobsService.getMyApplications(req.user.userId);
  }

  @Patch('applications/:applicationId/withdraw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  async withdrawApplication(
    @Req() req: AuthenticatedRequest,
    @Param('applicationId') applicationId: string,
    @Body() body: { reason?: string },
  ) {
    return this.jobsService.withdrawApplication(
      applicationId,
      req.user.userId,
      body?.reason,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  async getActiveJobs() {
    return this.jobsService.getActiveJobs();
  }

  @Get(':jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER', 'RECRUITER')
  async getJob(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(jobIdSchema)) params: jobIdInput,
  ) {
    return this.jobsService.getJob(params.jobId, req.user);
  }

  @Put(':jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async updateJob(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(jobIdSchema)) params: jobIdInput,
    @Body(new ZodValidationPipe(updateJobSchema)) body: updateJobInput,
  ) {
    return this.jobsService.updateJob(params.jobId, req.user.userId, body);
  }

  @Delete(':jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async deleteJob(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(jobIdSchema)) params: jobIdInput,
  ) {
    return this.jobsService.deleteJob(params.jobId, req.user.userId);
  }

  @Post(':jobId/apply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  @UseInterceptors(FileInterceptor('resume'))
  async applyToJob(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(jobIdSchema)) params: jobIdInput,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 5 * 1024 * 1024,
            message: 'File size should not be greater than 5MB',
          }),
          new FileTypeValidator({
            fileType: 'application/pdf',
          }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
    @Body('resumeId') resumeId?: string,
  ) {
    if (!file && !resumeId) {
      throw new BadRequestException('Either a resume file or resumeId is required');
    }
    return this.jobsService.applyToJob(params.jobId, req.user.userId, file, resumeId);
  }

  @Get(':jobId/applications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async getJobApplications(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(jobIdSchema)) params: jobIdInput,
  ) {
    return await this.jobsService.getJobApplications(params.jobId, req.user.userId);
  }

  @Get(':jobId/applications/:applicationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async getApplicationById(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(applicationParamsSchema))
    params: applicationParamsInput,
  ) {
    return this.jobsService.getApplicationById(
      req.user.userId,
      params.jobId,
      params.applicationId,
    );
  }

  @Patch(':jobId/applications/:applicationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async changeStatus(
    @Req() req: AuthenticatedRequest,
    @Param(new ZodValidationPipe(applicationParamsSchema))
    params: applicationParamsInput,
    @Body(new ZodValidationPipe(applicationStatusSchema))
    body: applicationStatusInput,
  ) {
    return await this.jobsService.changeStatus(
      params.jobId,
      params.applicationId,
      body.status,
      req.user.userId,
    );
  }

  /**
   * Stream candidate resume PDF to recruiter browser tab
   */
  @Get(':jobId/applications/:applicationId/resume')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async getApplicationResume(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Param('applicationId') applicationId: string,
    @Res() res: Response,
  ) {
    const result = await this.jobsService.getApplicationResume(
      jobId,
      applicationId,
      req.user.userId,
    );

    if (result.isS3 && result.presignedUrl) {
      return res.redirect(result.presignedUrl);
    }

    if (!result.stream) {
      throw new BadRequestException('Resume file stream is not available');
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.fileName}"`,
    });

    result.stream.pipe(res);
  }

  /**
   * Candidate Notes
   */
  @Post(':jobId/applications/:applicationId/notes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async addNote(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Param('applicationId') applicationId: string,
    @Body('noteText') noteText: string,
  ) {
    if (!noteText || !noteText.trim()) {
      throw new BadRequestException('Note text is required');
    }
    return this.jobsService.addCandidateNote(
      jobId,
      applicationId,
      req.user.userId,
      noteText.trim(),
    );
  }

  @Get(':jobId/applications/:applicationId/notes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async getNotes(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.jobsService.getCandidateNotes(
      jobId,
      applicationId,
      req.user.userId,
    );
  }

  @Delete(':jobId/applications/:applicationId/notes/:noteId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async deleteNote(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Param('applicationId') applicationId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.jobsService.deleteCandidateNote(
      jobId,
      applicationId,
      noteId,
      req.user.userId,
    );
  }

  /**
   * Candidate Bookmarks
   */
  @Post(':jobId/applications/:applicationId/bookmark')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECRUITER')
  async toggleBookmark(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.jobsService.toggleBookmark(
      jobId,
      applicationId,
      req.user.userId,
    );
  }
}
