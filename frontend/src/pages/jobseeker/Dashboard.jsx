import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useJobSeekerStore } from '../../store/jobSeekerStore'
import { calculateVariantMatch, calculateMarketSkillCoverage } from '../../utils/matchCalculator'

import Card from '../../components/ui/Card'
import SectionHeader from '../../components/ui/SectionHeader'
import ScoreBadge from '../../components/ui/ScoreBadge'
import StatusBadge from '../../components/ui/StatusBadge'

// ─── Sub-components ───────────────────────────────────────────────

function WelcomeHero({ user }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name ? user.name.split(' ')[0] : 'Job Seeker'

  return (
    <Card className="bg-gradient-to-r from-surface-container-lowest via-surface-container-lowest to-surface-container-low border border-outline-variant/80 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary font-bold text-base flex items-center justify-center shadow-subtle shrink-0">
            {user?.name
              ? user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              : 'JS'}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-on-surface tracking-tight">
                {greeting}, {firstName}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Job Search
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Live requisition telemetry synced • Here are your top algorithmic matches and pipeline updates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <Link
            to="/resume"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">description</span>
            Manage Resumes
          </Link>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:opacity-90 text-on-primary text-xs font-semibold shadow-xs transition-opacity"
          >
            <span className="material-symbols-outlined text-[16px]">search</span>
            Explore Roles
          </Link>
        </div>
      </div>
    </Card>
  )
}

function KpiStatsStrip({ stats }) {
  const items = [
    {
      label: 'Active Applications',
      value: stats.activeApplications,
      subtext: stats.activeApplications > 0 ? 'Live in triage pipeline' : 'No submitted applications',
      icon: 'send',
      iconBg: 'bg-blue-50 text-primary',
    },
    {
      label: 'High-Match Requisitions',
      value: stats.jobMatches,
      subtext: `${stats.jobMatches} roles ready to apply`,
      icon: 'auto_awesome',
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'In Review / Pipeline',
      value: stats.inReviewCount,
      subtext: stats.inReviewCount > 0 ? 'Recruiter evaluation active' : 'Waiting for triage review',
      icon: 'hourglass_top',
      iconBg: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Top Role Alignment',
      value: `${stats.topMatchScore}`,
      subtext: stats.topMatchRole ? `Fit: ${stats.topMatchRole}` : 'Highest algorithmic match',
      icon: 'verified',
      iconBg: 'bg-indigo-50 text-indigo-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card
          key={item.label}
          className="p-4 sm:p-5 flex flex-col justify-between border border-outline-variant/70 shadow-card hover:border-primary/30 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-on-surface-variant">{item.label}</span>
            <div className={`w-8 h-8 rounded-lg ${item.iconBg} flex items-center justify-center shrink-0`}>
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-on-surface tracking-tight">{item.value}</div>
            <p className="text-[11px] font-medium text-secondary mt-0.5 truncate">{item.subtext}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}

function MatchedRolesSection({ jobs, totalMatches }) {
  return (
    <div className="space-y-3.5">
      <SectionHeader
        title="Top Matched Opportunities"
        subtitle="Ranked by semantic match against your primary resume variant"
        right={
          <Link
            to="/jobs"
            className="text-primary text-xs font-semibold hover:underline inline-flex items-center gap-1"
          >
            <span>View All ({totalMatches})</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        }
      />

      {jobs.length === 0 ? (
        <Card className="text-center py-10 text-on-surface-variant border border-outline-variant/60">
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center mx-auto text-outline mb-2">
            <span className="material-symbols-outlined text-[24px]">work_outline</span>
          </div>
          <p className="text-sm font-semibold text-on-surface">No open roles found</p>
          <p className="text-xs text-secondary mt-1">
            Check back later for new requisitions matching your profile.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className="p-4 sm:p-5 border border-outline-variant/70 shadow-card hover:border-primary/40 hover:shadow-card-hover transition-all duration-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 shadow-subtle ${job.companyColor}`}
                  >
                    {job.companyInitial}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-on-surface hover:text-primary transition-colors">
                        {job.title}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-container text-secondary">
                        {job.workType}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium">
                      {job.company} • {job.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  {job.matchScore > 0 ? (
                    <ScoreBadge score={job.matchScore} />
                  ) : (
                    <span className="text-[10px] font-semibold text-secondary bg-surface-container px-2.5 py-1 rounded-full border border-outline-variant/60">
                      Upload Resume
                    </span>
                  )}
                </div>
              </div>

              {/* Skill chips */}
              {job.skills && job.skills.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                  <span className="text-[11px] font-medium text-secondary mr-1">Skills:</span>
                  {job.skills.slice(0, 4).map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-container-low text-on-surface-variant border border-outline-variant/60"
                    >
                      {skill}
                    </span>
                  ))}
                  {job.skills.length > 4 && (
                    <span className="text-[10px] text-secondary">+{job.skills.length - 4} more</span>
                  )}
                </div>
              )}

              {/* Bottom Row: Salary + CTA */}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-outline-variant/50 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">
                    payments
                  </span>
                  <span className="font-semibold text-on-surface">{job.salary}</span>
                </div>
                <Link
                  to={`/jobs/${job.id}`}
                  className="px-3.5 py-1.5 rounded-lg bg-primary hover:opacity-90 text-on-primary font-semibold text-xs transition-opacity flex items-center gap-1 shadow-subtle"
                >
                  <span>View Details &amp; Apply</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ApplicationStageStepper({ status }) {
  const isRejected = status === 'Rejected'
  const isShortlisted = status === 'Shortlisted'
  const isReviewing = status === 'Under Review' || isShortlisted

  if (isRejected) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-red-600 bg-red-50/80 px-2.5 py-1 rounded-lg border border-red-200/80">
        <span className="material-symbols-outlined text-[14px]">cancel</span>
        <span className="font-semibold text-[11px]">Requisition Closed / Not Selected</span>
      </div>
    )
  }

  const steps = [
    { label: 'Submitted', done: true },
    { label: 'Under Review', done: isReviewing },
    { label: 'Shortlisted', done: isShortlisted },
  ]

  return (
    <div className="flex items-center gap-2 text-[11px] flex-wrap">
      {steps.map((step, idx) => (
        <div key={step.label} className="flex items-center gap-1.5">
          <div
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md font-semibold ${
              step.done
                ? 'bg-blue-50 text-primary border border-blue-200/80'
                : 'bg-surface-container text-secondary/60 border border-outline-variant/50'
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">
              {step.done ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            <span>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <span className="text-secondary/40 font-bold">›</span>
          )}
        </div>
      ))}
    </div>
  )
}

function ApplicationPipelineSection({ applications }) {
  return (
    <div className="space-y-3.5">
      <SectionHeader
        title="Application Pipeline"
        subtitle="Real-time status telemetry across your submitted applications"
        right={
          <Link
            to="/applications"
            className="text-primary text-xs font-semibold hover:underline inline-flex items-center gap-1"
          >
            <span>View All ({applications.length})</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        }
      />

      {applications.length === 0 ? (
        <Card className="text-center py-10 text-on-surface-variant border border-outline-variant/60 space-y-2">
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center mx-auto text-outline mb-1">
            <span className="material-symbols-outlined text-[24px]">send</span>
          </div>
          <p className="text-sm font-semibold text-on-surface">No submitted applications yet</p>
          <p className="text-xs text-secondary max-w-sm mx-auto">
            Apply to top-matched roles with your tailored resume variants to track real-time hiring stages here.
          </p>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity mt-2"
          >
            Browse Open Roles
          </Link>
        </Card>
      ) : (
        <Card padding={false} className="border border-outline-variant/70 shadow-card overflow-hidden">
          <div className="divide-y divide-outline-variant/50">
            {applications.slice(0, 4).map((app) => (
              <div
                key={app.id}
                className="p-4 sm:p-5 space-y-2.5 hover:bg-surface-container-low/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-on-surface">{app.company}</span>
                      <span className="text-xs text-on-surface-variant font-medium">• {app.role}</span>
                    </div>
                    <p className="text-[11px] text-secondary mt-0.5">
                      Applied on <span className="font-medium text-on-surface">{app.appliedDate}</span> • Locked Submission
                    </p>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={app.status} />
                  </div>
                </div>

                <div className="pt-1">
                  <ApplicationStageStepper status={app.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function MarketSkillAlignmentCard({ marketAlignment, hasResumes }) {
  if (!hasResumes) {
    return (
      <Card className="p-5 space-y-4 border border-outline-variant/70 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-on-surface">Market Skill Fit</h2>
            <p className="text-xs text-on-surface-variant font-medium">Requisition Demand vs Profile</p>
          </div>
          <span className="inline-flex items-center text-[10px] font-bold text-secondary bg-surface-container px-2.5 py-0.5 rounded-full border border-outline-variant/60">
            No Resume
          </span>
        </div>

        <p className="text-xs text-secondary leading-relaxed">
          Upload a resume in Resume Management to calculate your live market skill alignment across active requisitions.
        </p>

        <Link
          to="/resume"
          className="w-full py-2.5 px-3 rounded-xl bg-primary text-on-primary text-xs font-semibold transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5 shadow-xs"
        >
          <span className="material-symbols-outlined text-[15px]">upload_file</span>
          <span>Upload Resume</span>
        </Link>
      </Card>
    )
  }

  return (
    <Card className="p-5 space-y-4 border border-outline-variant/70 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-on-surface">Market Skill Fit</h2>
          <p className="text-xs text-on-surface-variant font-medium">Requisition Demand vs Profile</p>
        </div>
        <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
          <span className="material-symbols-outlined text-[13px] mr-0.5">trending_up</span>
          {marketAlignment.coveragePercent}% Alignment
        </span>
      </div>

      {/* Coverage Progress Bar */}
      <div>
        <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
          <span className="text-secondary">Coverage Across Active Roles</span>
          <span className="text-on-surface">{marketAlignment.coveragePercent}%</span>
        </div>
        <div className="w-full bg-surface-container rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-700"
            style={{ width: `${marketAlignment.coveragePercent}%` }}
          />
        </div>
      </div>

      {/* In-Demand Skills You Have */}
      {marketAlignment.inDemandPossessed.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-secondary flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-emerald-600">check_circle</span>
            High-Demand Skills You Possess:
          </span>
          <div className="flex flex-wrap gap-1">
            {marketAlignment.inDemandPossessed.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Skills to Unlock More Roles */}
      {marketAlignment.inDemandMissing && marketAlignment.inDemandMissing.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-outline-variant/50">
          <span className="text-[11px] font-semibold text-secondary flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-primary">add_circle</span>
            High-Yield Skills to Add:
          </span>
          <div className="flex flex-wrap gap-1">
            {marketAlignment.inDemandMissing.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-container-low text-primary border border-outline-variant/60"
              >
                +{skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        to="/resume"
        className="w-full py-2.5 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container text-primary text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-outline-variant/80"
      >
        <span>Resume Management</span>
        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
      </Link>
    </Card>
  )
}

function AiOptimizationCard({ items }) {
  return (
    <Card className="p-5 space-y-3.5 border border-outline-variant/70 shadow-card">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-50 text-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[16px]">insights</span>
        </div>
        <div>
          <h2 className="text-sm font-bold text-on-surface">Targeted Optimization</h2>
          <p className="text-[11px] text-on-surface-variant font-medium">Insights to maximize job match rate</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/50 space-y-1 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface">{item.title}</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  item.type === 'high'
                    ? 'bg-rose-100 text-rose-800'
                    : item.type === 'medium'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {item.type}
              </span>
            </div>
            <p className="text-[11px] text-secondary leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function QuickShortcutsCard() {
  const shortcuts = [
    { label: 'Explore Requisitions', icon: 'travel_explore', to: '/jobs', badge: 'Live' },
    { label: 'Resume Management', icon: 'description', to: '/resume', badge: 'Active' },
    { label: 'Application Records', icon: 'assignment_turned_in', to: '/applications', badge: 'Locked' },
  ]

  return (
    <Card className="p-5 space-y-3 border border-outline-variant/70 shadow-card">
      <h2 className="text-sm font-bold text-on-surface">Quick Navigation</h2>
      <div className="space-y-1.5">
        {shortcuts.map(({ label, icon, to, badge }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors border border-transparent hover:border-outline-variant/60"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[17px] text-primary">{icon}</span>
              <span className="font-semibold">{label}</span>
            </div>
            {badge && (
              <span className="text-[10px] font-semibold text-secondary bg-surface-container px-2 py-0.5 rounded">
                {badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────

export default function Dashboard() {
  const { setPageTitle } = useUIStore()
  const { user } = useAuthStore()
  const { activeJobs, applications, resumes, fetchData } = useJobSeekerStore()

  useEffect(() => {
    setPageTitle('Dashboard')
    fetchData()
  }, [setPageTitle, fetchData])

  const primaryResume = useMemo(
    () => resumes.find((r) => r.isPrimary) || resumes[0],
    [resumes]
  )

  const mappedJobs = useMemo(() => {
    const list = activeJobs.slice(0, 4).map((j) => {
      const match = primaryResume ? calculateVariantMatch(primaryResume, j) : { score: 0 }
      return {
        id: j.id,
        title: j.title,
        company: j.company || 'HireLens Requisition',
        companyInitial: (j.company?.[0] || j.title?.[0] || 'J').toUpperCase(),
        companyColor: 'bg-primary text-on-primary',
        location: j.location || 'Remote',
        workType: j.workMode || 'Full-time',
        salary:
          j.minSalary && j.maxSalary
            ? `₹${Math.round(j.minSalary / 1000)}k - ₹${Math.round(j.maxSalary / 1000)}k`
            : 'Competitive',
        skills: Array.isArray(j.requiredSkills) ? j.requiredSkills : [],
        matchScore: match.score,
      }
    })
    return list.sort((a, b) => b.matchScore - a.matchScore)
  }, [activeJobs, primaryResume])

  const topMatchJob = primaryResume && mappedJobs.length > 0 && mappedJobs[0].matchScore > 0 ? mappedJobs[0] : null
  const topMatchScore = topMatchJob ? `${topMatchJob.matchScore}%` : '--'
  const topMatchRole = topMatchJob ? topMatchJob.title : (primaryResume ? 'Pending evaluation' : 'Upload resume')

  const stats = useMemo(() => {
    const inReview = applications.filter(
      (a) => a.status === 'REVIEWING' || a.status === 'SHORTLISTED'
    ).length
    return {
      activeApplications: applications.length,
      jobMatches: activeJobs.length,
      inReviewCount: inReview,
      topMatchScore,
      topMatchRole,
    }
  }, [applications, activeJobs.length, topMatchScore, topMatchRole])

  const marketAlignment = useMemo(
    () => calculateMarketSkillCoverage(resumes, activeJobs),
    [resumes, activeJobs]
  )

  const optimizationItems = useMemo(() => {
    if (!resumes.length) {
      return [
        {
          id: 'opt_upload',
          title: 'Upload Resume to Unlock Telemetry',
          description: 'Upload your tailored resume to run automated ATS parse tests and live market requisition matching.',
          type: 'high',
        },
      ]
    }
    const items = []
    if (marketAlignment.inDemandMissing && marketAlignment.inDemandMissing.length > 0) {
      items.push({
        id: 'opt_skills',
        title: `Market Gap: In-Demand Skills (${marketAlignment.inDemandMissing.slice(0, 2).join(', ')})`,
        description: `Active requisitions frequently require ${marketAlignment.inDemandMissing.slice(0, 3).join(', ')}. If you possess these competencies, surface them in your resume.`,
        type: 'high',
      })
    }
    items.push({
      id: 'opt_lock',
      title: 'Review Tailored Variants Before Applying',
      description: 'Once submitted, applications are locked to preserve recruiter pipeline integrity. Ensure your best-fit variant is selected.',
      type: 'medium',
    })
    return items
  }, [resumes.length, marketAlignment.inDemandMissing])

  const mappedApplications = useMemo(
    () =>
      applications.map((app) => ({
        id: app.id,
        company: app.job?.company || 'HireLens Client',
        role: app.job?.title || 'Applied Position',
        appliedDate: app.createdAt
          ? new Date(app.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Recent',
        status:
          app.status === 'SHORTLISTED'
            ? 'Shortlisted'
            : app.status === 'REVIEWING'
            ? 'Under Review'
            : app.status === 'REJECTED'
            ? 'Rejected'
            : 'Applied',
      })),
    [applications]
  )

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* 1. Header / Welcome Hero */}
      <WelcomeHero user={user} />

      {/* 2. Full-width 4-KPI Metric Strip */}
      <KpiStatsStrip stats={stats} />

      {/* 3. 2-Column Responsive Layout (Left 8 cols ~68% / Right 4 cols ~32%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column — Primary Job-Seeking Workspace (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <MatchedRolesSection jobs={mappedJobs} totalMatches={activeJobs.length} />
          <ApplicationPipelineSection applications={mappedApplications} />
        </div>

        {/* Right Column — Helper Sidebar & Market Alignment (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <MarketSkillAlignmentCard marketAlignment={marketAlignment} hasResumes={resumes.length > 0} />
          <AiOptimizationCard items={optimizationItems} />
          <QuickShortcutsCard />
        </div>
      </div>
    </div>
  )
}
