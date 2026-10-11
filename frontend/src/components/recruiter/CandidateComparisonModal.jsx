import Card from '../ui/Card'
import RadialGauge from '../ui/RadialGauge'
import StatusBadge from '../ui/StatusBadge'

export default function CandidateComparisonModal({
  candidates,
  isOpen,
  onClose,
  onUpdateStatus,
}) {
  if (!isOpen || !candidates || candidates.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface-container-lowest rounded-2xl max-w-5xl w-full p-6 shadow-2xl border border-outline-variant space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
          <div>
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[24px]">compare_arrows</span>
              Candidate Multi-Pillar Comparison
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Comparing {candidates.length} candidates side-by-side across all 4 evaluation pillars
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Comparison Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-${candidates.length} gap-4`}>
          {candidates.map((candidate) => (
            <Card key={candidate.id} className="space-y-4 border border-outline-variant/70">
              {/* Profile card */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${candidate.avatarColor}`}
                >
                  {candidate.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-on-surface truncate">{candidate.name}</h3>
                  <p className="text-xs text-secondary truncate">{candidate.role}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {candidate.company} • {candidate.yearsExp} yrs
                  </p>
                </div>
              </div>

              {/* Status & Match Score */}
              <div className="flex items-center justify-between bg-surface-container-low p-2.5 rounded-xl">
                <StatusBadge status={candidate.status} />
                <div className="flex items-center gap-2">
                  <RadialGauge score={candidate.overallScore} size="sm" color="text-primary-container" />
                  <div className="text-right">
                    <span className="text-xs font-bold text-on-surface block leading-none">
                      {candidate.overallScore}%
                    </span>
                    <span className="text-[9px] uppercase font-semibold text-secondary">Match</span>
                  </div>
                </div>
              </div>

              {/* 4 Pillars Breakdown */}
              <div className="space-y-2 bg-surface-container-lowest border border-outline-variant/60 p-3 rounded-xl text-xs">
                <span className="font-bold text-secondary uppercase tracking-wider text-[10px]">
                  4-Pillar Scores
                </span>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-on-surface-variant">Skills Match:</span>
                    <span className="font-bold text-on-surface">{candidate.pillarScores?.skills}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${candidate.pillarScores?.skills}%` }} />
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1">
                    <span className="text-on-surface-variant">Experience Depth:</span>
                    <span className="font-bold text-on-surface">{candidate.pillarScores?.experience}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${candidate.pillarScores?.experience}%` }} />
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1">
                    <span className="text-on-surface-variant">Project Rigor:</span>
                    <span className="font-bold text-on-surface">{candidate.pillarScores?.projects}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                    <div className="bg-purple-600 h-full rounded-full" style={{ width: `${candidate.pillarScores?.projects}%` }} />
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1">
                    <span className="text-on-surface-variant">Proof of Work (Code):</span>
                    <span className="font-bold text-on-surface">{candidate.pillarScores?.proof_of_work}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${candidate.pillarScores?.proof_of_work}%` }} />
                  </div>
                </div>
              </div>

              {/* Skills Overlap */}
              <div className="space-y-1.5 text-xs">
                <span className="font-bold text-secondary uppercase tracking-wider text-[10px]">
                  Skills Alignment
                </span>
                <div className="flex flex-wrap gap-1">
                  {candidate.matchedSkills?.map((sk) => (
                    <span key={sk} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                      ✓ {sk}
                    </span>
                  ))}
                  {candidate.missingSkills?.map((sk) => (
                    <span key={sk} className="px-2 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-semibold border border-red-200">
                      ✗ {sk}
                    </span>
                  ))}
                </div>
              </div>

              {/* Proof of Work Highlight */}
              <div className="space-y-1.5 text-xs bg-surface-container-low p-2.5 rounded-xl">
                <span className="font-bold text-secondary uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <span className="material-symbols-outlined text-primary text-[14px]">verified</span>
                  Proof of Work Artifacts
                </span>
                {candidate.proofOfWorkDetails?.verifiedLinks?.length > 0 ? (
                  <ul className="space-y-1 text-[11px] text-on-surface-variant">
                    {candidate.proofOfWorkDetails.verifiedLinks.slice(0, 2).map((link, idx) => (
                      <li key={idx} className="truncate">• {link.label}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[11px] text-on-surface-variant italic">No public code links (NDA/Enterprise)</span>
                )}
              </div>

              {/* Quick status button */}
              <div className="pt-2 border-t border-outline-variant/40 flex items-center justify-between">
                <select
                  value={candidate.status}
                  onChange={(e) => onUpdateStatus(candidate.id, e.target.value)}
                  className="bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs font-semibold text-on-surface"
                >
                  <option value="Applied">Applied</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Interviewing">Interviewing</option>
                  <option value="Rejected">Rejected</option>
                </select>

                <a
                  href={`/recruiter/candidates/${candidate.id}`}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Full Analysis →
                </a>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-outline-variant">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-surface-container text-on-surface font-semibold text-xs hover:bg-surface-container-high"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  )
}
