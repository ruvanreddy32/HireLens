import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useJobSeekerStore } from '../../store/jobSeekerStore'
import Card from '../../components/ui/Card'
import ScoreBadge from '../../components/ui/ScoreBadge'
import { getRankedVariantsForJob } from '../../utils/matchCalculator'
import { createResumePdfBlob } from '../../utils/pdfHelper'
import { api } from '../../services/api'

export default function JobBoard() {
  const { setPageTitle } = useUIStore()
  const {
    activeJobs,
    resumes,
    maxResumes,
    loading,
    applyingJobId,
    error,
    successMessage,
    clearError,
    clearSuccess,
    fetchData,
    applyToJob,
    hasAppliedToJob,
  } = useJobSeekerStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [workModeFilter, setWorkModeFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('MATCH')
  const [selectedJobForModal, setSelectedJobForModal] = useState(null)
  const [selectedResumeId, setSelectedResumeId] = useState(null)
  const [agreedToLockPolicy, setAgreedToLockPolicy] = useState(false)
  const [applyError, setApplyError] = useState(null)

  useEffect(() => {
    setPageTitle('Explore Job Opportunities')
    fetchData()
  }, [setPageTitle, fetchData])

  // Pre-compute best scores for all active jobs
  const enrichedJobs = useMemo(() => {
    return activeJobs.map((job) => {
      const ranked = getRankedVariantsForJob(resumes, job)
      const bestScore = ranked[0]?.matchScore ?? null
      return {
        ...job,
        bestScore,
        rankedVariants: ranked,
      }
    })
  }, [activeJobs, resumes])

  // Filter & sort jobs
  const filteredJobs = useMemo(() => {
    const list = enrichedJobs.filter((job) => {
      if (workModeFilter !== 'ALL' && job.workMode !== workModeFilter) return false
      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim()
        const titleMatch = job.title?.toLowerCase().includes(q)
        const locMatch = job.location?.toLowerCase().includes(q)
        const skillsMatch = (job.requiredSkills || []).some((s) => s.toLowerCase().includes(q))
        return titleMatch || locMatch || skillsMatch
      }
      return true
    })

    if (sortBy === 'MATCH') {
      list.sort((a, b) => b.bestScore - a.bestScore)
    } else if (sortBy === 'NEWEST') {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    } else if (sortBy === 'SALARY') {
      list.sort((a, b) => (b.maxSalary || 0) - (a.maxSalary || 0))
    }

    return list
  }, [enrichedJobs, workModeFilter, searchTerm, sortBy])

  const handleOpenApplyModal = (job) => {
    if (hasAppliedToJob(job.id)) {
      return
    }
    if (resumes.length > 0) {
      const ranked = getRankedVariantsForJob(resumes, job)
      const best = ranked[0] || resumes.find((r) => r.isPrimary) || resumes[0]
      setSelectedResumeId(best?.id || null)
    } else {
      setSelectedResumeId(null)
    }
    setAgreedToLockPolicy(false)
    setApplyError(null)
    setSelectedJobForModal(job)
  }

  const handleConfirmApplication = async (e) => {
    e.preventDefault()
    if (!selectedJobForModal) return

    if (!selectedResumeId) {
      setApplyError('Please select a resume variant to apply with.')
      return
    }

    if (!agreedToLockPolicy) {
      setApplyError('You must acknowledge the immutable application policy before submitting.')
      return
    }

    const targetResume = resumes.find((r) => r.id === selectedResumeId)
    if (!targetResume) {
      setApplyError('Selected resume not found.')
      return
    }

    try {
      // Use existing File instance or fetch authentic PDF from backend/S3
      let fileToSubmit = targetResume.file
      if (!(fileToSubmit instanceof File) && targetResume.id) {
        try {
          const blob = await api.getResumeFileBlob(targetResume.id)
          fileToSubmit = new File([blob], targetResume.fileName || 'resume.pdf', {
            type: 'application/pdf',
          })
        } catch (fetchErr) {
          console.warn('Could not fetch authentic PDF from backend storage, using metadata fallback:', fetchErr)
        }
      }

      if (!(fileToSubmit instanceof File)) {
        fileToSubmit = new File([createResumePdfBlob(targetResume)], targetResume.fileName || 'resume.pdf', {
          type: 'application/pdf',
        })
      }

      const res = await applyToJob({
        jobId: selectedJobForModal.id,
        resumeId: targetResume.id,
        file: fileToSubmit,
      })

      if (res.error) {
        setApplyError(res.payload || 'Failed to apply')
      } else {
        setSelectedJobForModal(null)
      }
    } catch (err) {
      setApplyError(err.message || 'Submission failed')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Toast Feedbacks */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-red-600">error</span>
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={clearError} className="text-red-500 hover:text-red-800">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
            <span className="font-medium">{successMessage}</span>
          </div>
          <button onClick={clearSuccess} className="text-emerald-500 hover:text-emerald-800">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Header and Resume Hub Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Active Opportunities</h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Browse live verified requisitions. Select your best tailored resume variant for each application.
          </p>
        </div>

        {/* Quick Resume Manager Link & Status */}
        <Link
          to="/resume"
          className="bg-surface-container-lowest border border-outline-variant/80 hover:border-primary/50 transition-colors rounded-xl px-3.5 py-2 flex items-center gap-3 shadow-subtle group"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">folder_shared</span>
          </div>
          <div className="text-xs">
            <span className="font-semibold text-on-surface group-hover:text-primary transition-colors block leading-tight">
              Resume Manager
            </span>
            <span className="text-[11px] text-secondary">
              {resumes.length} of {maxResumes} variants ready
            </span>
          </div>
          <span className="material-symbols-outlined text-[16px] text-secondary group-hover:translate-x-0.5 transition-transform">
            arrow_forward
          </span>
        </Link>
      </div>

      {/* Search & WorkMode Filter Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-3 shadow-subtle flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by role title, skill, or location..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-outline-variant/60 bg-surface-container-low focus:bg-surface-container-lowest focus:border-primary outline-hidden transition-colors"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 justify-between md:justify-end">
          {/* Work Mode Toggle Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {['ALL', 'REMOTE', 'HYBRID', 'ONSITE'].map((mode) => (
              <button
                key={mode}
                onClick={() => setWorkModeFilter(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  workModeFilter === mode
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container hover:bg-surface-container-high text-secondary'
                }`}
              >
                {mode === 'ALL' ? 'All Modes' : mode}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-outline-variant/60">
            <span className="text-[11px] font-semibold text-secondary hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-on-surface outline-hidden cursor-pointer"
            >
              <option value="MATCH">🎯 Best Match</option>
              <option value="NEWEST">⚡ Newest</option>
              <option value="SALARY">💰 Top Salary</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Listing */}
      {loading && activeJobs.length === 0 ? (
        <Card className="text-center py-12 text-on-surface-variant border border-outline-variant/60">
          <span className="material-symbols-outlined text-[36px] text-primary animate-spin mb-2">
            progress_activity
          </span>
          <p className="text-xs">Fetching live open requisitions...</p>
        </Card>
      ) : filteredJobs.length === 0 ? (
        <Card className="text-center py-12 text-on-surface-variant border border-outline-variant/60">
          <span className="material-symbols-outlined text-[48px] text-outline mb-2">work_off</span>
          <h3 className="text-base font-bold text-on-surface">No open requisitions found</h3>
          <p className="text-xs text-secondary mt-1">Try adjusting your search criteria or work mode filter.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const hasApplied = hasAppliedToJob(job.id)
            const isSubmitting = applyingJobId === job.id
            const bestScore = typeof job.bestScore === 'number' ? job.bestScore : null

            return (
              <Card
                key={job.id}
                className={`border transition-all duration-200 ${
                  hasApplied
                    ? 'border-blue-200/80 bg-gradient-to-r from-blue-50/30 via-surface-container-lowest to-surface-container-lowest shadow-subtle'
                    : 'border-outline-variant/70 hover:border-primary/40 shadow-card hover:shadow-card-hover'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Job Details */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-base font-bold text-on-surface">
                        <Link to={`/jobs/${job.id}`} className="hover:text-primary transition-colors">
                          {job.title}
                        </Link>
                      </h2>
                      {bestScore !== null && bestScore > 0 && (
                        <ScoreBadge score={bestScore} />
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-container text-secondary">
                        {job.workMode}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-container text-secondary">
                        {job.employmentType?.replace('_', ' ')}
                      </span>
                      {hasApplied && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">lock</span>
                          Applied • Submission Locked
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-on-surface-variant flex-wrap font-medium">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-outline">location_on</span>
                        {job.location || 'Remote'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-outline">work_history</span>
                        {job.minExperience}–{job.maxExperience || job.minExperience + 3} yrs experience
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-semibold text-on-surface">
                        <span className="material-symbols-outlined text-[15px] text-outline">payments</span>
                        {job.minSalary && job.maxSalary
                          ? `₹${Math.round(job.minSalary / 1000)}k – ₹${Math.round(job.maxSalary / 1000)}k`
                          : 'Market Competitive'}
                      </span>
                    </div>

                    {/* Required Skills Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(job.requiredSkills || []).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[11px] bg-blue-50/70 border border-blue-100 text-primary font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                      {(job.preferredSkills || []).slice(0, 3).map((pref, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[11px] bg-surface-container text-secondary"
                        >
                          +{pref}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions / Submission Status Box */}
                  <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-outline-variant/60">
                    {hasApplied ? (
                      <div className="text-right space-y-1">
                        <button
                          disabled
                          className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 cursor-not-allowed opacity-90 shadow-xs"
                          title="You have already applied. Re-applying or deleting is strictly disabled."
                        >
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          Application Submitted
                        </button>
                        <p className="text-[10px] text-secondary font-medium max-w-[200px] leading-tight">
                          🔒 Locked: Re-application with another resume is disabled.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="px-3.5 py-2 rounded-xl border border-outline-variant/80 hover:bg-surface-container text-secondary hover:text-on-surface font-semibold text-xs transition-colors"
                        >
                          Details
                        </Link>
                        <button
                          onClick={() => handleOpenApplyModal(job)}
                          disabled={isSubmitting}
                          className="px-4 py-2 rounded-xl bg-primary text-on-primary font-semibold text-xs hover:opacity-90 active:scale-95 transition-all shadow-subtle flex items-center gap-1.5"
                        >
                          {isSubmitting ? (
                            <>
                              <span className="material-symbols-outlined text-[16px] animate-spin">
                                progress_activity
                              </span>
                              Submitting...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[16px]">send</span>
                              Apply Now
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Application Modal with Resume Selection and Lock Acknowledgment */}
      {selectedJobForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-outline-variant space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
              <div>
                <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">send</span>
                  Submit Application
                </h2>
                <p className="text-xs text-secondary mt-0.5">
                  Requisition: <span className="font-semibold text-on-surface">{selectedJobForModal.title}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedJobForModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {applyError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{applyError}</span>
              </div>
            )}

            {/* Select Resume Variant */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                  Select Resume Variant (from your {resumes.length}/{maxResumes} resumes)
                </label>
                <Link
                  to="/resume"
                  target="_blank"
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                >
                  Manage Resumes
                  <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                </Link>
              </div>

              {resumes.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-outline-variant text-center space-y-2">
                  <p className="text-xs text-secondary">You haven't uploaded any resumes yet.</p>
                  <Link
                    to="/resume"
                    className="inline-block px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold"
                  >
                    Go to Resume Manager
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {getRankedVariantsForJob(resumes, selectedJobForModal).map((resume) => {
                    const isSelected = selectedResumeId === resume.id
                    return (
                      <div
                        key={resume.id}
                        onClick={() => setSelectedResumeId(resume.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-primary bg-blue-50/50 shadow-xs'
                            : 'border-outline-variant/70 hover:border-outline-variant bg-surface-container-lowest'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="radio"
                            name="resumeSelection"
                            checked={isSelected}
                            onChange={() => setSelectedResumeId(resume.id)}
                            className="text-primary focus:ring-primary h-4 w-4"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-on-surface truncate">
                                {resume.title}
                              </span>
                              {resume.isBestFit && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                                  Recommended Fit
                                </span>
                              )}
                              {resume.isPrimary && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-secondary truncate">
                              {resume.specialization} • Matches {resume.matchedCount} of {resume.totalRequired} required skills
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs font-bold block leading-none ${
                              resume.matchScore >= 85 ? 'text-emerald-700' : 'text-primary'
                            }`}
                          >
                            {resume.matchScore}%
                          </span>
                          <span className="text-[9px] uppercase font-semibold text-secondary">
                            Job Match
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Crucial: Immutable Application Lock Policy Warning */}
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <span className="material-symbols-outlined text-[18px] text-amber-700">warning</span>
                <span>Important: Immutable Submission Policy</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                By submitting this application, you understand and acknowledge that:
              </p>
              <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-1 pl-1">
                <li>
                  <strong className="text-amber-950">You cannot delete or withdraw</strong> this application once submitted.
                </li>
                <li>
                  <strong className="text-amber-950">You cannot apply again</strong> to this company requisition with another resume.
                </li>
                <li>The selected resume will be permanently archived in the recruiter's hiring record.</li>
              </ul>

              <div className="pt-2 border-t border-amber-200/80 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="lockPolicyCheckbox"
                  checked={agreedToLockPolicy}
                  onChange={(e) => setAgreedToLockPolicy(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <label
                  htmlFor="lockPolicyCheckbox"
                  className="text-xs font-semibold text-amber-950 cursor-pointer select-none"
                >
                  I understand this application is final and cannot be deleted or re-submitted.
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-outline-variant flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedJobForModal(null)}
                className="px-4 py-2 rounded-xl border border-outline-variant text-xs font-semibold hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApplication}
                disabled={!agreedToLockPolicy || !selectedResumeId || applyingJobId !== null}
                className={`px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 shadow-xs transition-all ${
                  !agreedToLockPolicy || !selectedResumeId || applyingJobId !== null
                    ? 'bg-surface-container text-outline opacity-60 cursor-not-allowed'
                    : 'bg-primary text-on-primary hover:opacity-90 active:scale-95'
                }`}
              >
                {applyingJobId !== null ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                    Submitting Application...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Confirm &amp; Lock Application
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
