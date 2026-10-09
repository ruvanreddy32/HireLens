"""Unified skill scoring engine combining alias mapping, fuzzy matching, and graph expansion."""

import logging
import re
import sys
from pathlib import Path
from typing import Optional, Union

# Ensure repository root is on sys.path when executed directly as a script
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from rapidfuzz import fuzz, process
from ml.resources.skill_aliases import SKILL_ALIAS_MAP
from ml.scoring.graph_expansion_scorer import compute_graph_expansion_score

logger = logging.getLogger(__name__)


# String & Vocabulary Helpers

def _resolve_alias(skill: str) -> str:
    """Map a skill string to its canonical form via alias map."""
    return SKILL_ALIAS_MAP.get(skill.lower().strip(), skill.strip())


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


# Candidate Skill Harvesting

def extract_all_candidate_skills(
    candidate_data: Union[dict, list, str],
) -> list[str]:
    """Harvest and deduplicate skills across all parsed resume sections."""
    if not candidate_data:
        return []

    collected: list[str] = []

    # Case A: candidate_data is a raw string
    if isinstance(candidate_data, str):
        return _parse_skills_block(candidate_data)

    # Case B: candidate_data is a list (strings or dicts)
    if isinstance(candidate_data, list):
        for item in candidate_data:
            if isinstance(item, dict) and "name" in item:
                collected.append(str(item["name"]))
            elif isinstance(item, str):
                collected.append(item)
        return _deduplicate_preserve_order(
            [s.strip("-•* \t") for s in collected if s and str(s).strip("-•* \t")]
        )

    # Case C: candidate_data is a full parsed resume dict
    if isinstance(candidate_data, dict):
        # 1. Primary: dedicated structured skills list
        skills_entries = candidate_data.get("skills", [])
        if isinstance(skills_entries, list):
            for entry in skills_entries:
                if isinstance(entry, dict) and "name" in entry:
                    collected.append(str(entry["name"]))
                elif isinstance(entry, str):
                    collected.append(entry)

        # 2. Tech stacks mentioned in projects
        projects = candidate_data.get("projects", [])
        if isinstance(projects, list):
            for proj in projects:
                if isinstance(proj, dict):
                    stack = proj.get("tech_stack", [])
                    if isinstance(stack, list):
                        for s in stack:
                            if isinstance(s, str):
                                collected.append(s)

        # 3. Skills mentioned in experience entries
        experiences = candidate_data.get("experience_entries", [])
        if isinstance(experiences, list):
            for exp in experiences:
                if isinstance(exp, dict):
                    mentioned = exp.get("mentioned_skills", [])
                    if isinstance(mentioned, list):
                        for s in mentioned:
                            if isinstance(s, str):
                                collected.append(s)

        # 4. Fallback: if nothing harvested yet, parse raw skills block
        if not collected and candidate_data.get("skills_block_raw"):
            collected.extend(_parse_skills_block(candidate_data["skills_block_raw"]))

    # Clean and deduplicate case-insensitively while preserving original casing
    cleaned_skills: list[str] = []
    seen_lower: set[str] = set()

    for skill in collected:
        s = skill.strip("-•* \t")
        if not s:
            continue
        lower = s.lower()
        if lower not in seen_lower:
            seen_lower.add(lower)
            cleaned_skills.append(s)

    return cleaned_skills


# Direct Matching Helper

def compute_direct_skill_matches(
    candidate_skills: list[str],
    required_skills: list[str],
    preferred_skills: list[str],
) -> tuple[list[str], list[str], list[str], list[str], list[str]]:
    """Match candidate skills against JD vocabulary using aliases and rapidfuzz."""
    jd_required_resolved = [_resolve_alias(s) for s in (required_skills or []) if s and s.strip()]
    jd_preferred_resolved = [_resolve_alias(s) for s in (preferred_skills or []) if s and s.strip()]
    reference_vocab = _deduplicate_preserve_order(
        jd_required_resolved + jd_preferred_resolved
    )

    candidate_canonical = _canonicalise_skill_list(
        candidate_skills, reference_vocab, score_cutoff=82
    )
    candidate_canonical = _deduplicate_preserve_order(candidate_canonical)
    candidate_set_lower = {s.lower() for s in candidate_canonical}

    matched_required = [s for s in jd_required_resolved if s.lower() in candidate_set_lower]
    missing_required = [s for s in jd_required_resolved if s.lower() not in candidate_set_lower]
    matched_preferred = [s for s in jd_preferred_resolved if s.lower() in candidate_set_lower]
    missing_preferred = [s for s in jd_preferred_resolved if s.lower() not in candidate_set_lower]

    return matched_required, missing_required, matched_preferred, missing_preferred, candidate_canonical


# Backward-compatible overlap score function

def compute_skill_overlap_score(
    skills_block_raw: Union[str, list[str], list[dict]],
    required_skills: list[str],
    preferred_skills: list[str],
) -> dict:
    """Compute fuzzy match overlap between candidate skills and JD requirements."""
    parsed_skills = extract_all_candidate_skills(skills_block_raw)
    if not parsed_skills:
        return {
            "final_overlap_score": 0.0,
            "required_match_score": 0.0,
            "preferred_match_score": 0.0,
            "matched_required": [],
            "matched_preferred": [],
            "missing_required": list(required_skills or []),
            "missing_preferred": list(preferred_skills or []),
            "candidate_skills_parsed": [],
        }

    matched_req, missing_req, matched_pref, missing_pref, candidate_canon = compute_direct_skill_matches(
        candidate_skills=parsed_skills,
        required_skills=required_skills,
        preferred_skills=preferred_skills,
    )

    req_score = len(matched_req) / len(required_skills) if required_skills else 0.0
    pref_score = len(matched_pref) / len(preferred_skills) if preferred_skills else 0.0
    final_score = 0.75 * req_score + 0.25 * pref_score

    return {
        "final_overlap_score": round(final_score, 4),
        "required_match_score": round(req_score, 4),
        "preferred_match_score": round(pref_score, 4),
        "matched_required": matched_req,
        "matched_preferred": matched_pref,
        "missing_required": missing_req,
        "missing_preferred": missing_pref,
        "candidate_skills_parsed": candidate_canon,
    }


# Main Unified Skill Scorer

def score_candidate_skills(
    candidate_data: Union[dict, list, str],
    required_skills: list[str],
    preferred_skills: Optional[list[str]] = None,
    required_weight: float = 0.80,
    preferred_weight: float = 0.20,
    graph_depth: int = 2,
    graph_depth_penalty: float = 0.5,
) -> dict:
    """Compute unified skill score with direct matches, audit metrics, and graph expansion."""
    preferred_skills = preferred_skills or []
    req_skills = [s.strip() for s in (required_skills or []) if s and s.strip()]
    pref_skills = [s.strip() for s in preferred_skills if s and s.strip()]

    # Normalize weights
    total_w = required_weight + preferred_weight
    if total_w > 0:
        w_req = required_weight / total_w
        w_pref = preferred_weight / total_w
    else:
        w_req, w_pref = 0.80, 0.20

    # Harvest all candidate skills across sections
    candidate_skills = extract_all_candidate_skills(candidate_data)

    # Empty inputs guard
    if not candidate_skills:
        logger.warning("score_candidate_skills: No candidate skills found.")
        empty_audit = {
            "matched_required": [],
            "missing_required": req_skills,
            "graph_recovered": [],
            "unrecovered_missing": req_skills,
            "matched_preferred": [],
            "missing_preferred": pref_skills,
        }
        empty_breakdown = {
            "direct_matches": [],
            "graph_recovered": [],
            "unrecovered_missing": req_skills,
            "preferred_matched": [],
            "preferred_missing": pref_skills,
        }
        return {
            "skill_score": 0.0,
            "required_effective_score": 0.0,
            "preferred_score": 0.0,
            "audit": empty_audit,
            "breakdown": empty_breakdown,
            "metadata": {
                "candidate_skills_count": 0,
                "required_count": len(req_skills),
                "preferred_count": len(pref_skills),
                "weights": {"required": w_req, "preferred": w_pref},
            },
        }

    # Direct fuzzy matching
    matched_required, missing_required, matched_preferred, missing_preferred, _ = compute_direct_skill_matches(
        candidate_skills=candidate_skills,
        required_skills=req_skills,
        preferred_skills=pref_skills,
    )

    graph_recovered_items: list[dict] = []
    unrecovered_missing: list[str] = []
    recovered_partial_credits: float = 0.0

    if missing_required:
        expansion_res = compute_graph_expansion_score(
            missing_required=missing_required,
            candidate_skills=candidate_skills,
            max_depth=graph_depth,
            depth_penalty=graph_depth_penalty,
        )

        expansions = expansion_res.get("expansions", [])
        for exp in expansions:
            score = exp.get("partial_score", 0.0)
            missing_name = exp.get("missing_skill", "")
            if score > 0.0:
                recovered_partial_credits += score
                graph_recovered_items.append({
                    "missing_skill": missing_name,
                    "matched_via": exp.get("matched_via"),
                    "via_path": exp.get("via_path"),
                    "credit": round(score, 3),
                    "hop_depth": exp.get("hop_depth"),
                })
            else:
                unrecovered_missing.append(missing_name)
    else:
        unrecovered_missing = []

    num_req = len(req_skills)
    num_pref = len(pref_skills)

    # 1. Effective Required Score (Direct matches count 1.0 each + graph credits)
    if num_req > 0:
        total_required_credit = len(matched_required) + recovered_partial_credits
        effective_req_ratio = min(1.0, total_required_credit / num_req)
        required_effective_score = effective_req_ratio * 100.0
    else:
        required_effective_score = 100.0

    # 2. Preferred Score (Direct matches against preferred list)
    if num_pref > 0:
        preferred_ratio = min(1.0, len(matched_preferred) / num_pref)
        preferred_score = preferred_ratio * 100.0
    else:
        preferred_score = 100.0

    # 3. Final Blended Skill Score
    if num_req > 0 and num_pref > 0:
        skill_score = (w_req * required_effective_score) + (w_pref * preferred_score)
    elif num_req > 0:
        skill_score = required_effective_score
    elif num_pref > 0:
        skill_score = preferred_score
    else:
        skill_score = 100.0

    # Dual contract: "audit" for composite_scorer / frontend, and "breakdown" for backward compatibility
    audit_data = {
        "matched_required": matched_required,
        "missing_required": missing_required,
        "graph_recovered": graph_recovered_items,
        "unrecovered_missing": unrecovered_missing,
        "matched_preferred": matched_preferred,
        "missing_preferred": missing_preferred,
    }

    breakdown_data = {
        "direct_matches": matched_required,
        "graph_recovered": graph_recovered_items,
        "unrecovered_missing": unrecovered_missing,
        "preferred_matched": matched_preferred,
        "preferred_missing": missing_preferred,
    }

    return {
        "skill_score": round(skill_score, 1),
        "required_effective_score": round(required_effective_score, 1),
        "preferred_score": round(preferred_score, 1),
        "audit": audit_data,
        "breakdown": breakdown_data,
        "metadata": {
            "candidate_skills_count": len(candidate_skills),
            "required_count": num_req,
            "preferred_count": num_pref,
            "weights": {"required": round(w_req, 2), "preferred": round(w_pref, 2)},
        },
    }