import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { createJobInput } from './schema/create-job.schema';
import { updateJobInput } from './schema/update-job.schema';
import { MlService } from 'src/ml/ml.service';
import 'multer';
import { applicationStatusInput } from './schema/application-status.schema';
import { ApplicationStatus } from '@prisma/client';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService, private readonly ml: MlService) { }

  async createJob(recruiterId: string, data: createJobInput) {
    return this.prisma.job.create({
      data: {
        recruiterId,

        title: data.title,
        description: data.description,
        location: data.location,

        workMode: data.workMode,
        employmentType: data.employmentType,

        minExperience: data.minExperience,
        maxExperience: data.maxExperience,

        education: data.education,

        requiredSkills: data.requiredSkills,

        preferredSkills: data.preferredSkills,

        minSalary: data.minSalary,
        maxSalary: data.maxSalary,
        isActive: data.isActive,
      },
    });
  }

  async getRecruiterJobs(recruiterId: string) {
    return this.prisma.job.findMany({
      where: {
        recruiterId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
  async getActiveJobs() {
    return this.prisma.job.findMany({
      where: {
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
    if (user.role == 'JOB_SEEKER') {
      if (!job.isActive) {
        throw new NotFoundException('job not found');
      }
      return job;
    }
    if (user.role == 'RECRUITER') {
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

    if (maxExperience !== null && maxExperience !== undefined && maxExperience < minExperience) {
      throw new BadRequestException(
        'Maximum experience cannot be less than minimum experience',
      );
    }

    const minSalary = data.minSalary ?? job.minSalary;

    const maxSalary = data.maxSalary ?? job.maxSalary;

    if (minSalary !== null && minSalary !== undefined && maxSalary !== null && maxSalary !== undefined && maxSalary < minSalary) {
      throw new BadRequestException(
        'Maximum salary cannot be less than minimum salary',
      );
    }

    return this.prisma.job.update({
      where: {
        id: jobId,
      },
      data,
    });
  }

  async applyToJob(jobId: string, applicantId: string, file: Express.Multer.File) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job || !job.isActive) {
      throw new NotFoundException("job not found or is inactive");
    }

    const exisitingApplication = await this.prisma.jobApplication.findFirst({ where: { jobId:jobId, applicantId: applicantId } });
    if (exisitingApplication) {
      throw new BadRequestException("you have already applied for this job");
    }

    const jdProfile = this.ml.jobToJdProfile(job);
    const mlResult = await this.ml.parseAndScore(file.buffer, file.originalname, jdProfile);

    return this.prisma.jobApplication.create({
      data: {
        jobId,
        applicantId,
        skillsScore: mlResult.pillar_scores.skills,
        experienceScore: mlResult.pillar_scores.experience,
        projectScore: mlResult.pillar_scores.projects,
        proofOfWorkScore: mlResult.pillar_scores.proof_of_work,
        isKnockedOut: mlResult.is_knocked_out,
        knockedOutReasons: mlResult.knockout_reasons || [],
        parsedInfo: mlResult.candidate || null,
      },
    });
  }
  async getJobApplications(jobId:string,recruiterId:string){
    const job=await this.prisma.job.findUnique({where:{id:jobId}});
    if(!job){
      throw new NotFoundException("job not found");
    }
    if(job.recruiterId!=recruiterId){
      throw new ForbiddenException("forbidden to access this resource");
    }
    return await this.prisma.jobApplication.findMany({where:{
      jobId:jobId
    },
    include:{
      applicant:{
        select:{
          id:true,name:true,email:true
        }
      }
    },
    orderBy:{
      createdAt:'desc'
    }
  });
  }

  async getApplicationById(recruiterId:string,jobId:string,applicationId:string){
    const job=await this.prisma.job.findUnique({where:{id:jobId}});
    if(!job){
      throw new NotFoundException("job not found");
    }
    if(job.recruiterId!=recruiterId){
      throw new ForbiddenException("do not have access");
    }
    const application=await this.prisma.jobApplication.findFirst({
      where:{
        id:applicationId,
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
      },
    });
    if(!application){
      throw new NotFoundException("application not found");
    }
    return application;
  }

  async changeStatus(jobId:string,applicationId:string,status:ApplicationStatus,recruiterId:string){
    await this.getApplicationById(recruiterId, jobId, applicationId);

    return this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status },
    });
  }
  async getMyApplications(applicantId:string){
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
