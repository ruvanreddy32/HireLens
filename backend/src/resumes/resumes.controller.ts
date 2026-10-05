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
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { ResumesService } from './resumes.service';
import { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  @UseInterceptors(FileInterceptor('file'))
  async uploadResume(
    @Req() req: AuthenticatedRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 5 * 1024 * 1024,
            message: 'Resume file size cannot exceed 5MB',
          }),
          new FileTypeValidator({
            fileType: 'application/pdf',
          }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body('title') title?: string,
    @Body('targetRole') targetRole?: string,
    @Body('isPrimary') isPrimary?: string | boolean,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    const primaryFlag =
      isPrimary === true || isPrimary === 'true' || isPrimary === '1';

    return this.resumesService.uploadResume(req.user.userId, file, {
      title,
      targetRole,
      isPrimary: primaryFlag,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  async getMyResumes(@Req() req: AuthenticatedRequest) {
    return this.resumesService.getUserResumes(req.user.userId);
  }

  @Patch(':id/primary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  async setPrimary(
    @Req() req: AuthenticatedRequest,
    @Param('id') resumeId: string,
  ) {
    return this.resumesService.setPrimaryResume(resumeId, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  async deleteResume(
    @Req() req: AuthenticatedRequest,
    @Param('id') resumeId: string,
  ) {
    return this.resumesService.deleteResume(resumeId, req.user.userId);
  }

  @Get(':id/file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  async getResumeFile(
    @Req() req: AuthenticatedRequest,
    @Param('id') resumeId: string,
    @Res() res: Response,
  ) {
    const result = await this.resumesService.getResumeFile(
      resumeId,
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
}
