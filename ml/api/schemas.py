"""Pydantic schemas"""

from typing import Any, Optional
from pydantic import BaseModel, Field


class JobDescriptionProfile(BaseModel):
    title: str = Field(default="", description="Job title")
    required_skills: list[str] = Field(default_factory=list, description="Mandatory/required skills")
    preferred_skills: list[str] = Field(default_factory=list, description="Preferred skills")
    target_yoe: float = Field(default=0.0, description="Target years of experience")
    target_seniority: str = Field(default="mid", description="Target seniority level")
    role_preset: str = Field(default="balanced", description="Macro role preset")
    pillar_presets: Optional[dict[str, str]] = Field(default_factory=dict, description="Per-pillar presets")
    pillar_weights: Optional[dict[str, dict[str, float]]] = Field(default_factory=dict, description="Per-pillar sub-weights")
    knockout_criteria: Optional[dict[str, Any]] = Field(default_factory=dict, description="Knockout criteria")
    macro_weights: Optional[dict[str, float]] = Field(default=None, description="Macro pillar weights")


class ScoreCandidateRequest(BaseModel):
    candidate_data: dict[str, Any] = Field(description="Parsed resume dictionary")
    jd_profile: JobDescriptionProfile = Field(description="Job description profile")
    macro_weights: Optional[dict[str, float]] = Field(default=None, description="Optional custom weights")
    preset: Optional[str] = Field(default="balanced", description="Role preset")
