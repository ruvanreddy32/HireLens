import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useRecruiterStore } from '../../store/recruiterStore'
import { MACRO_PRESETS } from '../../constants/macroPresets'
import Card from '../../components/ui/Card'

export default function JobManagement() {
  const { setPageTitle } = useUIStore()
  const navigate = useNavigate()
  const {
    jobs,
    createJob,
    updateJob,
    deleteJob,
    setSelectedJobId,
    fetchRecruiterData,
    loading,
    error,
  } = useRecruiterStore()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'ACTIVE' | 'PAUSED' | 'DRAFT'

  // Toast feedback
  const [toast, setToast] = useState(null)
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState(null)

  // Form state
  const initialForm = {
    title: '',
    department: '',
    location: 'San Francisco, CA',
    workMode: 'Hybrid',
    employmentType: 'Full-time',
    minExperience: 3,
    maxExperience: 6,
    minSalary: 140000,
    maxSalary: 185000,
    education: "Bachelor's Degree in CS or equivalent",
    requiredSkills: ['React', 'TypeScript', 'TailwindCSS'],
    preferredSkills: ['Next.js', 'GraphQL'],
    description: '',
    presetKey: 'balanced',
    status: 'ACTIVE',
    isActive: true,
  }

  const [formData, setFormData] = useState(initialForm)
  const [skillInput, setSkillInput] = useState('')
  const [prefSkillInput, setPrefSkillInput] = useState('')

  useEffect(() => {
    setPageTitle('Job Requisitions')
    fetchRecruiterData()
  }, [setPageTitle, fetchRecruiterData])

  const openCreateModal = () => {
    setEditingJob(null)
    setFormData(initialForm)
    setIsModalOpen(true)
  }

  const openEditModal = (job) => {
    setEditingJob(job)
    const currentStatus = job.status || (job.isActive ? 'ACTIVE' : 'PAUSED')
    setFormData({
      title: job.title || '',
      department: job.department || '',
      location: job.location || '',
      workMode: job.workMode || 'Hybrid',
      employmentType: job.employmentType || 'Full-time',
      minExperience: job.minExperience || 0,
      maxExperience: job.maxExperience || 0,
      minSalary: job.minSalary || 0,
      maxSalary: job.maxSalary || 0,
      education: job.education || '',
      requiredSkills: job.requiredSkills || [],
      preferredSkills: job.preferredSkills || [],
      description: job.description || '',
      presetKey: job.presetKey || 'balanced',
      status: currentStatus,
      isActive: currentStatus === 'ACTIVE',
    })
    setIsModalOpen(true)
  }

  const handleSaveDraft = async () => {
    if (!formData.title.trim()) {
      showToast('Please enter at least a job title to save a draft', 'error')
      return
    }

    try {
      const draftPayload = {
        ...formData,
        status: 'DRAFT',
        isActive: false,
      }

      if (editingJob) {
        await updateJob(editingJob.id, draftPayload)
        showToast('Draft requisition saved')
      } else {
        await createJob(draftPayload)
        showToast('Requisition saved to Drafts')
      }
      setIsModalOpen(false)
    } catch (err) {
      showToast(err.message || 'Failed to save draft', 'error')
    }
  }

  const handlePublishJob = async (e) => {
    if (e) e.preventDefault()
    if (!formData.title.trim()) {
      showToast('Requisition title is required', 'error')
      return
    }

    try {
      const targetStatus = formData.isActive ? 'ACTIVE' : 'PAUSED'
      const payload = {
        ...formData,
        status: targetStatus,
        isActive: targetStatus === 'ACTIVE',
      }

      if (editingJob) {
        await updateJob(editingJob.id, payload)
        showToast(
          targetStatus === 'ACTIVE'
            ? 'Requisition is live and accepting applications'
            : 'Requisition saved (applications paused)'
        )
      } else {
        await createJob(payload)
        showToast(
          targetStatus === 'ACTIVE'
            ? 'New requisition published and live!'
            : 'New requisition created (intake paused)'
        )
      }
      setIsModalOpen(false)
    } catch (err) {
      showToast(err.message || 'Failed to publish requisition', 'error')
    }
  }

  const handleTogglePause = async (job) => {
    const isCurrentlyActive = job.status === 'ACTIVE' || (!job.status && job.isActive)
    const newStatus = isCurrentlyActive ? 'PAUSED' : 'ACTIVE'
    try {
      await updateJob(job.id, { status: newStatus, isActive: newStatus === 'ACTIVE' })
      showToast(
        newStatus === 'ACTIVE'
          ? `Resumed applications for "${job.title}"`
          : `Applications paused for "${job.title}"`
      )
    } catch (err) {
      showToast(err.message || 'Failed to update job status', 'error')
    }
  }

  const handleQuickPublishDraft = async (job) => {
    if (!job.title) {
      openEditModal(job)
      return
    }
    try {
      await updateJob(job.id, { status: 'ACTIVE', isActive: true })
      showToast(`Published "${job.title}"! Applications are open now.`)
    } catch (err) {
      showToast(err.message || 'Failed to publish draft', 'error')
    }
  }

  const handleDeleteJobConfirm = async (job) => {
    const isDraft = job.status === 'DRAFT'
    const confirmMsg = isDraft
      ? `Discard draft "${job.title || 'Untitled Requisition'}"? This cannot be undone.`
      : `Delete requisition "${job.title}"? Associated candidates and evaluations will be removed.`

    if (window.confirm(confirmMsg)) {
      try {
        await deleteJob(job.id)
        showToast(isDraft ? 'Draft discarded' : 'Requisition deleted')
        if (editingJob && editingJob.id === job.id) {
          setIsModalOpen(false)
        }
      } catch (err) {
        showToast(err.message || 'Failed to delete requisition', 'error')
      }
    }
  }

  const handleAddSkill = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && skillInput.trim()) {
      e.preventDefault()
      const val = skillInput.trim().replace(',', '')
      if (val && !formData.requiredSkills.includes(val)) {
        setFormData({ ...formData, requiredSkills: [...formData.requiredSkills, val] })
      }
      setSkillInput('')
    }
  }

  const handleRemoveSkill = (skillToRemove) => {
    setFormData({
      ...formData,
      requiredSkills: formData.requiredSkills.filter((s) => s !== skillToRemove),
    })
  }

  const handleAddPrefSkill = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && prefSkillInput.trim()) {
      e.preventDefault()
      const val = prefSkillInput.trim().replace(',', '')
      if (val && !formData.preferredSkills.includes(val)) {
        setFormData({ ...formData, preferredSkills: [...formData.preferredSkills, val] })
      }
      setPrefSkillInput('')
    }
  }

  const handleRemovePrefSkill = (skillToRemove) => {
    setFormData({
      ...formData,
      preferredSkills: formData.preferredSkills.filter((s) => s !== skillToRemove),
    })
  }

  const handleViewCandidates = (jobId) => {
    setSelectedJobId(jobId)
    navigate('/recruiter/candidates')
  }

  // Count calculations
  const totalCount = jobs.length
  const activeCount = jobs.filter((j) => (j.status === 'ACTIVE' || (!j.status && j.isActive))).length
  const pausedCount = jobs.filter((j) => (j.status === 'PAUSED' || (!j.status && !j.isActive))).length
  const draftCount = jobs.filter((j) => j.status === 'DRAFT').length

  const filterTabs = [
    { key: 'all', label: 'All Roles', count: totalCount },
    { key: 'ACTIVE', label: 'Active', count: activeCount, dotColor: 'bg-emerald-500' },
    { key: 'PAUSED', label: 'Paused', count: pausedCount, dotColor: 'bg-amber-500' },
    { key: 'DRAFT', label: 'Drafts', count: draftCount, icon: 'edit_note' },
  ]

  // Filtered jobs
  const filteredJobs = jobs.filter((job) => {
    const jobStatus = job.status || (job.isActive ? 'ACTIVE' : 'PAUSED')
    if (statusFilter !== 'all' && jobStatus !== statusFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (job.title || '').toLowerCase().includes(q) ||
      (job.department || '').toLowerCase().includes(q) ||
      (job.location || '').toLowerCase().includes(q) ||
      (job.requiredSkills || []).some((s) => s.toLowerCase().includes(q))
    )
  })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

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

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Job Requisition Management</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Configure job openings, save drafts, manage application intake, and view inbound candidate queues
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-primary text-white text-xs font-bold hover:opacity-95 transition-all flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Create New Requisition
        </button>
      </div>

      {loading && jobs.length === 0 && (
        <div className="py-20 text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-on-surface-variant">Loading requisitions from backend...</p>
        </div>
      )}

      {/* Filter and Control Bar */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 border border-outline-variant/70 shadow-card">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, department, or skill..."
            className="w-full bg-surface-container-low text-on-surface placeholder:text-outline text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all border border-transparent focus:border-primary/40"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-xl flex-wrap border border-outline-variant/40">
          {filterTabs.map((tab) => {
            const isSelected = statusFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-surface-container-lowest text-primary font-bold shadow-subtle'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                {tab.dotColor && (
                  <span
                    className={`w-2 h-2 rounded-full ${tab.dotColor} ${
                      tab.key === 'ACTIVE' ? 'animate-pulse' : ''
                    }`}
                  />
                )}
                {tab.icon && (
                  <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                )}
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface-container text-secondary'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Drafts Section Notification Banner */}
      {statusFilter === 'DRAFT' && (
        <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-indigo-950">
          <span className="material-symbols-outlined text-indigo-600 text-[20px] mt-0.5">edit_document</span>
          <div>
            <p className="font-bold text-indigo-900">Drafts Workspace</p>
            <p className="text-[11px] text-indigo-800 mt-0.5">
              Drafts are private to your workspace and not visible to candidates. You can save partially filled roles, revisit them anytime, and publish when ready to receive applications.
            </p>
          </div>
        </div>
      )}

      {/* Paused Section Notification Banner */}
      {statusFilter === 'PAUSED' && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-950">
          <span className="material-symbols-outlined text-amber-700 text-[20px] mt-0.5">pause_circle</span>
          <div>
            <p className="font-bold text-amber-900">Applications Paused</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Candidates cannot apply to these jobs right now. Your existing candidate pipeline and scoring data remain fully accessible and editable.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredJobs.length === 0 && (
        <Card className="py-16 text-center space-y-3 border-dashed border-2 border-outline-variant/60">
          <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mx-auto text-secondary">
            <span className="material-symbols-outlined text-[28px]">
              {statusFilter === 'DRAFT' ? 'edit_note' : 'work_off'}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-on-surface">
              {statusFilter === 'DRAFT'
                ? 'No draft requisitions found'
                : statusFilter === 'PAUSED'
                ? 'No paused requisitions'
                : 'No requisitions found'}
            </h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto mt-1">
              {statusFilter === 'DRAFT'
                ? 'When creating a requisition, choose "Save as Draft" to work on it before publishing.'
                : 'Adjust your search filters or create a new job requisition to get started.'}
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-95 shadow-sm inline-flex items-center gap-1 mt-2"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Create Requisition
          </button>
        </Card>
      )}

      {/* Requisitions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredJobs.map((job) => {
          const isDraft = job.status === 'DRAFT'
          const isPaused = job.status === 'PAUSED' || (!isDraft && !job.isActive)
          const isActive = !isDraft && !isPaused

          // Incomplete warning checks for drafts
          const isMissingDescription = !job.description || job.description.trim() === ''
          const isMissingSkills = !job.requiredSkills || job.requiredSkills.length === 0

          return (
            <Card
              key={job.id}
              className={`flex flex-col justify-between transition-all duration-200 space-y-4 hover:-translate-y-0.5 hover:shadow-card-hover border border-outline-variant/70 shadow-card ${
                isDraft
                  ? 'border-2 border-dashed border-outline-variant hover:border-primary/50 bg-surface-container-lowest/60'
                  : 'bg-gradient-to-b from-white to-surface-container-lowest/90'
              }`}
            >
              {/* Header */}
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className="text-base font-bold text-on-surface hover:text-primary transition-colors cursor-pointer tracking-tight"
                        onClick={() => (isDraft ? openEditModal(job) : handleViewCandidates(job.id))}
                      >
                        {job.title || 'Untitled Requisition'}
                      </h3>
                      {isDraft && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                      {job.department || 'General'} • {job.location || 'Remote'} ({job.workMode || 'Hybrid'})
                    </p>
                  </div>

                  {/* Status Badge */}
                  {isDraft ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-container text-secondary border border-outline-variant/80 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">edit_note</span>
                      <span>Unpublished</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleTogglePause(job)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-subtle ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      }`}
                      title={isActive ? 'Click to pause applications' : 'Click to resume applications'}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                        }`}
                      />
                      <span>{isActive ? 'Accepting Applications' : 'Applications Paused'}</span>
                    </button>
                  )}
                </div>

                {/* Details pill bar */}
                <div className="flex items-center gap-2 text-xs text-secondary flex-wrap">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/50 text-[11px] font-medium">
                    <span className="material-symbols-outlined text-[14px]">badge</span>
                    {job.minExperience}–{job.maxExperience || 0} yrs
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/50 text-[11px] font-medium">
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    ₹{((job.minSalary || 0) / 1000).toFixed(0)}k–₹{((job.maxSalary || 0) / 1000).toFixed(0)}k
                  </span>
                  <span className="text-[11px] bg-blue-50 text-primary border border-blue-200/80 px-2 py-0.5 rounded-md font-bold">
                    Preset: {MACRO_PRESETS[job.presetKey]?.name || 'Balanced'}
                  </span>
                </div>

                {/* Required Skills */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {(job.requiredSkills || []).length > 0 ? (
                    job.requiredSkills.map((sk) => (
                      <span
                        key={sk}
                        className="px-2 py-0.5 rounded-md bg-surface-container-low text-[11px] font-medium text-secondary border border-outline-variant/40"
                      >
                        {sk}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-outline italic">No skills specified yet</span>
                  )}
                </div>

                {/* Draft Missing Info Alert */}
                {isDraft && (isMissingDescription || isMissingSkills) && (
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-800 flex items-center gap-1.5 shadow-subtle">
                    <span className="material-symbols-outlined text-[15px] text-amber-700">info</span>
                    <span>
                      Draft incomplete: {isMissingDescription ? 'Missing description' : ''}
                      {isMissingDescription && isMissingSkills ? ' and ' : ''}
                      {isMissingSkills ? 'No required skills' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Funnel Metrics Row (Live / Paused) vs Draft Guidance */}
              {!isDraft ? (
                <div className="space-y-2">
                  {isPaused && (
                    <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/70 text-[11px] text-amber-900 flex items-center justify-between shadow-subtle">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-amber-700">pause_circle</span>
                        <span>Intake paused — candidates cannot submit resumes</span>
                      </div>
                      <button
                        onClick={() => handleTogglePause(job)}
                        className="font-bold underline hover:text-amber-950"
                      >
                        Resume
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 bg-gradient-to-b from-surface-container-low/70 to-surface-container-low p-2.5 rounded-xl text-center border border-outline-variant/40">
                    <div>
                      <span className="text-lg font-bold text-on-surface block leading-tight">
                        {job.applicantsTotal || 0}
                      </span>
                      <span className="text-[10px] text-secondary font-medium">Total Applicants</span>
                    </div>
                    <div>
                      <span className="text-lg font-bold text-primary block leading-tight">
                        {job.shortlisted || 0}
                      </span>
                      <span className="text-[10px] text-primary font-medium">Shortlisted</span>
                    </div>
                    <div>
                      <span className="text-lg font-bold text-purple-700 block leading-tight">
                        {job.inInterview || 0}
                      </span>
                      <span className="text-[10px] text-purple-700 font-medium">In Interview</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-surface-container-low/80 rounded-xl flex items-center justify-between text-xs text-secondary border border-outline-variant/40">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
                    <span>Ready to publish anytime</span>
                  </div>
                  <span className="text-[11px] font-bold text-primary">
                    {!isMissingDescription && !isMissingSkills ? 'Complete ✓' : 'In Progress'}
                  </span>
                </div>
              )}

              {/* Action Footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-outline-variant/50">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(job)}
                    className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-container transition-colors"
                    title={isDraft ? 'Continue editing draft' : 'Edit Requisition'}
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteJobConfirm(job)}
                    className="p-1.5 rounded-lg text-secondary hover:text-error hover:bg-red-50 transition-colors"
                    title={isDraft ? 'Discard Draft' : 'Delete Requisition'}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {isDraft ? (
                    <>
                      <button
                        onClick={() => openEditModal(job)}
                        className="px-3 py-1.5 rounded-xl border border-outline-variant/80 hover:bg-surface-container text-xs font-semibold text-on-surface transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                        <span>Resume Editing</span>
                      </button>
                      <button
                        onClick={() => handleQuickPublishDraft(job)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-primary text-white text-xs font-bold hover:opacity-95 shadow-sm transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">publish</span>
                        <span>Publish</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleTogglePause(job)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border shadow-subtle ${
                          isActive
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}
                        title={isActive ? 'Pause intake' : 'Resume intake'}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isActive ? 'pause_circle' : 'play_circle'}
                        </span>
                        <span>{isActive ? 'Pause Applications' : 'Resume Applications'}</span>
                      </button>

                      <button
                        onClick={() => handleViewCandidates(job.id)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-primary text-white text-xs font-bold hover:opacity-95 transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <span>Rank Candidates</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-outline-variant space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-on-surface">
                    {editingJob
                      ? editingJob.status === 'DRAFT'
                        ? 'Edit Requisition Draft'
                        : 'Edit Requisition'
                      : 'Create New Requisition'}
                  </h2>
                  {editingJob?.status === 'DRAFT' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Draft
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Save as draft to finish later, or publish immediately to start screening candidates
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handlePublishJob} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-on-surface">Requisition Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Senior Distributed Systems Engineer"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-on-surface">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Core Infrastructure"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-on-surface">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. San Francisco, CA or Remote"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-on-surface"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-on-surface">Work Mode</label>
                  <select
                    value={formData.workMode}
                    onChange={(e) => setFormData({ ...formData, workMode: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-on-surface"
                  >
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Onsite">Onsite</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-on-surface">Employment Type</label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-on-surface"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-on-surface">Min Exp (Yrs)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={formData.minExperience}
                    onChange={(e) => setFormData({ ...formData, minExperience: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-on-surface"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-on-surface">Max Exp (Yrs)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={formData.maxExperience}
                    onChange={(e) => setFormData({ ...formData, maxExperience: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-on-surface"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-on-surface">Min Salary (₹)</label>
                  <input
                    type="number"
                    step="5000"
                    value={formData.minSalary}
                    onChange={(e) => setFormData({ ...formData, minSalary: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-on-surface"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-on-surface">Max Salary (₹)</label>
                  <input
                    type="number"
                    step="5000"
                    value={formData.maxSalary}
                    onChange={(e) => setFormData({ ...formData, maxSalary: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-on-surface"
                  />
                </div>
              </div>

              {/* Scoring Preset (DD03) */}
              <div className="space-y-1 bg-surface-container-low p-3 rounded-xl border border-outline-variant">
                <label className="font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">tune</span>
                  Default Scoring Engine Preset (DD03)
                </label>
                <select
                  value={formData.presetKey}
                  onChange={(e) => setFormData({ ...formData, presetKey: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2 text-on-surface mt-1"
                >
                  {Object.values(MACRO_PRESETS).map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.name} — {preset.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Required Skills Chips */}
              <div className="space-y-1.5">
                <label className="font-semibold text-on-surface">
                  Required Mandatory Skills (Type & press Enter)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-surface-container-low border border-outline-variant rounded-lg min-h-[42px]">
                  {formData.requiredSkills.map((sk) => (
                    <span
                      key={sk}
                      className="px-2 py-1 rounded bg-primary-container text-on-primary text-[11px] font-semibold flex items-center gap-1"
                    >
                      {sk}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(sk)}
                        className="hover:text-error"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleAddSkill}
                    placeholder={formData.requiredSkills.length === 0 ? 'Type skill and press Enter...' : ''}
                    className="flex-1 bg-transparent border-none text-xs focus:outline-none min-w-[120px]"
                  />
                </div>
              </div>

              {/* Preferred Skills Chips */}
              <div className="space-y-1.5">
                <label className="font-semibold text-on-surface">
                  Preferred / Nice-to-Have Skills
                </label>
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-surface-container-low border border-outline-variant rounded-lg min-h-[42px]">
                  {formData.preferredSkills.map((sk) => (
                    <span
                      key={sk}
                      className="px-2 py-1 rounded bg-surface-container text-secondary text-[11px] font-medium flex items-center gap-1"
                    >
                      {sk}
                      <button
                        type="button"
                        onClick={() => handleRemovePrefSkill(sk)}
                        className="hover:text-error"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={prefSkillInput}
                    onChange={(e) => setPrefSkillInput(e.target.value)}
                    onKeyDown={handleAddPrefSkill}
                    placeholder="Type preferred skill and press Enter..."
                    className="flex-1 bg-transparent border-none text-xs focus:outline-none min-w-[120px]"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-semibold text-on-surface">Job Description & Responsibilities</label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Outline key expectations, scope, and technical responsibilities..."
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Application Intake Status Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low border border-outline-variant">
                <div>
                  <span className="text-xs font-bold text-on-surface block">Application Intake</span>
                  <span className="text-[11px] text-on-surface-variant">
                    {formData.isActive
                      ? 'Accepting new applicant submissions upon publishing'
                      : 'Intake paused — candidates cannot submit applications'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                    formData.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {formData.isActive ? 'pause_circle' : 'play_circle'}
                  </span>
                  <span>{formData.isActive ? 'Pause Applications' : 'Accept Applications'}</span>
                </button>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
                {editingJob?.status === 'DRAFT' ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteJobConfirm(editingJob)}
                    className="px-3 py-2 rounded-lg text-error hover:bg-error-container/30 text-xs font-semibold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Discard Draft</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-outline-variant text-secondary hover:bg-surface-container font-semibold"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="px-4 py-2 rounded-lg bg-surface-container text-on-surface border border-outline-variant font-semibold hover:bg-surface-container-high transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>Save as Draft</span>
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-primary text-on-primary font-semibold hover:opacity-95 shadow-sm flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {editingJob && editingJob.status !== 'DRAFT' ? 'check' : 'publish'}
                    </span>
                    <span>
                      {editingJob && editingJob.status !== 'DRAFT' ? 'Save Changes' : 'Publish Requisition'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
