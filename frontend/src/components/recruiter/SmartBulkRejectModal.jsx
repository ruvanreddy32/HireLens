import { useState, useMemo } from 'react'

const PILLARS = [
  { key: 'skills',        label: 'Skills Alignment',  icon: 'psychology',    color: 'text-primary',     bar: 'bg-primary' },
  { key: 'experience',    label: 'Experience Depth',  icon: 'work_history',  color: 'text-blue-600',    bar: 'bg-blue-500' },
  { key: 'projects',      label: 'Project Rigor',     icon: 'rocket_launch', color: 'text-purple-600',  bar: 'bg-purple-500' },
  { key: 'proof_of_work', label: 'Proof of Work',     icon: 'verified',      color: 'text-emerald-600', bar: 'bg-emerald-500' },
]

const OVERALL_PRESETS = [50, 60, 70, 80]

const MODES = [
  { key: 'knockout', label: 'Knockout Gate',  icon: 'block'       },
  { key: 'overall',  label: 'Overall Score',  icon: 'donut_large' },
  { key: 'section',  label: 'By Section',     icon: 'tune'        },
]

export default function SmartBulkRejectModal({ isOpen, onClose, rankedCandidates, batchUpdateStatus }) {
  const [activeMode, setActiveMode] = useState('knockout')
  const [overallThreshold, setOverallThreshold] = useState(80)
  const [pillarRules, setPillarRules] = useState({
    skills:        { enabled: false, threshold: 70 },
    experience:    { enabled: false, threshold: 70 },
    projects:      { enabled: false, threshold: 70 },
    proof_of_work: { enabled: false, threshold: 70 },
  })
  const [sectionLogic, setSectionLogic] = useState('any')

  // ── Live preview ──────────────────────────────────────────────────────────
  const targetCandidates = useMemo(() => {
    if (!rankedCandidates) return []
    return rankedCandidates.filter((c) => {
      if (c.status === 'Rejected') return false

      if (activeMode === 'knockout') return !!c.isKnockedOut

      if (activeMode === 'overall') return (c.overallScore ?? 0) < overallThreshold

      if (activeMode === 'section') {
        const activePillars = Object.entries(pillarRules).filter(([, r]) => r.enabled)
        if (activePillars.length === 0) return false
        const fails = activePillars.filter(([key, r]) => (c.pillarScores?.[key] ?? 0) < r.threshold)
        return sectionLogic === 'any' ? fails.length > 0 : fails.length === activePillars.length
      }
      return false
    })
  }, [activeMode, overallThreshold, pillarRules, sectionLogic, rankedCandidates])

  const getRejectReason = (c) => {
    if (activeMode === 'knockout') return c.knockoutReasons?.[0] || 'Knockout criterion triggered'
    if (activeMode === 'overall') return `Overall ${c.overallScore ?? 0}% < ${overallThreshold}%`
    const failingPillars = PILLARS.filter(
      (p) => pillarRules[p.key]?.enabled && (c.pillarScores?.[p.key] ?? 0) < pillarRules[p.key].threshold
    )
    return failingPillars.length
      ? failingPillars.map((p) => `${p.label} ${c.pillarScores?.[p.key] ?? 0}%`).join(' · ')
      : '—'
  }

  const handleConfirm = () => {
    if (targetCandidates.length === 0) return
    batchUpdateStatus(targetCandidates.map((c) => c.id), 'Rejected')
    onClose()
  }

  const updatePillar = (key, field, value) =>
    setPillarRules((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))

  const totalActive = rankedCandidates?.filter((c) => c.status !== 'Rejected').length ?? 0
  const isAllWillBeRejected = targetCandidates.length > 0 && targetCandidates.length === totalActive
  const isActionDisabled =
    targetCandidates.length === 0 ||
    (activeMode === 'section' && !Object.values(pillarRules).some((r) => r.enabled))

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ background: 'rgba(11,28,48,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-full max-w-xl bg-surface rounded-2xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh', animation: 'fadeScaleIn 0.2s cubic-bezier(.4,0,.2,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient top bar */}
        <div className="h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-orange-400 shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-outline-variant/50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-red-600 text-[22px]">auto_delete</span>
            </span>
            <div>
              <h2 className="text-base font-bold text-on-surface">Smart Bulk Reject</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Set rejection criteria — preview updates live</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">

            {/* Mode Tab Pills */}
            <div className="flex gap-1.5 p-1 bg-surface-container-low rounded-xl">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setActiveMode(m.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeMode === m.key
                      ? 'bg-surface shadow-sm text-on-surface'
                      : 'text-secondary hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{m.icon}</span>
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              ))}
            </div>

            {/* ── Mode 1: Knockout Gate ── */}
            {activeMode === 'knockout' && (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                  <span className="material-symbols-outlined text-red-500 text-[22px] shrink-0 mt-0.5">block</span>
                  <div>
                    <p className="text-sm font-semibold text-red-900">Reject all knockout-failed candidates</p>
                    <p className="text-xs text-red-700 mt-1 leading-relaxed">
                      Candidates who failed one or more hard knockout criteria — such as missing mandatory qualifications,
                      below minimum experience, or work authorization issues — will be marked Rejected.
                    </p>
                  </div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Candidates with knockout flags</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">Already-rejected candidates are excluded</p>
                  </div>
                  <span className="text-2xl font-black text-red-600">
                    {rankedCandidates?.filter((c) => c.isKnockedOut && c.status !== 'Rejected').length ?? 0}
                  </span>
                </div>
              </div>
            )}

            {/* ── Mode 2: Overall Score Threshold ── */}
            {activeMode === 'overall' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">Reject candidates scoring below</span>
                    <span className="text-2xl font-black text-red-600">{overallThreshold}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="5"
                    value={overallThreshold}
                    onChange={(e) => setOverallThreshold(Number(e.target.value))}
                    className="w-full h-2 rounded-full accent-red-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-on-surface-variant mt-1">
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                </div>

                {/* Score distribution bar */}
                <div className="relative">
                  <div className="h-3 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-400 to-red-300 rounded-full transition-all duration-150"
                      style={{ width: `${overallThreshold}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="text-red-600 font-semibold">← Rejected zone</span>
                    <span className="text-emerald-600 font-semibold">Active pipeline →</span>
                  </div>
                </div>

                {/* Quick presets */}
                <div>
                  <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider block mb-2">Quick Presets</span>
                  <div className="flex gap-2 flex-wrap">
                    {OVERALL_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setOverallThreshold(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          overallThreshold === p
                            ? 'bg-red-500 text-white border-red-500 shadow-sm'
                            : 'bg-surface-container-low border-outline-variant text-secondary hover:border-red-300 hover:text-red-600'
                        }`}
                      >
                        Below {p}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Mode 3: Section-wise ── */}
            {activeMode === 'section' && (
              <div className="space-y-4">
                {/* Logic toggle */}
                <div>
                  <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block mb-2">Rejection Logic</span>
                  <div className="flex gap-1.5 p-1 bg-surface-container-low rounded-xl w-fit">
                    {[
                      { val: 'any', label: 'Fail ANY pillar', sub: 'Stricter' },
                      { val: 'all', label: 'Fail ALL pillars', sub: 'Lenient' },
                    ].map(({ val, label, sub }) => (
                      <button
                        key={val}
                        onClick={() => setSectionLogic(val)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          sectionLogic === val
                            ? 'bg-surface shadow-sm text-on-surface'
                            : 'text-secondary hover:text-on-surface'
                        }`}
                      >
                        {label}
                        <span className="ml-1 text-[10px] text-on-surface-variant font-normal">({sub})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pillar rows */}
                <div className="space-y-2.5">
                  {PILLARS.map((p) => {
                    const rule = pillarRules[p.key]
                    return (
                      <div
                        key={p.key}
                        className={`p-3.5 rounded-xl border transition-all duration-150 ${
                          rule.enabled
                            ? 'border-red-200 bg-red-50/40'
                            : 'border-outline-variant/40 bg-surface'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Toggle */}
                          <button
                            onClick={() => updatePillar(p.key, 'enabled', !rule.enabled)}
                            className={`w-9 h-5 rounded-full transition-colors relative shrink-0 border ${
                              rule.enabled ? 'bg-red-500 border-red-500' : 'bg-surface-container border-outline-variant'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                rule.enabled ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>

                          <span className={`material-symbols-outlined text-[17px] shrink-0 ${rule.enabled ? p.color : 'text-outline'}`}>
                            {p.icon}
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-semibold ${rule.enabled ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                                {p.label}
                              </span>
                              <span className={`text-sm font-black ${rule.enabled ? 'text-red-600' : 'text-on-surface-variant'}`}>
                                {'< '}{rule.threshold}%
                              </span>
                            </div>
                            <input
                              type="range" min="0" max="100" step="5"
                              value={rule.threshold}
                              disabled={!rule.enabled}
                              onChange={(e) => updatePillar(p.key, 'threshold', Number(e.target.value))}
                              className={`w-full h-1.5 rounded-full transition-all ${
                                rule.enabled ? 'cursor-pointer accent-red-500' : 'cursor-not-allowed opacity-40'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {!Object.values(pillarRules).some((r) => r.enabled) && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">lightbulb</span>
                    Enable at least one pillar above to define rejection criteria
                  </p>
                )}
              </div>
            )}

            {/* ── Live Preview ── */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  Live Preview
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  targetCandidates.length === 0
                    ? 'bg-surface-container text-on-surface-variant'
                    : isAllWillBeRejected
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {targetCandidates.length === 0
                    ? 'No candidates match'
                    : `${targetCandidates.length} will be rejected`}
                </span>
              </div>

              {isAllWillBeRejected && (
                <div className="bg-orange-50 border border-orange-300 rounded-lg px-3 py-2 text-xs text-orange-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  This will reject ALL active candidates for this role
                </div>
              )}

              {targetCandidates.length > 0 ? (
                <div className="border border-red-200 rounded-xl overflow-hidden">
                  <div className="max-h-48 overflow-y-auto divide-y divide-red-100">
                    {targetCandidates.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 bg-red-50/40 hover:bg-red-50 transition-colors">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${c.avatarColor}`}>
                          {c.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-on-surface truncate">{c.name}</p>
                          <p className="text-[10px] text-red-600 truncate">{getRejectReason(c)}</p>
                        </div>
                        <span className="text-xs font-bold text-on-surface-variant shrink-0 tabular-nums">
                          {c.overallScore ?? 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border border-outline-variant/40 rounded-xl py-8 text-center text-xs text-on-surface-variant bg-surface-container-low">
                  <span className="material-symbols-outlined text-[28px] text-outline block mb-1">search_off</span>
                  No candidates match the current criteria
                </div>
              )}
            </div>

            {/* Undo note */}
            <div className="bg-surface-container-low border border-outline-variant/40 rounded-lg px-3 py-2.5 flex items-start gap-2 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">undo</span>
              <span>Rejections are reversible — restore any candidate from their profile or by editing their status in the candidate list.</span>
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-outline-variant/50 px-6 py-4 flex gap-3 bg-surface">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-secondary hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isActionDisabled}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              isActionDisabled
                ? 'bg-surface-container text-on-surface-variant cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">person_remove</span>
            {isActionDisabled
              ? 'No candidates to reject'
              : `Reject ${targetCandidates.length} Candidate${targetCandidates.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
