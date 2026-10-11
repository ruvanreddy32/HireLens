import { useCallback } from 'react'
import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import authReducer, { loginUser, logout, initializeAuth, clearAuthError } from './slices/authSlice'
import uiReducer, { setSidebarOpen, toggleSidebar, setPageTitle } from './slices/uiSlice'
import recruiterReducer, {
  setSelectedJobId,
  setSearchTerm,
  setFilterKnockouts,
  setFilterScoreTier,
  setFilterStatus,
  setActivePreset,
  setCustomWeights,
  toggleBookmark as toggleBookmarkAction,
  addCandidateNote as addCandidateNoteAction,
  toggleCandidateSelection as toggleCandidateSelectionAction,
  selectAllCandidates as selectAllCandidatesAction,
  toggleCompareCandidate as toggleCompareCandidateAction,
  clearComparison as clearComparisonAction,
  fetchRecruiterData,
  createJobBackend,
  updateJobBackend,
  deleteJobBackend,
  changeApplicationStatusBackend,
  selectEffectiveWeights,
  selectRankedCandidates,
} from './slices/recruiterSlice'
import { computeCompositeScore, getMatchTier } from '../utils/scoring'
import { api } from '../services/api'

import jobSeekerReducer, {
  addResume as addResumeAction,
  deleteResume as deleteResumeAction,
  setPrimaryResume as setPrimaryResumeAction,
  clearJobSeekerError as clearJobSeekerErrorAction,
  clearJobSeekerSuccess as clearJobSeekerSuccessAction,
  withdrawApplicationAsync,
  fetchJobSeekerData,
  applyToJobAsync,
  MAX_RESUMES,
} from './slices/jobSeekerSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    recruiter: recruiterReducer,
    jobSeeker: jobSeekerReducer,
  },
})

export const useAppDispatch = () => useDispatch()
export const useAppSelector = useSelector

/**
 * useAuthStore Hook — Connected to real NestJS backend auth
 */
export function useAuthStore() {
  const dispatch = useDispatch()
  const { user, role, isAuthenticated, loading, error } = useSelector((state) => state.auth)

  const login = useCallback((credentials) => dispatch(loginUser(credentials)), [dispatch])
  const logoutUser = useCallback(() => dispatch(logout()), [dispatch])
  const initializeAuthFn = useCallback(() => dispatch(initializeAuth()), [dispatch])
  const clearError = useCallback(() => dispatch(clearAuthError()), [dispatch])

  return {
    user,
    role,
    isAuthenticated,
    loading,
    error,
    login,
    logout: logoutUser,
    initializeAuth: initializeAuthFn,
    clearError,
  }
}

/**
 * useUIStore Hook
 */
export function useUIStore() {
  const dispatch = useDispatch()
  const { sidebarOpen, pageTitle } = useSelector((state) => state.ui)

  const handleSetSidebarOpen = useCallback((open) => dispatch(setSidebarOpen(open)), [dispatch])
  const handleToggleSidebar = useCallback(() => dispatch(toggleSidebar()), [dispatch])
  const handleSetPageTitle = useCallback((title) => dispatch(setPageTitle(title)), [dispatch])

  return {
    sidebarOpen,
    pageTitle,
    setSidebarOpen: handleSetSidebarOpen,
    toggleSidebar: handleToggleSidebar,
    setPageTitle: handleSetPageTitle,
  }
}

/**
 * useRecruiterStore Hook — Connected to real NestJS backend /jobs and /applications
 */
export function useRecruiterStore() {
  const dispatch = useDispatch()
  const recruiter = useSelector((state) => state.recruiter)
  const effectiveWeights = useSelector(selectEffectiveWeights)

  const fetchData = useCallback((force = false) => dispatch(fetchRecruiterData(force)), [dispatch])
  const setSelectedJobIdFn = useCallback((id) => dispatch(setSelectedJobId(id)), [dispatch])
  const setSearchTermFn = useCallback((term) => dispatch(setSearchTerm(term)), [dispatch])
  const setFilterKnockoutsFn = useCallback((val) => dispatch(setFilterKnockouts(val)), [dispatch])
  const setFilterScoreTierFn = useCallback((val) => dispatch(setFilterScoreTier(val)), [dispatch])
  const setFilterStatusFn = useCallback((val) => dispatch(setFilterStatus(val)), [dispatch])
  const setActivePresetFn = useCallback((presetKey) => dispatch(setActivePreset(presetKey)), [dispatch])
  const setCustomWeightsFn = useCallback((weights) => dispatch(setCustomWeights(weights)), [dispatch])
  const getEffectiveWeights = useCallback(() => effectiveWeights, [effectiveWeights])

  const getCandidateCompositeScore = useCallback(
    (candidate) => computeCompositeScore(candidate?.pillarScores, effectiveWeights),
    [effectiveWeights]
  )

  const getCandidateTier = useCallback(
    (candidate) => {
      const score = computeCompositeScore(candidate?.pillarScores, effectiveWeights)
      return getMatchTier(score)
    },
    [effectiveWeights]
  )

  const createJob = useCallback((jobData) => dispatch(createJobBackend(jobData)), [dispatch])
  const updateJob = useCallback(
    (jobId, updates) => dispatch(updateJobBackend({ jobId, updates })),
    [dispatch]
  )
  const toggleJobStatus = useCallback(
    (jobId) => {
      const current = recruiter.jobs.find((j) => j.id === jobId)
      if (current) {
        const nextStatus = current.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
        dispatch(
          updateJobBackend({
            jobId,
            updates: { status: nextStatus, isActive: nextStatus === 'ACTIVE' },
          })
        )
      }
    },
    [dispatch, recruiter.jobs]
  )
  const deleteJob = useCallback((jobId) => dispatch(deleteJobBackend(jobId)), [dispatch])

  const updateCandidateStatus = useCallback(
    (candidateId, newStatus) => {
      const candidate = recruiter.candidates.find((c) => c.id === candidateId)
      if (candidate) {
        dispatch(
          changeApplicationStatusBackend({
            jobId: candidate.jobId,
            applicationId: candidateId,
            status: newStatus,
          })
        )
      }
    },
    [dispatch, recruiter.candidates]
  )

  const toggleBookmark = useCallback(
    (candidateId) => {
      dispatch(toggleBookmarkAction(candidateId))
      const candidate = recruiter.candidates.find((c) => c.id === candidateId)
      if (candidate?.jobId) {
        api.toggleCandidateBookmark(candidate.jobId, candidateId).catch(() => null)
      }
    },
    [dispatch, recruiter.candidates]
  )
  const addCandidateNote = useCallback(
    (candidateId, noteText, author) => {
      dispatch(addCandidateNoteAction({ candidateId, noteText, author }))
      const candidate = recruiter.candidates.find((c) => c.id === candidateId)
      if (candidate?.jobId) {
        api.addCandidateNote(candidate.jobId, candidateId, noteText).catch(() => null)
      }
    },
    [dispatch, recruiter.candidates]
  )
  const toggleCandidateSelection = useCallback(
    (candidateId) => dispatch(toggleCandidateSelectionAction(candidateId)),
    [dispatch]
  )
  const selectAllCandidates = useCallback(
    (jobId, select) => dispatch(selectAllCandidatesAction({ jobId, select })),
    [dispatch]
  )
  const batchUpdateStatus = useCallback(
    (candidateIds, newStatus) => {
      candidateIds.forEach((id) => {
        const candidate = recruiter.candidates.find((c) => c.id === id)
        if (candidate) {
          dispatch(
            changeApplicationStatusBackend({
              jobId: candidate.jobId,
              applicationId: id,
              status: newStatus,
            })
          )
        }
      })
    },
    [dispatch, recruiter.candidates]
  )
  const toggleCompareCandidate = useCallback(
    (candidateId) => dispatch(toggleCompareCandidateAction(candidateId)),
    [dispatch]
  )
  const clearComparison = useCallback(() => dispatch(clearComparisonAction()), [dispatch])

  const getRankedCandidates = useCallback(
    (targetJobId = null) => selectRankedCandidates({ recruiter }, targetJobId),
    [recruiter]
  )

  return {
    jobs: recruiter.jobs,
    candidates: recruiter.candidates,
    selectedJobId: recruiter.selectedJobId,
    activePresetKey: recruiter.activePresetKey,
    customWeights: recruiter.customWeights,
    searchTerm: recruiter.searchTerm,
    filterKnockouts: recruiter.filterKnockouts,
    filterScoreTier: recruiter.filterScoreTier,
    filterStatus: recruiter.filterStatus,
    comparedCandidateIds: recruiter.comparedCandidateIds,
    loading: recruiter.loading,
    error: recruiter.error,

    fetchRecruiterData: fetchData,
    setSelectedJobId: setSelectedJobIdFn,
    setSearchTerm: setSearchTermFn,
    setFilterKnockouts: setFilterKnockoutsFn,
    setFilterScoreTier: setFilterScoreTierFn,
    setFilterStatus: setFilterStatusFn,
    setActivePreset: setActivePresetFn,
    setCustomWeights: setCustomWeightsFn,
    getEffectiveWeights,
    getCandidateCompositeScore,
    getCandidateTier,
    createJob,
    updateJob,
    toggleJobStatus,
    deleteJob,
    updateCandidateStatus,
    toggleBookmark,
    addCandidateNote,
    toggleCandidateSelection,
    selectAllCandidates,
    batchUpdateStatus,
    toggleCompareCandidate,
    clearComparison,
    getRankedCandidates,
  }
}

/**
 * useJobSeekerStore Hook — Manages max 5 resumes, immutable applications, and live job data
 */
export function useJobSeekerStore() {
  const dispatch = useDispatch()
  const jobSeeker = useSelector((state) => state.jobSeeker)

  const fetchData = useCallback(
    (force = false) => dispatch(fetchJobSeekerData(force)),
    [dispatch]
  )
  const addResume = useCallback(
    (resumeData) => dispatch(addResumeAction(resumeData)),
    [dispatch]
  )
  const deleteResume = useCallback(
    (resumeId) => dispatch(deleteResumeAction(resumeId)),
    [dispatch]
  )
  const setPrimaryResume = useCallback(
    (resumeId) => dispatch(setPrimaryResumeAction(resumeId)),
    [dispatch]
  )
  const clearError = useCallback(() => dispatch(clearJobSeekerErrorAction()), [dispatch])
  const clearSuccess = useCallback(() => dispatch(clearJobSeekerSuccessAction()), [dispatch])
  const applyToJob = useCallback(
    ({ jobId, resumeId, file }) => dispatch(applyToJobAsync({ jobId, resumeId, file })),
    [dispatch]
  )
  const withdrawApplication = useCallback(
    ({ applicationId, reason }) =>
      dispatch(withdrawApplicationAsync({ applicationId, reason })),
    [dispatch]
  )
  const hasAppliedToJob = useCallback(
    (jobId) => jobSeeker.applications.some((app) => app.jobId === jobId),
    [jobSeeker.applications]
  )
  const getApplicationForJob = useCallback(
    (jobId) => jobSeeker.applications.find((app) => app.jobId === jobId),
    [jobSeeker.applications]
  )

  return {
    resumes: jobSeeker.resumes,
    activeJobs: jobSeeker.activeJobs,
    applications: jobSeeker.applications,
    loading: jobSeeker.loading,
    applyingJobId: jobSeeker.applyingJobId,
    error: jobSeeker.error,
    successMessage: jobSeeker.successMessage,
    maxResumes: MAX_RESUMES,

    fetchData,
    addResume,
    deleteResume,
    setPrimaryResume,
    clearError,
    clearSuccess,
    applyToJob,
    withdrawApplication,
    hasAppliedToJob,
    getApplicationForJob,
  }
}
