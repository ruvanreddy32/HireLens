import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { api } from '../../services/api'

export const MAX_RESUMES = 5

// Clean up legacy localStorage cache from previous offline version
try {
  localStorage.removeItem('hirelens_resumes')
} catch {
  // Ignore
}

// ─── Async Thunks ──────────────────────────────────────────────────────────

export const fetchJobSeekerData = createAsyncThunk(
  'jobSeeker/fetchData',
  async (force, { rejectWithValue }) => {
    try {
      const [jobsData, appsData, backendResumes] = await Promise.all([
        api.getActiveJobs().catch(() => []),
        api.getMyApplications().catch(() => []),
        api.getResumes().catch(() => []),
      ])

      return {
        activeJobs: Array.isArray(jobsData) ? jobsData : [],
        applications: Array.isArray(appsData) ? appsData : [],
        backendResumes: Array.isArray(backendResumes) ? backendResumes : [],
      }
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to load job seeker data')
    }
  },
  {
    condition: (force = false, { getState }) => {
      const { jobSeeker } = getState()
      // Prevent redundant network request if already loading
      if (jobSeeker.loading) {
        return false
      }
      // If we already have fresh activeJobs in store (fetched in the last 15s), skip unless force is true
      if (
        !force &&
        jobSeeker.lastFetched &&
        Date.now() - jobSeeker.lastFetched < 15000 &&
        jobSeeker.activeJobs.length > 0
      ) {
        return false
      }
      return true
    },
  }
)

export const applyToJobAsync = createAsyncThunk(
  'jobSeeker/applyToJob',
  async ({ jobId, resumeId, file }, { getState, rejectWithValue }) => {
    const state = getState().jobSeeker
    const existing = state.applications.find((a) => a.jobId === jobId)

    if (existing) {
      return rejectWithValue(
        'You have already applied to this company requisition. Applications are locked and cannot be resubmitted with another resume.'
      )
    }

    try {
      const createdApplication = await api.applyToJob(jobId, { resumeId, file })
      return {
        application: createdApplication,
        jobId,
        resumeId,
      }
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to submit application')
    }
  }
)

export const withdrawApplicationAsync = createAsyncThunk(
  'jobSeeker/withdrawApplicationAsync',
  async ({ applicationId, reason }, { rejectWithValue }) => {
    try {
      await api.withdrawApplication(applicationId, reason)
      return { applicationId, reason }
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to withdraw application')
    }
  }
)

// ─── Initial State ─────────────────────────────────────────────────────────

const initialState = {
  resumes: [],
  activeJobs: [],
  applications: [],
  loading: false,
  applyingJobId: null,
  error: null,
  successMessage: null,
  lastFetched: null,
}

// ─── Slice ─────────────────────────────────────────────────────────────────

export const jobSeekerSlice = createSlice({
  name: 'jobSeeker',
  initialState,
  reducers: {
    addResume: (state, action) => {
      if (state.resumes.length >= MAX_RESUMES) {
        state.error = `Maximum limit of ${MAX_RESUMES} resumes reached. Remove an unsubmitted resume to upload a new one.`
        return
      }

      const newResume = {
        ...action.payload,
        appliedJobIds: action.payload.appliedJobIds || [],
        isPrimary: state.resumes.length === 0 ? true : Boolean(action.payload.isPrimary),
      }

      if (newResume.isPrimary) {
        state.resumes.forEach((r) => {
          r.isPrimary = false
        })
      }

      state.resumes.unshift(newResume)
      state.error = null
      state.successMessage = `Resume "${newResume.title}" uploaded successfully (${state.resumes.length}/${MAX_RESUMES} slots used).`
    },

    deleteResume: (state, action) => {
      const resumeId = action.payload
      const target = state.resumes.find((r) => r.id === resumeId)

      if (!target) return

      // Check if attached to any submitted application
      const isLocked =
        (target.appliedJobIds && target.appliedJobIds.length > 0) ||
        state.applications.some((app) => app.resumeId === resumeId)

      if (isLocked) {
        state.error =
          'This resume cannot be deleted because it is attached to an active submitted application. Recruiter compliance requires submission records to remain immutable.'
        return
      }

      state.resumes = state.resumes.filter((r) => r.id !== resumeId)

      // Ensure there is always a primary resume if any exist
      if (target.isPrimary && state.resumes.length > 0) {
        state.resumes[0].isPrimary = true
      }

      state.error = null
      state.successMessage = `Resume deleted (${state.resumes.length}/${MAX_RESUMES} slots remaining).`
    },

    setPrimaryResume: (state, action) => {
      const resumeId = action.payload
      state.resumes.forEach((r) => {
        r.isPrimary = r.id === resumeId
      })
    },

    clearJobSeekerError: (state) => {
      state.error = null
    },

    clearJobSeekerSuccess: (state) => {
      state.successMessage = null
    },

    withdrawApplication: (state, action) => {
      const { applicationId, reason } = action.payload
      const app = state.applications.find((a) => a.id === applicationId)
      if (app) {
        app.status = 'WITHDRAWN'
        app.withdrawalReason = reason || 'Candidate voluntarily withdrew candidacy'
        app.withdrawnAt = new Date().toISOString()
      }
      state.successMessage =
        'Application successfully withdrawn. Your candidacy has been archived and removed from the active triage queue.'
    },
  },

  extraReducers: (builder) => {
    // fetchJobSeekerData
    builder.addCase(fetchJobSeekerData.pending, (state) => {
      state.loading = true
      state.error = null
    })
    builder.addCase(fetchJobSeekerData.fulfilled, (state, action) => {
      state.loading = false
      state.lastFetched = Date.now()
      state.activeJobs = action.payload.activeJobs
      state.applications = action.payload.applications

      // If backend returns real uploaded resumes, sync them
      if (Array.isArray(action.payload.backendResumes)) {
        state.resumes = action.payload.backendResumes.map((br) => {
          const parsedSkills = Array.isArray(br.parsedData?.skills)
            ? br.parsedData.skills.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
            : []

          return {
            id: br.id,
            title: br.title,
            fileName: br.fileName,
            fileUrl: br.fileUrl,
            fileSize: br.fileSize,
            targetRole: br.targetRole || '',
            isPrimary: br.isPrimary,
            parseStatus: br.parseStatus,
            parsedData: br.parsedData || null,
            skills: parsedSkills,
            uploadedAt: new Date(br.createdAt).toLocaleDateString(),
            appliedJobIds: [],
          }
        })
      }

      // Sync appliedJobIds onto resumes based on real applications
      const appliedJobIdsSet = new Set(action.payload.applications.map((a) => a.jobId))
      state.resumes.forEach((r) => {
        if (r.appliedJobIds) {
          r.appliedJobIds = r.appliedJobIds.filter((id) => appliedJobIdsSet.has(id))
        }
      })
    })
    builder.addCase(fetchJobSeekerData.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload || 'Failed to fetch job seeker data'
    })

    // withdrawApplicationAsync
    builder.addCase(withdrawApplicationAsync.fulfilled, (state, action) => {
      const { applicationId, reason } = action.payload
      const app = state.applications.find((a) => a.id === applicationId)
      if (app) {
        app.status = 'WITHDRAWN'
        app.withdrawalReason = reason || 'Candidate voluntarily withdrew candidacy'
        app.withdrawnAt = new Date().toISOString()
      }
      state.successMessage =
        'Application successfully withdrawn. Your candidacy has been archived.'
    })
    builder.addCase(withdrawApplicationAsync.rejected, (state, action) => {
      state.error = action.payload || 'Failed to withdraw application'
    })

    // applyToJobAsync
    builder.addCase(applyToJobAsync.pending, (state, action) => {
      state.applyingJobId = action.meta.arg.jobId
      state.error = null
    })
    builder.addCase(applyToJobAsync.fulfilled, (state, action) => {
      state.applyingJobId = null
      const { application, jobId, resumeId } = action.payload

      // Enrich application with local resumeId reference
      const enrichedApp = {
        ...application,
        resumeId,
      }
      state.applications.unshift(enrichedApp)

      // Mark the resume as locked to this jobId
      const targetResume = state.resumes.find((r) => r.id === resumeId)
      if (targetResume) {
        targetResume.appliedJobIds = Array.from(new Set([...(targetResume.appliedJobIds || []), jobId]))
      }

      state.successMessage =
        'Application successfully submitted and locked! Recruiters now have your dossier in their active triage queue.'
    })
    builder.addCase(applyToJobAsync.rejected, (state, action) => {
      state.applyingJobId = null
      state.error = action.payload || 'Failed to apply'
    })
  },
})

export const {
  addResume,
  deleteResume,
  setPrimaryResume,
  clearJobSeekerError,
  clearJobSeekerSuccess,
  withdrawApplication,
} = jobSeekerSlice.actions

export default jobSeekerSlice.reducer
