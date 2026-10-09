import sys
from pathlib import Path
from typing import Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.resources.project_scoring_patterns import (
    COMPLEXITY_CATEGORIES,
    TOY_APP_PATTERN,
    METRIC_PATTERNS,
    PROJECT_ROLE_PRESETS,
)
from ml.resources.skill_aliases import SKILL_ALIAS_MAP


def _canonicalize_skill(skill: str) -> str:
    """Normalize skill name via alias map."""
    if not skill or not isinstance(skill, str):
        return ""
    clean = skill.strip().lower()
    return SKILL_ALIAS_MAP.get(clean, skill.strip())


def _score_project_stack(
    tech_stack: list[str],
    required_skills: list[str],
    preferred_skills: list[str],
) -> tuple[float, list[str]]:
    """Score alignment between project tech stack and JD skills."""
    if not required_skills and not preferred_skills:
        return 100.0, list(tech_stack or [])

    if not tech_stack or not isinstance(tech_stack, list):
        return 0.0, []

    proj_canon_map = {_canonicalize_skill(s).lower(): s for s in tech_stack if s}
    req_canon = [_canonicalize_skill(s) for s in (required_skills or []) if s]
    pref_canon = [_canonicalize_skill(s) for s in (preferred_skills or []) if s]

    matched: list[str] = []
    req_matches = 0
    for req in req_canon:
        if req.lower() in proj_canon_map:
            req_matches += 1
            matched.append(proj_canon_map[req.lower()])

    pref_matches = 0
    for pref in pref_canon:
        if pref.lower() in proj_canon_map:
            pref_matches += 1
            if proj_canon_map[pref.lower()] not in matched:
                matched.append(proj_canon_map[pref.lower()])

    num_req = len(req_canon)
    num_pref = len(pref_canon)

    if num_req > 0 and num_pref > 0:
        req_ratio = min(1.0, req_matches / num_req)
        pref_ratio = min(1.0, pref_matches / num_pref)
        score = (0.80 * req_ratio + 0.20 * pref_ratio) * 100.0
    elif num_req > 0:
        score = min(1.0, req_matches / num_req) * 100.0
    elif num_pref > 0:
        score = min(1.0, pref_matches / num_pref) * 100.0
    else:
        score = 100.0

    # Base credit if candidate demonstrates a solid multi-skill tech stack
    if score == 0.0 and len(tech_stack) >= 3:
        score = 25.0

    return round(score, 1), matched


def _score_project_complexity(
    description: str,
    tech_stack: list[str],
) -> tuple[float, list[str]]:
    """Score architectural depth and engineering complexity."""
    combined_text = f"{description or ''} {' '.join(tech_stack or [])}"
    if not combined_text.strip():
        return 0.0, []

    matched_categories: list[str] = []
    for cat_name, pattern in COMPLEXITY_CATEGORIES.items():
        if pattern.search(combined_text):
            matched_categories.append(cat_name)

    num_categories = len(matched_categories)
    if num_categories >= 3:
        score = 100.0
    elif num_categories == 2:
        score = 85.0
    elif num_categories == 1:
        score = 65.0
    else:
        words = len(combined_text.split())
        score = 45.0 if words >= 20 else 25.0

    # Discount detected generic toy apps
    if TOY_APP_PATTERN.search(combined_text):
        score = max(15.0, score - 40.0)
        matched_categories.append("toy_app_discount")

    return round(score, 1), matched_categories


def _score_project_metrics(description: str) -> tuple[float, list[str]]:
    """Score presence of concrete performance metrics and benchmarks."""
    if not description or not isinstance(description, str) or not description.strip():
        return 0.0, []

    matched_metrics: list[str] = []
    seen_matches: set[str] = set()

    for pattern in METRIC_PATTERNS:
        for match in pattern.finditer(description):
            snippet = match.group(0).strip()
            s_lower = snippet.lower()
            if s_lower not in seen_matches:
                seen_matches.add(s_lower)
                matched_metrics.append(snippet)

    num_metrics = len(matched_metrics)
    if num_metrics >= 3:
        score = 100.0
    elif num_metrics == 2:
        score = 85.0
    elif num_metrics == 1:
        score = 65.0
    else:
        score = 25.0

    return round(score, 1), matched_metrics[:6]


def _extract_project_text(project_name: str, desc: str, projects_raw: str) -> str:
    """Combine structured description with raw project section text."""
    combined = [desc or ""]
    if projects_raw and isinstance(projects_raw, str):
        name_clean = project_name.strip().lower()
        if name_clean and name_clean in projects_raw.lower():
            lines = projects_raw.split("\n")
            collecting = False
            for line in lines:
                l_strip = line.strip()
                if name_clean in l_strip.lower():
                    collecting = True
                    combined.append(l_strip)
                    continue
                if collecting:
                    if (l_strip.startswith("- ") or l_strip.startswith("• ")) and any(sep in l_strip for sep in (":", "|", "[")):
                        break
                    combined.append(l_strip)
    return " ".join(combined)


def score_projects(
    candidate_data: dict,
    required_skills: Optional[list[str]] = None,
    preferred_skills: Optional[list[str]] = None,
    preset: str = "balanced",
    custom_weights: Optional[dict[str, float]] = None,
) -> dict:
    """Compute unified project score using stack alignment, complexity, and metrics."""
    if custom_weights and isinstance(custom_weights, dict):
        base_weights = custom_weights
        preset_name = "custom"
    else:
        preset_name = preset.lower() if preset else "balanced"
        base_weights = PROJECT_ROLE_PRESETS.get(
            preset_name, PROJECT_ROLE_PRESETS["balanced"]
        )

    weights = {
        "stack_alignment": float(base_weights.get("stack_alignment", 0.0)),
        "complexity": float(base_weights.get("complexity", 0.0)),
        "impact_metrics": float(base_weights.get("impact_metrics", 0.0)),
    }

    total_w = sum(weights.values())
    if total_w > 0:
        norm_weights = {k: v / total_w for k, v in weights.items()}
    else:
        norm_weights = {"stack_alignment": 0.40, "complexity": 0.35, "impact_metrics": 0.25}

    projects = candidate_data.get("projects", [])
    projects_raw = candidate_data.get("projects_raw", "")

    if not projects or not isinstance(projects, list):
        return {
            "projects_score": 0.0,
            "sub_scores": {k: 0.0 for k in norm_weights},
            "active_weights": {k: round(v, 2) for k, v in norm_weights.items()},
            "preset_used": preset_name,
            "evaluated_projects": [],
        }

    evaluated_projects = []
    for proj in projects:
        if not isinstance(proj, dict):
            continue

        name = proj.get("name", "Untitled Project")
        desc = proj.get("description", "")
        tech_stack = proj.get("tech_stack", [])

        full_text = _extract_project_text(name, desc, projects_raw)

        s_stack, matched_skills = _score_project_stack(
            tech_stack=tech_stack,
            required_skills=required_skills or [],
            preferred_skills=preferred_skills or [],
        )
        s_complex, complex_cats = _score_project_complexity(
            description=full_text,
            tech_stack=tech_stack,
        )
        s_metrics, matched_metrics = _score_project_metrics(
            description=full_text,
        )

        proj_composite = (
            norm_weights["stack_alignment"] * s_stack
            + norm_weights["complexity"] * s_complex
            + norm_weights["impact_metrics"] * s_metrics
        )

        evaluated_projects.append({
            "name": name,
            "composite_score": round(proj_composite, 1),
            "sub_scores": {
                "stack_alignment": round(s_stack, 1),
                "complexity": round(s_complex, 1),
                "impact_metrics": round(s_metrics, 1),
            },
            "evidence": {
                "matched_skills": matched_skills,
                "complexity_categories": complex_cats,
                "metrics_detected": matched_metrics,
            },
        })

    if not evaluated_projects:
        return {
            "projects_score": 0.0,
            "sub_scores": {k: 0.0 for k in norm_weights},
            "active_weights": {k: round(v, 2) for k, v in norm_weights.items()},
            "preset_used": preset_name,
            "evaluated_projects": [],
        }

    # Sort projects descending by composite score
    evaluated_projects.sort(key=lambda p: p["composite_score"], reverse=True)

    # Weighted distribution: 1st project (60%), 2nd (30%), 3rd (10%)
    rank_weights = [0.60, 0.30, 0.10]
    num_proj = len(evaluated_projects)

    if num_proj == 1:
        distribution = [1.0]
    elif num_proj == 2:
        distribution = [0.65, 0.35]
    else:
        distribution = rank_weights[:num_proj]
        dist_sum = sum(distribution)
        distribution = [w / dist_sum for w in distribution]

    overall_projects_score = sum(
        evaluated_projects[i]["composite_score"] * distribution[i]
        for i in range(len(distribution))
    )

    avg_sub_scores = {
        k: round(
            sum(p["sub_scores"][k] for p in evaluated_projects) / len(evaluated_projects), 1
        )
        for k in norm_weights
    }

    return {
        "projects_score": round(overall_projects_score, 1),
        "sub_scores": avg_sub_scores,
        "active_weights": {k: round(v, 2) for k, v in norm_weights.items()},
        "preset_used": preset_name,
        "evaluated_projects": evaluated_projects,
    }
