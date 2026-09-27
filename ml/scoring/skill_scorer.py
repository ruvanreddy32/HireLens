import sys
import logging
from pathlib import Path
from typing import Optional, Union

# Ensure repository root is on sys.path when executed directly as a script
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.scoring.skill_overlap_scorer import (
    compute_skill_overlap_score,
    _parse_skills_block,
    _deduplicate_preserve_order,
)
from ml.scoring.graph_expansion_scorer import compute_graph_expansion_score

logger = logging.getLogger(__name__)


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


def score_candidate_skills(
    candidate_data: Union[dict, list, str],
    required_skills: list[str],
    preferred_skills: Optional[list[str]] = None,
    required_weight: float = 0.80,
    preferred_weight: float = 0.20,
    graph_depth: int = 2,
    graph_depth_penalty: float = 0.5,
) -> dict:
    """Compute unified skill score with direct matches and graph expansion."""
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
        return {
            "skill_score": 0.0,
            "required_effective_score": 0.0,
            "preferred_score": 0.0,
            "breakdown": {
                "direct_matches": [],
                "graph_recovered": [],
                "unrecovered_missing": req_skills,
                "preferred_matched": [],
                "preferred_missing": pref_skills,
            },
            "metadata": {
                "candidate_skills_count": 0,
                "required_count": len(req_skills),
                "preferred_count": len(pref_skills),
                "weights": {"required": w_req, "preferred": w_pref},
            },
        }


    overlap_res = compute_skill_overlap_score(
        skills_block_raw=candidate_skills,
        required_skills=req_skills,
        preferred_skills=pref_skills,
    )

    matched_required: list[str] = overlap_res.get("matched_required", [])
    matched_preferred: list[str] = overlap_res.get("matched_preferred", [])
    missing_required: list[str] = overlap_res.get("missing_required", [])
    missing_preferred: list[str] = overlap_res.get("missing_preferred", [])

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
        # Clamp to 1.0 to prevent floating over-accumulation
        effective_req_ratio = min(1.0, total_required_credit / num_req)
        required_effective_score = effective_req_ratio * 100.0
    else:
        # If JD specifies no required skills, default to full credit
        required_effective_score = 100.0

    # 2. Preferred Score (Direct matches against preferred list)
    if num_pref > 0:
        preferred_ratio = min(1.0, len(matched_preferred) / num_pref)
        preferred_score = preferred_ratio * 100.0
    else:
        # If no preferred skills in JD, neutral 100.0 or 0 depending on presence
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

    return {
        "skill_score": round(skill_score, 1),
        "required_effective_score": round(required_effective_score, 1),
        "preferred_score": round(preferred_score, 1),
        "breakdown": {
            "direct_matches": matched_required,
            "graph_recovered": graph_recovered_items,
            "unrecovered_missing": unrecovered_missing,
            "preferred_matched": matched_preferred,
            "preferred_missing": missing_preferred,
        },
        "metadata": {
            "candidate_skills_count": len(candidate_skills),
            "required_count": num_req,
            "preferred_count": num_pref,
            "weights": {"required": round(w_req, 2), "preferred": round(w_pref, 2)},
        },
    }