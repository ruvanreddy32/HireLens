"""Post-extraction field validation, sanitization, and normalization."""

import logging
import re

logger = logging.getLogger(__name__)


# Item-level normalizers

def _normalize_skill_entry(entry: dict) -> dict | None:
    """Normalize and validate a single skill entry."""
    if not isinstance(entry, dict):
        return None
    name = entry.get("name")
    if not name or not isinstance(name, str) or not name.strip():
        return None
    return {
        "name": name.strip(),
        "source": entry.get("source", "explicit_list"),
    }


def _normalize_education_entry(entry: dict) -> dict | None:
    """Normalize and validate an education entry."""
    if not isinstance(entry, dict):
        return None
    institution = entry.get("institution")
    degree = entry.get("degree")
    if not institution and not degree:
        return None

    return {
        "institution": str(institution).strip() if institution else None,
        "degree": str(degree).strip() if degree else None,
        "field_of_study": str(entry.get("field_of_study")).strip() if entry.get("field_of_study") else None,
        "start_date": str(entry.get("start_date")).strip() if entry.get("start_date") else None,
        "end_date": str(entry.get("end_date")).strip() if entry.get("end_date") else None,
        "gpa_or_score": str(entry.get("gpa_or_score")).strip() if entry.get("gpa_or_score") else None,
    }


def _normalize_project_entry(entry: dict) -> dict | None:
    """Sanitize project entry, clean markdown links, and normalize fields."""
    if not isinstance(entry, dict):
        return None

    name = entry.get("name")
    if not name or not isinstance(name, str):
        return None

    # Clean markdown links in project title like "[Project Name](http://...)"
    m = re.match(r"^\[([^\]]+)\]\(([^)]+)\)$", name.strip())
    if m:
        clean_name, url = m.group(1).strip(), m.group(2).strip()
        entry["name"] = clean_name
        if not entry.get("link"):
            entry["link"] = url
        links = entry.setdefault("links", [])
        if not any(isinstance(l, dict) and l.get("url") == url for l in links):
            links.insert(0, {"label": "Project", "url": url})
    else:
        entry["name"] = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", name).strip()
        entry["name"] = entry["name"].rstrip(":| -").strip()

    if not entry["name"]:
        return None

    # Normalize links array
    links = entry.get("links")
    if not isinstance(links, list):
        entry["links"] = []

    if not entry.get("link") and entry["links"]:
        first = entry["links"][0]
        if isinstance(first, dict) and "url" in first:
            entry["link"] = first["url"]
        elif isinstance(first, str):
            entry["link"] = first

    tech_stack = entry.get("tech_stack", [])
    if isinstance(tech_stack, str):
        tech_stack = [t.strip() for t in tech_stack.split(",") if t.strip()]
    elif not isinstance(tech_stack, list):
        tech_stack = []

    return {
        "name": entry["name"],
        "description": entry.get("description") or "",
        "tech_stack": tech_stack,
        "date_or_duration": entry.get("date_or_duration"),
        "link": entry.get("link"),
        "links": entry.get("links", []),
    }


def _normalize_experience_entry(entry: dict) -> dict | None:
    """Validate and normalize an experience entry."""
    if not isinstance(entry, dict):
        return None

    title = entry.get("title")
    company = entry.get("company")
    if not title and not company:
        return None

    bullets = entry.get("bullets", [])
    if isinstance(bullets, str):
        bullets = [bullets]
    elif not isinstance(bullets, list):
        bullets = []

    mentioned_skills = entry.get("mentioned_skills", [])
    if isinstance(mentioned_skills, str):
        mentioned_skills = [mentioned_skills]
    elif not isinstance(mentioned_skills, list):
        mentioned_skills = []

    duration_months = entry.get("duration_months", 0)
    if not isinstance(duration_months, int) or duration_months < 0:
        duration_months = 0

    return {
        "title": str(title).strip() if title else None,
        "company": str(company).strip() if company else None,
        "start_date": str(entry.get("start_date")).strip() if entry.get("start_date") else None,
        "end_date": str(entry.get("end_date")).strip() if entry.get("end_date") else None,
        "duration_months": duration_months,
        "location": str(entry.get("location")).strip() if entry.get("location") else None,
        "bullets": [str(b).strip() for b in bullets if b],
        "mentioned_skills": [str(s).strip() for s in mentioned_skills if s],
    }


# Collection-level validators

def _validate_skills(skills_data: dict) -> list[dict]:
    """Validate and filter skills entries."""
    if skills_data.get("extraction_failed"):
        return []
    entries = skills_data.get("skills", [])
    if not isinstance(entries, list):
        return []
    return [norm for e in entries if (norm := _normalize_skill_entry(e))]


def _validate_education(education_data: dict) -> list[dict]:
    """Validate and filter education entries."""
    if education_data.get("extraction_failed"):
        return []
    entries = education_data.get("education", [])
    if not isinstance(entries, list):
        return []
    return [norm for e in entries if (norm := _normalize_education_entry(e))]


def _validate_projects(projects_data: dict) -> list[dict]:
    """Validate and filter project entries."""
    if projects_data.get("extraction_failed"):
        return []
    entries = projects_data.get("projects", [])
    if not isinstance(entries, list):
        return []
    return [norm for e in entries if (norm := _normalize_project_entry(e))]


def _validate_experience(experience_entries: list) -> list[dict]:
    """Validate and filter experience entries."""
    if not isinstance(experience_entries, list):
        return []
    return [norm for e in experience_entries if (norm := _normalize_experience_entry(e))]


# Top-level validator

def validate_and_flag(result: dict) -> dict:
    """Validate, clean, and normalize extracted sections in result dictionary."""
    if result.get("status") != "success":
        return result

    # Validate and normalize collections
    raw_skills_data = result.get("_skills_data", {})
    result["skills"] = _validate_skills(raw_skills_data)

    raw_education_data = result.get("_education_data", {})
    result["education"] = _validate_education(raw_education_data)

    raw_projects_data = result.get("_projects_data", {})
    result["projects"] = _validate_projects(raw_projects_data)

    experience_entries = result.get("experience_entries", [])
    result["experience_entries"] = _validate_experience(experience_entries)

    # Clean up internal staging keys
    for key in (
        "_skills_data",
        "_education_data",
        "_projects_data",
        "_low_confidence_sections",
        "_segmentation_method",
        "segmentation_confidence",
    ):
        result.pop(key, None)

    return result
