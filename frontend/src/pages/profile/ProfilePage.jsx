import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useJobSeekerStore } from '../../store/jobSeekerStore'
import { useRecruiterStore } from '../../store/recruiterStore'
import { MACRO_PRESETS } from '../../constants/macroPresets'
import Card from '../../components/ui/Card'

export default function ProfilePage() {
  const { setPageTitle } = useUIStore()
  const { user, role, logout } = useAuthStore()
  const navigate = useNavigate()

  const isRecruiter = role === 'recruiter'

  // Job seeker store
  const { resumes, applications, maxResumes } = useJobSeekerStore()

  // Recruiter store
  const {
    jobs,
    candidates,
    activePresetKey,
    setActivePreset,
  } = useRecruiterStore()

  useEffect(() => {
    setPageTitle(isRecruiter ? 'Recruiter Profile & Organization' : 'Job Seeker Profile & Settings')
  }, [setPageTitle, isRecruiter])

  // Active Tab: 'overview' | 'settings' | 'signals' | 'security'
  const [activeTab, setActiveTab] = useState('overview')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Profile Form States
  const [formData, setFormData] = useState({
    name: user?.name || (isRecruiter ? 'Alex Morgan' : 'Elena Rostova'),
    email: user?.email || (isRecruiter ? 'alex.morgan@acmecorp.com' : 'elena.rostova@design.io'),
    phone: isRecruiter ? '+1 (555) 382-9012' : '+1 (555) 782-4190',
    location: isRecruiter ? 'San Francisco, CA' : 'Seattle, WA',
    company: isRecruiter ? 'Acme Corp' : 'Independent / Design Labs',
    title: isRecruiter ? 'Lead Technical Recruiter' : 'Senior Full-Stack Engineer',
    bio: isRecruiter
      ? 'Head of Technical Recruiting for Core Systems and Infrastructure engineering requisitions across North America.'
      : 'Full-stack software architect specializing in distributed systems, modern React applications, and Python cloud backends.',
    yearsExp: isRecruiter ? '7' : '5.5',
    // External Signals (Job Seeker)
    githubUrl: 'https://github.com/elena-rostova',
    linkedinUrl: 'https://linkedin.com/in/elena-rostova',
    portfolioUrl: 'https://elenarostova.dev',
    competitiveProfile: 'https://leetcode.com/elena_dev',
    // Job Search Preferences (Job Seeker)
    searchStatus: 'Actively Interviewing',
    workModePreference: 'Hybrid or Remote',
    // Recruiter Defaults
    defaultPreset: activePresetKey || 'balanced',
    emailDigest: true,
    candidateThreshold: '70',
  })

  // Password Change Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordMessage, setPasswordMessage] = useState(null)
  const [passwordError, setPasswordError] = useState(null)

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = (e) => {
    e.preventDefault()
    setSaveSuccess(true)
    if (isRecruiter && formData.defaultPreset) {
      setActivePreset(formData.defaultPreset)
    }
    setTimeout(() => setSaveSuccess(false), 4000)
  }

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordMessage(null)

    if (!passwordForm.currentPassword) {
      setPasswordError('Please provide your current account password.')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setPasswordMessage('Password updated successfully for your current session.')
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setTimeout(() => setPasswordMessage(null), 4000)
  }

  const handleLogout = () => {
    logout()
    navigate('/auth/login')
  }

  const primaryResume = resumes.find((r) => r.isPrimary) || resumes[0]
  const initials = formData.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Toast Notification */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-xl flex items-center justify-between shadow-xs transition-all animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
            <span className="font-semibold">Profile preferences and telemetry updated successfully!</span>
          </div>
          <button onClick={() => setSaveSuccess(false)} className="text-emerald-500 hover:text-emerald-800">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Hero Profile Header */}
      <Card className="bg-gradient-to-r from-surface-container-lowest via-surface-container-lowest to-surface-container-low border border-outline-variant/80 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-blue-600 to-indigo-700 text-on-primary font-bold text-xl flex items-center justify-center shadow-subtle shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-on-surface tracking-tight">{formData.name}</h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  isRecruiter
                    ? 'bg-blue-50 text-primary border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isRecruiter ? 'bg-primary' : 'bg-emerald-500'} animate-pulse`} />
                  {isRecruiter ? 'Lead Recruiter' : 'Verified Candidate'}
                </span>
                <span className="text-xs text-secondary bg-surface-container-low px-2 py-0.5 rounded-md border border-outline-variant/60 font-medium">
                  {formData.email}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                {formData.title} • {formData.company} • {formData.location}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-red-50 text-on-surface hover:text-error text-xs font-semibold border border-outline-variant hover:border-red-200 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              Sign Out
            </button>
          </div>
        </div>
      </Card>

      {/* Role-Specific Quick Telemetry KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isRecruiter ? (
          <>
            <Card className="border border-outline-variant/60">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Active Requisitions</span>
              <div className="text-2xl font-bold text-on-surface mt-2">{jobs.length} Jobs</div>
              <Link to="/recruiter/jobs" className="text-[11px] text-primary hover:underline font-semibold mt-1 inline-block">
                Manage live roles &rarr;
              </Link>
            </Card>

            <Card className="border border-outline-variant/60">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Triage Pipeline</span>
              <div className="text-2xl font-bold text-primary mt-2">{candidates.length} Applicants</div>
              <Link to="/recruiter/candidates" className="text-[11px] text-primary hover:underline font-semibold mt-1 inline-block">
                View candidate rankings &rarr;
              </Link>
            </Card>

            <Card className="border border-outline-variant/60">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Scoring Calibration</span>
              <div className="text-base font-bold text-on-surface mt-2 truncate">
                {MACRO_PRESETS[formData.defaultPreset]?.name || 'Balanced'}
              </div>
              <p className="text-[11px] text-secondary mt-1">Dynamic Macro Weight default</p>
            </Card>

            <Card className="border border-outline-variant/60">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Telemetry Engine</span>
              <div className="text-base font-bold text-emerald-700 mt-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Live NestJS + Postgres
              </div>
              <p className="text-[11px] text-secondary mt-1">Real-time candidate evaluation</p>
            </Card>
          </>
        ) : (
          <>
            <Card className="border border-outline-variant/60">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Primary Resume</span>
              <div className="text-base font-bold text-on-surface mt-2 truncate">
                {primaryResume?.title || primaryResume?.fileName || 'None Selected'}
              </div>
              <Link to="/resume" className="text-[11px] text-primary hover:underline font-semibold mt-1 inline-block">
                Manage variants ({resumes.length}/{maxResumes}) &rarr;
              </Link>
            </Card>

            <Card className="border border-outline-variant/60">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Active Applications</span>
              <div className="text-2xl font-bold text-primary mt-2">{applications.length} Submitted</div>
              <Link to="/applications" className="text-[11px] text-primary hover:underline font-semibold mt-1 inline-block">
                Track status telemetry &rarr;
              </Link>
            </Card>

            <Card className="border border-outline-variant/60">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Search Status</span>
              <div className="text-base font-bold text-emerald-700 mt-2 truncate">
                {formData.searchStatus}
              </div>
              <p className="text-[11px] text-secondary mt-1">{formData.workModePreference}</p>
            </Card>

            <Card className="border border-outline-variant/60">
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Proof-of-Work Verification</span>
              <div className="text-base font-bold text-primary mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
                GitHub & LinkedIn Synced
              </div>
              <p className="text-[11px] text-secondary mt-1">+40 pts ATS proof boost</p>
            </Card>
          </>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-outline-variant/80 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'overview'
              ? 'bg-primary text-on-primary shadow-subtle'
              : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">account_circle</span>
          Personal & Professional Details
        </button>

        <button
          onClick={() => setActiveTab('signals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'signals'
              ? 'bg-primary text-on-primary shadow-subtle'
              : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {isRecruiter ? 'tune' : 'code'}
          </span>
          {isRecruiter ? 'Scoring & Calibration Presets' : 'Verifiable External Artifacts'}
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'security'
              ? 'bg-primary text-on-primary shadow-subtle'
              : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">security</span>
          Security & Active Session
        </button>
      </div>

      {/* Tab 1: Personal & Professional Details */}
      {activeTab === 'overview' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <Card className="space-y-5 border border-outline-variant/70">
            <div className="border-b border-outline-variant/60 pb-3">
              <h2 className="text-base font-bold text-on-surface">Identity & Contact Telemetry</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Core identity information linked to your HireLens candidate dossiers and recruiter signatures.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  {isRecruiter ? 'Job Title / Designation' : 'Target Role / Specialization'}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  {isRecruiter ? 'Company / Organization' : 'Current Employer / Affiliation'}
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">Primary Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">Contact Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1.5">Professional Bio / Executive Summary</label>
              <textarea
                rows={3}
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {!isRecruiter && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-outline-variant/60">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">Search Availability</label>
                  <select
                    value={formData.searchStatus}
                    onChange={(e) => handleInputChange('searchStatus', e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="Actively Interviewing">Actively Interviewing (Immediate)</option>
                    <option value="Open to Opportunities">Open to High-Fit Opportunities</option>
                    <option value="Casually Looking">Casually Looking / Networking</option>
                    <option value="Not Looking">Not Looking Currently</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">Work Arrangement Preference</label>
                  <select
                    value={formData.workModePreference}
                    onChange={(e) => handleInputChange('workModePreference', e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="Hybrid or Remote">Hybrid or Remote</option>
                    <option value="Remote Only">Remote Only</option>
                    <option value="On-site / In-Office">On-site / In-Office</option>
                    <option value="Any">Flexible / Any</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-primary hover:opacity-90 text-on-primary text-xs font-semibold shadow-xs transition-opacity cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                Save Profile Changes
              </button>
            </div>
          </Card>
        </form>
      )}

      {/* Tab 2: Verifiable External Signals (Job Seeker) OR Calibration Presets (Recruiter) */}
      {activeTab === 'signals' && (
        <div className="space-y-6">
          {isRecruiter ? (
            <Card className="space-y-5 border border-outline-variant/70">
              <div className="border-b border-outline-variant/60 pb-3">
                <h2 className="text-base font-bold text-on-surface">Default Macro Weight Calibration (DD03)</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Configure the default 4-pillar weighting preset applied across newly created requisition queues and candidate scoring evaluations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {Object.values(MACRO_PRESETS).map((preset) => {
                  const isSelected = formData.defaultPreset === preset.key
                  return (
                    <div
                      key={preset.key}
                      onClick={() => handleInputChange('defaultPreset', preset.key)}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-blue-50/70 shadow-subtle ring-1 ring-primary/40'
                          : 'border-outline-variant/70 bg-surface-container-lowest hover:border-primary/40 hover:bg-surface-container-low/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-on-surface">{preset.name}</span>
                        {isSelected && (
                          <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                        )}
                      </div>
                      <p className="text-[11px] text-secondary line-clamp-2 mb-3">{preset.description}</p>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-on-surface-variant flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant/60">Skills {preset.weights.skills}%</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant/60">Exp {preset.weights.experience}%</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant/60">Proj {preset.weights.projects}%</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant/60">Proof {preset.weights.proof_of_work}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between">
                <span className="text-xs text-secondary">
                  Active preset in store: <strong className="text-on-surface">{MACRO_PRESETS[activePresetKey]?.name || 'Balanced'}</strong>
                </span>
                <button
                  onClick={() => {
                    setActivePreset(formData.defaultPreset)
                    setSaveSuccess(true)
                    setTimeout(() => setSaveSuccess(false), 3000)
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-xs hover:opacity-90 cursor-pointer"
                >
                  Apply Calibration Preset
                </button>
              </div>
            </Card>
          ) : (
            <Card className="space-y-5 border border-outline-variant/70">
              <div className="border-b border-outline-variant/60 pb-3">
                <h2 className="text-base font-bold text-on-surface">Verifiable Engineering Proof-of-Work Links (DD04)</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Verifiable external engineering artifacts directly boost your candidate profile rank and Proof-of-Work score in recruiter triage queues.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">code</span>
                      GitHub Profile / Repository Archive
                    </label>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                      +40 pts Proof of Work
                    </span>
                  </div>
                  <input
                    type="url"
                    value={formData.githubUrl}
                    onChange={(e) => handleInputChange('githubUrl', e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-blue-600">badge</span>
                      LinkedIn Profile
                    </label>
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold border border-blue-200">
                      +25 pts Verification
                    </span>
                  </div>
                  <input
                    type="url"
                    value={formData.linkedinUrl}
                    onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-purple-600">language</span>
                      Portfolio / Live Engineering Demos
                    </label>
                    <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-bold border border-purple-200">
                      +15 pts Deployed Demos
                    </span>
                  </div>
                  <input
                    type="url"
                    value={formData.portfolioUrl}
                    onChange={(e) => handleInputChange('portfolioUrl', e.target.value)}
                    placeholder="https://yourdomain.com"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-amber-600">terminal</span>
                      Competitive Programming / LeetCode / Kaggle Profile
                    </label>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold border border-amber-200">
                      +20 pts Algorithm Proof
                    </span>
                  </div>
                  <input
                    type="url"
                    value={formData.competitiveProfile}
                    onChange={(e) => handleInputChange('competitiveProfile', e.target.value)}
                    placeholder="https://leetcode.com/username"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-outline-variant/60">
                <button
                  onClick={handleSaveProfile}
                  className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-xs hover:opacity-90 cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  Sync Verified Links
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab 3: Security & Session */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card className="space-y-5 border border-outline-variant/70">
            <div className="border-b border-outline-variant/60 pb-3">
              <h2 className="text-base font-bold text-on-surface">Authentication & Session Security</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Current session state and cryptographic token authorization details.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-container-low/70 border border-outline-variant/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-secondary">Authentication Strategy</span>
                <span className="font-mono text-[11px] font-bold text-primary">NestJS JWT Bearer (HS256)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-secondary">Token Storage</span>
                <span className="font-mono text-[11px] text-on-surface">localStorage (&lsquo;hirelens_token&rsquo;)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-secondary">Session Status</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active & Authorized
                </span>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">Change Password</h3>

              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{passwordMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Min 8 characters"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-outline-variant transition-colors cursor-pointer"
                >
                  Update Account Password
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
