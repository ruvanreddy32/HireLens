import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../ui/Card'
import StatusBadge from '../ui/StatusBadge'
import RadialGauge from '../ui/RadialGauge'

export default function CandidateWorkstationDossier({
  candidate,
  job,
  onUpdateStatus,
  onToggleBookmark,
  onAddNote,
  onToggleCompare,
  isComparing,
  onNext,
  onPrev,
  hasPrev,
  hasNext,
  currentIndex,
  totalCount,
}) {
  const [activeTab, setActiveTab] = useState('ai_signal')
  const [noteText, setNoteText] = useState('')

  if (!candidate) {
    return (
      <Card className="h-full flex items-center justify-center p-12 text-center text-on-surface-variant border border-outline-variant/60">
        <div>
          <span className="material-symbols-outlined text-[48px] text-outline mb-2">person_search</span>
          <h3 className="text-base font-bold text-on-surface">No candidate selected</h3>
          <p className="text-xs text-secondary mt-1">Select a candidate from the queue on the left to inspect their dossier.</p>
        </div>
      </Card>
    )
  }

  const handleAddNote = (e) => {
    e.preventDefault()
    if (!noteText.trim()) return
    onAddNote(candidate.id, noteText.trim(), 'Alex Morgan')
    setNoteText('')
  }

  const isShortlisted = candidate.status === 'Shortlisted'
  const isInterviewing = candidate.status === 'Interviewing' || candidate.status === 'Under Review'
  const isRejected = candidate.status === 'Rejected'

  return (
    <div className="space-y-4">
      {/* Top Dossier Header Card */}
      <Card className="border border-outline-variant/70 shadow-sm space-y-4">
        {/* Navigation & Stage Breadcrumb */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/50 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">
              Dossier #{candidate.rank || currentIndex + 1}
            </span>
            <span className="text-xs text-on-surface-variant">•</span>
            <span className="text-xs text-on-surface-variant font-medium">
              Candidate {currentIndex + 1} of {totalCount}
            </span>
            <span className="text-xs text-on-surface-variant">•</span>
            <StatusBadge status={candidate.status} />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className={`p-1.5 rounded-lg border flex items-center justify-center transition-colors ${
                hasPrev
                  ? 'border-outline-variant hover:bg-surface-container text-on-surface cursor-pointer'
                  : 'border-transparent text-outline opacity-40 cursor-not-allowed'
              }`}
              title="Previous candidate"
            >
              <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className={`p-1.5 rounded-lg border flex items-center justify-center transition-colors ${
                hasNext
                  ? 'border-outline-variant hover:bg-surface-container text-on-surface cursor-pointer'
                  : 'border-transparent text-outline opacity-40 cursor-not-allowed'
              }`}
              title="Next candidate"
            >
              <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
            </button>
          </div>
        </div>

        {/* Candidate Identity + Radial Gauge */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm shrink-0 ${candidate.avatarColor}`}
            >
              {candidate.initials}
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-on-surface tracking-tight truncate">
                  {candidate.name}
                </h2>
                {candidate.isKnockedOut && (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold border border-red-200 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">block</span>
                    Knocked Out
                  </span>
                )}
              </div>

              <p className="text-xs font-semibold text-secondary">
                {candidate.role} • <span className="text-on-surface font-bold">{candidate.company}</span>
              </p>

              <div className="flex items-center gap-3 text-[11px] text-on-surface-variant flex-wrap pt-0.5">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {candidate.location}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                  {candidate.yearsExp} yrs exp
                </span>
                {candidate.phone && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">call</span>
                      {candidate.phone}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Radial Score Gauge */}
          <div className="flex items-center sm:flex-col items-end sm:items-center gap-3 sm:gap-1 shrink-0 bg-surface-container-low sm:bg-transparent p-2 sm:p-0 rounded-xl">
            <RadialGauge
              score={candidate.overallScore}
              size="md"
              color="text-primary"
            />
            <div className="text-right sm:text-center">
              <span className="text-[11px] font-bold block text-on-surface">
                Match Score
              </span>
              <span className={`text-[10px] font-semibold ${candidate.tierInfo?.color || 'text-primary'}`}>
                {candidate.tierInfo?.tier || 'Matched'}
              </span>
            </div>
          </div>
        </div>

        {/* 1-Click Action Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 border-t border-outline-variant/60">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Shortlist Button */}
            <button
              onClick={() => onUpdateStatus(candidate.id, 'Shortlisted')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-subtle ${
                isShortlisted
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-700/25 ring-2 ring-emerald-500/20'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isShortlisted ? 'check_circle' : 'check'}
              </span>
              <span>{isShortlisted ? 'Shortlisted' : 'Shortlist'}</span>
            </button>

            {/* Quick Move to Interview */}
            <button
              onClick={() => onUpdateStatus(candidate.id, 'Under Review')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-subtle ${
                isInterviewing
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-700/25 ring-2 ring-purple-500/20'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/90'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">record_voice_over</span>
              <span>{isInterviewing ? 'In Interview' : 'Interview'}</span>
            </button>

            {/* Quick Reject Button */}
            <button
              onClick={() => onUpdateStatus(candidate.id, 'Rejected')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-subtle ${
                isRejected
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-red-700/25 ring-2 ring-red-500/20'
                  : 'bg-red-50 hover:bg-red-100 text-red-800 border border-red-200/90'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              <span>{isRejected ? 'Rejected' : 'Reject'}</span>
            </button>

            {/* Status Dropdown */}
            <select
              value={candidate.status}
              onChange={(e) => onUpdateStatus(candidate.id, e.target.value)}
              className="bg-surface-container-low border border-outline-variant/80 text-on-surface rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="Applied">Applied</option>
              <option value="Under Review">Under Review</option>
              <option value="Shortlisted">Shortlisted</option>
              <option value="Interviewing">Interviewing</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Bookmark button */}
            <button
              onClick={() => onToggleBookmark(candidate.id)}
              className={`p-1.5 rounded-xl border transition-all ${
                candidate.isBookmarked
                  ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-subtle'
                  : 'border-outline-variant/70 hover:bg-surface-container-low text-secondary'
              }`}
              title={candidate.isBookmarked ? 'Bookmarked' : 'Bookmark candidate'}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: candidate.isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
              >
                bookmark
              </span>
            </button>

            {/* Compare toggle */}
            <button
              onClick={() => onToggleCompare(candidate.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${
                isComparing
                  ? 'bg-primary text-on-primary border-primary shadow-subtle'
                  : 'border-outline-variant/70 hover:bg-surface-container-low text-secondary'
              }`}
              title="Compare side-by-side"
            >
              <span className="material-symbols-outlined text-[15px]">compare_arrows</span>
              <span>{isComparing ? 'Comparing' : 'Compare'}</span>
            </button>

            {/* View Original Resume PDF Button */}
            <a
              href={`http://localhost:3000/jobs/${job?.id || candidate.jobId}/applications/${candidate.id}/resume`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-xl border border-outline-variant/70 text-xs font-semibold text-secondary hover:text-primary hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
              title="Open original submitted PDF resume in browser tab"
            >
              <span className="material-symbols-outlined text-[16px] text-red-500">picture_as_pdf</span>
              <span className="hidden sm:inline">View PDF</span>
            </a>

            {/* Full Analysis Page Link */}
            <Link
              to={`/recruiter/candidates/${candidate.id}`}
              className="p-1.5 rounded-xl border border-outline-variant/70 text-secondary hover:text-primary hover:bg-surface-container-low transition-colors"
              title="Open full dedicated analysis page"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </Link>
          </div>
        </div>

        {/* 4 Pillar Mini Progress Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="bg-gradient-to-b from-white to-blue-50/40 p-2.5 rounded-xl text-center border border-blue-100 shadow-subtle">
            <span className="text-[10px] text-secondary font-bold block uppercase tracking-wider">Skills Match</span>
            <span className="text-base font-bold text-primary">{candidate.pillarScores?.skills || 0}%</span>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-primary h-full rounded-full transition-all duration-300" style={{ width: `${candidate.pillarScores?.skills || 0}%` }} />
            </div>
          </div>

          <div className="bg-gradient-to-b from-white to-blue-50/40 p-2.5 rounded-xl text-center border border-blue-100 shadow-subtle">
            <span className="text-[10px] text-secondary font-bold block uppercase tracking-wider">Experience</span>
            <span className="text-base font-bold text-blue-700">{candidate.pillarScores?.experience || 0}%</span>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${candidate.pillarScores?.experience || 0}%` }} />
            </div>
          </div>

          <div className="bg-gradient-to-b from-white to-purple-50/40 p-2.5 rounded-xl text-center border border-purple-100 shadow-subtle">
            <span className="text-[10px] text-secondary font-bold block uppercase tracking-wider">Projects</span>
            <span className="text-base font-bold text-purple-700">{candidate.pillarScores?.projects || 0}%</span>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div className="bg-purple-600 h-full rounded-full transition-all duration-300" style={{ width: `${candidate.pillarScores?.projects || 0}%` }} />
            </div>
          </div>

          <div className="bg-gradient-to-b from-white to-emerald-50/40 p-2.5 rounded-xl text-center border border-emerald-100 shadow-subtle">
            <span className="text-[10px] text-secondary font-bold block uppercase tracking-wider">Proof of Work</span>
            <span className="text-base font-bold text-emerald-700">{candidate.pillarScores?.proof_of_work || 0}%</span>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full transition-all duration-300" style={{ width: `${candidate.pillarScores?.proof_of_work || 0}%` }} />
            </div>
          </div>
        </div>

        {/* Knockout Criteria Trigger Banner */}
        {candidate.isKnockedOut && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2.5 text-xs text-red-900 shadow-subtle">
            <span className="material-symbols-outlined text-[18px] text-red-600 mt-0.5 shrink-0">
              report
            </span>
            <div>
              <p className="font-bold text-red-900">Knockout Criteria Disqualification:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-red-800 text-[11px]">
                {candidate.knockoutReasons && candidate.knockoutReasons.length > 0 ? (
                  candidate.knockoutReasons.map((reason, idx) => <li key={idx}>{reason}</li>)
                ) : (
                  <li>Candidate fell below minimum mandatory prerequisites for this requisition.</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </Card>

      {/* Dossier Tabs Header */}
      <div className="flex items-center gap-1 border-b border-outline-variant/80 overflow-x-auto">
        {[
          { key: 'ai_signal', label: 'AI Signal & Skills', icon: 'auto_awesome' },
          { key: 'proof_of_work', label: 'Proof of Work & Repos', icon: 'verified' },
          { key: 'experience', label: 'Experience History', icon: 'work_history' },
          { key: 'notes', label: `Recruiter Notes (${candidate.notes?.length || 0})`, icon: 'edit_note' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary text-primary bg-primary/5 rounded-t-xl shadow-subtle'
                : 'border-transparent text-secondary hover:text-on-surface hover:bg-surface-container-low/70 rounded-t-xl'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: AI Signal & Skills */}
      {activeTab === 'ai_signal' && (
        <div className="space-y-4">
          {/* AI Executive Reasoning Card */}
          <Card className="border border-outline-variant/60 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                psychology
              </span>
              <h3 className="text-sm font-bold text-on-surface">Algorithmic Match Evaluation</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/40">
                <span className="font-bold text-secondary uppercase text-[10px] block mb-1">What Happened</span>
                <p className="text-on-surface leading-relaxed">
                  {candidate.aiSummary?.whatHappened || 'Evaluated against job prerequisites based on verified resume and experience signals.'}
                </p>
              </div>

              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/40">
                <span className="font-bold text-secondary uppercase text-[10px] block mb-1">Algorithmic Rationale (Why Matched)</span>
                <p className="text-on-surface leading-relaxed">
                  {candidate.aiSummary?.why || 'Demonstrates strong alignment with core tech stack requirements and verified code execution.'}
                </p>
              </div>

              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/40">
                <span className="font-bold text-secondary uppercase text-[10px] block mb-1">What It Means For This Role</span>
                <p className="text-on-surface leading-relaxed">
                  {candidate.aiSummary?.whatItMeans || 'Candidate possesses relevant competencies to contribute with minimal onboarding lag.'}
                </p>
              </div>
            </div>

          </Card>

          {/* Skills Breakdown Card */}
          <Card className="border border-outline-variant/60 space-y-3">
            <h3 className="text-sm font-bold text-on-surface">Skill Alignment Matrix</h3>

            {/* Matched Skills */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Matched Required Skills ({candidate.matchedSkills?.length || 0})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(candidate.matchedSkills || []).map((skill) => (
                  <span key={skill} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Bonus Skills */}
            {candidate.bonusSkills && candidate.bonusSkills.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">stars</span>
                  Bonus & Preferred Skills ({candidate.bonusSkills.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.bonusSkills.map((skill) => (
                    <span key={skill} className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 text-xs font-semibold border border-purple-200">
                      +{skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Skills */}
            {candidate.missingSkills && candidate.missingSkills.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  Missing Stack Prerequisites ({candidate.missingSkills.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.missingSkills.map((skill) => (
                    <span key={skill} className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200 line-through opacity-80">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Proof of Work & Repos */}
      {activeTab === 'proof_of_work' && (
        <div className="space-y-4">
          <Card className="border border-outline-variant/60 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
                <h3 className="text-sm font-bold text-on-surface">Verified Proof of Work & Artifacts</h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                PoW Score: {candidate.pillarScores?.proof_of_work || 0}%
              </span>
            </div>

            {/* PoW Sub-Scores */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-surface-container-low p-2 rounded-lg text-center border border-outline-variant/40">
                <span className="text-[10px] text-on-surface-variant block font-medium">Code Repos</span>
                <span className="text-sm font-bold text-on-surface">{candidate.proofOfWorkDetails?.codeRepos ?? 0}%</span>
              </div>
              <div className="bg-surface-container-low p-2 rounded-lg text-center border border-outline-variant/40">
                <span className="text-[10px] text-on-surface-variant block font-medium">Live Deployments</span>
                <span className="text-sm font-bold text-on-surface">{candidate.proofOfWorkDetails?.liveDeployments ?? 0}%</span>
              </div>
              <div className="bg-surface-container-low p-2 rounded-lg text-center border border-outline-variant/40">
                <span className="text-[10px] text-on-surface-variant block font-medium">Problem Solving</span>
                <span className="text-sm font-bold text-on-surface">{candidate.proofOfWorkDetails?.problemSolving ?? 0}%</span>
              </div>
              <div className="bg-surface-container-low p-2 rounded-lg text-center border border-outline-variant/40">
                <span className="text-[10px] text-on-surface-variant block font-medium">Hackathons</span>
                <span className="text-sm font-bold text-on-surface">{candidate.proofOfWorkDetails?.hackathons ?? 0}%</span>
              </div>
            </div>

            {/* Verified Repos & Links */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-on-surface block">Audited Repositories & Deliverables:</span>
              {candidate.proofOfWorkDetails?.verifiedLinks && candidate.proofOfWorkDetails.verifiedLinks.length > 0 ? (
                candidate.proofOfWorkDetails.verifiedLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container border border-outline-variant/50 transition-colors text-xs group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                        verified
                      </span>
                      <span className="font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                        {link.label}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-outline group-hover:text-primary shrink-0">
                      arrow_outward
                    </span>
                  </a>
                ))
              ) : (
                <div className="p-4 rounded-lg bg-surface-container-low text-center text-xs text-on-surface-variant">
                  No verified public links submitted with application.
                </div>
              )}
            </div>

            {/* Hackathon Wins */}
            {candidate.proofOfWorkDetails?.hackathonWins && candidate.proofOfWorkDetails.hackathonWins.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-outline-variant/40">
                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-600 text-[16px]">emoji_events</span>
                  Recognitions & Hackathon Wins
                </span>
                <div className="space-y-1">
                  {candidate.proofOfWorkDetails.hackathonWins.map((win, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>{win}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 3: Experience History */}
      {activeTab === 'experience' && (
        <Card className="border border-outline-variant/60 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-on-surface">Employment History & Education</h3>
            <span className="text-xs text-on-surface-variant font-semibold">{candidate.yearsExp} Years Total</span>
          </div>

          {/* Experience Timeline */}
          <div className="space-y-3 pt-1">
            {candidate.experienceHistory && candidate.experienceHistory.length > 0 ? (
              candidate.experienceHistory.map((exp, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/40 space-y-1 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-bold text-on-surface text-sm">{exp.role}</span>
                    <span className="text-[11px] font-semibold text-secondary">{exp.period}</span>
                  </div>
                  <p className="text-primary font-semibold">{exp.company}</p>
                  <p className="text-on-surface-variant leading-relaxed pt-0.5">{exp.highlights}</p>
                </div>
              ))
            ) : (
              <div className="p-3 rounded-lg bg-surface-container-low text-xs text-on-surface-variant">
                Experience details recorded from {candidate.company} ({candidate.yearsExp} years).
              </div>
            )}
          </div>

          {/* Education */}
          <div className="pt-2 border-t border-outline-variant/40">
            <span className="text-xs font-bold text-on-surface block mb-1.5">Education:</span>
            <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/40 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">school</span>
              <span className="text-on-surface font-semibold">{candidate.education || 'Degree in relevant field'}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 4: Recruiter Notes */}
      {activeTab === 'notes' && (
        <Card className="border border-outline-variant/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">edit_note</span>
              <h3 className="text-sm font-bold text-on-surface">Recruiter Interview Notes</h3>
            </div>
            <span className="text-xs text-secondary">{candidate.notes?.length || 0} entries</span>
          </div>

          {/* Add Note Form */}
          <form onSubmit={handleAddNote} className="space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add evaluation observations, compensation expectations, or interview takeaways..."
              rows={2}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!noteText.trim()}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  noteText.trim()
                    ? 'bg-primary text-on-primary hover:opacity-90 shadow-sm cursor-pointer'
                    : 'bg-surface-container text-outline opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>Save Note</span>
              </button>
            </div>
          </form>

          {/* Notes Feed */}
          <div className="space-y-2 pt-2 border-t border-outline-variant/40">
            {candidate.notes && candidate.notes.length > 0 ? (
              candidate.notes.map((note) => (
                <div key={note.id} className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-primary">{note.author || 'Recruiter'}</span>
                    <span className="text-on-surface-variant">{note.date}</span>
                  </div>
                  <p className="text-on-surface leading-relaxed">{note.text}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-center py-4 text-on-surface-variant">
                No recruiter notes added yet. Record observations above.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
