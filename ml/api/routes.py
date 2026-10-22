import json
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from ml.api.schemas import (JobDescriptionProfile, ScoreCandidateRequest)
from ml.parsing.resume_parser import parse_resume
from ml.scoring.composite_scorer import score_candidate_match

router = APIRouter(prefix="/api/v1", tags=["ML Engine"])


@router.post("/parse-resume", summary="Parse a PDF resume into structured JSON")
async def parse_resume_endpoint(file: UploadFile = File(...)):
    try:
        parsed = parse_resume(file.file)
        if parsed.get("status") != "success":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=parsed.get("message", "Failed to parse resume document"),
            )
        return parsed

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal resume parsing error: {str(exc)}",
        )


@router.post("/score", summary="Score a parsed candidate against a job description")
def score_candidate_endpoint(payload: ScoreCandidateRequest):
    try:
        jd_dict = payload.jd_profile.model_dump()
        result = score_candidate_match(
            candidate_data=payload.candidate_data,
            jd_profile=jd_dict,
            macro_weights=payload.macro_weights,
            preset=payload.preset or "balanced",
        )
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Candidate scoring error: {str(exc)}",
        )


@router.post("/parse-and-score", summary="Upload a resume PDF and score directly against a JD")
async def parse_and_score_endpoint(
    file: UploadFile = File(...),
    jd_profile: str = Form(..., description="JSON string conforming to JobDescriptionProfile"),
    preset: Optional[str] = Form("balanced"),
    macro_weights: Optional[str] = Form(None, description="Optional JSON string of macro weights"),
):
    try:
        jd_raw = json.loads(jd_profile)
        validated_jd = JobDescriptionProfile(**jd_raw).model_dump()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid jd_profile JSON: {str(exc)}",
        )

    weights_dict = None
    if macro_weights:
        try:
            weights_dict = json.loads(macro_weights)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid macro_weights JSON",
            )

    try:
        parsed = parse_resume(file.file)
        if parsed.get("status") != "success":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=parsed.get("message", "Failed to parse resume document"),
            )

        evaluation = score_candidate_match(
            candidate_data=parsed,
            jd_profile=validated_jd,
            macro_weights=weights_dict,
            preset=preset or "balanced",
        )

        return {
            "parsed_resume": parsed,
            "evaluation": evaluation,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Parse and score error: {str(exc)}",
        )
