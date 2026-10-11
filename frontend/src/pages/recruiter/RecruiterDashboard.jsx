import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useRecruiterStore } from '../../store/recruiterStore'
import Card from '../../components/ui/Card'
import StatusBadge from '../../components/ui/StatusBadge'
import RadialGauge from '../../components/ui/RadialGauge'

export default function RecruiterDashboard() {
  const { setPageTitle } = useUIStore()
  const navigate = useNavigate()
  const {
    jobs,
    setSelectedJobId,
    getRankedCandidates,
    toggleJobStatus,
    toggleBookmark,
    fetchRecruiterData,
    loading,
    error,
  } = useRecruiterStore()

  useEffect(() => {
    setPageTitle('Recruiter Dashboard')
    fetchRecruiterData()
  }, [setPageTitle, fetchRecruiterData])

  // Aggregate stats
  const publishedJobs = jobs.filter((j) => j.status !== 'DRAFT')
  const activeJobs = publishedJobs.filter((j) => j.isActive)
  const totalApplicants = publishedJobs.reduce((sum, j) => sum + (j.applicantsTotal || 0), 0)
  const totalReviewed = publishedJobs.reduce((sum, j) => sum + ((j.applicantsTotal || 0) - (j.underReview || 0)), 0)
  const totalShortlisted = publishedJobs.reduce((sum, j) => sum + (j.shortlisted || 0), 0)
  const totalInterviews = publishedJobs.reduce((sum, j) => sum + (j.inInterview || 0), 0)
  const totalHired = publishedJobs.reduce((sum, j) => sum + (j.hired || 0), 0)
  const shortlistRate = totalApplicants > 0 ? Math.round((totalShortlisted / totalApplicants) * 100) : 0
  const hiredPercent = totalApplicants > 0 ? `${Math.round((totalHired / totalApplicants) * 100)}%` : '0%'

  // Top matching candidates across all jobs
  const topCandidates = getRankedCandidates('all').filter((c) => !c.isKnockedOut).slice(0, 4)

  // Pipeline funnel steps
  const funnelSteps = [
    { label: 'Applied', count: totalApplicants, percent: '100%', color: 'bg-surface-container-highest text-secondary' },
    { label: 'Under Review', count: totalApplicants - totalReviewed, percent: `${Math.round(((totalApplicants - totalReviewed) / (totalApplicants || 1)) * 100)}%`, color: 'bg-amber-100 text-amber-800' },
    { label: 'Shortlisted', count: totalShortlisted, percent: `${Math.round((totalShortlisted / (totalApplicants || 1)) * 100)}%`, color: 'bg-blue-100 text-primary' },
    { label: 'In Interview', count: totalInterviews, percent: `${Math.round((totalInterviews / (totalApplicants || 1)) * 100)}%`, color: 'bg-purple-100 text-purple-700' },
    { label: 'Hired', count: totalHired, percent: hiredPercent, color: 'bg-emerald-100 text-emerald-800' },
  ]

  const handleReviewJob = (jobId) => {
    setSelectedJobId(jobId)
    navigate('/recruiter/candidates')
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-20">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchRecruiterData()}
            className="px-2.5 py-1 bg-red-100 text-red-800 rounded font-semibold hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {loading && jobs.length === 0 ? (
        <div className="py-24 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-on-surface">Connecting to PostgreSQL backend...</p>
        </div>
      ) : (
        <>
          {/* Top Welcome & Actions Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Talent Pipeline Overview</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live ATS Sync
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Card className="flex flex-col justify-between bg-gradient-to-br from-white via-white to-blue-50/50 border border-blue-200/60 hover:border-primary/50 hover:shadow-card-hover transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Active Requisitions</span>
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-primary text-white shadow-subtle flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">work</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-on-surface tracking-tight">{activeJobs.length}</div>
            <p className="text-[11px] text-primary font-medium mt-0.5">Across Engineering</p>
          </div>
        </Card>

        {/* Metric 2 */}
        <Card className="flex flex-col justify-between bg-gradient-to-br from-white via-white to-purple-50/40 border border-purple-200/60 hover:border-purple-400 hover:shadow-card-hover transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Total Candidates</span>
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white shadow-subtle flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">groups</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-on-surface tracking-tight">{totalApplicants}</div>
            <p className="text-[11px] text-purple-700 font-medium mt-0.5">In Screening Cohorts</p>
          </div>
        </Card>

        {/* Metric 3: Shortlist Rate */}
        <Card className="flex flex-col justify-between bg-gradient-to-br from-white via-white to-amber-50/40 border border-amber-200/60 hover:border-amber-400 hover:shadow-card-hover transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Shortlist Rate</span>
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-subtle flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">fact_check</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-on-surface tracking-tight">{shortlistRate}%</div>
            <p className="text-[11px] text-amber-700 font-medium mt-0.5">Pipeline Calibration</p>
          </div>
        </Card>

        {/* Metric 4: Active Interviewees */}
        <Card className="flex flex-col justify-between bg-gradient-to-br from-white via-white to-emerald-50/40 border border-emerald-200/60 hover:border-emerald-400 hover:shadow-card-hover transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Active Interviewees</span>
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-subtle flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">record_voice_over</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-on-surface tracking-tight">{totalInterviews}</div>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">Technical Rounds</p>
          </div>
        </Card>
      </div>

      {/* Recruitment Funnel Visualizer */}
      <Card className="space-y-4 border border-outline-variant/70 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">filter_alt</span>
            </span>
            <h2 className="text-sm font-bold text-on-surface tracking-tight">Hiring Funnel Progression</h2>
          </div>
          <span className="text-xs text-secondary font-medium">Cumulative across all active jobs</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          {funnelSteps.map((step, idx) => (
            <div
              key={step.label}
              className="p-3.5 rounded-xl bg-gradient-to-b from-white to-surface-container-low/70 border border-outline-variant/60 shadow-subtle flex flex-col justify-between hover:border-primary/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">{step.label}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-surface-container text-secondary">
                  Step {idx + 1}
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-on-surface tracking-tight">{step.count}</div>
                <div className="w-full bg-surface-container-high rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-primary h-full rounded-full transition-all duration-500"
                    style={{ width: step.percent }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-secondary mt-1 font-semibold">
                  <span>Conversion</span>
                  <span>{step.percent}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Main Grid: Active Requisitions + Top Talent Spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Requisitions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface tracking-tight">Active Requisitions</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-xs font-bold text-primary border border-blue-200/80">
                {jobs.length} Total
              </span>
            </div>
            <Link
              to="/recruiter/jobs"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>Manage all jobs</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </Link>
          </div>

          <div className="space-y-3">
            {publishedJobs.map((job) => (
              <Card
                key={job.id}
                className="transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-card-hover border border-outline-variant/70 shadow-card"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-on-surface hover:text-primary transition-colors">
                        {job.title}
                      </h3>
                      <button
                        onClick={() => toggleJobStatus(job.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-subtle ${
                          job.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                        }`}
                        title={job.isActive ? 'Click to pause applications' : 'Click to resume applications'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${job.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                        <span>{job.isActive ? 'Accepting Applications' : 'Applications Paused'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium">
                      {job.department} • {job.location} ({job.workMode}) • {job.minExperience}–{job.maxExperience} yrs
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {job.requiredSkills.slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 rounded-md bg-surface-container-low text-[10px] font-semibold text-secondary border border-outline-variant/50"
                        >
                          {skill}
                        </span>
                      ))}
                      {job.requiredSkills.length > 3 && (
                        <span className="text-[10px] text-secondary font-semibold">
                          +{job.requiredSkills.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-outline-variant/50 shrink-0">
                    <div className="text-right mr-1">
                      <span className="text-lg font-bold text-on-surface leading-none block">
                        {job.applicantsTotal}
                      </span>
                      <span className="text-[10px] text-secondary font-medium">Applicants</span>
                    </div>

                    <button
                      onClick={() => toggleJobStatus(job.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border shadow-subtle ${
                        job.isActive
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                      title={job.isActive ? 'Pause taking new applications' : 'Resume taking new applications'}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {job.isActive ? 'pause_circle' : 'play_circle'}
                      </span>
                      <span>{job.isActive ? 'Pause' : 'Resume'}</span>
                    </button>

                    <button
                      onClick={() => handleReviewJob(job.id)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-primary text-white text-xs font-bold hover:opacity-95 shadow-sm transition-all flex items-center gap-1 shrink-0"
                    >
                      <span>Review ({job.shortlisted})</span>
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Top Matching Talent Spotlight */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface tracking-tight">Top Candidate Spotlight</h2>
              <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
            </div>
            <Link
              to="/recruiter/candidates"
              className="text-xs font-bold text-primary hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {topCandidates.map((candidate) => (
              <Card
                key={candidate.id}
                className="space-y-3 border border-outline-variant/70 shadow-card hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-card-hover transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-subtle ${candidate.avatarColor}`}
                    >
                      {candidate.initials}
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/recruiter/candidates/${candidate.id}`}
                        className="text-xs font-bold text-on-surface truncate block hover:text-primary transition-colors"
                      >
                        {candidate.name}
                      </Link>
                      <p className="text-[11px] text-secondary font-medium truncate">{candidate.role}</p>
                      <p className="text-[10px] text-on-surface-variant truncate">{candidate.company} • {candidate.yearsExp}y</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center shrink-0">
                    <RadialGauge score={candidate.overallScore} size="sm" color="text-primary" />
                    <span className="text-[9px] font-bold text-primary mt-0.5 uppercase tracking-wider">Match</span>
                  </div>
                </div>

                {/* Proof of Work Highlight */}
                {candidate.proofOfWorkDetails?.verifiedLinks?.[0] && (
                  <div className="bg-surface-container-low/80 p-2 rounded-lg text-[11px] text-on-surface-variant flex items-center gap-1.5 truncate border border-outline-variant/40">
                    <span className="material-symbols-outlined text-primary text-[15px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                    <span className="truncate font-medium">{candidate.proofOfWorkDetails.verifiedLinks[0].label}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/50">
                  <StatusBadge status={candidate.status} />

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleBookmark(candidate.id)}
                      className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-surface-container transition-colors"
                      title="Bookmark"
                    >
                      <span
                        className="material-symbols-outlined text-[18px]"
                        style={{ fontVariationSettings: candidate.isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        bookmark
                      </span>
                    </button>
                    <Link
                      to={`/recruiter/candidates/${candidate.id}`}
                      className="px-3 py-1 rounded-lg bg-surface-container text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all shadow-subtle"
                    >
                      Analyze
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  )}
</div>
  )
}
