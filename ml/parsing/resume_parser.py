import json
import logging
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.parsing.pdf_extractor import extract_pdf_content
from ml.parsing.text_sanitizer import sanitize_text
from ml.parsing.section_segmenter import detect_sections
from ml.parsing.experience_parser import parse_experience_entries, compute_total_experience_months
from ml.parsing.llm_segmenter import apply_llm_segmentation_fallback
from ml.parsing.llm_field_extractor import (
    extract_skills,
    extract_education,
    extract_projects,
    extract_experience_fields,
)
from ml.parsing.schema_validator import validate_and_flag

logger = logging.getLogger(__name__)


def parse_resume(pdf_path) -> dict:
    """Parse a PDF resume into a structured dictionary."""
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        return {
            "status": "error",
            "message": f"File not found: {pdf_path}",
        }

    if pdf_path.suffix.lower() != ".pdf":
        return {
            "status": "error",
            "message": f"Not a PDF file: {pdf_path}",
        }

    try:
        # 1. Extract raw text and layout in a single pass
        raw_text, pages_data = extract_pdf_content(str(pdf_path))

        if not raw_text or not raw_text.strip():
            return {
                "status": "error",
                "message": "Unintelligible document structure",
            }

        # 2. Sanitize and segment sections
        sanitized = sanitize_text(raw_text)
        if not sanitized or not sanitized.strip():
            return {
                "status": "error",
                "message": "Unintelligible document structure",
            }

        result = detect_sections(sanitized)
        if result.get("status") != "success":
            return result

        confidence_list = result.get("segmentation_confidence", [])

        # 3. LLM segmentation fallback for low-confidence sections
        result, low_confidence_sections = apply_llm_segmentation_fallback(
            result, sanitized, confidence_list
        )

        # 4. Extract structured fields (skills, education, projects, experience) concurrently
        skills_raw = result.get("skills_block_raw", "")
        education_raw = result.get("education_raw", "")
        projects_raw = result.get("projects_raw", "")
        experience_raw = result.get("experience_block_raw", "")

        with ThreadPoolExecutor(max_workers=4) as executor:
            future_skills = executor.submit(extract_skills, skills_raw)
            future_edu = executor.submit(extract_education, education_raw)
            future_proj = executor.submit(extract_projects, projects_raw)
            future_exp = executor.submit(extract_experience_fields, experience_raw)

            skills_data = future_skills.result()
            education_data = future_edu.result()
            projects_data = future_proj.result()
            experience_data = future_exp.result()

        result["_skills_data"] = skills_data
        result["_education_data"] = education_data
        result["_projects_data"] = projects_data

        # 5. Extract experience entries and total tenure
        experience_entries = parse_experience_entries(
            experience_raw, llm_data=experience_data
        )
        result["experience_entries"] = experience_entries
        result["total_experience_months"] = compute_total_experience_months(
            experience_entries
        )

        # 6. Validate schema and assemble confidence flags
        result = validate_and_flag(result)
        return result

    except Exception as e:
        logger.exception("parse_resume: unhandled exception for path '%s'", pdf_path)
        return {
            "status": "error",
            "message": f"Parse error: {str(e)}",
        }
