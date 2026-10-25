import {
  Injectable,
  Logger,
  BadGatewayException,
  BadRequestException,
} from '@nestjs/common';
import {
  JobDescriptionProfile,
  CandidateScoreResponse,
} from './ml.types';

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.ML_SERVICE_URL ||"http://127.0.0.1:8000";
  }

  // Upload and parse resume PDF into structured candidate profile
  async parseResume(fileBuffer: Buffer, fileName: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' }), fileName);
    return this.sendRequest('/api/v1/parse-resume', { method: 'POST', body: formData });
  }

  // Score candidate profile against a job description profile
  async scoreCandidate(
    candidateData: any,
    jdProfile: JobDescriptionProfile,
  ): Promise<CandidateScoreResponse> {
    return this.sendRequest<CandidateScoreResponse>('/api/v1/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_data: candidateData,
        jd_profile: jdProfile,
      }),
    });
  }

  // Parse resume PDF and compute 4-pillar scores in a single request
  async parseAndScore(
    fileBuffer: Buffer,
    fileName: string,
    jdProfile: JobDescriptionProfile,
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' }), fileName);
    formData.append('jd_profile', JSON.stringify(jdProfile));
    return this.sendRequest('/api/v1/parse-and-score', { method: 'POST', body: formData });
  }

  // Convert Prisma Job record to JobDescriptionProfile expected by ML service
  jobToJdProfile(job: {
    title: string;
    requiredSkills?: string[];
    preferredSkills?: string[];
    minExperience?: number;
  }): JobDescriptionProfile {
    const minExp = job.minExperience ?? 0;
    return {
      title: job.title,
      required_skills: job.requiredSkills || [],
      preferred_skills: job.preferredSkills || [],
      target_yoe: minExp,
      knockout_criteria: {
        min_total_experience_months: minExp * 12,
        mandatory_skills: job.requiredSkills || [],
      },
    };
  }

  private async sendRequest<T>(
    endpoint: string,
    init: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, init);

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
}

