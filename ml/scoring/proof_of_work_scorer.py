import sys
from pathlib import Path
from typing import Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.resources.proof_of_work_patterns import (
    CODE_REPO_DOMAINS as _CODE_REPO_DOMAINS,
    LIVE_DEMO_DOMAINS as _LIVE_DEMO_DOMAINS,
    COMPETITIVE_DOMAINS as _COMPETITIVE_DOMAINS,
    HACKATHON_KEYWORDS_PATTERN as _HACKATHON_KEYWORDS_PATTERN,
    ROLE_PRESETS,
)


def harvest_proof_signals(candidate_data: dict) -> dict:
    """Extract verifiable external proof signals from parsed candidate data."""
    signals = {
        "profile_repos": [],
        "project_repos": [],
        "live_demos": [],
        "competitive_profiles": {},
        "hackathon_mentions": [],
        "portfolio_urls": [],
    }

    if not isinstance(candidate_data, dict):
        return signals

    # 1. Contact metadata links
    meta_links = candidate_data.get("metadata", {}).get("links", {})
    if isinstance(meta_links, dict):
        for key, url in meta_links.items():
            if not isinstance(url, str):
                continue
            url_clean = url.strip()
            u_lower = url_clean.lower()

            if any(dom in u_lower for dom in _CODE_REPO_DOMAINS):
                signals["profile_repos"].append(url_clean)

            for dom, platform in _COMPETITIVE_DOMAINS.items():
                if dom in u_lower:
                    signals["competitive_profiles"][platform] = url_clean

            if key in ("portfolio", "website") or (
                "linkedin" not in u_lower
                and not any(dom in u_lower for dom in _CODE_REPO_DOMAINS)
                and not any(dom in u_lower for dom in _COMPETITIVE_DOMAINS)
            ):
                signals["portfolio_urls"].append(url_clean)

    # 2. Project links
    projects = candidate_data.get("projects", [])
    if isinstance(projects, list):
        for proj in projects:
            if not isinstance(proj, dict):
                continue

            proj_links = proj.get("links", [])
            all_links = []
            if isinstance(proj_links, list):
                for lk in proj_links:
                    if isinstance(lk, dict) and "url" in lk:
                        all_links.append((lk.get("label", ""), lk.get("url", "")))

            if proj.get("link"):
                all_links.append(("", proj["link"]))

            for label, url in all_links:
                if not isinstance(url, str) or not url.strip():
                    continue
                url_clean = url.strip()
                u_lower = url_clean.lower()
                l_lower = label.lower()

                if any(dom in u_lower for dom in _CODE_REPO_DOMAINS):
                    if url_clean not in signals["project_repos"]:
                        signals["project_repos"].append(url_clean)
                elif (
                    any(dom in u_lower for dom in _LIVE_DEMO_DOMAINS)
                    or "demo" in l_lower
                    or "live" in l_lower
                    or "app" in l_lower
                ):
                    if url_clean not in signals["live_demos"]:
                        signals["live_demos"].append(url_clean)

    # 3. Achievements and hackathon mentions
    achievements_text = candidate_data.get("achievements_raw", "")
    if isinstance(achievements_text, str) and achievements_text.strip():
        for line in achievements_text.split("\n"):
            line_clean = line.strip(" -•*\t")
            if line_clean and _HACKATHON_KEYWORDS_PATTERN.search(line_clean):
                signals["hackathon_mentions"].append(line_clean)

    for proj in (projects if isinstance(projects, list) else []):
        if isinstance(proj, dict):
            desc = proj.get("description", "")
            if isinstance(desc, str) and _HACKATHON_KEYWORDS_PATTERN.search(desc):
                match = _HACKATHON_KEYWORDS_PATTERN.search(desc)
                if match:
                    snippet = f"Project {proj.get('name', '')}: {match.group(0)}"
                    if snippet not in signals["hackathon_mentions"]:
                        signals["hackathon_mentions"].append(snippet)

    return signals


def _score_code_repos(profile_repos: list[str], project_repos: list[str]) -> float:
    """Score public code repositories."""
    score = 0.0
    if profile_repos:
        score += 40.0

    num_projects = len(project_repos)
    if num_projects >= 2:
        score += 60.0
    elif num_projects == 1:
        score += 30.0

    if not profile_repos and num_projects >= 2:
        score = 100.0
    elif not profile_repos and num_projects == 1:
        score = 60.0

    return min(100.0, score)


def _score_live_deployments(live_demos: list[str]) -> float:
    """Score verified live demos and deployed apps."""
    num_demos = len(live_demos)
    if num_demos >= 2:
        return 100.0
    elif num_demos == 1:
        return 70.0
    return 0.0


def _score_problem_solving(
    competitive_profiles: dict[str, str],
    portfolio_urls: list[str],
) -> float:
    """Score competitive coding and problem-solving profiles."""
    num_profiles = len(competitive_profiles)
    if num_profiles >= 2:
        return 100.0
    elif num_profiles == 1:
        return 80.0
    elif portfolio_urls:
        return 40.0
    return 0.0


def _score_hackathons(hackathon_mentions: list[str]) -> float:
    """Score hackathons, competitions, and recognized achievements."""
    num_mentions = len(hackathon_mentions)
    if num_mentions >= 2:
        return 100.0
    elif num_mentions == 1:
        return 75.0
    return 0.0


def score_proof_of_work(
    candidate_data: dict,
    preset: str = "balanced",
    custom_weights: Optional[dict[str, float]] = None,
) -> dict:
    """Compute unified proof-of-work score across repos, demos, and competitions."""
    if custom_weights and isinstance(custom_weights, dict):
        base_weights = custom_weights
        preset_name = "custom"
    else:
        preset_name = preset.lower() if preset else "balanced"
        base_weights = ROLE_PRESETS.get(preset_name, ROLE_PRESETS["balanced"])

    weights = {
        "code_repos": float(base_weights.get("code_repos", 0.0)),
        "live_deployments": float(base_weights.get("live_deployments", 0.0)),
        "problem_solving": float(base_weights.get("problem_solving", 0.0)),
        "hackathons": float(base_weights.get("hackathons", 0.0)),
    }

    total_w = sum(weights.values())
    if total_w > 0:
        norm_weights = {k: v / total_w for k, v in weights.items()}
    else:
        norm_weights = {k: 0.25 for k in weights}

    signals = harvest_proof_signals(candidate_data)

    sub_scores = {
        "code_repos": _score_code_repos(
            profile_repos=signals["profile_repos"],
            project_repos=signals["project_repos"],
        ),
        "live_deployments": _score_live_deployments(
            live_demos=signals["live_demos"],
        ),
        "problem_solving": _score_problem_solving(
            competitive_profiles=signals["competitive_profiles"],
            portfolio_urls=signals["portfolio_urls"],
        ),
        "hackathons": _score_hackathons(
            hackathon_mentions=signals["hackathon_mentions"],
        ),
    }

    proof_of_work_score = sum(
        norm_weights[k] * sub_scores[k] for k in norm_weights
    )

    return {
        "proof_of_work_score": round(proof_of_work_score, 1),
        "sub_scores": {k: round(v, 1) for k, v in sub_scores.items()},
        "active_weights": {k: round(v, 2) for k, v in norm_weights.items()},
        "preset_used": preset_name,
        "evidence": {
            "profile_repos": signals["profile_repos"],
            "project_repos": signals["project_repos"],
            "live_demos": signals["live_demos"],
            "competitive_profiles": signals["competitive_profiles"],
            "hackathons_detected": signals["hackathon_mentions"],
            "portfolio_urls": signals["portfolio_urls"],
        },
    }
