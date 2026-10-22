export interface JobDescriptionProfile {
  title: string;
  role_family?: string;
  required_skills: string[];
  preferred_skills?: string[];
  min_experience_years?: number;
  education_level?: string;
  knockout_criteria?: {
    min_experience_years?: number;
    required_skills?: string[];
    strict_degree_requirement?: boolean;
  };
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
