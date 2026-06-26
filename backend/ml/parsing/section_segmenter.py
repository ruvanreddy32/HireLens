
import re

from backend.ml.resources.segmenter_patterns import (
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
)


def _classify_by_keywords(text):

    words = set(re.findall(r"[a-zA-Z./#+-]+", text.lower()))

    scores = {
        "skills": len(words & _SKILLS_KEYWORDS),
        "experience": len(words & _EXPERIENCE_KEYWORDS),
        "education": len(words & _EDUCATION_KEYWORDS),
    }

    # Boost experience score if date patterns are found
    date_matches = re.findall(
        r"\b(?:19|20)\d{2}\b", text
    )
    scores["experience"] += len(date_matches) * 2

    # Boost experience score for bullet-point heavy text
    bullet_count = text.count("\n-") + text.count("\n•") + text.count("\n*")
    scores["experience"] += bullet_count

    return max(scores, key=scores.get)


def _extract_metadata(lines):

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
    return name_text, raw_contact, header_end


def _detect_section_at_line(line):

    stripped = line.strip()
    if not stripped:
        return None

    for pattern, section_key in _SECTION_PATTERNS:
        if pattern.match(stripped):
            return section_key

    # Fallback: check for ALL-CAPS lines that might be headers
    if stripped.isupper() and len(stripped.split()) <= 5 and len(stripped) > 2:
        upper_text = stripped.lower()
        for pattern, section_key in _SECTION_PATTERNS:
            # Try matching the lowercase version with a more lenient check
            if any(kw in upper_text for kw in _get_section_keywords(section_key)):
                return section_key

    return None


def _get_section_keywords(section_key):
    """Return a set of simple keyword triggers for a given section type."""
    return _SECTION_KEYWORD_TRIGGERS.get(section_key, set())


def detect_sections(sanitized_text):

    if not sanitized_text or not sanitized_text.strip():
        return {
            "status": "error",
            "message": "Unintelligible document structure",
        }

    lines = sanitized_text.split("\n")

    # Step 1: Extract metadata (name + contact) from top
    raw_name, raw_contact, body_start = _extract_metadata(lines)

    # Step 2: Scan for section boundaries
    sections = []  # list of (start_line_idx, section_key)
    for i in range(body_start, len(lines)):
        section_key = _detect_section_at_line(lines[i])
        if section_key:
            sections.append((i, section_key))

    # Step 3: Extract text blocks between section boundaries
    buckets = {
        "skills": [],
        "experience": [],
        "education": [],
        "summary": [],
    }

    if sections:
        # Text between body_start and first section header → classify by keywords
        pre_section_text = "\n".join(lines[body_start:sections[0][0]]).strip()
        if pre_section_text:
            bucket = _classify_by_keywords(pre_section_text)
            buckets[bucket].append(pre_section_text)

        # Process each detected section
        for idx, (start, key) in enumerate(sections):
            # Section text runs from the line after the header to the next header
            end = sections[idx + 1][0] if idx + 1 < len(sections) else len(lines)
            section_text = "\n".join(lines[start + 1:end]).strip()
            if section_text:
                buckets[key].append(section_text)
    else:
        # No section headers found — classify the entire body by keywords
        body_text = "\n".join(lines[body_start:]).strip()
        if body_text:
            bucket = _classify_by_keywords(body_text)
            buckets[bucket].append(body_text)

    # Step 4: Merge summary into metadata contact text (it's profile info)
    if buckets["summary"]:
        summary_text = "\n".join(buckets["summary"])
        if raw_contact:
            raw_contact = raw_contact + "\n" + summary_text
        else:
            raw_contact = summary_text

    # Step 5: Assemble output
    skills_raw = "\n\n".join(buckets["skills"]) if buckets["skills"] else ""
    experience_raw = "\n\n".join(buckets["experience"]) if buckets["experience"] else ""
    education_raw = "\n\n".join(buckets["education"]) if buckets["education"] else ""

    # Validate: if all buckets are empty, it's unintelligible
    if not skills_raw and not experience_raw and not education_raw and not raw_name:
        return {
            "status": "error",
            "message": "Unintelligible document structure",
        }

    return {
        "status": "success",
        "metadata": {
            "raw_name_text": raw_name,
            "raw_contact_text": raw_contact,
        },
        "skills_block_raw": skills_raw,
        "experience_block_raw": experience_raw,
        "education_projects_raw": education_raw,
    }
