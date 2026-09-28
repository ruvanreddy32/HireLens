import { BadRequestException, Body, Controller, FileTypeValidator, FileValidator, Get, MaxFileSizeValidator, Param, ParseFilePipe, Patch, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
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
import { applicationParamsInput,applicationParamsSchema } from './schema/application-params.schema';
import { applicationStatusInput, applicationStatusSchema } from './schema/application-status.schema';

@Controller('jobs')
export class JobsController {
    constructor(
        private readonly jobsService: JobsService
    ) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('RECRUITER')
    async createJob(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(createJob)) body: createJobInput) {
        return this.jobsService.createJob(req.user.userId, body);
    }

    @Get('recruiter/jobs')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('RECRUITER')
    async getRecruiterJobs(@Req() req: AuthenticatedRequest) {
        return this.jobsService.getRecruiterJobs(req.user.userId);
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
    async getJob(@Req() req: AuthenticatedRequest, @Param(new ZodValidationPipe(jobIdSchema)) params: jobIdInput) {
        return this.jobsService.getJob(
            params.jobId,
            req.user
        );
    }

    @Put(':jobId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('RECRUITER')
    async updateJob(
        @Req() req: AuthenticatedRequest,
        @Param(new ZodValidationPipe(jobIdSchema)) params: jobIdInput,
        @Body(new ZodValidationPipe(updateJobSchema)) body: updateJobInput
    ) {
        return this.jobsService.updateJob(
            params.jobId,
            req.user.userId,
            body
        );
    }

    @Post(':jobId/apply')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('JOB_SEEKER')
    @UseInterceptors(FileInterceptor('resume'))
    async applyToJob(@Req() req: AuthenticatedRequest, @Param(new ZodValidationPipe(jobIdSchema)) params: jobIdInput,
        @UploadedFile(new ParseFilePipe({
            validators:[
                new MaxFileSizeValidator({
                    maxSize:5*1024*1024,
                    message:"File size should not be greater than 5MB"
                }),
                new FileTypeValidator({
                    fileType:"application/pdf",
                }),
            
            ],fileIsRequired:true
        })) file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Resume file is required');
        }
        return this.jobsService.applyToJob(params.jobId, req.user.userId, file);
    }
    @Get(':jobId/applications')
    @UseGuards(JwtAuthGuard,RolesGuard)
    @Roles('RECRUITER')
    async getJobApplications(@Req() req:AuthenticatedRequest, @Param(new ZodValidationPipe(jobIdSchema)) params:jobIdInput){
        return await this.jobsService.getJobApplications(params.jobId,req.user.userId);
    }   

    @Get(':jobId/applications/:applicationId')
    @UseGuards(JwtAuthGuard,RolesGuard)
    @Roles('RECRUITER')
    async getApplicationById(@Req() req:AuthenticatedRequest,@Param(new ZodValidationPipe(applicationParamsSchema)) params:applicationParamsInput){
        return this.jobsService.getApplicationById(req.user.userId,params.jobId,params.applicationId);
    }

    @Patch(":jobId/applications/:applicationId")
    @UseGuards(JwtAuthGuard,RolesGuard)
    @Roles("RECRUITER")
    async changeStatus(@Req() req:AuthenticatedRequest,@Param(new ZodValidationPipe(applicationParamsSchema))params:applicationParamsInput,@Body(new ZodValidationPipe(applicationStatusSchema)) body:applicationStatusInput){
        return await this.jobsService.changeStatus(params.jobId,params.applicationId,body.status,req.user.userId);
    }
    
}
