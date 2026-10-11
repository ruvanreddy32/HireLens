/**
 * Match Calculator Utility
 * Calculates realistic, data-backed match scores between candidate resumes and specific job requisitions.
 */

// Normalized synonym map for common tech skills
const SKILL_SYNONYMS = {
  js: 'javascript',
  ts: 'typescript',
  reactjs: 'react',
  'react.js': 'react',
  nodejs: 'node.js',
  node: 'node.js',
  postgres: 'postgresql',
  k8s: 'kubernetes',
  golang: 'go',
  py: 'python',
}

function normalizeSkill(skill = '') {
  const clean = skill.toLowerCase().trim().replace(/[-_.]/g, '')
  return SKILL_SYNONYMS[clean] || skill.toLowerCase().trim()
}

/**
 * Calculates deterministic match metrics between a resume variant and a job posting
 * @param {object} resume
 * @param {object} job
 * @returns {object} { score, matchedSkills, missingSkills, matchRatio, isRecommended }
 */
export function calculateVariantMatch(resume, job) {
  if (!resume || !job) {
    return {
      score: 0,
      matchedSkills: [],
      missingSkills: [],
      matchRatio: 0,
      matchedCount: 0,
      totalRequired: 0,
      titleMatch: false,
    }
  }

  const rawSkills = [
    ...(Array.isArray(resume.skills) ? resume.skills : []),
    ...(Array.isArray(resume.parsedData?.skills)
      ? resume.parsedData.skills.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
      : []),
  ]
  const resumeSkills = Array.from(new Set(rawSkills.map(normalizeSkill)))
  const requiredSkills = (job.requiredSkills || []).map(normalizeSkill)

  const baselineJobSkills = requiredSkills
  if (baselineJobSkills.length === 0) {
    return {
      score: 0,
      matchedSkills: [],
      missingSkills: [],
      matchRatio: 0,
      matchedCount: 0,
      totalRequired: 0,
      titleMatch: false,
    }
  }

  const matchedSkills = []
  const missingSkills = []

  baselineJobSkills.forEach((jobSkill) => {
    const isFound = resumeSkills.some(
      (rSkill) =>
        rSkill === jobSkill ||
        rSkill.includes(jobSkill) ||
        jobSkill.includes(rSkill)
    )
    if (isFound) {
      matchedSkills.push(jobSkill)
    } else {
      missingSkills.push(jobSkill)
    }
  })

  // Skill score (up to 75 points)
  const skillRatio = matchedSkills.length / baselineJobSkills.length
  const skillPoints = Math.round(skillRatio * 75)

  // Title / Specialization affinity (up to 20 points)
  const resumeRole = (
    resume.targetRole ||
    resume.specialization ||
    resume.role ||
    resume.parsedData?.target_role ||
    resume.parsedData?.experience_entries?.[0]?.title ||
    ''
  ).toLowerCase()
  const jobTitle = (job.title || '').toLowerCase()

  let titlePoints = 0
  if (resumeRole && jobTitle) {
    const jobWords = jobTitle.split(/\W+/).filter((w) => w.length > 3)
    const matchesAny = jobWords.some((w) => resumeRole.includes(w))
    if (matchesAny) {
      titlePoints = 15
    }
  }

  // Base parse quality credit (5 points if healthy)
  const baseCredit = resume.parseStatus === 'HEALTHY' || resume.parsedData ? 5 : 0
  const totalScore = Math.min(skillPoints + titlePoints + baseCredit, 100)

  return {
    score: totalScore,
    matchedSkills,
    missingSkills,
    matchRatio: skillRatio,
    matchedCount: matchedSkills.length,
    totalRequired: baselineJobSkills.length,
  }
}

/**
 * Evaluates all candidate resumes against a job and sorts them, flagging the best match
 * @param {Array} resumes
 * @param {object} job
 * @returns {Array} List of resumes with computed match details, highest score first
 */
export function getRankedVariantsForJob(resumes = [], job) {
  if (!resumes.length || !job) return []

  const evaluated = resumes.map((resume) => {
    const match = calculateVariantMatch(resume, job)
    return {
      ...resume,
      matchScore: match.score,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
      matchedCount: match.matchedCount,
      totalRequired: match.totalRequired,
    }
  })

  evaluated.sort((a, b) => b.matchScore - a.matchScore)

  if (evaluated.length > 0 && evaluated[0].matchScore > 0) {
    evaluated[0].isBestFit = true
  }

  return evaluated
}

/**
 * Calculates aggregate market alignment across candidate skills and all active jobs
 * @param {Array} resumes
 * @param {Array} activeJobs
 */
export function calculateMarketSkillCoverage(resumes = [], activeJobs = []) {
  if (!activeJobs.length || !resumes.length) {
    return {
      coveragePercent: 0,
      inDemandPossessed: [],
      inDemandMissing: [],
      totalMarketSkills: 0,
    }
  }

  // Gather market skill frequencies from live jobs
  const skillFrequency = {}
  activeJobs.forEach((job) => {
    ;(job.requiredSkills || []).forEach((s) => {
      const clean = s.trim()
      if (clean) {
        skillFrequency[clean] = (skillFrequency[clean] || 0) + 1
      }
    })
  })

  // Gather candidate skills
  const candidateSkills = new Set()
  resumes.forEach((r) => {
    ;(r.skills || []).forEach((s) => {
      const name = typeof s === 'string' ? s : s?.name
      if (name) candidateSkills.add(name.toLowerCase().trim())
    })
    ;(r.parsedData?.skills || []).forEach((s) => {
      const name = typeof s === 'string' ? s : s?.name
      if (name) candidateSkills.add(name.toLowerCase().trim())
    })
  })

  const inDemandPossessed = []
  const inDemandMissing = []

  const sortedMarketSkills = Object.entries(skillFrequency).sort((a, b) => b[1] - a[1])

  sortedMarketSkills.forEach(([skill]) => {
    const norm = skill.toLowerCase().trim()
    const hasSkill = Array.from(candidateSkills).some(
      (cSkill) => cSkill === norm || cSkill.includes(norm) || norm.includes(cSkill)
    )

    if (hasSkill) {
      if (inDemandPossessed.length < 5) inDemandPossessed.push(skill)
    } else {
      if (inDemandMissing.length < 4) inDemandMissing.push(skill)
    }
  })

  const totalEvaluated = sortedMarketSkills.length || 1
  const coveredCount = sortedMarketSkills.filter(([skill]) => {
    const norm = skill.toLowerCase().trim()
    return Array.from(candidateSkills).some((cSkill) => cSkill === norm || cSkill.includes(norm))
  }).length

  const coveragePercent = Math.round((coveredCount / totalEvaluated) * 100)

  return {
    coveragePercent,
    inDemandPossessed,
    inDemandMissing,
    totalMarketSkills: sortedMarketSkills.length,
  }
}
