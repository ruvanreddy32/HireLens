import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useRecruiterStore } from '../../store/recruiterStore'
import Card from '../../components/ui/Card'
import StatusBadge from '../../components/ui/StatusBadge'
import RadialGauge from '../../components/ui/RadialGauge'

export default function CandidateAnalysis() {
  const { setPageTitle } = useUIStore()
  const { id } = useParams()

  const {
    candidates,
    jobs,
    getCandidateCompositeScore,
    getCandidateTier,
    updateCandidateStatus,
    toggleBookmark,
    addCandidateNote,
    getEffectiveWeights,
    fetchRecruiterData,
  } = useRecruiterStore()

  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    if (candidates.length === 0) {
      fetchRecruiterData()
    }
  }, [candidates.length, fetchRecruiterData])

  const candidate = candidates.find((c) => c.id === id) || candidates[0]
  const job = jobs.find((j) => j.id === candidate?.jobId) || jobs[0]
  const effectiveWeights = getEffectiveWeights()

  useEffect(() => {
    setPageTitle(`Candidate Analysis — ${candidate?.name || 'Evaluation'}`)
  }, [candidate, setPageTitle])

  if (!candidate) {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        <h2 className="text-lg font-bold">Candidate not found</h2>
        <Link to="/recruiter/candidates" className="text-primary hover:underline mt-2 inline-block">
          Return to Candidate Ranking
        </Link>
      </div>
    )
  }

  const overallScore = getCandidateCompositeScore(candidate)
  const tierInfo = getCandidateTier(candidate)

  const handleAddNote = (e) => {
    e.preventDefault()
    if (!noteText.trim()) return
    addCandidateNote(candidate.id, noteText.trim())
    setNoteText('')
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <Link
            to={job ? `/recruiter/jobs/${job.id}/candidates` : '/recruiter/candidates'}
            className="hover:text-primary flex items-center gap-1 font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Candidates
          </Link>
          <span>/</span>
          <span className="text-on-surface font-semibold truncate max-w-[200px]">{candidate.name}</span>
          <span>/</span>
          <span className="bg-surface-container px-2 py-0.5 rounded text-[11px] font-semibold text-secondary">
            {job?.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`http://localhost:3000/jobs/${job?.id || candidate.jobId}/applications/${candidate.id}/resume`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-semibold text-secondary hover:text-primary hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
            title="Open original submitted PDF resume"
          >
            <span className="material-symbols-outlined text-[16px] text-red-500">picture_as_pdf</span>
            View Resume PDF
          </a>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-xs font-semibold text-secondary hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Export PDF
          </button>
        </div>
      </div>

      {/* Hero Profile Banner */}
      <Card className="border border-outline-variant/70 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl shadow-md shrink-0 ${candidate.avatarColor}`}
            >
              {candidate.initials}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-on-surface">{candidate.name}</h1>
                <StatusBadge status={candidate.status} />
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${tierInfo.bgColor} ${tierInfo.color}`}>
                  {tierInfo.tier}
                </span>
              </div>
              <p className="text-xs text-secondary font-medium">
                {candidate.role} • {candidate.company}
              </p>
              <div className="flex items-center gap-3 text-xs text-on-surface-variant flex-wrap pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">work_history</span>
                  {candidate.yearsExp} yrs total exp
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">location_on</span>
                  {candidate.location}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">mail</span>
                  {candidate.email}
                </span>
              </div>
            </div>
          </div>

          {/* Action and Status Changer */}
          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={() => toggleBookmark(candidate.id)}
              className="p-2 rounded-lg border border-outline-variant bg-surface-container-low text-secondary hover:text-primary transition-colors"
              title="Bookmark candidate"
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: candidate.isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
              >
                bookmark
              </span>
            </button>

            <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant">
              <span className="text-xs font-semibold text-secondary">Status:</span>
              <select
                value={candidate.status}
                onChange={(e) => updateCandidateStatus(candidate.id, e.target.value)}
                className="bg-transparent text-xs font-bold text-primary focus:outline-none cursor-pointer"
              >
                <option value="Applied">Applied</option>
                <option value="Under Review">Under Review</option>
                <option value="Shortlisted">Shortlisted</option>
                <option value="Interviewing">Interviewing</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Links bar */}
        <div className="flex items-center gap-3 pt-3 border-t border-outline-variant/50 text-xs flex-wrap">
          {candidate.portfolioUrl && (
            <a
              href={candidate.portfolioUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              <span className="material-symbols-outlined text-[15px]">language</span>
              Portfolio
            </a>
          )}
          {candidate.githubUrl && (
            <a
              href={candidate.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              <span className="material-symbols-outlined text-[15px]">code</span>
              GitHub Profile
            </a>
          )}
          {candidate.linkedinUrl && (
            <a
              href={candidate.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              <span className="material-symbols-outlined text-[15px]">account_box</span>
              LinkedIn
            </a>
          )}
        </div>
      </Card>

      {/* Knockout Banner if triggered */}
      {candidate.isKnockedOut && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-900">
          <span className="material-symbols-outlined text-red-600 text-[22px] shrink-0 mt-0.5">
            error
          </span>
          <div>
            <h3 className="font-bold text-sm text-red-900">Knockout Criteria Gate Triggered</h3>
            <p className="text-xs text-red-800 mt-1 leading-relaxed">
              {candidate.knockoutReasons?.join('. ')}
            </p>
          </div>
        </div>
      )}

      {/* 4-Pillar Score Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Overall Composite Score */}
        <Card className="flex flex-col items-center justify-center text-center p-4 border-2 border-primary/20 bg-surface-container-lowest">
          <RadialGauge score={overallScore} size="lg" color="text-primary" />
          <span className="text-xs font-bold text-on-surface mt-2">Overall Match Score</span>
          <span className={`text-[11px] font-semibold mt-0.5 ${tierInfo.color}`}>
            {tierInfo.tier}
          </span>
          <span className="text-[10px] text-on-surface-variant mt-1 max-w-[160px]">
            {tierInfo.action}
          </span>
        </Card>

        {/* Pillar 1: Skills */}
        <Card className="flex flex-col justify-between p-4 border border-outline-variant/60">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-secondary uppercase">1. Skills Alignment</span>
              <span className="material-symbols-outlined text-primary text-[18px]">psychology</span>
            </div>
            <div className="text-2xl font-bold text-on-surface mt-2">
              {candidate.pillarScores?.skills}%
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${candidate.pillarScores?.skills}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] text-on-surface-variant pt-3 border-t border-outline-variant/40 mt-3">
            Weight: {effectiveWeights.skills}% • Semantic keyword match & synonym expansion
          </div>
        </Card>

        {/* Pillar 2: Experience Depth */}
        <Card className="flex flex-col justify-between p-4 border border-outline-variant/60">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-secondary uppercase">2. Experience Depth</span>
              <span className="material-symbols-outlined text-blue-600 text-[18px]">work_history</span>
            </div>
            <div className="text-2xl font-bold text-blue-700 mt-2">
              {candidate.pillarScores?.experience}%
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full"
                style={{ width: `${candidate.pillarScores?.experience}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] text-on-surface-variant pt-3 border-t border-outline-variant/40 mt-3">
            Weight: {effectiveWeights.experience}% • Tenure fit, seniority level & company stability
          </div>
        </Card>

        {/* Pillar 3: Projects Rigor */}
        <Card className="flex flex-col justify-between p-4 border border-outline-variant/60">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-secondary uppercase">3. Project Rigor</span>
              <span className="material-symbols-outlined text-purple-600 text-[18px]">rocket_launch</span>
            </div>
            <div className="text-2xl font-bold text-purple-700 mt-2">
              {candidate.pillarScores?.projects}%
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full"
                style={{ width: `${candidate.pillarScores?.projects}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] text-on-surface-variant pt-3 border-t border-outline-variant/40 mt-3">
            Weight: {effectiveWeights.projects}% • Architectural complexity & production impact
          </div>
        </Card>

        {/* Pillar 4: Proof of Work */}
        <Card className="flex flex-col justify-between p-4 border border-outline-variant/60">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-secondary uppercase">4. Proof of Work (Code)</span>
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified</span>
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-2">
              {candidate.pillarScores?.proof_of_work}%
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full"
                style={{ width: `${candidate.pillarScores?.proof_of_work}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] text-on-surface-variant pt-3 border-t border-outline-variant/40 mt-3">
            Weight: {effectiveWeights.proof_of_work}% • Repos, deployed apps & competitive DSA
          </div>
        </Card>
      </div>

      {/* AI Explanation & Decision Engine (Section 37) */}
      <Card className="space-y-4 border border-outline-variant/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">psychology</span>
            <h2 className="text-base font-bold text-on-surface">
              Deterministic Intelligence & Executive Rationale
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary text-[10px] font-semibold">
            Audit Ready
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* What happened? */}
          <div className="bg-surface-container-low p-3.5 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <span className="material-symbols-outlined text-[16px]">info</span>
              What Happened?
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {candidate.aiSummary?.whatHappened}
            </p>
          </div>

          {/* Why? */}
          <div className="bg-surface-container-low p-3.5 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <span className="material-symbols-outlined text-[16px]">fact_check</span>
              Why? (Facts & Evidence)
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {candidate.aiSummary?.why}
            </p>
          </div>

          {/* What does it mean? */}
          <div className="bg-surface-container-low p-3.5 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <span className="material-symbols-outlined text-[16px]">lightbulb</span>
              What Does It Mean?
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {candidate.aiSummary?.whatItMeans}
            </p>
          </div>
        </div>
      </Card>

      {/* Two Column Layout: Skills & Proof of Work vs Experience & Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Skills & Proof of Work Details */}
        <div className="space-y-6">
          {/* Skills Breakdown */}
          <Card className="space-y-4 border border-outline-variant/60">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">checklist</span>
                Mandatory & Bonus Skills Alignment
              </h2>
              <span className="text-xs text-secondary font-semibold">
                {candidate.matchedSkills?.length} / {job?.requiredSkills?.length} Required
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block mb-1.5">
                  Matched Mandatory Skills
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.matchedSkills?.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px] text-emerald-600">check</span>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {candidate.missingSkills?.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider block mb-1.5">
                    Missing Mandatory Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.missingSkills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2.5 py-1 rounded-md bg-red-50 text-red-800 border border-red-200 text-xs font-semibold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px] text-red-600">close</span>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {candidate.bonusSkills?.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-1.5">
                    Bonus / Adjacent Tech
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.bonusSkills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-xs font-medium"
                      >
                        + {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Proof of Work Sub-dimension Details (DD03) */}
          <Card className="space-y-4 border border-outline-variant/60">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">terminal</span>
                Proof of Work Verifications (DD03)
              </h2>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {candidate.pillarScores?.proof_of_work}% Authenticated
              </span>
            </div>

            {/* Sub dimensions grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-surface-container-low p-2 rounded-lg">
                <span className="text-[10px] text-on-surface-variant block">Code Repos</span>
                <span className="font-bold text-on-surface text-sm">
                  {candidate.proofOfWorkDetails?.codeRepos ?? 0}%
                </span>
              </div>
              <div className="bg-surface-container-low p-2 rounded-lg">
                <span className="text-[10px] text-on-surface-variant block">Live Apps</span>
                <span className="font-bold text-on-surface text-sm">
                  {candidate.proofOfWorkDetails?.liveDeployments ?? 0}%
                </span>
              </div>
              <div className="bg-surface-container-low p-2 rounded-lg">
                <span className="text-[10px] text-on-surface-variant block">Problem Solving</span>
                <span className="font-bold text-on-surface text-sm">
                  {candidate.proofOfWorkDetails?.problemSolving ?? 0}%
                </span>
              </div>
              <div className="bg-surface-container-low p-2 rounded-lg">
                <span className="text-[10px] text-on-surface-variant block">Hackathons</span>
                <span className="font-bold text-on-surface text-sm">
                  {candidate.proofOfWorkDetails?.hackathons ?? 0}%
                </span>
              </div>
            </div>

            {/* Verified External URLs */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block">
                Auditable URLs & Repositories
              </span>
              {candidate.proofOfWorkDetails?.verifiedLinks?.length > 0 ? (
                <div className="space-y-1.5">
                  {candidate.proofOfWorkDetails.verifiedLinks.map((link, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/60 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                          verified
                        </span>
                        <span className="font-medium text-on-surface truncate">{link.label}</span>
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline text-xs font-semibold shrink-0 ml-2"
                      >
                        Inspect ↗
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant italic">
                  No public repositories discovered (typical for enterprise engineers operating under strict NDA).
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Experience History & Recruiter Notes */}
        <div className="space-y-6">
          {/* Experience History */}
          <Card className="space-y-4 border border-outline-variant/60">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">history_edu</span>
                Career Progression & Tenure Fit
              </h2>
              <span className="text-xs text-on-surface-variant font-medium">
                {candidate.education}
              </span>
            </div>

            <div className="space-y-3">
              {candidate.experienceHistory?.map((exp, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/50 space-y-1 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-on-surface">{exp.role}</span>
                    <span className="text-[11px] text-secondary font-medium shrink-0">{exp.period}</span>
                  </div>
                  <div className="text-primary font-semibold text-[11px]">{exp.company}</div>
                  <p className="text-on-surface-variant text-[11px] leading-relaxed pt-1">
                    {exp.highlights}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Recruiter Private Notes */}
          <Card className="space-y-4 border border-outline-variant/60">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">notes</span>
                Evaluation Notes & Activity
              </h2>
              <span className="text-xs text-on-surface-variant font-semibold">
                {candidate.notes?.length || 0} Notes
              </span>
            </div>

            {/* Note Input */}
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                rows="2"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Log internal feedback, interview debriefs, or compensation notes..."
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-lg hover:opacity-95 shadow-sm"
                >
                  Post Note
                </button>
              </div>
            </form>

            {/* Notes List */}
            <div className="space-y-2 pt-1">
              {candidate.notes?.map((n) => (
                <div
                  key={n.id}
                  className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/40 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-on-surface">{n.author}</span>
                    <span className="text-on-surface-variant">{n.date}</span>
                  </div>
                  <p className="text-secondary text-xs">{n.text}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
