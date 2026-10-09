import sys
from pathlib import Path
from typing import Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.resources.composite_scoring_patterns import (
    MACRO_ROLE_PRESETS,
    MATCH_TIER_THRESHOLDS,
    SUMMARY_THRESHOLDS,
)
from ml.scoring.skill_scorer import score_candidate_skills
from ml.scoring.experience_scorer import score_experience
from ml.scoring.project_scorer import score_projects
from ml.scoring.proof_of_work_scorer import score_proof_of_work


def resolve_macro_weights(
    preset: str = "balanced",
    custom_weights: Optional[dict[str, float]] = None,
) -> tuple[dict[str, float], str]:
    """Resolve and normalize macro weights across the 4 pillars."""
    if custom_weights and isinstance(custom_weights, dict):
        raw_weights = {
            "skills": float(custom_weights.get("skills", 0.0)),
            "experience": float(custom_weights.get("experience", 0.0)),
            "projects": float(custom_weights.get("projects", 0.0)),
            "proof_of_work": float(custom_weights.get("proof_of_work", 0.0)),
        }
        total_w = sum(raw_weights.values())
        if total_w > 0:
            norm_weights = {k: round(v / total_w, 4) for k, v in raw_weights.items()}
            return norm_weights, "custom"

    preset_name = preset.lower() if preset else "balanced"
    base_weights = MACRO_ROLE_PRESETS.get(preset_name, MACRO_ROLE_PRESETS["balanced"])
    total_w = sum(base_weights.values())
    norm_weights = {k: round(v / total_w, 4) for k, v in base_weights.items()}
    return norm_weights, preset_name


def determine_match_tier(match_score: float) -> tuple[str, str]:
    """Map match score (0-100) to tier label and color."""
    for min_score, label, color in MATCH_TIER_THRESHOLDS:
        if match_score >= min_score:
            return label, color
    return "Weak Match", "#6B7280"


def check_knockouts(
    candidate_data: dict,
    skills_result: dict,
    projects_result: dict,
    knockout_criteria: Optional[dict] = None,
) -> tuple[bool, list[str]]:
    """Evaluate candidate against hard prerequisite qualification gates."""
    if not knockout_criteria or not isinstance(knockout_criteria, dict):
        return False, []

    reasons: list[str] = []

    # 1. Minimum total experience
    min_months = int(
        knockout_criteria.get("min_total_experience_months")
        or knockout_criteria.get("min_tenure_months")
        or 0
    )
    if min_months > 0:
        cand_months = int(candidate_data.get("total_experience_months", 0))
        if cand_months < min_months:
            reasons.append(
                f"Career tenure ({cand_months} months / {round(cand_months / 12, 1)} yrs) "
                f"is below required minimum ({min_months} months / {round(min_months / 12, 1)} yrs)."
            )

    # 2. Mandatory skills
    mandatory_skills = knockout_criteria.get("mandatory_skills", [])
    if mandatory_skills and isinstance(mandatory_skills, list):
        audit = skills_result.get("audit") or skills_result.get("breakdown") or {}
        matched_required = {
            s.lower()
            for s in (audit.get("matched_required") or audit.get("direct_matches") or [])
        }
        graph_recovered = {
            item["missing_skill"].lower()
            for item in audit.get("graph_recovered", [])
            if item.get("credit", 0.0) >= 0.50
        }
        all_qualified_skills = matched_required.union(graph_recovered)

        for mandatory_skill in mandatory_skills:
            if not isinstance(mandatory_skill, str) or not mandatory_skill.strip():
                continue
            ms_clean = mandatory_skill.strip().lower()
            if ms_clean not in all_qualified_skills:
                reasons.append(f"Missing mandatory required skill: '{mandatory_skill}'.")

    # 3. Minimum skill score
    min_skill_score = float(knockout_criteria.get("min_skill_score", 0.0))
    if min_skill_score > 0.0:
        actual_skill_score = float(skills_result.get("skill_score", 0.0))
        if actual_skill_score < min_skill_score:
            reasons.append(
                f"Overall skill score ({actual_skill_score}) is below minimum requirement ({min_skill_score})."
            )

    # 4. Minimum projects score
    min_project_score = float(knockout_criteria.get("min_project_score", 0.0))
    if min_project_score > 0.0:
        actual_project_score = float(projects_result.get("projects_score", 0.0))
        if actual_project_score < min_project_score:
            reasons.append(
                f"Projects score ({actual_project_score}) is below minimum requirement ({min_project_score})."
            )

    return len(reasons) > 0, reasons


def generate_executive_summary(
    candidate_name: str,
    match_score: float,
    pillar_scores: dict[str, float],
    pillar_details: dict[str, dict],
    is_knocked_out: bool,
    knockout_reasons: list[str],
) -> dict:
    """Generate concise strengths, risks, and hiring recommendation."""
    strengths: list[str] = []
    risks: list[str] = []

    skills_data = pillar_details.get("skills", {})
    exp_data = pillar_details.get("experience", {})
    proj_data = pillar_details.get("projects", {})
    pow_data = pillar_details.get("proof_of_work", {})

    skills_audit = skills_data.get("audit") or skills_data.get("breakdown") or {}

    # Skills highlights
    if pillar_scores["skills"] >= SUMMARY_THRESHOLDS["high_skill_cutoff"]:
        matched_len = len(skills_audit.get("matched_required") or skills_audit.get("direct_matches") or [])
        total_req = skills_data.get("metadata", {}).get("required_count", 0)
        strengths.append(
            f"Exceptional technical alignment: directly matches {matched_len}/{total_req} core JD skills."
        )

    recovered_items = skills_audit.get("graph_recovered", [])
    if recovered_items:
        rec_names = ", ".join(item["missing_skill"] for item in recovered_items[:3])
        strengths.append(
            f"High stack adaptability: recovered transferable credit for {len(recovered_items)} skills "
            f"via domain graph expansion ({rec_names})."
        )

    # Experience highlights
    if pillar_scores["experience"] >= SUMMARY_THRESHOLDS["high_experience_cutoff"]:
        metrics = exp_data.get("metrics", {})
        strengths.append(
            f"Strong career tenure and seniority: {metrics.get('total_experience_years', 0)} years "
            f"with detected level '{metrics.get('detected_seniority', '').upper()}'."
        )

    # Project highlights
    if pillar_scores["projects"] >= SUMMARY_THRESHOLDS["high_project_cutoff"]:
        eval_projs = proj_data.get("evaluated_projects", [])
        top_name = eval_projs[0].get("name", "Flagship Project") if eval_projs else "Flagship"
        strengths.append(
            f"Demonstrated engineering depth in projects (e.g., '{top_name}') with verified "
            f"architectural complexity and quantified benchmarks."
        )

    # Proof of work highlights
    if pillar_scores["proof_of_work"] >= SUMMARY_THRESHOLDS["high_pow_cutoff"]:
        ev = pow_data.get("evidence", {})
        repo_cnt = len(ev.get("profile_repos", [])) + len(ev.get("project_repos", []))
        demo_cnt = len(ev.get("live_demos", []))
        comp_cnt = len(ev.get("competitive_profiles", {}))
        hack_cnt = len(ev.get("hackathons_detected", []))

        evidence_parts = []
        if repo_cnt > 0:
            evidence_parts.append(f"{repo_cnt} code repository links")
        if demo_cnt > 0:
            evidence_parts.append(f"{demo_cnt} live application deployments")
        if comp_cnt > 0:
            evidence_parts.append("active competitive programming profiles (e.g. LeetCode/Kaggle)")
        if hack_cnt > 0:
            evidence_parts.append(f"{hack_cnt} hackathon / competition achievements")

        ev_str = ", ".join(evidence_parts) if evidence_parts else "verifiable code repositories and artifacts"
        strengths.append(f"Verified public engineering footprint: {ev_str}.")

    # Risks analysis
    if is_knocked_out:
        for r in knockout_reasons:
            risks.append(f"KNOCKOUT GATE: {r}")

    if pillar_scores["skills"] < SUMMARY_THRESHOLDS["low_skill_cutoff"]:
        missing = skills_audit.get("unrecovered_missing", [])
        if missing:
            risks.append(f"Missing primary core required skills: {', '.join(missing[:4])}.")

    if pillar_scores["experience"] < SUMMARY_THRESHOLDS["low_experience_cutoff"]:
        metrics = exp_data.get("metrics", {})
        risks.append(
            f"Experience gap: candidate has {metrics.get('total_experience_years', 0)} yrs tenure "
            f"vs target of {metrics.get('target_yoe', 0)} yrs ({metrics.get('detected_seniority', '').upper()} "
            f"vs target {metrics.get('target_seniority', '').upper()})."
        )

    exp_subs = exp_data.get("sub_scores", {})
    if exp_subs.get("stability", 100.0) < 50.0:
        metrics = exp_data.get("metrics", {})
        risks.append(
            f"Low employment stability: candidate averaged only {metrics.get('avg_tenure_months', 0)} "
            f"months per company across {metrics.get('company_count', 0)} positions."
        )

    if pillar_scores["proof_of_work"] < SUMMARY_THRESHOLDS["low_pow_cutoff"]:
        if pillar_scores["projects"] >= SUMMARY_THRESHOLDS["high_project_cutoff"]:
            risks.append(
                "Proprietary/Enterprise profile: deep engineering complexity under potential NDA "
                "with minimal public portfolio or external repository footprint."
            )
        else:
            risks.append("No verifiable public code repositories, deployed live demos, or competitive coding profiles found.")

    if pillar_scores["projects"] < SUMMARY_THRESHOLDS["low_project_cutoff"]:
        risks.append("Candidate projects show limited architectural complexity or lack quantified impact metrics.")

    # Recommendation
    if is_knocked_out:
        recommendation = "Reject / Knocked Out: Failed mandatory prerequisite criteria."
    elif match_score >= 80.0:
        recommendation = "Strong Advance: Candidate exceeds role expectations across core technical dimensions."
    elif match_score >= 65.0:
        recommendation = "Advance to Phone Screen: Solid foundation; verify identified skill/experience gaps during interview."
    elif match_score >= 50.0:
        recommendation = "Borderline: Consider only if candidate pool is constrained or if hiring for adjacent transferable skills."
    else:
        recommendation = "Do Not Advance: Low alignment with key job requirements."

    return {
        "top_strengths": strengths,
        "potential_risks": risks,
        "recommendation": recommendation,
    }


def score_candidate_match(
    candidate_data: dict,
    jd_profile: dict,
    macro_weights: Optional[dict[str, float]] = None,
    preset: str = "balanced",
) -> dict:
    """Evaluate a candidate across all 4 pillars against a job description."""
    candidate_id = (
        candidate_data.get("id")
        or candidate_data.get("candidate_id")
        or candidate_data.get("_id")
    )
    candidate_name = (
        candidate_data.get("name")
        or candidate_data.get("metadata", {}).get("raw_name_text")
        or candidate_data.get("metadata", {}).get("name")
        or "Candidate"
    )

    req_skills = jd_profile.get("required_skills", [])
    pref_skills = jd_profile.get("preferred_skills", [])
    target_yoe = float(jd_profile.get("target_yoe", 0.0))
    target_seniority = jd_profile.get("target_seniority", "mid")

    pillar_presets = jd_profile.get("pillar_presets") or {}
    pillar_weights = jd_profile.get("pillar_weights") or {}
    knockout_criteria = jd_profile.get("knockout_criteria") or {}

    active_preset = preset or jd_profile.get("role_preset", "balanced")
    active_macro_weights = macro_weights or jd_profile.get("macro_weights")
    norm_macro_weights, active_preset_name = resolve_macro_weights(
        preset=active_preset,
        custom_weights=active_macro_weights,
    )

    # 1. Skills
    skill_res = score_candidate_skills(
        candidate_data=candidate_data,
        required_skills=req_skills,
        preferred_skills=pref_skills,
    )

    # 2. Experience
    exp_res = score_experience(
        candidate_data=candidate_data,
        target_yoe=target_yoe,
        target_seniority=target_seniority,
        preset=pillar_presets.get("experience", "balanced"),
        custom_weights=pillar_weights.get("experience"),
    )

    # 3. Projects
    proj_res = score_projects(
        candidate_data=candidate_data,
        required_skills=req_skills,
        preferred_skills=pref_skills,
        preset=pillar_presets.get("projects", "balanced"),
        custom_weights=pillar_weights.get("projects"),
    )

    # 4. Proof of Work
    pow_res = score_proof_of_work(
        candidate_data=candidate_data,
        preset=pillar_presets.get("proof_of_work", "balanced"),
        custom_weights=pillar_weights.get("proof_of_work"),
    )

    pillar_scores = {
        "skills": float(skill_res.get("skill_score", 0.0)),
        "experience": float(exp_res.get("experience_score", 0.0)),
        "projects": float(proj_res.get("projects_score", 0.0)),
        "proof_of_work": float(pow_res.get("proof_of_work_score", 0.0)),
    }

    # Weighted match score
    weighted_contributions = {
        k: round(norm_macro_weights[k] * pillar_scores[k], 2)
        for k in norm_macro_weights
    }
    match_score = round(sum(weighted_contributions.values()), 2)
    match_score = max(0.0, min(100.0, match_score))

    match_tier, tier_color = determine_match_tier(match_score)

    is_knocked_out, knockout_reasons = check_knockouts(
        candidate_data=candidate_data,
        skills_result=skill_res,
        projects_result=proj_res,
        knockout_criteria=knockout_criteria,
    )

    pillar_details = {
        "skills": skill_res,
        "experience": exp_res,
        "projects": proj_res,
        "proof_of_work": pow_res,
    }

    executive_summary = generate_executive_summary(
        candidate_name=candidate_name,
        match_score=match_score,
        pillar_scores=pillar_scores,
        pillar_details=pillar_details,
        is_knocked_out=is_knocked_out,
        knockout_reasons=knockout_reasons,
    )

    return {
        "candidate_id": candidate_id,
        "candidate_name": candidate_name,
        "match_score": match_score,
        "match_tier": match_tier,
        "tier_color": tier_color,
        "is_knocked_out": is_knocked_out,
        "knockout_reasons": knockout_reasons,
        "macro_weights": norm_macro_weights,
        "preset_used": active_preset_name,
        "pillar_scores": pillar_scores,
        "weighted_contributions": weighted_contributions,
        "pillar_details": pillar_details,
        "executive_summary": executive_summary,
    }


def rank_candidates(
    candidate_pool: list[dict],
    jd_profile: dict,
    macro_weights: Optional[dict[str, float]] = None,
    preset: str = "balanced",
) -> dict:
    """Rank a cohort of candidates against a job description with knockouts."""
    if not candidate_pool or not isinstance(candidate_pool, list):
        return {
            "total_candidates": 0,
            "qualified_count": 0,
            "knocked_out_count": 0,
            "qualified_candidates": [],
            "knocked_out_candidates": [],
            "stats": {},
        }

    evaluated_candidates: list[dict] = []
    for cand in candidate_pool:
        res = score_candidate_match(
            candidate_data=cand,
            jd_profile=jd_profile,
            macro_weights=macro_weights,
            preset=preset,
        )
        evaluated_candidates.append(res)

    qualified: list[dict] = []
    knocked_out: list[dict] = []

    for item in evaluated_candidates:
        if item["is_knocked_out"]:
            knocked_out.append(item)
        else:
            qualified.append(item)

    qualified.sort(key=lambda x: x["match_score"], reverse=True)
    for idx, cand in enumerate(qualified, start=1):
        cand["rank"] = idx

    knocked_out.sort(key=lambda x: x["match_score"], reverse=True)

    total_count = len(candidate_pool)
    qualified_count = len(qualified)
    knocked_out_count = len(knocked_out)

    avg_score = (
        round(sum(c["match_score"] for c in qualified) / qualified_count, 2)
        if qualified_count > 0
        else 0.0
    )

    top_candidate = (
        {
            "name": qualified[0]["candidate_name"],
            "score": qualified[0]["match_score"],
            "tier": qualified[0]["match_tier"],
        }
        if qualified_count > 0
        else None
    )

    return {
        "job_title": jd_profile.get("title", "Target Role"),
        "total_candidates": total_count,
        "qualified_count": qualified_count,
        "knocked_out_count": knocked_out_count,
        "preset_used": qualified[0]["preset_used"] if qualified else (knocked_out[0]["preset_used"] if knocked_out else preset),
        "macro_weights": qualified[0]["macro_weights"] if qualified else (knocked_out[0]["macro_weights"] if knocked_out else {}),
        "stats": {
            "average_qualified_score": avg_score,
            "top_candidate": top_candidate,
        },
        "qualified_candidates": qualified,
        "knocked_out_candidates": knocked_out,
    }
