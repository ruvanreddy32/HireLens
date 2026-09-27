# ============================================================================
# experience_parser.py — Structured Experience Entry Extractor
# Takes the flat `experience_block_raw` string produced by section_segmenter 
# and returns a list of structured job-entry dicts.

# ============================================================================

import re
import math
from datetime import datetime
from typing import Optional

try:
    from dateutil import parser as dateutil_parser
except ImportError:
    dateutil_parser = None  # graceful fallback — we have manual regex parsing

from backend.ml.resources.experience_patterns import (
    ROLE_KEYWORDS as _ROLE_KEYWORDS,
    PRESENT_TOKENS as _PRESENT_TOKENS,
    MONTH_MAP as _MONTH_MAP,
    DATE_RANGE_RE as _DATE_RANGE_RE,
    HAS_DATE_RANGE_RE as _HAS_DATE_RANGE_RE,
    ROLE_COMPANY_SEP_RE as _ROLE_COMPANY_SEP_RE,
    BULLET_RE as _BULLET_RE,
    BLANK_RE as _BLANK_RE,
    KNOWN_CITIES as _KNOWN_CITIES,
    KNOWN_CITY_PHRASES as _KNOWN_CITY_PHRASES,
    LOCATION_INLINE_RE as _LOCATION_INLINE_RE,
    LOCATION_STANDALONE_RE as _LOCATION_STANDALONE_RE,
)


# ---------------------------------------------------------------------------
# Date parsing helpers
# ---------------------------------------------------------------------------

def _parse_single_date(raw: str) -> Optional[datetime]:
   
    if not raw:
        return None

    cleaned = raw.strip().lower()

    # Handle present-like tokens → today
    if cleaned in _PRESENT_TOKENS:
        return datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Attempt dateutil first (most flexible)
    if dateutil_parser is not None:
        try:
            # dayfirst=False so "06/2020" isn't treated as day-first
            return dateutil_parser.parse(raw, dayfirst=False, default=datetime(2000, 1, 1))
        except (ValueError, OverflowError):
            pass  # fall through to manual extraction

    # --- Manual regex fallback ---

    # Numeric month/year: "06/2020" or "6-2020"
    m = re.match(r"(\d{1,2})[/\-](\d{4})", cleaned)
    if m:
        month, year = int(m.group(1)), int(m.group(2))
        if 1 <= month <= 12:
            return datetime(year, month, 1)

    # Month-name + year: "jan 2022", "January 2022"
    m = re.match(r"([a-z]+)\s*,?\s*(\d{4})", cleaned)
    if m:
        month_str, year_str = m.group(1), m.group(2)
        month_num = _MONTH_MAP.get(month_str)
        if month_num:
            return datetime(int(year_str), month_num, 1)

    # Bare year: "2021"
    m = re.match(r"^(\d{4})$", cleaned)
    if m:
        return datetime(int(m.group(1)), 1, 1)

    return None


def _compute_duration_months(start: Optional[datetime], end: Optional[datetime]) -> int:
    """Compute duration in months between two datetimes, rounding partial months up.

    Returns 0 if either date is None or if end < start.
    """
    if not start or not end:
        return 0
    if end < start:
        return 0

    # Total months difference, rounding partial months up
    month_diff = (end.year - start.year) * 12 + (end.month - start.month)

    # If there are remaining days, round up
    if end.day > start.day:
        month_diff += 1
    # Minimum 1 month if start == end month/year
    return max(month_diff, 1) if month_diff >= 0 else 0


# ---------------------------------------------------------------------------
# Line-level classification helpers
# ---------------------------------------------------------------------------

def _has_role_keyword(line: str) -> bool:
    """Check if a line contains a common job-title keyword."""
    words = set(re.findall(r"[a-zA-Z]+", line.lower()))
    return bool(words & _ROLE_KEYWORDS)


def _has_separator(line: str) -> bool:
    """Check if a line contains a role/company separator (|, @, or comma
    that sits between two text segments)."""
    return bool(re.search(r"[|@]", line)) or bool(re.search(r"\w\s*,\s*\w", line))


def _is_entry_header(line: str) -> bool:
    
    if not _HAS_DATE_RANGE_RE.search(line):
        return False
    return _has_role_keyword(line) or _has_separator(line)


def _is_bullet(line: str) -> bool:
    """Check if a line starts with a bullet-point marker."""
    return bool(_BULLET_RE.match(line))


def _clean_bullet(line: str) -> str:
    """Strip bullet-point prefix and surrounding whitespace."""
    return _BULLET_RE.sub("", line).strip()



def _is_known_city(text: str) -> bool:
    """Check if text is a recognized single city name or phrase."""
    lowered = text.strip().lower()
    if lowered in _KNOWN_CITIES:
        return True
    if lowered in _KNOWN_CITY_PHRASES:
        return True
    return False


def _extract_dates_from_line(line: str) -> tuple:
    
    m = _DATE_RANGE_RE.search(line)
    if not m:
        return None, None, None, None

    raw_start, raw_end = m.group(1).strip(), m.group(2).strip()
    dt_start = _parse_single_date(raw_start)
    dt_end = _parse_single_date(raw_end)
    return raw_start, raw_end, dt_start, dt_end


def _strip_dates(line: str) -> str:
    """Remove the date-range portion from a line so we can parse the rest."""
    return _DATE_RANGE_RE.sub("", line).strip()


def _strip_location_inline(line: str) -> tuple:
    
    m = _LOCATION_INLINE_RE.search(line)
    if m:
        location = m.group(1).strip()
        cleaned = line[:m.start()] + line[m.end():]
        return cleaned.strip().rstrip("|-,").strip(), location

    # Fallback: check if the last comma-segment is a known city name
    if "," in line:
        last_seg = line.rsplit(",", 1)[1].strip()
        if _is_known_city(last_seg):
            cleaned = line.rsplit(",", 1)[0].strip().rstrip("|-,").strip()
            return cleaned, last_seg

    return line, None


def _strip_location_standalone(line: str) -> tuple:
    
    m = _LOCATION_STANDALONE_RE.match(line.strip())
    if m:
        return "", m.group(1).strip()

    # Check known cities/phrases for standalone lines
    stripped = line.strip()
    if _is_known_city(stripped):
        return "", stripped

    return line, None


def _parse_title_company(text: str) -> tuple:
    
    if not text or not text.strip():
        return None, None

    text = text.strip().rstrip("|-@,").strip()

    # Try splitting on explicit separators: |, @
    for sep in ("|", "@"):
        if sep in text:
            parts = [p.strip() for p in text.split(sep, 1)]
            if len(parts) == 2 and parts[0] and parts[1]:
                return parts[0], parts[1]

    # Handle comma-separated segments.
    # Split on ALL commas and classify each segment to find the title and company.
    if "," in text:
        segments = [s.strip() for s in text.split(",") if s.strip()]

        if len(segments) == 2:
            # Simple case: "Backend Developer, Razorpay"
            left, right = segments[0], segments[1]
            if _has_role_keyword(left):
                return left, right
            if _has_role_keyword(right):
                return right, left
            return left, right

        if len(segments) >= 3:
            # Multi-comma: "Software Engineer, BigCorp, New York"
            # Strategy: the segment with a role keyword is the title,
            # the next segment is the company, remaining are discarded
            # (likely location that wasn't stripped earlier).
            for i, seg in enumerate(segments):
                if _has_role_keyword(seg):
                    company = segments[i + 1] if i + 1 < len(segments) else None
                    return seg, company
            # No role keyword found — treat first as title, second as company
            return segments[0], segments[1]

    # No separator — entire text is the title, company unknown
    return text if text else None, None


# ---------------------------------------------------------------------------
# Main entry parser
# ---------------------------------------------------------------------------

def parse_experience_entries(experience_block_raw: str) -> list[dict]:
   
    if not experience_block_raw or not experience_block_raw.strip():
        return []

    lines = experience_block_raw.split("\n")
    entries: list[dict] = []

    # ---- Phase 1: Split into raw entry blocks using header detection -----
    # Each block = [header_line(s), ...bullet/body lines]
    entry_blocks: list[list[str]] = []
    current_block: list[str] = []

    for line in lines:
        if _BLANK_RE.match(line):
            # Blank lines within a block are fine; skip leading blanks
            if current_block:
                current_block.append(line)
            continue

        if _is_entry_header(line):
            # Flush previous block
            if current_block:
                entry_blocks.append(current_block)
            current_block = [line]
        else:
            # Continuation of current block — could be a second header line
            # (company on its own line), a bullet, or body text.
            current_block.append(line)

    # Flush the last block
    if current_block:
        entry_blocks.append(current_block)

    # Handle edge case: no entry headers detected at all.
    # Try a more aggressive split — look for ANY line with a date range.
    if not entry_blocks:
        # Re-scan with date-range-only heuristic
        current_block = []
        for line in lines:
            if _BLANK_RE.match(line):
                if current_block:
                    current_block.append(line)
                continue
            if _HAS_DATE_RANGE_RE.search(line):
                if current_block:
                    entry_blocks.append(current_block)
                current_block = [line]
            else:
                current_block.append(line)
        if current_block:
            entry_blocks.append(current_block)

    # ---- Phase 2: Parse each block into a structured entry ---------------
    for block in entry_blocks:
        entry = _parse_entry_block(block)
        if entry:
            entries.append(entry)

    return entries


def _parse_entry_block(block: list[str]) -> Optional[dict]:
    """Parse a single entry block (header line(s) + bullets) into a dict.

    Returns None if the block is entirely unparseable.
    """
    if not block:
        return None

    # Strip trailing blank lines
    while block and _BLANK_RE.match(block[-1]):
        block.pop()
    if not block:
        return None

    # --- Extract dates from the first line that contains them ---
    header_line_idx = 0
    start_date_str = end_date_str = None
    start_dt = end_dt = None

    for i, line in enumerate(block):
        s, e, sd, ed = _extract_dates_from_line(line)
        if s is not None:
            start_date_str, end_date_str = s, e
            start_dt, end_dt = sd, ed
            header_line_idx = i
            break

    # --- Build the "header text" by combining non-bullet, non-blank lines
    # up to (and including) the date line, plus possibly the next line if
    # it looks like a company name or location (short, non-bullet, no date,
    # not a full sentence). ---
    header_lines = []
    body_start = 0

    for i, line in enumerate(block):
        stripped = line.strip()
        if not stripped:
            continue
        if i <= header_line_idx:
            header_lines.append(stripped)
            body_start = i + 1
        elif i <= header_line_idx + 2 and not _is_bullet(stripped) and not _HAS_DATE_RANGE_RE.search(stripped):
            # Possible continuation header line: company or location on its own
            # line. Guard against absorbing body text by checking line length
            # and word count — real company/location lines are short.
            if len(stripped.split()) <= 6 and len(stripped) < 60:
                header_lines.append(stripped)
                body_start = i + 1
            else:
                body_start = i
                break
        else:
            body_start = i
            break

    # --- Extract bullets from remaining lines ---
    bullets = []
    current_bullet = None
    for i in range(body_start, len(block)):
        line = block[i]
        stripped = line.strip()
        if not stripped:
            # Blank line terminates current bullet continuation
            if current_bullet:
                bullets.append(current_bullet)
                current_bullet = None
            continue

        if _is_bullet(stripped):
            if current_bullet:
                bullets.append(current_bullet)
            current_bullet = _clean_bullet(stripped)
        elif current_bullet:
            # Continuation of a multi-line bullet (indented text without a new marker)
            current_bullet += " " + stripped
        else:
            # Non-bullet body text after the header — could be an implicit bullet
            # (starts with a capital letter after a newline, common in some resumes)
            if stripped[0].isupper() and len(stripped) > 20:
                if current_bullet:
                    bullets.append(current_bullet)
                current_bullet = stripped
            # else: discard noise/orphan lines

    if current_bullet:
        bullets.append(current_bullet)

    # --- Parse header text: process each header line individually to
    # find the location, then combine the non-location, non-date lines
    # for title/company extraction. ---
    location = None

    # First pass: check each header line for a standalone location
    non_loc_header_lines = []
    for hl in header_lines:
        hl_no_dates = _strip_dates(hl)
        # Try standalone first (entire line is a location)
        _, standalone_loc = _strip_location_standalone(hl_no_dates)
        if standalone_loc:
            location = standalone_loc
            # Pure location line — nothing to keep
            continue
        # Try inline location (location at end of line with other content)
        hl_clean, inline_loc = _strip_location_inline(hl_no_dates)
        if inline_loc:
            location = inline_loc
            remainder = hl_clean.strip().rstrip("|-,").strip()
            if remainder and len(remainder) > 2:
                non_loc_header_lines.append(remainder)
        else:
            cleaned = hl_no_dates.strip()
            if cleaned:
                non_loc_header_lines.append(cleaned)

    combined_header = " ".join(non_loc_header_lines)

    # Clean up separator artifacts at edges
    combined_header = re.sub(r"^\s*[|@,\-]\s*", "", combined_header)
    combined_header = re.sub(r"\s*[|@,\-]\s*$", "", combined_header)
    combined_header = combined_header.strip()

    # If no location found yet, try inline extraction from the combined header
    if location is None:
        combined_header, location = _strip_location_inline(combined_header)
        combined_header = combined_header.strip().rstrip("|-,").strip()

    # Handle "Role on one line, Company on next line" pattern
    title, company = None, None
    if len(non_loc_header_lines) >= 2 and "|" not in combined_header and "@" not in combined_header:
        # Use non_loc_header_lines (already stripped of dates and location)
        first_clean = non_loc_header_lines[0].strip().rstrip("|-@,").strip()
        second_clean = non_loc_header_lines[1].strip().rstrip("|-@,").strip()

        # Only apply multi-line logic if neither line contains a comma separator
        # (comma-separated lines are handled by _parse_title_company instead)
        if "," not in first_clean and "," not in second_clean:
            if first_clean and second_clean:
                if _has_role_keyword(first_clean):
                    title, company = first_clean, second_clean
                elif _has_role_keyword(second_clean):
                    title, company = second_clean, first_clean
                else:
                    # Ambiguous — treat first as title, second as company
                    title, company = first_clean, second_clean

    # Fallback: parse from combined header using separator logic
    if title is None:
        title, company = _parse_title_company(combined_header)

    # --- Compute duration ---
    duration = _compute_duration_months(start_dt, end_dt)

    # --- If we got absolutely nothing useful, skip this entry ---
    if not title and not company and not start_date_str and not bullets:
        return None

    return {
        "title": title or None,
        "company": company or None,
        "start_date": start_date_str or None,
        "end_date": end_date_str or None,
        "duration_months": duration,
        "location": location or None,
        "bullets": bullets,
    }


def compute_total_experience_months(entries: list[dict]) -> int:
    if not entries:
        return 0

    # Collect parsed intervals
    intervals: list[tuple[datetime, datetime]] = []
    for entry in entries:
        start_dt = _parse_single_date(entry.get("start_date") or "")
        end_dt = _parse_single_date(entry.get("end_date") or "")
        if start_dt and end_dt and end_dt >= start_dt:
            intervals.append((start_dt, end_dt))

    if not intervals:
        return 0

    # Sort by start date
    intervals.sort(key=lambda iv: iv[0])

    # Merge overlapping intervals
    merged: list[tuple[datetime, datetime]] = [intervals[0]]
    for start, end in intervals[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end:
            # Overlapping or contiguous — extend the current interval
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))

    # Sum durations of merged intervals
    total = 0
    for start, end in merged:
        total += _compute_duration_months(start, end)

    return total
