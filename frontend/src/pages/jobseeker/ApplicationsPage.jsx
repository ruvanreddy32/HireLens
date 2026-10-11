import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useJobSeekerStore } from '../../store/jobSeekerStore'
import { api } from '../../services/api'
import Card from '../../components/ui/Card'
import StatusBadge from '../../components/ui/StatusBadge'

// ─── Sub-Components ──────────────────────────────────────────────────────────

function ApplicationProgressStepper({ status, appliedDate }) {
  const isRejected = status === 'REJECTED' || status === 'Rejected'
  const isWithdrawn = status === 'WITHDRAWN' || status === 'Withdrawn'
  const isShortlisted = status === 'SHORTLISTED' || status === 'Shortlisted'
  const isReviewing = status === 'REVIEWING' || status === 'Under Review' || isShortlisted

  if (isWithdrawn) {
    return (
      <div className="bg-surface-container-low border border-outline-variant/70 rounded-xl p-3 flex items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-outline text-[18px]">unpublished</span>
          <div>
            <span className="font-bold text-on-surface">Candidacy Voluntarily Withdrawn</span>
            <p className="text-[11px] text-secondary">
              This application has been withdrawn from consideration. Re-applying to this requisition is permanently locked to preserve audit integrity.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-surface-container text-secondary text-[11px] font-semibold shrink-0">
          Archived
        </span>
      </div>
    )
  }

  if (isRejected) {
    return (
      <div className="bg-red-50/70 border border-red-200/80 rounded-xl p-3 flex items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-2 text-red-900">
          <span className="material-symbols-outlined text-red-600 text-[18px]">cancel</span>
          <div>
            <span className="font-bold">Requisition Process Completed</span>
            <p className="text-[11px] text-red-700">
              The hiring team has selected other candidates for this requisition. Thank you for your submission.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800 text-[11px] font-semibold shrink-0">
          Closed
        </span>
      </div>
    )
  }

  const steps = [
    { label: 'Submitted', done: true, subtext: appliedDate },
    { label: 'Under Review', done: isReviewing, current: status === 'REVIEWING' || status === 'Under Review' },
    { label: 'Shortlisted / Screen', done: isShortlisted, current: isShortlisted },
    { label: 'Final Decision', done: false, current: false },
  ]

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3.5 space-y-2">
      <div className="flex items-center justify-between text-[11px] font-semibold text-secondary">
        <span>Hiring Stage Telemetry</span>
        <span className="text-primary font-bold">
          {isShortlisted ? 'Stage 3 of 4: Interviewing' : isReviewing ? 'Stage 2 of 4: Triage Review' : 'Stage 1 of 4: Application Filed'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {steps.map((step) => (
          <div
            key={step.label}
            className={`p-2 rounded-lg border text-xs flex flex-col justify-between transition-all ${
              step.done
                ? 'bg-blue-50/70 border-blue-200 text-primary'
                : 'bg-surface-container-low/50 border-outline-variant/50 text-outline'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-[15px]">
                {step.done ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              <span className="truncate">{step.label}</span>
            </div>
            {step.subtext && (
              <span className="text-[10px] text-secondary mt-1 block">{step.subtext}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PillarScoreBar({ label, value, color = 'bg-primary' }) {
  const rounded = Math.round(value || 0)
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-secondary font-medium">{label}</span>
        <span className="font-bold text-on-surface">{rounded}%</span>
      </div>
      <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${rounded}%` }} />
      </div>
    </div>
  )
}

// ─── Main Applications Page ──────────────────────────────────────────────────

export default function ApplicationsPage() {
  const { setPageTitle } = useUIStore()
  const {
    applications,
    resumes,
    loading,
    error,
    successMessage,
    clearError,
    clearSuccess,
    fetchData,
    withdrawApplication,
  } = useJobSeekerStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('ALL')
  const [withdrawingApp, setWithdrawingApp] = useState(null)
  const [withdrawalReason, setWithdrawalReason] = useState('Accepted another offer')
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false)

  useEffect(() => {
    setPageTitle('Application Pipeline')
    fetchData()
  }, [setPageTitle, fetchData])

  // Clear messages after 6s
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        clearError()
        clearSuccess()
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [error, successMessage, clearError, clearSuccess])

  // Metric counts (computed in a single pass)
  const { totalCount, inReviewCount, shortlistedCount, withdrawnCount, rejectedCount } = useMemo(() => {
    let inReview = 0
    let shortlisted = 0
    let withdrawn = 0
    let rejected = 0

    for (const a of applications) {
      if (a.status === 'SHORTLISTED' || a.status === 'Shortlisted') {
        shortlisted++
      } else if (
        a.status === 'REVIEWING' ||
        a.status === 'APPLIED' ||
        a.status === 'Under Review' ||
        a.status === 'Applied'
      ) {
        inReview++
      } else if (a.status === 'WITHDRAWN' || a.status === 'Withdrawn') {
        withdrawn++
      } else if (a.status === 'REJECTED' || a.status === 'Rejected') {
        rejected++
      }
    }

    return {
      totalCount: applications.length,
      inReviewCount: inReview,
      shortlistedCount: shortlisted,
      withdrawnCount: withdrawn,
      rejectedCount: rejected,
    }
  }, [applications])

  // Filtered applications memoized
  const filteredApplications = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return applications.filter((app) => {
      const jobTitle = (app.job?.title || 'Engineering Role').toLowerCase()
      const company = (app.job?.company || 'HireLens Requisition').toLowerCase()
      const location = (app.job?.location || 'Remote').toLowerCase()

      const matchesSearch = !q || jobTitle.includes(q) || company.includes(q) || location.includes(q)
      if (!matchesSearch) return false

      if (activeTab === 'ACTIVE') {
        return (
          app.status === 'APPLIED' ||
          app.status === 'REVIEWING' ||
          app.status === 'SHORTLISTED' ||
          app.status === 'Applied' ||
          app.status === 'Under Review' ||
          app.status === 'Shortlisted'
        )
      }
      if (activeTab === 'SHORTLISTED') {
        return app.status === 'SHORTLISTED' || app.status === 'Shortlisted'
      }
      if (activeTab === 'WITHDRAWN') {
        return app.status === 'WITHDRAWN' || app.status === 'Withdrawn'
      }
      if (activeTab === 'CLOSED') {
        return app.status === 'REJECTED' || app.status === 'Rejected'
      }
      return true
    })
  }, [applications, searchQuery, activeTab])

  // Handle Withdrawal Submission
  const handleConfirmWithdrawal = async () => {
    if (!withdrawingApp) return

    setIsSubmittingWithdrawal(true)

    // Call store action
    withdrawApplication({
      applicationId: withdrawingApp.id,
      reason: withdrawalReason,
    })

    // Sync with backend if available
    try {
      await api.withdrawApplication(withdrawingApp.id, withdrawalReason)
    } catch {
      // Handled silently
    }

    setIsSubmittingWithdrawal(false)
    setWithdrawingApp(null)
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Notifications */}
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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Application Pipeline</h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Real-time stage telemetry, 4-pillar algorithmic evaluation, and submission lifecycle tracking.
          </p>
        </div>

        <Link
          to="/jobs"
          className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 self-start shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px]">search</span>
          Browse More Roles
        </Link>
      </div>

      {/* 4-Card Analytics Overview Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-outline-variant/70 shadow-card flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">send</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-secondary block">Total Submitted</span>
            <span className="text-xl font-bold text-on-surface">{totalCount}</span>
          </div>
        </Card>

        <Card className="p-4 border border-outline-variant/70 shadow-card flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-secondary block">Active in Review</span>
            <span className="text-xl font-bold text-on-surface">{inReviewCount}</span>
          </div>
        </Card>

        <Card className="p-4 border border-outline-variant/70 shadow-card flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">verified</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-secondary block">Shortlisted / Screen</span>
            <span className="text-xl font-bold text-on-surface">{shortlistedCount}</span>
          </div>
        </Card>

        <Card className="p-4 border border-outline-variant/70 shadow-card flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-surface-container text-secondary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">archive</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-secondary block">Withdrawn / Closed</span>
            <span className="text-xl font-bold text-on-surface">{withdrawnCount + rejectedCount}</span>
          </div>
        </Card>
      </div>

      {/* Filter Tabs & Search Toolbar */}
      <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-3 shadow-subtle flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Stage Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar py-1">
          {[
            { id: 'ALL', label: 'All', count: totalCount },
            { id: 'ACTIVE', label: 'Active Pipeline', count: inReviewCount + shortlistedCount },
            { id: 'SHORTLISTED', label: 'Shortlisted', count: shortlistedCount },
            { id: 'WITHDRAWN', label: 'Withdrawn', count: withdrawnCount },
            { id: 'CLOSED', label: 'Closed', count: rejectedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-secondary hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id
                    ? 'bg-on-primary/20 text-on-primary'
                    : 'bg-surface-container text-secondary'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[16px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by role or company..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-hidden"
          />
        </div>
      </div>

      {/* Applications List */}
      {loading && applications.length === 0 ? (
        <Card className="text-center py-12 text-on-surface-variant border border-outline-variant/60">
          <span className="material-symbols-outlined text-[36px] text-primary animate-spin mb-2">
            progress_activity
          </span>
          <p className="text-xs">Synchronizing application records...</p>
        </Card>
      ) : applications.length === 0 ? (
        <Card className="text-center py-14 text-on-surface-variant border border-outline-variant/60 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mx-auto text-outline">
            <span className="material-symbols-outlined text-[32px]">send</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-on-surface">No submitted applications yet</h3>
            <p className="text-xs text-secondary mt-1 max-w-sm mx-auto">
              Explore open engineering opportunities and apply with your tailored resume variants to track real-time hiring progress here.
            </p>
          </div>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <span>Explore Open Roles</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </Card>
      ) : filteredApplications.length === 0 ? (
        <Card className="text-center py-12 text-on-surface-variant border border-outline-variant/60 space-y-2">
          <p className="text-sm font-semibold text-on-surface">No applications match your filter</p>
          <p className="text-xs text-secondary">Try switching tabs or clearing your search query.</p>
          <button
            onClick={() => {
              setActiveTab('ALL')
              setSearchQuery('')
            }}
            className="px-3.5 py-1.5 rounded-xl border border-outline-variant text-xs font-semibold hover:bg-surface-container transition-colors mt-1"
          >
            Reset Filters
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((app) => {
            const jobId = app.job?.id || app.jobId
            const jobTitle = app.job?.title || 'Software Engineering Requisition'
            const companyName = app.job?.company || 'HireLens Requisition'
            const jobLocation = app.job?.location || 'Remote'
            const workMode = app.job?.workMode || 'HYBRID'
            const appliedDate = app.createdAt
              ? new Date(app.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Recent'

            const uiStatus =
              app.status === 'SHORTLISTED'
                ? 'Shortlisted'
                : app.status === 'REVIEWING'
                ? 'Under Review'
                : app.status === 'REJECTED'
                ? 'Rejected'
                : app.status === 'WITHDRAWN'
                ? 'Withdrawn'
                : 'Applied'

            const isWithdrawn = app.status === 'WITHDRAWN' || app.status === 'Withdrawn'
            const isClosed = app.status === 'REJECTED' || app.status === 'Rejected'

            // Find matching resume
            const matchedResume = resumes.find((r) => r.id === app.resumeId) || resumes[0]

            return (
              <Card
                key={app.id}
                className="border border-outline-variant/70 shadow-card hover:border-primary/40 transition-all space-y-4 p-5"
              >
                {/* Top Row: Requisition Title, Company & Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-outline-variant/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-on-surface">
                        <Link to={`/jobs/${jobId}`} className="hover:text-primary transition-colors">
                          {jobTitle}
                        </Link>
                      </h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-container text-secondary">
                        {workMode}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap font-medium">
                      <span className="font-semibold text-on-surface">{companyName}</span>
                      <span>•</span>
                      <span>{jobLocation}</span>
                      <span>•</span>
                      <span>Applied on <strong className="font-semibold text-on-surface">{appliedDate}</strong></span>
                      {matchedResume && (
                        <>
                          <span>•</span>
                          <span className="text-primary font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">description</span>
                            {matchedResume.title}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={uiStatus} />
                    {!isWithdrawn && !isClosed && (
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-container text-secondary flex items-center gap-1"
                        title="Application is permanently archived in company triage queue"
                      >
                        <span className="material-symbols-outlined text-[12px] text-primary">lock</span>
                        Locked Record
                      </span>
                    )}
                  </div>
                </div>

                {/* Visual Hiring Progression Stepper */}
                <ApplicationProgressStepper status={app.status} appliedDate={appliedDate} />

                {/* 4-Pillar Algorithmic Evaluation */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-3">
                  <PillarScoreBar label="Skills Match" value={typeof app.skillsScore === 'number' ? app.skillsScore : 0} color="bg-primary" />
                  <PillarScoreBar label="Experience Depth" value={typeof app.experienceScore === 'number' ? app.experienceScore : 0} color="bg-blue-600" />
                  <PillarScoreBar label="Project Rigor" value={typeof app.projectScore === 'number' ? app.projectScore : 0} color="bg-purple-600" />
                  <PillarScoreBar label="Proof of Work" value={typeof app.proofOfWorkScore === 'number' ? app.proofOfWorkScore : 0} color="bg-emerald-600" />
                </div>

                {/* Knockout Warning Banner if any */}
                {app.isKnockedOut && (
                  <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-2.5 text-xs text-amber-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-amber-700">warning</span>
                    <span>
                      Prerequisite Qualification Flag: {app.knockedOutReasons?.[0] || 'Did not meet a mandatory requisition requirement.'}
                    </span>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="pt-2 flex items-center justify-between gap-3 flex-wrap text-xs">
                  <Link
                    to={`/jobs/${jobId}`}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    <span>Inspect Requisition Details</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>

                  <div className="flex items-center gap-2">
                    {!isWithdrawn && !isClosed && (
                      <button
                        onClick={() => setWithdrawingApp(app)}
                        className="px-3 py-1.5 rounded-lg border border-outline-variant hover:border-red-300 hover:bg-red-50 text-secondary hover:text-red-700 font-semibold text-xs transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">cancel</span>
                        Withdraw Candidacy
                      </button>
                    )}

                    {isWithdrawn && (
                      <span className="text-[11px] text-secondary italic">
                        Withdrawn: {app.withdrawalReason || 'Voluntarily withdrawn'}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Withdraw Confirmation Modal */}
      {withdrawingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant space-y-4">
            <div className="flex items-center gap-3 text-red-600 pb-2 border-b border-outline-variant/60">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-on-surface">Withdraw Candidacy</h3>
                <p className="text-xs text-secondary">
                  {withdrawingApp.job?.title || 'Engineering Role'}
                </p>
              </div>
            </div>

            <p className="text-xs text-secondary leading-relaxed">
              Are you sure you want to withdraw your candidacy? Your application will be archived and removed from the active recruiter triage queue.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                Permanent Requisition Lock:
              </span>
              <p>
                To maintain algorithmic fairness and prevent adversarial ATS resume tuning, <strong className="font-bold">you will not be able to re-apply</strong> to this specific requisition.
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wider">
                Reason for Withdrawal
              </label>
              <select
                value={withdrawalReason}
                onChange={(e) => setWithdrawalReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:border-primary outline-hidden"
              >
                <option value="Accepted another offer">Accepted another offer</option>
                <option value="Compensation or location mismatch">Compensation or location mismatch</option>
                <option value="Submitted incorrect resume by mistake">Submitted incorrect resume by mistake</option>
                <option value="No longer interested in the role">No longer interested in the role</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setWithdrawingApp(null)}
                disabled={isSubmittingWithdrawal}
                className="px-4 py-2 rounded-xl border border-outline-variant text-xs font-semibold hover:bg-surface-container transition-colors"
              >
                Keep Application Active
              </button>
              <button
                type="button"
                onClick={handleConfirmWithdrawal}
                disabled={isSubmittingWithdrawal}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
              >
                {isSubmittingWithdrawal ? (
                  <>
                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                    Withdrawing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[14px]">check</span>
                    Confirm Withdrawal
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
