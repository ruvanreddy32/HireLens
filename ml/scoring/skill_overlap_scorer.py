import re
import sys
import logging
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from rapidfuzz import fuzz, process
from ml.resources.skill_aliases import SKILL_ALIAS_MAP

logger = logging.getLogger(__name__)


def _parse_skills_block(skills_block_raw: str) -> list[str]:
    """Parse raw skills section text into a list of cleaned skill names."""
    if not skills_block_raw or not skills_block_raw.strip():
        return []

    skills: list[str] = []
    seen_lower: set[str] = set()

    for line in skills_block_raw.split("\n"):
        line = line.strip()
        if not line:
            continue

        # Strip bullet prefixes and category headers (e.g. "Languages:")
        line = re.sub(r"^\s*[-•*]\s+", "", line)
        colon_match = re.match(r"^[A-Za-z0-9\s&/\-]+\s*:\s*", line)
        if colon_match:
            line = line[colon_match.end():]
        line = re.sub(r"^\s*[-•*]\s+", "", line)

        # Normalize inline separators and split tokens
        line = re.sub(r"\s+[-•*]\s+", " | ", line)
        tokens = re.split(r"\s*[|;,]\s*", line)

        for token in tokens:
            token = token.strip()
            if not token:
                continue

            # Strip parenthetical annotations (e.g. "Python (3 years)")
            token = re.sub(r"\s*\([^)]*\)\s*$", "", token).strip("-•* \t")
            if not token:
                continue

            lower = token.lower()
            if lower not in seen_lower:
                seen_lower.add(lower)
                skills.append(token)

    return skills


def _resolve_alias(skill: str) -> str:
    """Map a skill string to its canonical form via alias map."""
    return SKILL_ALIAS_MAP.get(skill.lower().strip(), skill)


def _canonicalise_skill_list(
    raw_skills: list[str],
    reference_vocab: list[str],
    score_cutoff: int = 82,
) -> list[str]:
    """Fuzzy match and canonicalize skill strings against a reference vocabulary."""
    if not raw_skills:
        return []

    if not reference_vocab:
        return [_resolve_alias(s) for s in raw_skills]

    canonical: list[str] = []
    for skill in raw_skills:
        resolved = _resolve_alias(skill)
        # Use stricter cutoff for short names (<= 3 chars) to avoid false positives
        effective_cutoff = 95 if len(resolved) <= 3 else score_cutoff

        match_result = process.extractOne(
            resolved,
            reference_vocab,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=effective_cutoff,
        )

        canonical.append(match_result[0] if match_result is not None else resolved)

    return canonical


def _deduplicate_preserve_order(items: list[str]) -> list[str]:
    """Remove duplicates while preserving original order and casing."""
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        lower = item.lower()
        if lower not in seen:
            seen.add(lower)
            result.append(item)
    return result


def compute_skill_overlap_score(
    skills_block_raw: str | list[str] | list[dict],
    required_skills: list[str],
    preferred_skills: list[str],
) -> dict:
    """Compute fuzzy match overlap between candidate skills and JD requirements."""
    empty_result: dict = {
        "final_overlap_score": 0.0,
        "required_match_score": 0.0,
        "preferred_match_score": 0.0,
        "matched_required": [],
        "matched_preferred": [],
        "missing_required": list(required_skills) if required_skills else [],
        "missing_preferred": list(preferred_skills) if preferred_skills else [],
        "candidate_skills_parsed": [],
    }

    try:
        # 1. Parse raw candidate skills
        if isinstance(skills_block_raw, list):
            raw_list: list[str] = []
            for item in skills_block_raw:
                if isinstance(item, dict) and "name" in item:
                    raw_list.append(str(item["name"]))
                elif isinstance(item, str):
                    raw_list.append(item)
            parsed_skills = _deduplicate_preserve_order(
                [s.strip("-•* \t") for s in raw_list if s and str(s).strip("-•* \t")]
            )
        elif isinstance(skills_block_raw, str):
            parsed_skills = _parse_skills_block(skills_block_raw)
        else:
            parsed_skills = []

        if not parsed_skills:
            logger.warning("skill_overlap_scorer: zero parsed skills found.")
            return empty_result

        # 2. Build reference vocabulary from JD requirements
        jd_required_resolved = [_resolve_alias(s) for s in (required_skills or [])]
        jd_preferred_resolved = [_resolve_alias(s) for s in (preferred_skills or [])]
        reference_vocab = _deduplicate_preserve_order(
            jd_required_resolved + jd_preferred_resolved
        )

        # 3. Canonicalize candidate skills against JD vocabulary
        candidate_canonical = _canonicalise_skill_list(
            parsed_skills, reference_vocab, score_cutoff=82
        )
        candidate_canonical = _deduplicate_preserve_order(candidate_canonical)
        candidate_set_lower = {s.lower() for s in candidate_canonical}

        # 4. Compute matches and missing skills
        matched_required: list[str] = []
        missing_required: list[str] = []
        for skill in jd_required_resolved:
            if skill.lower() in candidate_set_lower:
                matched_required.append(skill)
            else:
                missing_required.append(skill)

        matched_preferred: list[str] = []
        missing_preferred: list[str] = []
        for skill in jd_preferred_resolved:
            if skill.lower() in candidate_set_lower:
                matched_preferred.append(skill)
            else:
                missing_preferred.append(skill)

        # 5. Compute match scores
        required_match_score = (
            len(matched_required) / len(jd_required_resolved)
            if jd_required_resolved
            else 0.0
        )
        preferred_match_score = (
            len(matched_preferred) / len(jd_preferred_resolved)
            if jd_preferred_resolved
            else 0.0
        )

        # Weighted final score: required skills weighted 75%, preferred 25%
        final_overlap_score = (
            0.75 * required_match_score + 0.25 * preferred_match_score
        )

        return {
            "final_overlap_score": round(final_overlap_score, 4),
            "required_match_score": round(required_match_score, 4),
            "preferred_match_score": round(preferred_match_score, 4),
            "matched_required": matched_required,
            "matched_preferred": matched_preferred,
            "missing_required": missing_required,
            "missing_preferred": missing_preferred,
            "candidate_skills_parsed": candidate_canonical,
        }

    except Exception as e:
        logger.error("skill_overlap_scorer error: %s", e, exc_info=True)
        return empty_result
