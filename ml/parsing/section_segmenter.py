
#Detects candidate contact info, links, unheadered bios, and segments raw text into distinct section blocks (`skills`, `experience`, `education`, `projects`, `summary`, `achievements`).

import re

from ml.resources.segmenter_patterns import (
    SECTION_PATTERNS as _SECTION_PATTERNS,
    EMAIL_PATTERN as _EMAIL_PATTERN,
    PHONE_PATTERN as _PHONE_PATTERN,
    LINKEDIN_PATTERN as _LINKEDIN_PATTERN,
    GITHUB_PATTERN as _GITHUB_PATTERN,
    URL_PATTERN as _URL_PATTERN,
    SKILLS_KEYWORDS as _SKILLS_KEYWORDS,
    EXPERIENCE_KEYWORDS as _EXPERIENCE_KEYWORDS,
    EDUCATION_KEYWORDS as _EDUCATION_KEYWORDS,
    SECTION_KEYWORD_TRIGGERS as _SECTION_KEYWORD_TRIGGERS,
    EDUCATION_DEGREE_KEYWORDS_RE as _EDUCATION_DEGREE_KEYWORDS_RE,
    PROJECT_ENTRY_RE as _PROJECT_ENTRY_RE,
    PROJECT_SUBHEADER_RE as _PROJECT_SUBHEADER_RE,
)

# Keyword classification with confidence scoring

def _classify_by_keywords_with_scores(text: str) -> tuple[str, dict]:
    """Classify a text block by keyword density and return (category, scores)."""
    words = set(re.findall(r"[a-zA-Z./#+-]+", text.lower()))

    scores = {
        "skills":     len(words & _SKILLS_KEYWORDS),
        "experience": len(words & _EXPERIENCE_KEYWORDS),
        "education":  len(words & _EDUCATION_KEYWORDS),
    }

    # Boost experience score if date patterns are found
    date_matches = re.findall(r"\b(?:19|20)\d{2}\b", text)
    scores["experience"] += len(date_matches) * 2

    # Boost experience score for bullet-point heavy text
    bullet_count = text.count("\n-") + text.count("\n•") + text.count("\n*")
    scores["experience"] += bullet_count

    winner = max(scores, key=scores.get)
    return winner, scores


def _build_confidence_obj(
    section_name: str,
    scores: dict,
    *,
    split_ambiguous: bool = False,
    header_match: bool = False,
) -> dict:
    """Build a segmentation_confidence object for a single section block."""
    if header_match:
        return {
            "section": section_name,
            "winning_score": 999,
            "runner_up_score": 0,
            "margin": 999,
            "method": "header_regex",
            "split_ambiguous": split_ambiguous,
        }

    sorted_scores = sorted(scores.values(), reverse=True)
    winning_score = sorted_scores[0] if sorted_scores else 0
    runner_up_score = sorted_scores[1] if len(sorted_scores) > 1 else 0

    return {
        "section": section_name,
        "winning_score": winning_score,
        "runner_up_score": runner_up_score,
        "margin": winning_score - runner_up_score,
        "method": "keyword_density",
        "split_ambiguous": split_ambiguous,
    }


# Education and projects secondary splitter

def _has_project_subheader(text: str) -> bool:
    """Check if text contains an explicit project sub-header line."""
    for line in text.split("\n"):
        if _PROJECT_SUBHEADER_RE.match(line.strip()):
            return True
    return False


def _split_education_projects(raw_text: str) -> tuple[str, str, bool]:
    """Split combined education and projects block into (education_raw, projects_raw, is_split).

    Splits cleanly on a detected project sub-header boundary or explicit project entry,
    without misclassifying degree details (GPA, Major, Coursework, Honors) as projects.
    """
    if not raw_text or not raw_text.strip():
        return "", "", False

    lines = raw_text.split("\n")
    split_idx = -1

    # 1. Look for an explicit project sub-header (e.g. "Projects:", "Academic Projects:")
    for i, line in enumerate(lines):
        stripped = line.strip()
        if _PROJECT_SUBHEADER_RE.match(stripped):
            split_idx = i
            break

    # 2. If no sub-header found, search for the first clear project entry boundary
    # (e.g. GitHub link or bulleted project title with separator)
    if split_idx == -1:
        for i, line in enumerate(lines):
            stripped = line.strip()
            if re.search(r"github\.com/[^\s]+", stripped, re.IGNORECASE):
                split_idx = i
                break
            if re.match(r"^\s*[-•*]\s+[A-Za-z0-9\s\-]+(?::|(?:\s*\|))\s+\w+", stripped):
                # Ensure it's not coursework, GPA, honors, etc.
                if not re.search(
                    r"\b(?:gpa|cgpa|coursework|courses?|major|minor|dean|honors?|degree|thesis|dissertation)\b",
                    stripped,
                    re.IGNORECASE,
                ):
                    split_idx = i
                    break

    if split_idx != -1:
        edu_lines = lines[:split_idx]
        proj_lines = lines[split_idx:]
        # If the split line was a sub-header like "Projects:", omit the label from project content
        if proj_lines and _PROJECT_SUBHEADER_RE.match(proj_lines[0].strip()):
            proj_lines = proj_lines[1:]

        edu_text = "\n".join(edu_lines).strip()
        proj_text = "\n".join(proj_lines).strip()
        return edu_text, proj_text, bool(proj_text)

    # Could not find project boundary -> keep all as education
    return raw_text.strip(), "", False


def _extract_profile_links(text: str) -> dict:
    """Extract social, code repository, and email links from contact text."""
    if not text:
        return {}
    links = {}

    # Email
    m_email = _EMAIL_PATTERN.search(text)
    if m_email:
        links["email"] = m_email.group(0)

    # Markdown links: [Label](url)
    md_links = re.findall(r"\[([^\]]+)\]\((https?://[^)]+)\)", text)
    for label, url in md_links:
        l_lower = label.lower()
        u_lower = url.lower()
        if "linkedin" in u_lower or "linkedin" in l_lower:
            links["linkedin"] = url
        elif "github" in u_lower or "github" in l_lower:
            links["github"] = url
        elif "leetcode" in u_lower or "leetcode" in l_lower:
            links["leetcode"] = url
        elif "portfolio" in l_lower or "website" in l_lower:
            links["portfolio"] = url

    # Raw URLs
    raw_urls = _URL_PATTERN.findall(text)
    for url in raw_urls:
        u_lower = url.lower()
        if "linkedin.com" in u_lower and "linkedin" not in links:
            links["linkedin"] = url
        elif "github.com" in u_lower and "github" not in links:
            links["github"] = url
        elif "leetcode.com" in u_lower and "leetcode" not in links:
            links["leetcode"] = url

    # Domain handles
    if "github" not in links:
        m_gh = _GITHUB_PATTERN.search(text)
        if m_gh:
            links["github"] = f"https://{m_gh.group(0)}"
    if "linkedin" not in links:
        m_li = _LINKEDIN_PATTERN.search(text)
        if m_li:
            links["linkedin"] = f"https://{m_li.group(0)}"

    return links


def _extract_metadata(lines):
    """Extract candidate name, contact lines, and profile links from top lines."""
    name_text = None
    contact_lines = []
    header_end = 0

    # Scan first 8 lines for name and contact info
    scan_limit = min(len(lines), 8)

    for i in range(scan_limit):
        line = lines[i].strip()
        if not line:
            continue

        # Check if this is a section header — if so, body starts here
        is_header = False
        for pattern, _ in _SECTION_PATTERNS:
            if pattern.match(line):
                is_header = True
                break

        if is_header:
            header_end = i
            break

        # Check if this line is contact info
        is_contact = bool(
            _EMAIL_PATTERN.search(line)
            or _PHONE_PATTERN.search(line)
            or _LINKEDIN_PATTERN.search(line)
            or _GITHUB_PATTERN.search(line)
            or _URL_PATTERN.search(line)
        )

        # Also detect location patterns like "City, State" or "City, Country"
        if re.match(r"^[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)+\s*(?:\d{5,6})?$", line):
            is_contact = True

        if is_contact:
            contact_lines.append(line)
            header_end = i + 1
        elif name_text is None and len(line.split()) <= 5:
            # First short non-contact line is likely the name
            name_text = line
            header_end = i + 1
        elif name_text is not None:
            # If we already have a name and this isn't contact, might still be
            # subtitle / title line — include in contact if it looks like a title
            if len(line.split()) <= 6 and not any(c.isdigit() for c in line):
                contact_lines.append(line)
                header_end = i + 1
            else:
                header_end = i
                break

    raw_contact = "\n".join(contact_lines) if contact_lines else None
    profile_links = _extract_profile_links(raw_contact) if raw_contact else {}
    return name_text, raw_contact, header_end, profile_links


def _detect_section_at_line(line):
    """Detect if a line matches any known section header."""
    stripped = line.strip()
    if not stripped:
        return None

    for pattern, section_key in _SECTION_PATTERNS:
        if pattern.match(stripped):
            return section_key

    # Check for all-caps section header candidates
    if stripped.isupper() and len(stripped.split()) <= 5 and len(stripped) > 2:
        upper_text = stripped.lower()
        for pattern, section_key in _SECTION_PATTERNS:
            if any(kw in upper_text for kw in _get_section_keywords(section_key)):
                return section_key

    return None


def _get_section_keywords(section_key):
    """Return a set of keyword triggers for a given section type."""
    return _SECTION_KEYWORD_TRIGGERS.get(section_key, set())


# Main segmentation entry point

def detect_sections(sanitized_text: str) -> dict:
    """Segment sanitized resume text into labeled section buckets."""
    if not sanitized_text or not sanitized_text.strip():
        return {
            "status": "error",
            "message": "Unintelligible document structure",
        }

    lines = sanitized_text.split("\n")

    # Extract metadata from top
    raw_name, raw_contact, body_start, profile_links = _extract_metadata(lines)

    # Scan for section boundaries
    sections = []
    for i in range(body_start, len(lines)):
        section_key = _detect_section_at_line(lines[i])
        if section_key:
            sections.append((i, section_key))

    # Extract text blocks between section boundaries
    buckets: dict[str, list[str]] = {
        "skills": [],
        "experience": [],
        "education": [],
        "projects": [],
        "education_projects": [],
        "achievements": [],
        "summary": [],
    }

    segmentation_confidence: list[dict] = []

    if sections:
        # Pre-section text before first header
        pre_section_text = "\n".join(lines[body_start:sections[0][0]]).strip()
        if pre_section_text:
            bucket, scores = _classify_by_keywords_with_scores(pre_section_text)
            buckets[bucket].append(pre_section_text)
            segmentation_confidence.append(
                _build_confidence_obj(bucket, scores, header_match=False)
            )

        # Process each detected section
        for idx, (start, key) in enumerate(sections):
            end = sections[idx + 1][0] if idx + 1 < len(sections) else len(lines)
            section_text = "\n".join(lines[start + 1:end]).strip()
            if section_text:
                buckets[key].append(section_text)
                segmentation_confidence.append(
                    _build_confidence_obj(key, {}, header_match=True)
                )
    else:
        # No section headers found — classify body by keywords
        body_text = "\n".join(lines[body_start:]).strip()
        if body_text:
            bucket, scores = _classify_by_keywords_with_scores(body_text)
            buckets[bucket].append(body_text)
            segmentation_confidence.append(
                _build_confidence_obj(bucket, scores, header_match=False)
            )

    summary_raw = "\n".join(buckets["summary"]).strip() if buckets["summary"] else ""
    skills_raw = "\n\n".join(buckets["skills"]) if buckets["skills"] else ""
    experience_raw = "\n\n".join(buckets["experience"]) if buckets["experience"] else ""
    explicit_edu = "\n\n".join(buckets["education"]).strip() if buckets["education"] else ""
    explicit_proj = "\n\n".join(buckets["projects"]).strip() if buckets["projects"] else ""
    combined_edu_proj = "\n\n".join(buckets.get("education_projects", [])).strip()

    if not skills_raw and not experience_raw and not explicit_edu and not combined_edu_proj and not raw_name:
        return {
            "status": "error",
            "message": "Unintelligible document structure",
        }

    # Only split if there is an explicit combined header OR if no separate projects section exists
    # and education has a clear projects sub-header. Never split standard standalone education!
    if combined_edu_proj:
        edu_part, proj_part, split_ambiguous = _split_education_projects(combined_edu_proj)
        education_raw = f"{explicit_edu}\n\n{edu_part}".strip() if explicit_edu else edu_part
        if explicit_proj and proj_part:
            projects_raw = f"{explicit_proj}\n\n{proj_part}".strip()
        else:
            projects_raw = explicit_proj or proj_part
    elif not explicit_proj and explicit_edu and _has_project_subheader(explicit_edu):
        education_raw, projects_raw, split_ambiguous = _split_education_projects(explicit_edu)
    else:
        # Separate education and projects exist cleanly, or no projects sub-header in education
        education_raw = explicit_edu
        projects_raw = explicit_proj
        split_ambiguous = False

    achievements_raw = "\n\n".join(buckets["achievements"]).strip() if buckets["achievements"] else ""

    return {
        "status": "success",
        "metadata": {
            "raw_name_text": raw_name,
            "raw_contact_text": raw_contact,
            "links": profile_links,
        },
        "summary_raw": summary_raw,
        "skills_block_raw": skills_raw,
        "experience_block_raw": experience_raw,
        "education_raw": education_raw,
        "projects_raw": projects_raw,
        "achievements_raw": achievements_raw,
        "segmentation_confidence": segmentation_confidence,
    }
