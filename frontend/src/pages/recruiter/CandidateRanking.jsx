import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useRecruiterStore } from '../../store/recruiterStore'
import { MACRO_PRESETS } from '../../constants/macroPresets'
import Card from '../../components/ui/Card'
import StatusBadge from '../../components/ui/StatusBadge'
import CandidateComparisonModal from '../../components/recruiter/CandidateComparisonModal'
import SmartBulkRejectModal from '../../components/recruiter/SmartBulkRejectModal'
import CandidateWorkstationDossier from '../../components/recruiter/CandidateWorkstationDossier'

export default function CandidateRanking() {
  const { setPageTitle } = useUIStore()
  const { id: routeJobId } = useParams()
  const navigate = useNavigate()

  const {
    jobs,
    selectedJobId,
    setSelectedJobId,
    activePresetKey,
    setActivePreset,
    toggleJobStatus,
    setCustomWeights,
    getEffectiveWeights,
    getRankedCandidates,
    searchTerm,
    setSearchTerm,
    filterKnockouts,
    setFilterKnockouts,
    filterScoreTier,
    setFilterScoreTier,
    filterStatus,
    setFilterStatus,
    toggleCandidateSelection,
    selectAllCandidates,
    batchUpdateStatus,
    toggleBookmark,
    updateCandidateStatus,
    addCandidateNote,
    comparedCandidateIds,
    toggleCompareCandidate,
    clearComparison,
    candidates,
    fetchRecruiterData,
    loading,
    error,
  } = useRecruiterStore()

  const [showWeightSliders, setShowWeightSliders] = useState(false)
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
  const [isSmartRejectOpen, setIsSmartRejectOpen] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)

  // Sync route param with store selectedJobId
  useEffect(() => {
    if (routeJobId && routeJobId !== selectedJobId) {
      setSelectedJobId(routeJobId)
    }
  }, [routeJobId, selectedJobId, setSelectedJobId])

  useEffect(() => {
    setPageTitle('Candidate Ranking & Triage')
    fetchRecruiterData()
  }, [setPageTitle, fetchRecruiterData])

  const activeJob = jobs.find((j) => j.id === selectedJobId) || jobs[0]
  const effectiveWeights = getEffectiveWeights()
  const rankedCandidates = getRankedCandidates(selectedJobId)
  const selectedCandidates = rankedCandidates.filter((c) => c.isSelected)

  // Total weight for percentage display
  const totalWeight =
    (effectiveWeights.skills || 0) +
    (effectiveWeights.experience || 0) +
    (effectiveWeights.projects || 0) +
    (effectiveWeights.proof_of_work || 0) || 1

  const handleSliderChange = (pillar, value) => {
    const val = parseInt(value) || 0
    setCustomWeights({
      ...effectiveWeights,
      [pillar]: val,
    })
  }

  const handleJobChange = (newJobId) => {
    setSelectedJobId(newJobId)
    if (newJobId !== 'all') {
      navigate(`/recruiter/jobs/${newJobId}/candidates`)
    } else {
      navigate('/recruiter/candidates')
    }
  }

  // Candidate stage counts for selected job
  const jobCandidates =
    selectedJobId === 'all' || !selectedJobId
      ? candidates
      : candidates.filter((c) => c.jobId === selectedJobId)

  const stageCounts = {
    all: jobCandidates.length,
    applied: jobCandidates.filter((c) => c.status === 'Applied').length,
    reviewing: jobCandidates.filter((c) => c.status === 'Under Review' || c.status === 'Interviewing').length,
    shortlisted: jobCandidates.filter((c) => c.status === 'Shortlisted').length,
    knockouts: jobCandidates.filter((c) => c.isKnockedOut).length,
    rejected: jobCandidates.filter((c) => c.status === 'Rejected').length,
  }

  // Active candidate for Workstation dossier view
  const activeCandidate =
    rankedCandidates.find((c) => c.id === selectedCandidateId) ||
    rankedCandidates[0] ||
    null

  const currentCandidateIndex = rankedCandidates.findIndex((c) => c.id === activeCandidate?.id)
  const hasPrev = currentCandidateIndex > 0
  const hasNext = currentCandidateIndex >= 0 && currentCandidateIndex < rankedCandidates.length - 1

  const handleNextCandidate = () => {
    if (hasNext) {
      setSelectedCandidateId(rankedCandidates[currentCandidateIndex + 1].id)
    }
  }

  const handlePrevCandidate = () => {
    if (hasPrev) {
      setSelectedCandidateId(rankedCandidates[currentCandidateIndex - 1].id)
    }
  }

  const handleStageTabClick = (stage) => {
    if (stage === 'knockouts') {
      setFilterKnockouts('knockouts_only')
      setFilterStatus('all')
    } else if (stage === 'all') {
      setFilterKnockouts('all')
      setFilterStatus('all')
    } else {
      setFilterKnockouts('all')
      setFilterStatus(stage)
    }
    setSelectedCandidateId(null)
  }



  // Get compared candidates objects
  const comparedCandidates = candidates.filter((c) =>
    comparedCandidateIds.includes(c.id)
  )

  const handleOpenCompare = () => {
    // If user has selected items via checkbox, set compared ids to selected
    if (selectedCandidates.length > 0) {
      selectedCandidates.slice(0, 3).forEach((c) => {
        if (!comparedCandidateIds.includes(c.id)) {
          toggleCompareCandidate(c.id)
        }
      })
    }
    setIsCompareModalOpen(true)
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-28">
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

      {loading && candidates.length === 0 && (
        <div className="py-20 text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-on-surface-variant">Fetching live candidates from backend...</p>
        </div>
      )}

      {/* Requisition Header & Switcher */}
      <Card className="space-y-4 border border-outline-variant/70">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[16px]">work</span>
              </span>
              <span className="text-xs text-secondary uppercase tracking-wider font-semibold">
                Requisition Evaluation
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Ranking
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <select
                value={selectedJobId || 'all'}
                onChange={(e) => handleJobChange(e.target.value)}
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1.5 text-base font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Published Openings ({jobs.filter((j) => j.status !== 'DRAFT').length})</option>
                {jobs
                  .filter((j) => j.status !== 'DRAFT')
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.department}) {j.status === 'PAUSED' ? '— [Paused]' : ''}
                    </option>
                  ))}
              </select>
            </div>

            {activeJob && selectedJobId !== 'all' && (
              <div className="flex items-center gap-3 flex-wrap pt-0.5">
                <p className="text-xs text-on-surface-variant">
                  {activeJob.department} • {activeJob.location} ({activeJob.workMode}) • {activeJob.minExperience}–{activeJob.maxExperience} yrs required • ₹{(activeJob.minSalary/1000).toFixed(0)}k–₹{(activeJob.maxSalary/1000).toFixed(0)}k
                </p>
                <button
                  onClick={() => toggleJobStatus(activeJob.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors border shadow-sm ${
                    activeJob.isActive
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}
                  title={activeJob.isActive ? 'Pause taking new applications' : 'Resume taking new applications'}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {activeJob.isActive ? 'pause_circle' : 'play_circle'}
                  </span>
                  <span>{activeJob.isActive ? 'Pause Applications' : 'Resume Applications'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick counts */}
          <div className="grid grid-cols-3 gap-2 shrink-0">
            <div className="bg-surface-container-low p-2.5 rounded-lg text-center min-w-[85px]">
              <span className="text-lg font-bold text-on-surface block leading-tight">
                {rankedCandidates.length}
              </span>
              <span className="text-[10px] text-on-surface-variant">In Queue</span>
            </div>
            <div className="bg-blue-50 p-2.5 rounded-lg text-center min-w-[85px]">
              <span className="text-lg font-bold text-primary block leading-tight">
                {rankedCandidates.filter((c) => c.status === 'Shortlisted').length}
              </span>
              <span className="text-[10px] text-blue-700 font-medium">Shortlisted</span>
            </div>
            <div className="bg-amber-50 p-2.5 rounded-lg text-center min-w-[85px]">
              <span className="text-lg font-bold text-amber-800 block leading-tight">
                {rankedCandidates.filter((c) => c.isKnockedOut).length}
              </span>
              <span className="text-[10px] text-amber-800 font-medium">Knocked Out</span>
            </div>
          </div>
        </div>

        {/* Paused Notice Banner */}
        {activeJob && !activeJob.isActive && selectedJobId !== 'all' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-700 text-[20px]">pause_circle</span>
              <div>
                <p className="font-bold">Applications are currently paused for this role</p>
                <p className="text-[11px] text-amber-800">Job seekers cannot submit new applications. Existing candidates remain accessible below.</p>
              </div>
            </div>
            <button
              onClick={() => toggleJobStatus(activeJob.id)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center gap-1 self-start sm:self-auto shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">play_circle</span>
              <span>Resume Applications</span>
            </button>
          </div>
        )}

        {/* Scoring Engine Presets & Sliders Bar (DD03) */}
        <div className="pt-3 border-t border-outline-variant/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.values(MACRO_PRESETS).map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => setActivePreset(preset.key)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                    activePresetKey === preset.key
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container-low text-secondary hover:text-on-surface'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowWeightSliders(!showWeightSliders)}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>{showWeightSliders ? 'Hide Sliders' : 'Customize Sliders'}</span>
              <span className="material-symbols-outlined text-[16px]">
                {showWeightSliders ? 'expand_less' : 'tune'}
              </span>
            </button>
          </div>

          {/* Expandable Custom Weight Sliders */}
          {showWeightSliders && (
            <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant space-y-3 transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-on-surface">Dynamic Pillar Weight Calibrator</span>
                <span className="text-[11px] text-on-surface-variant">
                  Adjust sliders to dynamically re-rank all applicants in real time
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
                {/* Skills Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-on-surface">1. Skills</span>
                    <span className="font-bold text-primary">
                      {Math.round(((effectiveWeights.skills || 0) / totalWeight) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={effectiveWeights.skills || 0}
                    onChange={(e) => handleSliderChange('skills', e.target.value)}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                {/* Experience Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-on-surface">2. Experience</span>
                    <span className="font-bold text-blue-600">
                      {Math.round(((effectiveWeights.experience || 0) / totalWeight) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={effectiveWeights.experience || 0}
                    onChange={(e) => handleSliderChange('experience', e.target.value)}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                {/* Projects Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-on-surface">3. Projects</span>
                    <span className="font-bold text-purple-600">
                      {Math.round(((effectiveWeights.projects || 0) / totalWeight) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={effectiveWeights.projects || 0}
                    onChange={(e) => handleSliderChange('projects', e.target.value)}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>

                {/* Proof of Work Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-on-surface">4. Proof of Work (Code)</span>
                    <span className="font-bold text-emerald-600">
                      {Math.round(((effectiveWeights.proof_of_work || 0) / totalWeight) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={effectiveWeights.proof_of_work || 0}
                    onChange={(e) => handleSliderChange('proof_of_work', e.target.value)}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Interactive Pipeline Stage Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All Candidates', count: stageCounts.all, color: 'text-on-surface' },
          { key: 'Applied', label: 'Applied', count: stageCounts.applied, color: 'text-secondary' },
          { key: 'Shortlisted', label: 'Shortlisted', count: stageCounts.shortlisted, color: 'text-emerald-700' },
          { key: 'Under Review', label: 'In Interview', count: stageCounts.reviewing, color: 'text-purple-700' },
          { key: 'knockouts', label: 'Knockouts', count: stageCounts.knockouts, color: 'text-red-700' },
          { key: 'Rejected', label: 'Rejected', count: stageCounts.rejected, color: 'text-error' },
        ].map((tab) => {
          const isActive =
            tab.key === 'knockouts'
              ? filterKnockouts === 'knockouts_only'
              : tab.key === 'all'
              ? filterKnockouts !== 'knockouts_only' && filterStatus === 'all'
              : filterStatus === tab.key

          return (
            <button
              key={tab.key}
              onClick={() => handleStageTabClick(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap border cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-blue-50 to-primary/10 text-primary border-primary/40 shadow-subtle font-bold ring-1 ring-primary/20'
                  : 'bg-surface-container-lowest text-secondary border-outline-variant/60 hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search, Filter & View Switcher Toolbar */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 border border-outline-variant/70 shadow-card">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search candidate, company, or skill..."
            className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all border border-transparent focus:border-primary/40"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tier Filter */}
          <select
            value={filterScoreTier}
            onChange={(e) => setFilterScoreTier(e.target.value)}
            className="bg-surface-container-low border border-outline-variant/80 rounded-xl px-3 py-1.5 text-xs text-on-surface font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Match Tiers</option>
            <option value="exceptional">Exceptional (85%+)</option>
            <option value="strong">Strong (70–84%)</option>
            <option value="moderate">Moderate (55–69%)</option>
            <option value="marginal">Marginal (&lt;55%)</option>
          </select>

          {/* ⚡ Smart Bulk Reject button */}
          <button
            onClick={() => setIsSmartRejectOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all shadow-subtle"
            title="Bulk reject candidates by rule"
          >
            <span className="material-symbols-outlined text-[15px]">auto_delete</span>
            <span>Smart Reject</span>
          </button>
        </div>
      </Card>

      {/* Zero state if no ranked candidates */}
      {rankedCandidates.length === 0 && (
        <Card className="p-12 text-center text-on-surface-variant border border-outline-variant/60 space-y-3 shadow-card">
          <span className="material-symbols-outlined text-[48px] text-outline">search_off</span>
          <h3 className="text-base font-bold text-on-surface">No candidates match current criteria</h3>
          <p className="text-xs text-secondary max-w-md mx-auto">
            Try resetting your search query, knockout filter, or stage filter to view available applicants.
          </p>
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterKnockouts('all')
              setFilterScoreTier('all')
              setFilterStatus('all')
            }}
            className="px-4 py-2 rounded-xl bg-surface-container text-primary font-bold text-xs hover:bg-surface-container-high transition-colors"
          >
            Reset Filters
          </button>
        </Card>
      )}

      {/* Main View: Dual-Pane Workstation */}
      {rankedCandidates.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Left Column: Candidate Stream Queue */}
          <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 space-y-2">
            {/* Queue Header & Select All */}
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    rankedCandidates.length > 0 &&
                    rankedCandidates.every((c) => c.isSelected)
                  }
                  onChange={(e) => selectAllCandidates(selectedJobId, e.target.checked)}
                  className="w-4 h-4 rounded text-primary cursor-pointer accent-primary"
                  title="Select all filtered candidates"
                />
                <span className="font-bold text-on-surface tracking-tight">
                  Queue ({rankedCandidates.length})
                </span>
              </div>
            </div>

            {/* Scrollable Queue Cards */}
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {rankedCandidates.map((candidate, idx) => {
                const isSelected = activeCandidate?.id === candidate.id

                return (
                  <div
                    key={candidate.id}
                    onClick={() => setSelectedCandidateId(candidate.id)}
                    className={`p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer relative ${
                      isSelected
                        ? 'border-primary bg-gradient-to-r from-blue-50/80 via-white to-surface-container-lowest ring-1 ring-primary/30 shadow-card border-l-4 border-l-primary'
                        : candidate.isKnockedOut
                        ? 'border-red-200/90 bg-red-50/25 hover:border-red-300'
                        : 'border-outline-variant/70 bg-surface-container-lowest hover:border-primary/40 hover:bg-surface-container-low/40 hover:shadow-subtle'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {/* Checkbox */}
                        <div
                          className="pt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={candidate.isSelected || false}
                            onChange={() => toggleCandidateSelection(candidate.id)}
                            className="w-4 h-4 rounded text-primary cursor-pointer accent-primary"
                          />
                        </div>

                        {/* Avatar with rank badge */}
                        <div className="relative shrink-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-subtle ${candidate.avatarColor}`}
                          >
                            {candidate.initials}
                          </div>
                          <div
                            className={`absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs ${
                              candidate.rank === 1
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface-container-highest text-on-surface'
                            }`}
                          >
                            {candidate.rank || idx + 1}
                          </div>
                        </div>

                        {/* Name & Role */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-on-surface truncate">
                              {candidate.name}
                            </span>
                            {candidate.isKnockedOut && (
                              <span
                                className="material-symbols-outlined text-[14px] text-red-600"
                                title="Knocked out by screening rules"
                              >
                                block
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-secondary font-medium truncate">
                            {candidate.role} • {candidate.company}
                          </p>
                          <p className="text-[10px] text-on-surface-variant font-medium">
                            {candidate.yearsExp}y • {candidate.location}
                          </p>
                        </div>
                      </div>

                      {/* Right Side: Score Pill + Bookmark */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold shadow-subtle ${
                            candidate.overallScore >= 85
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/90'
                              : candidate.overallScore >= 70
                              ? 'bg-blue-50 text-primary border border-blue-200/90'
                              : candidate.overallScore >= 55
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/90'
                              : 'bg-red-50 text-red-800 border border-red-200/90'
                          }`}
                        >
                          {candidate.overallScore}%
                        </span>

                        <div className="flex items-center gap-1">
                          <StatusBadge status={candidate.status} />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleBookmark(candidate.id)
                            }}
                            className="text-secondary hover:text-primary transition-colors p-0.5"
                            title="Bookmark"
                          >
                            <span
                              className="material-symbols-outlined text-[15px]"
                              style={{ fontVariationSettings: candidate.isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
                            >
                              bookmark
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Active Candidate Dossier */}
          <div className="flex-1 min-w-0 w-full sticky top-4 max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
            <CandidateWorkstationDossier
              candidate={activeCandidate}
              job={activeJob}
              onUpdateStatus={updateCandidateStatus}
              onToggleBookmark={toggleBookmark}
              onAddNote={addCandidateNote}
              onToggleCompare={toggleCompareCandidate}
              isComparing={comparedCandidateIds.includes(activeCandidate?.id)}
              onNext={handleNextCandidate}
              onPrev={handlePrevCandidate}
              hasPrev={hasPrev}
              hasNext={hasNext}
              currentIndex={currentCandidateIndex}
              totalCount={rankedCandidates.length}
            />
          </div>
        </div>
      )}


      {/* Floating Batch Actions Bar */}
      {(selectedCandidates.length > 0 || comparedCandidateIds.length > 0) && (
        <div className="fixed bottom-5 left-0 right-0 z-40 px-6 pointer-events-none lg:left-60">
          <div className="max-w-2xl mx-auto bg-inverse-surface text-inverse-on-surface rounded-xl p-3 shadow-2xl flex items-center justify-between gap-3 pointer-events-auto border border-outline-variant/40">
            <div className="flex items-center gap-2 pl-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold">
                {selectedCandidates.length} Selected • {comparedCandidateIds.length} in Compare Tray
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(comparedCandidateIds.length > 0 || selectedCandidates.length > 0) && (
                <button
                  onClick={handleOpenCompare}
                  className="px-3 py-1.5 rounded-lg bg-primary-fixed text-primary text-xs font-bold hover:bg-primary-fixed-dim transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
                  Compare Side-by-Side
                </button>
              )}

              {selectedCandidates.length > 0 && (
                <>
                  <button
                    onClick={() =>
                      batchUpdateStatus(
                        selectedCandidates.map((c) => c.id),
                        'Shortlisted'
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors"
                  >
                    Shortlist ({selectedCandidates.length})
                  </button>

                  <button
                    onClick={() =>
                      batchUpdateStatus(
                        selectedCandidates.map((c) => c.id),
                        'Rejected'
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-error text-on-error text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Reject
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  selectAllCandidates(selectedJobId, false)
                  clearComparison()
                }}
                className="p-1 rounded text-secondary hover:text-white"
                title="Dismiss Tray"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      <CandidateComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        candidates={comparedCandidates.length > 0 ? comparedCandidates : selectedCandidates}
        onUpdateStatus={updateCandidateStatus}
      />

      {/* ⚡ Smart Bulk Reject Modal */}
      <SmartBulkRejectModal
        isOpen={isSmartRejectOpen}
        onClose={() => setIsSmartRejectOpen(false)}
        rankedCandidates={rankedCandidates}
        batchUpdateStatus={batchUpdateStatus}
      />
    </div>
  )
}
