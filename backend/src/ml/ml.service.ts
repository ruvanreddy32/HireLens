import { Injectable, Logger, BadGatewayException, BadRequestException } from '@nestjs/common';
import {
  JobDescriptionProfile,
  WeightsConfig,
  CandidateScoreResponse,
  PresetsResponse,
} from './ml.types';

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  }

  // Check health status of Python FastAPI service
  async checkHealth(): Promise<{ status: string; service: string }> {
    return this.sendJsonRequest<{ status: string; service: string }>('/health', {
      method: 'GET',
    });
  }

  // Get macro role preset weights and tier thresholds
  async getPresets(): Promise<PresetsResponse> {
    return this.sendJsonRequest<PresetsResponse>('/api/v1/presets', {
      method: 'GET',
    });
  }

  // Upload and parse resume PDF into structured candidate profile
  async parseResume(fileBuffer: Buffer, fileName: string): Promise<any> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' });
    formData.append('file', blob, fileName);

    return this.sendMultipartRequest('/api/v1/parse-resume', formData);
  }

  // Score candidate profile against a job description profile
  async scoreCandidate(
    candidateData: any,
    jdProfile: JobDescriptionProfile,
    weights?: WeightsConfig,
  ): Promise<CandidateScoreResponse> {
    return this.sendJsonRequest<CandidateScoreResponse>('/api/v1/score', {
      method: 'POST',
      body: JSON.stringify({
        candidate_data: candidateData,
        jd_profile: jdProfile,
        weights,
      }),
    });
  }

  // Parse resume PDF and compute 4-pillar scores in a single request
  async parseAndScore(
    fileBuffer: Buffer,
    fileName: string,
    jdProfile: JobDescriptionProfile,
    weights?: WeightsConfig,
  ): Promise<any> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' });
    formData.append('file', blob, fileName);
    formData.append('jd_profile', JSON.stringify(jdProfile));
    if (weights) {
      formData.append('weights', JSON.stringify(weights));
    }

    return this.sendMultipartRequest('/api/v1/parse-and-score', formData);
  }

  // Rank candidate cohort against a job description
  async rankCohort(
    candidates: any[],
    jdProfile: JobDescriptionProfile,
    weights?: WeightsConfig,
  ): Promise<any> {
    return this.sendJsonRequest('/api/v1/rank', {
      method: 'POST',
      body: JSON.stringify({
        candidates,
        jd_profile: jdProfile,
        weights,
      }),
    });
  }

  // Convert Prisma Job record to JobDescriptionProfile expected by ML service
  jobToJdProfile(job: {
    title: string;
    requiredSkills?: string[];
    preferredSkills?: string[];
    minExperience?: number;
    education?: string | null;
  }): JobDescriptionProfile {
    const titleLower = job.title.toLowerCase();
    let roleFamily = 'generalist';
    if (titleLower.includes('back') || titleLower.includes('python') || titleLower.includes('node')) {
      roleFamily = 'backend';
    } else if (titleLower.includes('front') || titleLower.includes('react') || titleLower.includes('ui')) {
      roleFamily = 'frontend';
    } else if (titleLower.includes('ml') || titleLower.includes('ai') || titleLower.includes('data')) {
      roleFamily = 'ai_ml';
    }

    return {
      title: job.title,
      role_family: roleFamily,
      required_skills: job.requiredSkills || [],
      preferred_skills: job.preferredSkills || [],
      min_experience_years: job.minExperience ?? 0,
      education_level: job.education || undefined,
      knockout_criteria: {
        min_experience_years: job.minExperience ?? 0,
        required_skills: job.requiredSkills || [],
      },
    };
  }

  private async sendJsonRequest<T>(endpoint: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`ML Service Error [${response.status}]: ${errorText}`);
        throw new BadRequestException(`ML Service returned error: ${errorText}`);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`Failed to connect to ML Service at ${url}: ${err.message}`);
      throw new BadGatewayException(`ML Service is unreachable at ${this.baseUrl}`);
    }
  }

  private async sendMultipartRequest<T = any>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`ML Service Multipart Error [${response.status}]: ${errorText}`);
        throw new BadRequestException(`ML Service returned error: ${errorText}`);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`Failed to upload to ML Service at ${url}: ${err.message}`);
      throw new BadGatewayException(`ML Service is unreachable at ${this.baseUrl}`);
    }
  }
}
