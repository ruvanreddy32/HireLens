import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MlService } from './ml.service';
import { JobDescriptionProfile, WeightsConfig } from './ml.types';

@Controller('ml')
export class MlController {
  constructor(private readonly mlService: MlService) {}

  @Get('health')
  async health() {
    return this.mlService.checkHealth();
  }

  @Get('presets')
  async getPresets() {
    return this.mlService.getPresets();
  }

  @Post('parse-resume')
  @UseInterceptors(FileInterceptor('file'))
  async parseResume(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A PDF resume file is required');
    }
    return this.mlService.parseResume(file.buffer, file.originalname);
  }

  @Post('score')
  async scoreCandidate(
    @Body('candidate_data') candidateData: any,
    @Body('jd_profile') jdProfile: JobDescriptionProfile,
    @Body('weights') weights?: WeightsConfig,
  ) {
    if (!candidateData || !jdProfile) {
      throw new BadRequestException('candidate_data and jd_profile are required');
    }
    return this.mlService.scoreCandidate(candidateData, jdProfile, weights);
  }

  @Post('parse-and-score')
  @UseInterceptors(FileInterceptor('file'))
  async parseAndScore(
    @UploadedFile() file: Express.Multer.File,
    @Body('jd_profile') jdProfileRaw: string | JobDescriptionProfile,
    @Body('weights') weightsRaw?: string | WeightsConfig,
  ) {
    if (!file) {
      throw new BadRequestException('A PDF resume file is required');
    }

    let jdProfile: JobDescriptionProfile;
    try {
      jdProfile = typeof jdProfileRaw === 'string' ? JSON.parse(jdProfileRaw) : jdProfileRaw;
    } catch {
      throw new BadRequestException('Invalid JSON provided for jd_profile');
    }

    let weights: WeightsConfig | undefined;
    if (weightsRaw) {
      try {
        weights = typeof weightsRaw === 'string' ? JSON.parse(weightsRaw) : weightsRaw;
      } catch {
        throw new BadRequestException('Invalid JSON provided for weights');
      }
    }

    return this.mlService.parseAndScore(file.buffer, file.originalname, jdProfile, weights);
  }

  @Post('rank')
  async rankCohort(
    @Body('candidates') candidates: any[],
    @Body('jd_profile') jdProfile: JobDescriptionProfile,
    @Body('weights') weights?: WeightsConfig,
  ) {
    if (!candidates || !jdProfile) {
      throw new BadRequestException('candidates and jd_profile are required');
    }
    return this.mlService.rankCohort(candidates, jdProfile, weights);
  }
}
