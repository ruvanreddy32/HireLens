#Dispatches a 4-worker thread pool to extract structured data for Skills, Education, Projects, and Experience in parallel, extracting all work experience entries in a single batch prompt.

import logging

from ml.parsing.llm import call_llm, parse_json_response

logger = logging.getLogger(__name__)


def _partial_failure(raw_text: str) -> dict:
    """Return a standardised partial-failure marker."""
    return {"extraction_failed": True, "raw_text": raw_text}


def _llm_extract(prompt: str, expected_top_key: str, raw_text: str) -> dict:
    """Generic LLM call and parse with single retry."""
    for attempt in range(2):
        try:
            raw_response = call_llm(prompt)
            parsed = parse_json_response(raw_response)
            if parsed is not None and expected_top_key in parsed:
                return parsed
            logger.warning(
                "llm_field_extractor: attempt %d — missing key '%s' in response",
                attempt + 1, expected_top_key,
            )
        except ValueError as exc:
            # LLM not configured / missing API key — fail immediately without retrying
            logger.info("llm_field_extractor: LLM not configured (%s) — returning failure marker", exc)
            return _partial_failure(raw_text)
        except Exception as exc:
            logger.warning(
                "llm_field_extractor: attempt %d failed with %s: %s",
                attempt + 1, type(exc).__name__, exc,
            )

    logger.warning(
        "llm_field_extractor: both attempts failed for key '%s'", expected_top_key
    )
    return _partial_failure(raw_text)


# Skills extraction

_SKILLS_PROMPT_TEMPLATE = """\
Extract all skills mentioned in this resume section. Include both explicitly
listed skills and skills clearly named within descriptive text (do not infer
vaguely implied skills — only extract what is explicitly named).

Output strictly as JSON:
{{"skills": [{{"name": "<as written>", "source": "explicit_list" | "embedded_text"}}]}}

Do not normalize or deduplicate — return exactly as written.

Section text:
\"\"\"
{section_text}
\"\"\"\
"""


def extract_skills(skills_raw: str) -> dict:
    """Extract structured skill entries from raw skills text."""
    if not skills_raw or not skills_raw.strip():
        return {"skills": []}

    prompt = _SKILLS_PROMPT_TEMPLATE.format(section_text=skills_raw)
    return _llm_extract(prompt, "skills", skills_raw)


# Education extraction

_EDUCATION_PROMPT_TEMPLATE = """\
Extract education entries from this resume section.

Output strictly as JSON:
{{"education": [{{"institution": "<string>", "degree": "<string or null>",
"field_of_study": "<string or null>", "start_date": "<as written, or null>",
"end_date": "<as written, or null>", "gpa_or_score": "<string or null>"}}]}}

Do not infer degree type from institution name alone. Do not convert
GPA/percentage scales.

Section text:
\"\"\"
{section_text}
\"\"\"\
"""


def extract_education(education_raw: str) -> dict:
    """Extract structured education entries from raw education text."""
    if not education_raw or not education_raw.strip():
        return {"education": []}

    prompt = _EDUCATION_PROMPT_TEMPLATE.format(section_text=education_raw)
    return _llm_extract(prompt, "education", education_raw)


# Projects extraction

_PROJECTS_PROMPT_TEMPLATE = """\
Extract project entries from this resume section.

Rules for names and links:
1. "name" must be the clean project name without markdown link brackets or URLs.
   If the title was hyperlinked like "[Project Name](http://...)", extract "Project Name" as the name, and associate the URL with the project.
2. "link" should be the primary URL (e.g. GitHub repo or live demo), or null if none.
3. "links" should be an array of all links associated with the project:
   [{{"label": "<e.g. GitHub | Live Demo | Project | Website>", "url": "<url>"}}]
4. tech_stack must only include technologies explicitly named — do not infer from project type. If no separate description exists, use the title as description.

Output strictly as JSON:
{{"projects": [{{"name": "<string>", "description": "<summarized, not fabricated>", "tech_stack": ["<tech>"], "date_or_duration": "<as written, or null>", "link": "<string or null>", "links": [{{"label": "<string>", "url": "<string>"}}]}}]}}

Section text:
\"\"\"
{section_text}
\"\"\"\
"""


def extract_projects(projects_raw: str) -> dict:
    """Extract structured project entries from raw projects text."""
    if not projects_raw or not projects_raw.strip():
        return {"projects": []}

    prompt = _PROJECTS_PROMPT_TEMPLATE.format(section_text=projects_raw)
    return _llm_extract(prompt, "projects", projects_raw)


# Experience extraction

_EXPERIENCE_PROMPT_TEMPLATE = """\
Extract work experience entries from this resume section.

Output strictly as JSON:
{{"experience": [{{"company": "<string>", "title": "<string>",
"location": "<string or null>", "start_date": "<as written, or null>",
"end_date": "<as written, or null>", "is_current": <boolean>,
"responsibilities": ["<bullet>"], "mentioned_skills": ["<skill>"]}}]}}

Do not merge multiple roles at the same company unless the source presents
them as one. Do not infer dates not present in the text. mentioned_skills
must only include skills explicitly named in this entry's text.

Section text:
\"\"\"
{section_text}
\"\"\"\
"""


def extract_experience_fields(experience_block_text: str) -> dict:
    """Extract structured experience fields from job block text."""
    if not experience_block_text or not experience_block_text.strip():
        return {"experience": []}

    prompt = _EXPERIENCE_PROMPT_TEMPLATE.format(section_text=experience_block_text)
    return _llm_extract(prompt, "experience", experience_block_text)

