#Invoked only if heuristic confidence margins fall below threshold (Δ<3)segmenting unformatted or non-standard resumes without discarding valid sections.


import json
import logging
import re
from typing import Optional

from ml.parsing.llm import call_llm

logger = logging.getLogger(__name__)

# Margin threshold to trigger LLM fallback
LOW_CONFIDENCE_MARGIN_THRESHOLD = 3

# LLM provider call

def _call_llm(prompt: str) -> str:
    """Send a prompt to LLM and return raw response text."""
    return call_llm(prompt)


# LLM segmentation prompt template

_SEGMENTATION_PROMPT_TEMPLATE = """\
You are a resume section segmentation engine. You will be given the raw text
of a resume that could not be reliably segmented using formatting heuristics.

Your task: split the text into labeled sections. Do NOT extract or interpret
field values — only identify boundaries and labels.

Valid section labels: header, summary, skills, experience, projects,
education, certifications, achievements, other

Rules:
- Preserve the original text of each section exactly as given.
- If a block doesn't clearly belong to any category, label it "other".
- If two categories appear merged, split them if distinguishable;
  otherwise keep as one and label with the dominant category.
- Assign a confidence score (0.0-1.0) per section.

Output strictly as JSON, no prose, no markdown fences:
{{
  "sections": [
    {{"label": "<label>", "text": "<verbatim text>", "confidence": <float>}}
  ]
}}

Resume text:
\"\"\"
{raw_text}
\"\"\"\
"""


# JSON parsing helper

def _parse_json_response(raw: str) -> Optional[dict]:
    """Strip markdown fences and parse JSON. Returns None on failure."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


# Core LLM segmentation call

def segment_with_llm(sanitized_text: str) -> Optional[dict]:
    """Send resume text to LLM for section segmentation with retry."""
    prompt = _SEGMENTATION_PROMPT_TEMPLATE.format(raw_text=sanitized_text)

    for attempt in range(2):
        try:
            raw_response = _call_llm(prompt)
            parsed = _parse_json_response(raw_response)
            if parsed and "sections" in parsed and isinstance(parsed["sections"], list):
                return parsed
            logger.warning(
                "llm_segmenter: attempt %d — invalid JSON structure from LLM", attempt + 1
            )
        except ValueError as exc:
            logger.info("llm_segmenter: LLM not configured (%s) — returning None", exc)
            return None
        except Exception as exc:
            logger.warning(
                "llm_segmenter: attempt %d failed with %s: %s",
                attempt + 1, type(exc).__name__, exc,
            )

    logger.warning("llm_segmenter: both attempts failed, returning None")
    return None


# Merge helper: overlay LLM labels onto heuristic result

_LLM_LABEL_TO_BUCKET = {
    "header":           None,
    "summary":          None,
    "skills":           "skills",
    "experience":       "experience",
    "projects":         "projects_raw",
    "education":        "education_raw",
    "certifications":   "education_raw",
    "achievements":     "education_raw",
    "other":            None,
}


def apply_llm_segmentation_fallback(
    heuristic_result: dict,
    sanitized_text: str,
    confidence_list: list[dict],
) -> tuple[dict, list[str]]:
    """Apply LLM segmentation fallback to low-confidence sections."""
    low_confidence_sections = [
        conf["section"]
        for conf in confidence_list
        if conf.get("margin", 999) < LOW_CONFIDENCE_MARGIN_THRESHOLD
        and conf.get("method") != "header_regex"  # header hits are always certain
    ]

    # If nothing is low-confidence, return immediately — no LLM call made
    if not low_confidence_sections:
        return heuristic_result, []

    logger.info(
        "llm_segmenter: low-confidence sections %s — attempting LLM fallback",
        low_confidence_sections,
    )

    try:
        llm_response = segment_with_llm(sanitized_text)
    except Exception as exc:
        logger.warning("llm_segmenter: LLM call raised %s — keeping heuristic result", exc)
        return heuristic_result, low_confidence_sections

    if llm_response is None:
        return heuristic_result, low_confidence_sections

    # Build a merged copy of the heuristic result
    merged = dict(heuristic_result)

    # Collect LLM text per bucket, only for low-confidence sections
    llm_buckets: dict[str, list[str]] = {
        "skills": [],
        "experience": [],
        "education_raw": [],
        "projects_raw": [],
    }

    for section in llm_response.get("sections", []):
        label = section.get("label", "other").lower()
        text = section.get("text", "").strip()
        if not text:
            continue

        bucket_key = _LLM_LABEL_TO_BUCKET.get(label)
        if bucket_key is None:
            continue  # header / summary / other — skip

        # Map bucket_key back to confidence section name for filtering
        conf_section_name = {
            "skills":       "skills",
            "experience":   "experience",
            "education_raw": "education",
            "projects_raw": "education",  # Projects were in education bucket
        }.get(bucket_key, bucket_key)

        if conf_section_name in low_confidence_sections:
            llm_buckets[bucket_key].append(text)

    # Override heuristic blocks only where LLM provided content for a low-conf section
    for bucket_key, texts in llm_buckets.items():
        if texts:
            heuristic_key_map = {
                "skills":       "skills_block_raw",
                "experience":   "experience_block_raw",
                "education_raw": "education_raw",
                "projects_raw": "projects_raw",
            }
            output_key = heuristic_key_map.get(bucket_key)
            if output_key:
                merged[output_key] = "\n\n".join(texts)
                logger.info(
                    "llm_segmenter: overrode '%s' with LLM output (%d chars)",
                    output_key, len(merged[output_key]),
                )

    return merged, low_confidence_sections
