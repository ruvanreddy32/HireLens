// Scoring Engine Utilities
// Aligned with docs/designs.md and docs/DesignDecisions.md (DD03, DD04, DD05)

/**
 * Computes composite score across 4 pillars using dynamic macro weights
 * @param {{ skills: number, experience: number, projects: number, proof_of_work: number }} pillarScores
 * @param {{ skills: number, experience: number, projects: number, proof_of_work: number }} weights
 * @returns {number}
 */
export function computeCompositeScore(pillarScores, weights) {
  if (!pillarScores || !weights) return 0

  const sumWeights =
    (weights.skills || 0) +
    (weights.experience || 0) +
    (weights.projects || 0) +
    (weights.proof_of_work || 0)

  if (sumWeights === 0) return 0

  const composite =
    ((weights.skills || 0) * (pillarScores.skills || 0) +
      (weights.experience || 0) * (pillarScores.experience || 0) +
      (weights.projects || 0) * (pillarScores.projects || 0) +
      (weights.proof_of_work || 0) * (pillarScores.proof_of_work || 0)) /
    sumWeights

  return Math.round(composite)
}

/**
 * Maps composite score to match tier badge and colors
 * @param {number} score
 */
export function getMatchTier(score) {
  if (score >= 85) {
    return {
      tier: 'Exceptional Match',
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50 border-emerald-200',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      dotColor: 'bg-emerald-500',
      action: 'Fast-track to onsite / direct interview',
    }
  }
  if (score >= 70) {
    return {
      tier: 'Strong Match',
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 border-blue-200',
      badgeColor: 'bg-blue-100 text-blue-800',
      dotColor: 'bg-blue-500',
      action: 'High-priority recruiter phone screen',
    }
  }
  if (score >= 55) {
    return {
      tier: 'Moderate Match',
      color: 'text-amber-800',
      bgColor: 'bg-amber-50 border-amber-200',
      badgeColor: 'bg-amber-100 text-amber-800',
      dotColor: 'bg-amber-500',
      action: 'Standard pipeline screen; review pillar gaps',
    }
  }
  if (score >= 40) {
    return {
      tier: 'Marginal Match',
      color: 'text-pink-700',
      bgColor: 'bg-pink-50 border-pink-200',
      badgeColor: 'bg-pink-100 text-pink-800',
      dotColor: 'bg-pink-500',
      action: 'Secondary consideration if applicant pool constrained',
    }
  }
  return {
    tier: 'Weak Match',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50 border-slate-200',
    badgeColor: 'bg-slate-100 text-slate-700',
    dotColor: 'bg-slate-400',
    action: 'Filter out / reject',
  }
}
