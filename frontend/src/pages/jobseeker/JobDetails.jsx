import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useJobSeekerStore } from '../../store/jobSeekerStore'
import { api } from '../../services/api'
import { getRankedVariantsForJob } from '../../utils/matchCalculator'
import { createResumePdfBlob } from '../../utils/pdfHelper'

import Card from '../../components/ui/Card'
import ScoreBadge from '../../components/ui/ScoreBadge'

export default function JobDetails() {
  const { id } = useParams()
  const { setPageTitle } = useUIStore()
  const { role } = useAuthStore()
  const {
    activeJobs,
    resumes,
    hasAppliedToJob,
    getApplicationForJob,
    applyToJob,
    applyingJobId,
    fetchData,
  } = useJobSeekerStore()

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // Apply Modal States
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [selectedResumeId, setSelectedResumeId] = useState(null)
  const [agreedToLockPolicy, setAgreedToLockPolicy] = useState(false)
  const [applyError, setApplyError] = useState(null)

  // Initial load
  useEffect(() => {
    setPageTitle('Requisition Details')
    fetchData()

    async function loadJobDetails() {
      setLoading(true)
      setFetchError(null)

      // First check local activeJobs cache
      const cached = activeJobs.find((j) => j.id === id)
      if (cached) {
        setJob(cached)
        setLoading(false)
        return
      }

      // Fallback to API
      try {
        const data = await api.getJobById(id)
        setJob(data)
      } catch (err) {
        setFetchError(err.message || 'Unable to load requisition details')
      } finally {
        setLoading(false)
      }
    }

    loadJobDetails()
  }, [id, setPageTitle, fetchData, activeJobs])

  // Update page title when job loads
  useEffect(() => {
    if (job?.title) {
      setPageTitle(job.title)
    }
  }, [job, setPageTitle])

  // Compute resume variant rankings for this specific job
  const rankedVariants = job && resumes.length > 0 ? getRankedVariantsForJob(resumes, job) : []
  const bestVariant = rankedVariants[0] || null

  const hasApplied = job ? hasAppliedToJob(job.id) : false
  const application = job ? getApplicationForJob(job.id) : null

  // Candidate's aggregated skills
  const candidateSkills = new Set(
    resumes.flatMap((r) => (r.skills || []).map((s) => s.toLowerCase().trim()))
  )

  const handleOpenApplyModal = () => {
    if (hasApplied) return
    const best = bestVariant || resumes.find((r) => r.isPrimary) || resumes[0]
    setSelectedResumeId(best?.id || null)
    setAgreedToLockPolicy(false)
    setApplyError(null)
    setApplyModalOpen(true)
  }

  const handleConfirmApplication = async (e) => {
    e.preventDefault()
    if (!job) return

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
      const isParsed = targetResume.parsedData && targetResume.parseStatus === 'COMPLETED'

      let res
      if (isParsed) {
        // Resume already parsed in Resume Manager — backend will score-only using cached parsedData
        res = await applyToJob({
          jobId: job.id,
          resumeId: targetResume.id,
        })
      } else {
        // Fallback: fetch PDF and send for parseAndScore
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

        res = await applyToJob({
          jobId: job.id,
          resumeId: targetResume.id,
          file: fileToSubmit,
        })
      }

      if (res.error) {
        setApplyError(res.payload || 'Failed to submit application')
      } else {
        setApplyModalOpen(false)
      }
    } catch (err) {
      setApplyError(err.message || 'Submission failed')
    }
  }

  // Loading State
  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center space-y-3">
        <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
          progress_activity
        </span>
        <p className="text-sm font-semibold text-on-surface">Loading requisition specifications...</p>
        <p className="text-xs text-secondary">Retrieving live telemetry and algorithmic match criteria.</p>
      </div>
    )
  }

  // Error State
  if (fetchError || !job) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
          <span className="material-symbols-outlined text-[32px]">error</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-on-surface">Requisition Not Found</h2>
          <p className="text-xs text-secondary mt-1">
            {fetchError || 'The requested requisition could not be located or is no longer active.'}
          </p>
        </div>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Return to Job Board
        </Link>
      </div>
    )
  }

  // Format currency and attributes
  const salaryString =
    job.minSalary && job.maxSalary
      ? `₹${Math.round(job.minSalary / 1000)}k – ₹${Math.round(job.maxSalary / 1000)}k`
      : 'Competitive / Market Standard'

  const requiredSkills = Array.isArray(job.requiredSkills) ? job.requiredSkills : []
  const preferredSkills = Array.isArray(job.preferredSkills) ? job.preferredSkills : []

  const companyInitial = (job.company?.[0] || job.title?.[0] || 'H').toUpperCase()
  const companyName = job.company || 'HireLens Partner Requisition'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Breadcrumb & Share Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Opportunities</span>
        </Link>

        {role === 'recruiter' && (
          <Link
            to={`/recruiter/jobs/${job.id}/candidates`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">group</span>
            <span>View Candidate Pipeline</span>
          </Link>
        )}
      </div>

      {/* Hero Header Card */}
      <Card className="border border-outline-variant/80 shadow-card bg-gradient-to-r from-surface-container-lowest via-surface-container-lowest to-surface-container-low p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-on-primary font-bold text-xl flex items-center justify-center shadow-subtle shrink-0">
              {companyInitial}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-on-surface tracking-tight">{job.title}</h1>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-container text-secondary">
                  {job.workMode}
                </span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-container text-secondary">
                  {job.employmentType?.replace('_', ' ')}
                </span>
                {bestVariant && bestVariant.matchScore > 0 && (
                  <ScoreBadge score={bestVariant.matchScore} />
                )}
              </div>

              <p className="text-xs text-on-surface-variant font-medium flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-on-surface">{companyName}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-outline">location_on</span>
                  {job.location || 'Remote'}
                </span>
                <span>•</span>
                <span className="text-secondary">Verified Engineering Requisition</span>
              </p>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="shrink-0 flex items-center gap-3">
            {hasApplied ? (
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200/90 rounded-xl px-4 py-2.5 shadow-subtle">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-emerald-950">Applied &amp; Locked</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-200/80 text-emerald-900">
                      Active
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-medium">
                    Status: <strong className="font-bold">{application?.status || 'Submitted'}</strong>
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleOpenApplyModal}
                className="px-6 py-3 rounded-xl bg-primary hover:opacity-90 text-on-primary font-bold text-xs flex items-center gap-2 shadow-card hover:shadow-card-hover transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span>Apply to Requisition</span>
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Requisition Key Specifications Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-outline-variant/70 shadow-subtle flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">payments</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-secondary block">Compensation</span>
            <span className="text-xs font-bold text-on-surface">{salaryString}</span>
          </div>
        </Card>

        <Card className="p-4 border border-outline-variant/70 shadow-subtle flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">work_history</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-secondary block">Experience Required</span>
            <span className="text-xs font-bold text-on-surface">
              {job.minExperience}–{job.maxExperience || job.minExperience + 3} Years
            </span>
          </div>
        </Card>

        <Card className="p-4 border border-outline-variant/70 shadow-subtle flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">apartment</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-secondary block">Work Arrangement</span>
            <span className="text-xs font-bold text-on-surface">{job.workMode}</span>
          </div>
        </Card>

        <Card className="p-4 border border-outline-variant/70 shadow-subtle flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">school</span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-secondary block">Education</span>
            <span className="text-xs font-bold text-on-surface truncate">
              {job.education || 'B.Tech / Equivalent in CS'}
            </span>
          </div>
        </Card>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Job Description & Skills */}
        <div className="lg:col-span-8 space-y-6">
          {/* Detailed Job Description */}
          <Card className="p-6 space-y-4 border border-outline-variant/70 shadow-card">
            <div className="flex items-center gap-2 pb-3 border-b border-outline-variant/60">
              <span className="material-symbols-outlined text-primary text-[20px]">description</span>
              <h2 className="text-base font-bold text-on-surface">Role Overview &amp; Responsibilities</h2>
            </div>

            <div className="text-xs leading-relaxed text-on-surface-variant space-y-3.5 whitespace-pre-line font-normal">
              {job.description ? (
                job.description
              ) : (
                <>
                  <p>
                    We are looking for a skilled engineer to join our high-impact engineering squad.
                    In this position, you will design, build, and deploy production-grade software
                    services, ensuring high availability, scalable data architecture, and resilient API contracts.
                  </p>
                  <p>
                    You will collaborate closely with product management, UX designers, and platform architects
                    to deliver reliable engineering solutions across our core services.
                  </p>
                  <div className="pt-2">
                    <h3 className="font-bold text-on-surface text-xs mb-2">Core Responsibilities:</h3>
                    <ul className="list-disc list-inside space-y-1.5 pl-1 text-secondary">
                      <li>Architect, develop, and maintain performant, scalable cloud-native microservices.</li>
                      <li>Write clean, well-tested, and maintainable TypeScript/JavaScript or backend code.</li>
                      <li>Participate in architectural reviews, blameless post-mortems, and sprint retrospectives.</li>
                      <li>Optimize query latency and data persistence across relational and key-value stores.</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Technical Requirements & Skill Compatibility */}
          <Card className="p-6 space-y-5 border border-outline-variant/70 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">code</span>
                <h2 className="text-base font-bold text-on-surface">Technical Proficiencies</h2>
              </div>
              <span className="text-[11px] font-semibold text-secondary">
                Matched against your uploaded resumes
              </span>
            </div>

            {/* Mandatory Required Skills */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                Required Core Skills
              </span>
              <div className="flex flex-wrap gap-2">
                {requiredSkills.map((skill) => {
                  const norm = skill.toLowerCase().trim()
                  const isPossessed = Array.from(candidateSkills).some(
                    (c) => c === norm || c.includes(norm) || norm.includes(c)
                  )

                  return (
                    <div
                      key={skill}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                        isPossessed
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200/90 shadow-2xs'
                          : 'bg-surface-container-low text-secondary border-outline-variant/70'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {isPossessed ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>{skill}</span>
                      {isPossessed && (
                        <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-100/70 px-1 py-0.2 rounded">
                          Matched
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Preferred / Bonus Skills */}
            <div className="space-y-2 pt-2 border-t border-outline-variant/50">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                Preferred Qualifications &amp; Nice-to-Haves
              </span>
              <div className="flex flex-wrap gap-2">
                {preferredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-container text-secondary border border-outline-variant/60"
                  >
                    +{skill}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* Immutable Application Policy Callout */}
          <div className="bg-gradient-to-r from-blue-50/80 via-surface-container-lowest to-indigo-50/60 border border-blue-200/80 rounded-2xl p-4 shadow-subtle flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[18px]">gavel</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="font-bold text-on-surface flex items-center gap-2">
                <span>Platform Fairness Standard</span>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-100 text-primary">
                  Locked Triage
                </span>
              </div>
              <p className="text-secondary leading-relaxed">
                To guarantee fair candidate benchmarking and recruitment audit integrity, all submitted
                applications are permanently locked in the hiring team's triage queue. Re-applying with
                a different resume is restricted once an application is filed.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Smart Resume Fit & Telemetry */}
        <div className="lg:col-span-4 space-y-6">
          {/* Smart Variant Fit Card */}
          <Card className="p-5 space-y-4 border border-outline-variant/70 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
              <div>
                <h2 className="text-sm font-bold text-on-surface">Your Resume Compatibility</h2>
                <p className="text-[11px] text-secondary font-medium">Algorithmic fit for this requisition</p>
              </div>
              {bestVariant && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  {bestVariant.matchScore}% Peak Match
                </span>
              )}
            </div>

            {resumes.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-secondary">No resumes found in your profile.</p>
                <Link
                  to="/resume"
                  className="inline-block px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold"
                >
                  Upload a Resume Variant
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {rankedVariants.map((variant) => (
                  <div
                    key={variant.id}
                    className={`p-3 rounded-xl border transition-all ${
                      variant.isBestFit
                        ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                        : 'border-outline-variant/70 bg-surface-container-lowest'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-on-surface truncate">
                            {variant.title}
                          </span>
                          {variant.isBestFit && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                              Best Fit
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-secondary truncate mt-0.5">
                          Matches {variant.matchedCount} of {variant.totalRequired} required skills
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-bold block leading-none ${
                            variant.matchScore >= 85 ? 'text-emerald-700' : 'text-primary'
                          }`}
                        >
                          {variant.matchScore}%
                        </span>
                        <span className="text-[9px] uppercase font-semibold text-secondary">
                          Fit
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {!hasApplied && (
                  <button
                    onClick={handleOpenApplyModal}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-primary hover:opacity-90 text-on-primary text-xs font-bold shadow-xs transition-opacity flex items-center justify-center gap-1.5"
                  >
                    <span>Apply with {bestVariant?.title ? 'Recommended' : 'Resume'}</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </button>
                )}
              </div>
            )}
          </Card>

          {/* Hiring Workflow Telemetry Card */}
          <Card className="p-5 space-y-3.5 border border-outline-variant/70 shadow-card">
            <h2 className="text-sm font-bold text-on-surface">Hiring Process Telemetry</h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <span className="font-bold text-on-surface block">Automated Semantic Match</span>
                  <span className="text-secondary text-[11px]">
                    4-pillar algorithmic evaluation runs upon application submission.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <span className="font-bold text-on-surface block">Recruiter Review</span>
                  <span className="text-secondary text-[11px]">
                    Triage team evaluates portfolio artifacts and benchmark fit.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <span className="font-bold text-on-surface block">Direct Interview Fast-Track</span>
                  <span className="text-secondary text-[11px]">
                    Candidates with &gt;85% match tier are prioritized for technical phone screens.
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Support / Contact */}
          <Card className="p-5 border border-outline-variant/70 shadow-card bg-surface-container-low/40 space-y-2 text-xs">
            <span className="font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>
              HireLens Verified Requisition
            </span>
            <p className="text-secondary text-[11px] leading-relaxed">
              This job requisition is live and verified under the HireLens Network.
              All submissions comply with algorithmic fairness and recruitment audit standards.
            </p>
          </Card>
        </div>
      </div>

      {/* Apply Modal */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant space-y-5 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
              <div>
                <h2 className="text-base font-bold text-on-surface">Submit Application</h2>
                <p className="text-xs text-secondary mt-0.5">{job.title}</p>
              </div>
              <button
                onClick={() => setApplyModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Error in modal */}
            {applyError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{applyError}</span>
              </div>
            )}

            {/* Resume Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                  Select Resume Variant
                </label>
                <Link
                  to="/resume"
                  target="_blank"
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
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
                  {rankedVariants.map((resume) => {
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

            {/* Immutable Submission Policy Notice */}
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
                  id="lockPolicyCheckboxDetails"
                  checked={agreedToLockPolicy}
                  onChange={(e) => setAgreedToLockPolicy(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <label
                  htmlFor="lockPolicyCheckboxDetails"
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
                onClick={() => setApplyModalOpen(false)}
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
