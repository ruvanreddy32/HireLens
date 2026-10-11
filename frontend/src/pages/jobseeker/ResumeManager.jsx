import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useJobSeekerStore } from '../../store/jobSeekerStore'
import Card from '../../components/ui/Card'
import { api } from '../../services/api'

export default function ResumeManager() {
  const { setPageTitle } = useUIStore()
  const {
    resumes,
    applications,
    maxResumes,
    addResume,
    deleteResume,
    setPrimaryResume,
    error,
    successMessage,
    clearError,
    clearSuccess,
    fetchData,
  } = useJobSeekerStore()

  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // Upload Form Modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    targetRole: '',
    specialization: '',
    skillsInput: '',
    isPrimary: false,
  })

  const fileInputRef = useRef(null)

  useEffect(() => {
    setPageTitle('Resume Management')
    fetchData()
  }, [setPageTitle, fetchData])

  // Clear toast notifications after 5 seconds
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        clearError()
        clearSuccess()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, successMessage, clearError, clearSuccess])

  const canUpload = resumes.length < maxResumes

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canUpload) return
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (!canUpload) return

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0])
    }
  }

  const handleFileSelected = (file) => {
    if (!canUpload) return

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      alert('Only PDF documents are supported.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds the 5MB limit.')
      return
    }

    setPendingFile(file)
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
    setFormData({
      title: baseName,
      targetRole: '',
      specialization: '',
      skillsInput: '',
      isPrimary: resumes.length === 0,
    })
    setUploadModalOpen(true)
  }

  const handleConfirmUpload = async (e) => {
    e.preventDefault()
    if (!pendingFile || !canUpload) return

    setIsUploading(true)

    const skillsArray = formData.skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      const uploaded = await api.uploadResume(pendingFile, {
        title: formData.title.trim() || pendingFile.name,
        targetRole: formData.targetRole.trim() || formData.title.trim(),
        isPrimary: formData.isPrimary,
      })

      if (uploaded) {
        const parsedSkills = Array.isArray(uploaded.parsedData?.skills)
          ? uploaded.parsedData.skills.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
          : skillsArray

        addResume({
          id: uploaded.id,
          title: uploaded.title,
          fileName: uploaded.fileName,
          fileUrl: uploaded.fileUrl,
          fileSize: `${Math.round(uploaded.fileSize / 1024)} KB`,
          uploadedAt: new Date(uploaded.createdAt || Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          isPrimary: uploaded.isPrimary,
          targetRole: uploaded.targetRole || formData.targetRole.trim() || '',
          specialization: formData.specialization.trim() || '',
          skills: parsedSkills.length > 0 ? parsedSkills : skillsArray,
          parsedData: uploaded.parsedData || null,
          parseStatus: 'HEALTHY',
          textExtractable: true,
        })
        fetchData(true)
      }
    } catch (err) {
      console.error('Failed to upload resume to S3:', err)
      alert(err.message || 'Failed to upload resume')
    } finally {
      setIsUploading(false)
      setUploadModalOpen(false)
      setPendingFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Calculate applications linked to this resume
  const getLinkedApplications = (resume) => {
    const jobIds = resume.appliedJobIds || []
    return applications.filter(
      (app) => jobIds.includes(app.jobId) || app.resumeId === resume.id
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Toast Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-red-600">error</span>
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={clearError} className="text-red-500 hover:text-red-800">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
            <span className="font-medium">{successMessage}</span>
          </div>
          <button onClick={clearSuccess} className="text-emerald-500 hover:text-emerald-800">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Clean, Non-Intrusive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Resume Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container text-secondary border border-outline-variant/60">
              {resumes.length} of {maxResumes} slots
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Maintain tailored resume profiles for different engineering roles. When applying, the best-matched variant is automatically recommended.
          </p>
        </div>

        {/* Header Upload Button */}
        <div>
          <button
            onClick={() => {
              if (canUpload && fileInputRef.current) {
                fileInputRef.current.click()
              }
            }}
            disabled={!canUpload}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
              canUpload
                ? 'bg-primary text-on-primary hover:opacity-90 cursor-pointer'
                : 'bg-surface-container text-outline cursor-not-allowed border border-outline-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            <span>Upload Resume</span>
          </button>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        disabled={!canUpload}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Resumes Grid or Clean Empty State */}
      {resumes.length === 0 ? (
        <Card className="text-center py-16 border border-dashed border-outline-variant/80 bg-surface-container-low/20 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mx-auto text-primary shadow-subtle">
            <span className="material-symbols-outlined text-[32px]">upload_file</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-on-surface">No resumes uploaded yet</h3>
            <p className="text-xs text-secondary mt-1 max-w-md mx-auto">
              Upload your resume (PDF) to unlock real-time match scoring and candidate analysis against live requisitions.
            </p>
          </div>
          <button
            onClick={() => {
              if (fileInputRef.current) fileInputRef.current.click()
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity mt-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Upload Your First Resume</span>
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {resumes.map((resume) => {
            const linkedApps = getLinkedApplications(resume)
            const isLocked = linkedApps.length > 0

            return (
              <Card
                key={resume.id}
                className={`p-5 flex flex-col justify-between border transition-all ${
                  resume.isPrimary
                    ? 'border-primary/50 bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest to-blue-50/20 shadow-card'
                    : 'border-outline-variant/70 shadow-subtle hover:border-outline-variant'
                }`}
              >
                <div className="space-y-3">
                  {/* Header Row: Title & Primary Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">description</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-bold text-on-surface truncate">{resume.title}</h2>
                          {resume.isPrimary && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-on-primary flex items-center gap-1 shadow-2xs">
                              <span className="material-symbols-outlined text-[11px]">star</span>
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary font-medium mt-0.5">{resume.targetRole}</p>
                      </div>
                    </div>

                    {/* Clean Parse Indicator */}
                    <span
                      className="shrink-0 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1"
                      title="Clean text extractable PDF parse"
                    >
                      <span className="material-symbols-outlined text-[13px]">check</span>
                      Clean Parse
                    </span>
                  </div>

                  {/* File Details Line */}
                  <div className="flex items-center gap-2 text-[11px] text-secondary">
                    <span className="font-mono text-[10px] text-on-surface font-medium truncate max-w-[180px]">
                      {resume.fileName}
                    </span>
                    <span>•</span>
                    <span>{resume.fileSize}</span>
                    <span>•</span>
                    <span>Uploaded {resume.uploadedAt}</span>
                  </div>

                  {/* Focus Specialization & Skill Tags */}
                  {(resume.specialization || (resume.skills && resume.skills.length > 0)) && (
                    <div className="space-y-1.5 pt-0.5">
                      {resume.specialization && (
                        <p className="text-[11px] text-secondary font-medium truncate">
                          Focus: <span className="text-on-surface">{resume.specialization}</span>
                        </p>
                      )}
                      {resume.skills && resume.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {resume.skills.slice(0, 4).map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-container text-on-surface-variant border border-outline-variant/50"
                            >
                              {skill}
                            </span>
                          ))}
                          {resume.skills.length > 4 && (
                            <span className="px-1.5 py-0.5 text-[10px] text-secondary font-medium">
                              +{resume.skills.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Clean Status Pill (Locked vs Unsubmitted) */}
                  <div className="pt-1">
                    {isLocked ? (
                      <div
                        className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg flex items-center justify-between gap-2"
                        title="Attached to submitted requisitions. Protected from deletion to preserve hiring pipeline integrity."
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-[14px] text-amber-700 shrink-0">lock</span>
                          <span className="font-medium truncate">
                            Active in {linkedApps.length} requisition{linkedApps.length > 1 ? 's' : ''} (Locked)
                          </span>
                        </div>
                        <span className="text-[10px] text-amber-700 font-bold shrink-0">Non-deletable</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-200/60 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
                        <span>Ready for applications • Unlocked</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Minimal Card Footer */}
                <div className="pt-3.5 mt-3 border-t border-outline-variant/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/resume/${resume.id}/analysis`}
                      className="font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <span>View Analysis</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>

                    {!resume.isPrimary && (
                      <button
                        onClick={() => {
                          setPrimaryResume(resume.id)
                          api.setPrimaryResume(resume.id).catch(() => null)
                        }}
                        className="text-secondary hover:text-primary font-semibold transition-colors cursor-pointer"
                      >
                        Make Primary
                      </button>
                    )}
                  </div>

                  {/* Delete Action */}
                  <div>
                    {deleteConfirmId === resume.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            deleteResume(resume.id)
                            api.deleteResume(resume.id).catch(() => null)
                            setDeleteConfirmId(null)
                          }}
                          className="px-2 py-0.5 rounded bg-red-600 text-white font-semibold text-[11px] hover:bg-red-700 cursor-pointer"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-0.5 rounded border border-outline-variant text-[11px] text-secondary hover:bg-surface-container cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (isLocked) {
                            alert(
                              'This resume is attached to active applications and cannot be deleted while those applications are active.'
                            )
                            return
                          }
                          setDeleteConfirmId(resume.id)
                        }}
                        disabled={isLocked}
                        className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                          isLocked
                            ? 'text-outline/40 cursor-not-allowed'
                            : 'text-secondary hover:text-red-600 hover:bg-red-50 cursor-pointer'
                        }`}
                        title={isLocked ? 'Locked: Attached to submitted application' : 'Delete resume profile'}
                      >
                        <span className="material-symbols-outlined text-[17px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}

          {/* Upload Slot Card inside the Grid */}
          {canUpload && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => {
                if (canUpload && fileInputRef.current) {
                  fileInputRef.current.click()
                }
              }}
              className={`min-h-[220px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer ${
                dragActive
                  ? 'border-primary bg-blue-50/50 scale-[1.01]'
                  : 'border-outline-variant/80 hover:border-primary/60 bg-surface-container-low/30 hover:bg-surface-container-low/70'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-primary mb-2 shadow-2xs">
                <span className="material-symbols-outlined text-[24px]">add</span>
              </div>
              <span className="text-xs font-bold text-on-surface">Add Resume Profile</span>
              <p className="text-[11px] text-secondary mt-1 max-w-[210px] leading-relaxed">
                Click to browse or drop PDF ({maxResumes - resumes.length} slots left)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upload Details Configuration Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-2xl border border-outline-variant space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/60">
              <div>
                <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">upload_file</span>
                  Add Resume Profile
                </h2>
                <p className="text-[11px] text-secondary mt-0.5">
                  Slot {resumes.length + 1} of {maxResumes} • {pendingFile?.name}
                </p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmUpload} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  Profile Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. My Resume"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:border-primary outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">
                    Target Role
                  </label>
                  <input
                    type="text"
                    value={formData.targetRole}
                    onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                    placeholder="e.g. Software Engineer"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:border-primary outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    placeholder="e.g. Distributed Systems"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:border-primary outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  Core Skills (Comma separated)
                </label>
                <input
                  type="text"
                  value={formData.skillsInput}
                  onChange={(e) => setFormData({ ...formData, skillsInput: e.target.value })}
                  placeholder="e.g. Python, SQL, Docker"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:border-primary outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isPrimaryCheck"
                  checked={formData.isPrimary}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="isPrimaryCheck" className="text-xs text-on-surface font-medium cursor-pointer">
                  Set this as my default / primary resume
                </label>
              </div>

              <div className="pt-3 border-t border-outline-variant/60 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant text-xs font-semibold hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs"
                >
                  {isUploading ? (
                    <>
                      <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      Confirm &amp; Add
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
