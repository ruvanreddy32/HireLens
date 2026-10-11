import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '../../services/api'
import { MACRO_PRESETS } from '../../constants/macroPresets'
import { computeCompositeScore, getMatchTier } from '../../utils/scoring'

// Helper to map UI status to Backend status enum
export function toBackendStatus(status) {
  if (!status) return 'APPLIED'
  const s = status.toUpperCase()
  if (s.includes('SHORT')) return 'SHORTLISTED'
  if (s.includes('REVIEW') || s.includes('INTERVIEW')) return 'REVIEWING'
  if (s.includes('REJECT')) return 'REJECTED'
  return 'APPLIED'
}

export function toUIStatus(backendStatus) {
  switch (backendStatus) {
    case 'SHORTLISTED':
      return 'Shortlisted'
    case 'REVIEWING':
      return 'Under Review'
    case 'REJECTED':
      return 'Rejected'
    case 'APPLIED':
    default:
      return 'Applied'
  }
}

// Async Thunks
export const fetchRecruiterData = createAsyncThunk(
  'recruiter/fetchRecruiterData',
  async (force, { rejectWithValue }) => {
    try {
      const rawJobs = await api.getRecruiterJobs()
      const allCandidates = []

      // Fetch applications for each job in parallel
      const enrichedJobs = await Promise.all(
        rawJobs.map(async (job) => {
          try {
            const apps = await api.getJobApplications(job.id)

            // Normalize each application
            const jobCandidates = apps.map((app) => {
              const parsed = app.parsedInfo || {}
              const initials = app.applicant?.name
                ? app.applicant.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                : 'U'

              const evalAudit = parsed.evaluation?.pillar_details?.skills?.audit || {}
              const evalSummary = parsed.evaluation?.executive_summary || {}
              const matchedSkills = evalAudit.matched_required || parsed.matchedSkills || []
              const missingSkills = evalAudit.missing_required || parsed.missingSkills || []
              const expYears = parsed.total_experience_months
                ? Math.round((parsed.total_experience_months / 12) * 10) / 10
                : (parsed.yearsExp || job.minExperience || 0)

              const topRole = parsed.experience_entries?.[0]
              const companyName = topRole?.company
                ? topRole.company.split('\n')[0].split(',')[0].trim()
                : (parsed.company || 'Direct Applicant')

              const links = parsed.metadata?.links || {}

              return {
                id: app.id,
                applicantId: app.applicantId,
                jobId: app.jobId,
                name: app.applicant?.name || 'Candidate',
                email: app.applicant?.email || '',
                status: toUIStatus(app.status),
                backendStatus: app.status,
                initials,
                avatarColor: parsed.avatarColor || 'bg-blue-100 text-blue-700',
                role: topRole?.title || parsed.role || 'Software Engineer',
                company: companyName,
                yearsExp: expYears,
                location: parsed.location || job.location || 'Remote',
                phone: parsed.phone || '',
                portfolioUrl: parsed.portfolioUrl || null,
                githubUrl: links.github || parsed.githubUrl || null,
                linkedinUrl: links.linkedin || parsed.linkedinUrl || null,
                isBookmarked: Array.isArray(app.bookmarks) && app.bookmarks.length > 0,
                isSelected: false,
                pillarScores: {
                  skills: Math.round(typeof app.skillsScore === 'number' ? app.skillsScore : (parsed.evaluation?.pillar_scores?.skills ?? 0)),
                  experience: Math.round(typeof app.experienceScore === 'number' ? app.experienceScore : (parsed.evaluation?.pillar_scores?.experience ?? 0)),
                  projects: Math.round(typeof app.projectScore === 'number' ? app.projectScore : (parsed.evaluation?.pillar_scores?.projects ?? 0)),
                  proof_of_work: Math.round(typeof app.proofOfWorkScore === 'number' ? app.proofOfWorkScore : (parsed.evaluation?.pillar_scores?.proof_of_work ?? 0)),
                },
                proofOfWorkDetails: parsed.proofOfWorkDetails || (() => {
                  const powPillar = parsed.evaluation?.pillar_details?.proof_of_work || {}
                  const sub = powPillar.sub_scores || {}
                  const evidence = powPillar.evidence || {}

                  const verifiedLinks = []
                  if (links.github) verifiedLinks.push({ label: 'GitHub Repository', url: links.github })
                  if (links.linkedin) verifiedLinks.push({ label: 'LinkedIn Profile', url: links.linkedin })
                  if (parsed.portfolioUrl) verifiedLinks.push({ label: 'Portfolio / Personal Website', url: parsed.portfolioUrl })
                  if (Array.isArray(evidence.live_demos)) {
                    evidence.live_demos.forEach((d) => {
                      const url = typeof d === 'string' ? d : d.url
                      const label = typeof d === 'string' ? d : (d.label || d.url)
                      if (url) verifiedLinks.push({ label: `Live Demo: ${label}`, url })
                    })
                  }
                  if (Array.isArray(evidence.project_repos)) {
                    evidence.project_repos.forEach((r) => {
                      const url = typeof r === 'string' ? r : r.url
                      const label = typeof r === 'string' ? r : (r.label || r.url)
                      if (url) verifiedLinks.push({ label: `Project Repo: ${label}`, url })
                    })
                  }

                  return {
                    codeRepos: Math.round(typeof sub.code_repos === 'number' ? sub.code_repos : (links.github ? 85 : 0)),
                    liveDeployments: Math.round(typeof sub.live_deployments === 'number' ? sub.live_deployments : (evidence.live_demos?.length ? 80 : 0)),
                    problemSolving: Math.round(typeof sub.problem_solving === 'number' ? sub.problem_solving : (evidence.competitive_profiles?.length ? 80 : 0)),
                    hackathons: Math.round(typeof sub.hackathons === 'number' ? sub.hackathons : (evidence.hackathons_detected?.length ? 80 : 0)),
                    verifiedLinks,
                  }
                })(),
                matchedSkills,
                missingSkills,
                bonusSkills: parsed.bonusSkills || job.preferredSkills || [],
                experienceHistory: parsed.experience_entries || parsed.experienceHistory || [],
                education: Array.isArray(parsed.education) && parsed.education[0]
                  ? `${parsed.education[0].degree || 'Degree'} from ${parsed.education[0].institution || 'University'}`
                  : (parsed.education || job.education || 'Degree in related field'),
                isKnockedOut: Boolean(app.isKnockedOut),
                knockoutReasons: app.knockedOutReasons || [],
                aiSummary: parsed.aiSummary || {
                  whatHappened: evalSummary.recommendation || `Evaluated for ${job.title} based on submitted resume.`,
                  why: evalSummary.top_strengths?.join('. ') || `Algorithmic parsing matched candidate background against ${job.title} prerequisites.`,
                  whatItMeans: evalSummary.potential_risks?.join('. ') || `Review candidate's verified proof-of-work signals for confirmation.`,
                  suggestedQuestions: [
                    `Walk us through the architecture of your most impactful project.`,
                  ],
                },
                notes: Array.isArray(app.notes) ? app.notes : (parsed.notes || []),
              }
            })

            allCandidates.push(...jobCandidates)

            const shortlisted = apps.filter((a) => a.status === 'SHORTLISTED').length
            const inInterview = apps.filter((a) => a.status === 'REVIEWING').length
            const underReview = apps.filter((a) => a.status === 'APPLIED').length

            const jobStatus = job.status || (job.isActive ? 'ACTIVE' : 'PAUSED')
            return {
              ...job,
              department: job.department || 'Engineering',
              status: jobStatus,
              isActive: jobStatus === 'ACTIVE',
              applicantsTotal: apps.length,
              shortlisted,
              inInterview,
              underReview,
              presetKey: 'balanced',
            }
          } catch {
            const jobStatus = job.status || (job.isActive ? 'ACTIVE' : 'PAUSED')
            return {
              ...job,
              department: job.department || 'Engineering',
              status: jobStatus,
              isActive: jobStatus === 'ACTIVE',
              applicantsTotal: 0,
              shortlisted: 0,
              inInterview: 0,
              underReview: 0,
              presetKey: 'balanced',
            }
          }
        })
      )

      return { jobs: enrichedJobs, candidates: allCandidates }
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch recruiter data from backend')
    }
  },
  {
    condition: (force, { getState }) => {
      const { recruiter } = getState()
      if (recruiter.loading) return false
      if (!force && recruiter.jobs && recruiter.jobs.length > 0) return false
      return true
    },
  }
)

export const createJobBackend = createAsyncThunk(
  'recruiter/createJobBackend',
  async (jobData, { rejectWithValue }) => {
    try {
      const targetStatus = jobData.status || (jobData.isActive === false ? 'PAUSED' : 'ACTIVE')
      // Map UI payload to backend CreateJob schema
      const payload = {
        title: jobData.title,
        description: jobData.description || '',
        location: jobData.location || '',
        workMode: (jobData.workMode || 'REMOTE').toUpperCase(),
        employmentType: (jobData.employmentType || 'FULL_TIME').toUpperCase().replace('-', '_'),
        minExperience: parseInt(jobData.minExperience) || 0,
        maxExperience: jobData.maxExperience ? parseInt(jobData.maxExperience) : undefined,
        education: jobData.education || undefined,
        requiredSkills: jobData.requiredSkills || [],
        preferredSkills: jobData.preferredSkills || [],
        minSalary: jobData.minSalary ? parseInt(jobData.minSalary) : undefined,
        maxSalary: jobData.maxSalary ? parseInt(jobData.maxSalary) : undefined,
        status: targetStatus,
        isActive: targetStatus === 'ACTIVE',
      }

      const created = await api.createJob(payload)
      const finalStatus = created.status || targetStatus
      return {
        ...created,
        status: finalStatus,
        isActive: finalStatus === 'ACTIVE',
        applicantsTotal: 0,
        shortlisted: 0,
        inInterview: 0,
        underReview: 0,
        presetKey: jobData.presetKey || 'balanced',
      }
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to create job')
    }
  }
)

export const updateJobBackend = createAsyncThunk(
  'recruiter/updateJobBackend',
  async ({ jobId, updates }, { rejectWithValue }) => {
    try {
      const payload = {}
      if (updates.title !== undefined) payload.title = updates.title
      if (updates.description !== undefined) payload.description = updates.description
      if (updates.location !== undefined) payload.location = updates.location
      if (updates.workMode) payload.workMode = updates.workMode.toUpperCase()
      if (updates.employmentType)
        payload.employmentType = updates.employmentType.toUpperCase().replace('-', '_')
      if (updates.minExperience !== undefined) payload.minExperience = parseInt(updates.minExperience)
      if (updates.maxExperience !== undefined) payload.maxExperience = parseInt(updates.maxExperience)
      if (updates.minSalary !== undefined) payload.minSalary = parseInt(updates.minSalary)
      if (updates.maxSalary !== undefined) payload.maxSalary = parseInt(updates.maxSalary)
      if (updates.education !== undefined) payload.education = updates.education
      if (updates.requiredSkills !== undefined) payload.requiredSkills = updates.requiredSkills
      if (updates.preferredSkills !== undefined) payload.preferredSkills = updates.preferredSkills
      if (updates.status !== undefined) {
        payload.status = updates.status
        payload.isActive = updates.status === 'ACTIVE'
      } else if (updates.isActive !== undefined) {
        payload.isActive = updates.isActive
        payload.status = updates.isActive ? 'ACTIVE' : 'PAUSED'
      }

      const updated = await api.updateJob(jobId, payload)
      return { jobId, updated }
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to update job')
    }
  }
)

export const deleteJobBackend = createAsyncThunk(
  'recruiter/deleteJobBackend',
  async (jobId, { rejectWithValue }) => {
    try {
      await api.deleteJob(jobId)
      return jobId
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to delete job')
    }
  }
)

export const changeApplicationStatusBackend = createAsyncThunk(
  'recruiter/changeApplicationStatusBackend',
  async ({ jobId, applicationId, status }, { rejectWithValue }) => {
    try {
      const backendStatus = toBackendStatus(status)
      await api.changeApplicationStatus(jobId, applicationId, backendStatus)
      return { applicationId, status: toUIStatus(backendStatus) }
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to update candidate status')
    }
  }
)

const initialState = {
  jobs: [],
  candidates: [],
  selectedJobId: null,
  loading: false,
  error: null,

  // Macro scoring preset & weights (DD03)
  activePresetKey: 'balanced',
  customWeights: { skills: 35, experience: 30, projects: 20, proof_of_work: 15 },

  // Filters
  searchTerm: '',
  filterKnockouts: 'all',
  filterScoreTier: 'all',
  filterStatus: 'all',

  // Comparison drawer/modal
  comparedCandidateIds: [],
}

export const recruiterSlice = createSlice({
  name: 'recruiter',
  initialState,
  reducers: {
    setSelectedJobId: (state, action) => {
      state.selectedJobId = action.payload
    },
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload
    },
    setFilterKnockouts: (state, action) => {
      state.filterKnockouts = action.payload
    },
    setFilterScoreTier: (state, action) => {
      state.filterScoreTier = action.payload
    },
    setFilterStatus: (state, action) => {
      state.filterStatus = action.payload
    },

    setActivePreset: (state, action) => {
      const presetKey = action.payload
      if (MACRO_PRESETS[presetKey]) {
        state.activePresetKey = presetKey
        state.customWeights = { ...MACRO_PRESETS[presetKey].weights }
      }
    },

    setCustomWeights: (state, action) => {
      state.activePresetKey = 'custom'
      state.customWeights = { ...action.payload }
    },

    toggleBookmark: (state, action) => {
      const candidateId = action.payload
      const candidate = state.candidates.find((c) => c.id === candidateId)
      if (candidate) {
        candidate.isBookmarked = !candidate.isBookmarked
      }
    },

    addCandidateNote: (state, action) => {
      const { candidateId, noteText, author = 'Alex Morgan' } = action.payload
      const candidate = state.candidates.find((c) => c.id === candidateId)
      if (candidate) {
        const newNote = {
          id: `n_${Date.now()}`,
          author,
          date: 'Just now',
          text: noteText,
        }
        candidate.notes = [newNote, ...(candidate.notes || [])]
      }
    },

    toggleCandidateSelection: (state, action) => {
      const candidateId = action.payload
      const candidate = state.candidates.find((c) => c.id === candidateId)
      if (candidate) {
        candidate.isSelected = !candidate.isSelected
      }
    },

    selectAllCandidates: (state, action) => {
      const { jobId, select = true } = action.payload
      state.candidates.forEach((c) => {
        if (!jobId || jobId === 'all' || c.jobId === jobId) {
          c.isSelected = select
        }
      })
    },

    toggleCompareCandidate: (state, action) => {
      const candidateId = action.payload
      if (state.comparedCandidateIds.includes(candidateId)) {
        state.comparedCandidateIds = state.comparedCandidateIds.filter((id) => id !== candidateId)
      } else {
        if (state.comparedCandidateIds.length >= 3) {
          state.comparedCandidateIds = [...state.comparedCandidateIds.slice(1), candidateId]
        } else {
          state.comparedCandidateIds.push(candidateId)
        }
      }
    },

    clearComparison: (state) => {
      state.comparedCandidateIds = []
    },
  },

  extraReducers: (builder) => {
    // fetchRecruiterData
    builder.addCase(fetchRecruiterData.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchRecruiterData.fulfilled, (state, action) => {
      state.loading = false
      state.jobs = action.payload.jobs
      state.candidates = action.payload.candidates
      if (!state.selectedJobId && action.payload.jobs.length > 0) {
        state.selectedJobId = action.payload.jobs[0].id
      }
      state.error = null
    })
    builder.addCase(fetchRecruiterData.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload || 'Failed to load backend recruiter data'
    })

    // createJobBackend
    builder.addCase(createJobBackend.fulfilled, (state, action) => {
      state.jobs.unshift(action.payload)
      state.selectedJobId = action.payload.id
    })

    // updateJobBackend
    builder.addCase(updateJobBackend.fulfilled, (state, action) => {
      const { jobId, updated } = action.payload
      const index = state.jobs.findIndex((j) => j.id === jobId)
      if (index !== -1) {
        const nextStatus = updated.status || (updated.isActive !== undefined ? (updated.isActive ? 'ACTIVE' : 'PAUSED') : state.jobs[index].status)
        const isActive = nextStatus === 'ACTIVE'
        state.jobs[index] = {
          ...state.jobs[index],
          ...updated,
          isActive,
          status: nextStatus,
        }
      }
    })

    // deleteJobBackend
    builder.addCase(deleteJobBackend.fulfilled, (state, action) => {
      const jobId = action.payload
      state.jobs = state.jobs.filter((j) => j.id !== jobId)
      state.candidates = state.candidates.filter((c) => c.jobId !== jobId)
      if (state.selectedJobId === jobId) {
        state.selectedJobId = state.jobs[0]?.id || null
      }
    })

    // changeApplicationStatusBackend
    builder.addCase(changeApplicationStatusBackend.fulfilled, (state, action) => {
      const { applicationId, status } = action.payload
      const candidate = state.candidates.find((c) => c.id === applicationId)
      if (candidate) {
        candidate.status = status
      }
    })
  },
})

export const {
  setSelectedJobId,
  setSearchTerm,
  setFilterKnockouts,
  setFilterScoreTier,
  setFilterStatus,
  setActivePreset,
  setCustomWeights,
  toggleBookmark,
  addCandidateNote,
  toggleCandidateSelection,
  selectAllCandidates,
  toggleCompareCandidate,
  clearComparison,
} = recruiterSlice.actions

// Selectors
export const selectEffectiveWeights = (state) => {
  const { activePresetKey, customWeights } = state.recruiter
  if (activePresetKey === 'custom') return customWeights
  return MACRO_PRESETS[activePresetKey]?.weights || customWeights
}

export const selectCandidateCompositeScore = (state, candidate) => {
  const weights = selectEffectiveWeights(state)
  return computeCompositeScore(candidate.pillarScores, weights)
}

export const selectCandidateTier = (state, candidate) => {
  const score = selectCandidateCompositeScore(state, candidate)
  return getMatchTier(score)
}

export const selectRankedCandidates = (state, targetJobId = null) => {
  const recruiter = state.recruiter
  const jobId = targetJobId || recruiter.selectedJobId
  const weights = selectEffectiveWeights(state)

  let list = recruiter.candidates
  if (jobId && jobId !== 'all') {
    list = list.filter((c) => c.jobId === jobId)
  }

  // Knockouts filter
  if (recruiter.filterKnockouts === 'eligible_only') {
    list = list.filter((c) => !c.isKnockedOut)
  } else if (recruiter.filterKnockouts === 'knockouts_only') {
    list = list.filter((c) => c.isKnockedOut)
  }

  // Status filter
  if (recruiter.filterStatus !== 'all') {
    list = list.filter((c) => c.status === recruiter.filterStatus)
  }

  // Compute score & tier
  const scoredList = list.map((candidate) => {
    const overallScore = computeCompositeScore(candidate.pillarScores, weights)
    const tierInfo = getMatchTier(overallScore)
    return {
      ...candidate,
      overallScore,
      tierInfo,
    }
  })

  // Tier filter
  let filtered = scoredList
  if (recruiter.filterScoreTier !== 'all') {
    if (recruiter.filterScoreTier === 'exceptional') {
      filtered = filtered.filter((c) => c.overallScore >= 85)
    } else if (recruiter.filterScoreTier === 'strong') {
      filtered = filtered.filter((c) => c.overallScore >= 70 && c.overallScore < 85)
    } else if (recruiter.filterScoreTier === 'moderate') {
      filtered = filtered.filter((c) => c.overallScore >= 55 && c.overallScore < 70)
    } else if (recruiter.filterScoreTier === 'marginal') {
      filtered = filtered.filter((c) => c.overallScore < 55)
    }
  }

  // Search filter
  if (recruiter.searchTerm) {
    const q = recruiter.searchTerm.toLowerCase()
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        (c.matchedSkills && c.matchedSkills.some((s) => s.toLowerCase().includes(q)))
    )
  }

  // Sort descending by overallScore (eligible first)
  filtered.sort((a, b) => {
    if (a.isKnockedOut !== b.isKnockedOut) {
      return a.isKnockedOut ? 1 : -1
    }
    return b.overallScore - a.overallScore
  })

  return filtered.map((c, index) => ({
    ...c,
    rank: index + 1,
  }))
}

export default recruiterSlice.reducer
