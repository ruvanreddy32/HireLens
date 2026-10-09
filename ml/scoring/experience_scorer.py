import sys
from pathlib import Path
from typing import Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.resources.experience_scoring_patterns import (
    SENIORITY_PATTERNS,
    SENIORITY_NAME_TO_LEVEL,
    SENIORITY_LEVEL_TO_NAME,
    SENIORITY_DISTANCE_SCORES,
    STABILITY_TENURE_BINS,
    EXPERIENCE_ROLE_PRESETS,
)


def detect_candidate_seniority(experience_entries: list[dict]) -> tuple[int, str]:
    """Detect candidate seniority level from experience entries."""
    if not experience_entries or not isinstance(experience_entries, list):
        return 0, "intern"

    detected_levels: list[int] = []

    for entry in experience_entries:
        if not isinstance(entry, dict):
            continue
        title = entry.get("title", "")
        if not title or not isinstance(title, str):
            continue

        entry_level = None
        for level, _, pattern in SENIORITY_PATTERNS:
            if pattern.search(title):
                entry_level = level
                break

        if entry_level is not None:
            detected_levels.append(entry_level)

    if not detected_levels:
        return 2, SENIORITY_LEVEL_TO_NAME[2]

    max_level = max(detected_levels)
    return max_level, SENIORITY_LEVEL_TO_NAME[max_level]


def score_tenure_fit(
    total_experience_months: int,
    target_yoe: Optional[float] = None,
) -> float:
    """Score career tenure against target YoE."""
    if target_yoe is None:
        return 100.0

    target_months = max(0.0, float(target_yoe) * 12.0)

    # Entry-level / fresher roles (0 YoE target)
    if target_months == 0.0:
        if total_experience_months <= 12:
            return 100.0
        elif total_experience_months <= 24:
            return 90.0
        elif total_experience_months <= 36:
            return 80.0
        else:
            return 70.0

    if total_experience_months >= target_months:
        return 100.0

    ratio = total_experience_months / target_months
    return round(min(100.0, ratio * 100.0), 1)


def score_seniority_fit(
    detected_level: int,
    target_seniority: Optional[str] = None,
) -> float:
    """Score seniority alignment between candidate and target role."""
    if not target_seniority:
        return 100.0

    target_key = str(target_seniority).strip().lower()
    target_level = SENIORITY_NAME_TO_LEVEL.get(target_key, 2)

    diff = detected_level - target_level
    diff_clamped = max(-4, min(4, diff))
    return SENIORITY_DISTANCE_SCORES.get(diff_clamped, 50.0)


def score_stability(experience_entries: list[dict]) -> tuple[float, float, int]:
    """Score tenure consistency and job stability across companies."""
    if not experience_entries or not isinstance(experience_entries, list):
        return 100.0, 0.0, 0

    valid_entries = []
    for entry in experience_entries:
        if isinstance(entry, dict) and entry.get("duration_months") is not None:
            months = max(1, int(entry["duration_months"]))
            valid_entries.append(months)

    company_count = len(valid_entries)

    if company_count <= 1:
        avg_months = float(valid_entries[0]) if company_count == 1 else 0.0
        return 100.0, avg_months, company_count

    avg_tenure = sum(valid_entries) / company_count

    score = 20.0
    for threshold, pts in STABILITY_TENURE_BINS:
        if avg_tenure >= threshold:
            score = pts
            break

    return score, round(avg_tenure, 1), company_count


def score_experience(
    candidate_data: dict,
    target_yoe: Optional[float] = None,
    target_seniority: Optional[str] = None,
    preset: str = "balanced",
    custom_weights: Optional[dict[str, float]] = None,
) -> dict:
    """Compute unified experience score using tenure, seniority, and stability."""
    if custom_weights and isinstance(custom_weights, dict):
        base_weights = custom_weights
        preset_name = "custom"
    else:
        preset_name = preset.lower() if preset else "balanced"
        base_weights = EXPERIENCE_ROLE_PRESETS.get(
            preset_name, EXPERIENCE_ROLE_PRESETS["balanced"]
        )

    weights = {
        "tenure_fit": float(base_weights.get("tenure_fit", 0.0)),
        "seniority_fit": float(base_weights.get("seniority_fit", 0.0)),
        "stability": float(base_weights.get("stability", 0.0)),
    }

    total_w = sum(weights.values())
    if total_w > 0:
        norm_weights = {k: v / total_w for k, v in weights.items()}
    else:
        norm_weights = {"tenure_fit": 0.50, "seniority_fit": 0.30, "stability": 0.20}

    experience_entries = candidate_data.get("experience_entries", [])
    total_months = int(candidate_data.get("total_experience_months", 0))

    # Compute sub-scores
    s_tenure = score_tenure_fit(total_months, target_yoe)
    det_level, det_name = detect_candidate_seniority(experience_entries)
    s_seniority = score_seniority_fit(det_level, target_seniority)
    s_stability, avg_tenure, comp_count = score_stability(experience_entries)

    sub_scores = {
        "tenure_fit": round(s_tenure, 1),
        "seniority_fit": round(s_seniority, 1),
        "stability": round(s_stability, 1),
    }

    experience_score = sum(norm_weights[k] * sub_scores[k] for k in norm_weights)

    return {
        "experience_score": round(experience_score, 1),
        "sub_scores": sub_scores,
        "active_weights": {k: round(v, 2) for k, v in norm_weights.items()},
        "preset_used": preset_name,
        "metrics": {
            "total_experience_months": total_months,
            "total_experience_years": round(total_months / 12.0, 1),
            "target_yoe": target_yoe,
            "detected_seniority": det_name,
            "detected_level": det_level,
            "target_seniority": target_seniority,
            "company_count": comp_count,
            "avg_tenure_months": avg_tenure,
        },
    }
