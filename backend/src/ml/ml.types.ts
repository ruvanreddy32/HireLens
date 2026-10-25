export interface JobDescriptionProfile {
  title: string;
  required_skills: string[];
  preferred_skills?: string[];
  target_yoe?: number;
  target_seniority?: string;
  role_preset?: string;
  knockout_criteria?: {
    min_total_experience_months?: number;
    mandatory_skills?: string[];
    min_skill_score?: number;
    min_project_score?: number;
  };
  macro_weights?: WeightsConfig;
}

export interface WeightsConfig {
  skills: number;
  experience: number;
  projects: number;
  proof_of_work: number;
}

export interface PillarScores {
  skills: number;
  experience: number;
  projects: number;
  proof_of_work: number;
}

export interface CandidateScoreResponse {
  candidate_id: string;
  is_knocked_out: boolean;
  knockout_reasons: string[];
  composite_score: number;
  match_tier: string;
  match_badge_color: string;
  pillar_scores: PillarScores;
  pillar_details: Record<string, any>;
  executive_summary: string;
}
