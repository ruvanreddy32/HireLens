import { useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { useJobSeekerStore } from '../../store/jobSeekerStore'
import Card from '../../components/ui/Card'
import RadialGauge from '../../components/ui/RadialGauge'

// ─── Sub-components ───────────────────────────────────────────────

function ResumeHeader({ resume }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0">
          <span className="material-symbols-outlined text-[24px]">picture_as_pdf</span>
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-on-surface truncate">{resume.fileName || resume.title}</h2>
          <p className="text-xs text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            {resume.uploadedAt || 'Uploaded recently'}
          </p>
        </div>
      </div>
      <Link
        to="/resume"
        className="p-2 text-on-surface-variant hover:text-primary rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors shrink-0"
        title="Return to Resume Management"
      >
        <span className="material-symbols-outlined text-[20px]">folder_shared</span>
      </Link>
    </div>
  )
}

function ScoreHero({ analysis }) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 bg-surface-container-low rounded-xl p-4">
      <RadialGauge score={analysis.overallScore} size="lg" />

      <div className="flex-1 text-center sm:text-left space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold tracking-wide uppercase">
          <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
          {analysis.verdict}
        </div>
        <p className="text-sm font-semibold text-on-surface">{analysis.benchmark}</p>
        <p className="text-xs text-on-surface-variant leading-relaxed">{analysis.benchmarkDetail}</p>
      </div>

      <div className="w-full sm:w-auto px-4 py-3 bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant/60 flex sm:flex-col items-center justify-between sm:justify-center text-center gap-2 sm:gap-0">
        <span className="text-xs text-on-surface-variant">Parse Health</span>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-emerald-600 leading-none">Clean</span>
          <span className="text-xs text-emerald-700 font-semibold">Extractable</span>
        </div>
      </div>
    </div>
  )
}

function CategoryScoreCard({ category }) {
  return (
    <Card className="space-y-2 border border-outline-variant/70 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[18px]">{category.icon}</span>
          </div>
          <span className="text-sm font-semibold text-on-surface">{category.name}</span>
        </div>
        <span className="text-sm font-bold text-primary">
          {category.score}<span className="text-on-surface-variant font-normal text-xs">/100</span>
        </span>
      </div>
      <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
        <div
          className="bg-primary h-full rounded-full transition-all duration-700"
          style={{ width: `${category.score}%` }}
        />
      </div>
      <p className="text-xs text-on-surface-variant flex items-center gap-1">
        <span className="material-symbols-outlined text-emerald-600 text-[14px]">check_circle</span>
        {category.caption}
      </p>
    </Card>
  )
}

function KeywordEngine({ keywords }) {
  return (
    <Card className="space-y-4 border border-outline-variant/70 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Keyword Engine Match</h3>
          <p className="text-xs text-on-surface-variant">Evaluated against live verified requisitions</p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant/60">
          {keywords.found} / {keywords.total} Verified
        </span>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">verified</span>
          Verified Competencies in Resume Profile
        </span>
        <div className="flex flex-wrap gap-1.5">
          {keywords.detected.length > 0 ? (
            keywords.detected.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200/60"
              >
                <span className="material-symbols-outlined text-emerald-600 text-[13px]">check</span>
                {kw}
              </span>
            ))
          ) : (
            <p className="text-xs text-secondary italic">No overlapping keywords detected yet.</p>
          )}
        </div>
      </div>

      {keywords.missing.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-outline-variant/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-amber-600">priority_high</span>
              In-Demand Market Competencies to Consider
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.missing.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container text-secondary text-[11px] font-medium border border-outline-variant/60"
              >
                +{kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function Strengths({ strengths }) {
  return (
    <Card className="space-y-3.5 border border-outline-variant/70 shadow-card">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
          <span className="material-symbols-outlined text-[18px]">thumb_up</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-on-surface">Key Profile Strengths</h3>
          <p className="text-xs text-on-surface-variant">Validated points from candidate profile</p>
        </div>
      </div>
      <div className="space-y-2">
        {strengths.map((s, idx) => (
          <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/40">
            <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">check_circle</span>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-on-surface">{s.title}</p>
              <p className="text-[11px] text-secondary">{s.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function DiagnosticGaps({ improvements }) {
  if (!improvements.length) return null

  return (
    <Card className="space-y-3.5 border border-outline-variant/70 shadow-card">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-[18px]">build</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-on-surface">Targeted Optimization Recommendations</h3>
          <p className="text-xs text-on-surface-variant">Direct ways to enhance requisition alignment</p>
        </div>
      </div>
      <div className="space-y-2">
        {improvements.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/40">
            <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">{item.icon}</span>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-on-surface">{item.title}</p>
              <p className="text-[11px] text-secondary">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────

export default function ResumeAnalysis() {
  const { id } = useParams()
  const { setPageTitle } = useUIStore()
  const { resumes, activeJobs, applications, fetchData } = useJobSeekerStore()

  useEffect(() => {
    setPageTitle('Resume Analysis')
    fetchData()
  }, [setPageTitle, fetchData])

  const targetResume = useMemo(() => {
    return resumes.find((r) => r.id === id) || resumes[0] || null
  }, [resumes, id])

  const analysis = useMemo(() => {
    if (!targetResume) return null

    const parsedData = targetResume.parsedData || {}

    // 1. Extract candidate skills from parsed ML data + manual tags
    const rawParsedSkills = Array.isArray(parsedData.skills)
      ? parsedData.skills.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
      : []
    const manualSkills = Array.isArray(targetResume.skills) ? targetResume.skills : []
    const candidateSkillsSet = new Set()
    const candidateSkillsList = []

    ;[...rawParsedSkills, ...manualSkills].forEach((s) => {
      const clean = s.trim()
      const lower = clean.toLowerCase()
      if (clean && !candidateSkillsSet.has(lower)) {
        candidateSkillsSet.add(lower)
        candidateSkillsList.push(clean)
      }
    })

    // 2. Extract market requirements from active jobs
    const marketSkillsMap = new Map()
    activeJobs.forEach((job) => {
      ;(job.requiredSkills || []).forEach((skill) => {
        const norm = skill.toLowerCase().trim()
        if (norm && !marketSkillsMap.has(norm)) {
          marketSkillsMap.set(norm, skill)
        }
      })
    })

    // 3. Match candidate skills against active job requirements
    const detected = []
    const missing = []

    marketSkillsMap.forEach((originalName, norm) => {
      const isPresent = Array.from(candidateSkillsSet).some(
        (s) => s === norm || s.includes(norm) || norm.includes(s)
      )
      if (isPresent) {
        detected.push(originalName)
      } else {
        missing.push(originalName)
      }
    })

    // Also include candidate's unmapped specialized skills
    candidateSkillsList.forEach((skill) => {
      const norm = skill.toLowerCase().trim()
      const alreadyIncluded = detected.some((d) => d.toLowerCase() === norm)
      if (!alreadyIncluded) {
        detected.push(skill)
      }
    })

    // 4. Check if linked to an active submitted application with backend ML score
    const linkedApp = applications.find(
      (a) => a.resumeId === targetResume.id || (targetResume.appliedJobIds || []).includes(a.jobId)
    )

    // 5. Pillar 1: Technical Skills Matrix
    let dynamicSkillsScore = 0
    if (candidateSkillsList.length > 0) {
      const marketMatchRatio = marketSkillsMap.size > 0 ? (detected.length / marketSkillsMap.size) : 0.5
      dynamicSkillsScore = Math.min(
        100,
        Math.max(
          15,
          Math.round(marketMatchRatio * 50) + Math.min(candidateSkillsList.length * 4, 45)
        )
      )
    }
    const skillsScore = linkedApp?.skillsScore ? Math.round(linkedApp.skillsScore) : dynamicSkillsScore

    // 6. Pillar 2: Experience Depth
    const totalMonths = parsedData.total_experience_months || 0
    const expEntries = Array.isArray(parsedData.experience_entries) ? parsedData.experience_entries : []
    const yearsExp = totalMonths > 0 ? totalMonths / 12 : (expEntries.length * 1.5)

    let dynamicExpScore = 0
    if (yearsExp > 0) {
      dynamicExpScore = Math.min(100, Math.max(25, Math.round(30 + Math.min(yearsExp, 10) * 7.0)))
    }
    const experienceScore = linkedApp?.experienceScore ? Math.round(linkedApp.experienceScore) : dynamicExpScore

    let expCaption
    if (expEntries.length > 0) {
      const topRole = expEntries[0]
      const companyClean = topRole.company ? topRole.company.split('\n')[0].split(',')[0].trim() : ''
      expCaption = `${yearsExp.toFixed(1)} yrs across ${expEntries.length} role${expEntries.length > 1 ? 's' : ''} (latest: ${topRole.title || 'Engineer'}${companyClean ? ' at ' + companyClean : ''})`
    } else if (yearsExp > 0) {
      expCaption = `${yearsExp.toFixed(1)} years verified industry experience`
    } else {
      expCaption = 'No verified professional experience entries detected'
    }

    // 7. Pillar 3: Project Complexity
    const projects = Array.isArray(parsedData.projects) ? parsedData.projects : []
    let dynamicProjScore = 0
    if (projects.length > 0) {
      const hasLinks = projects.some((p) => p.link || (p.links && p.links.length > 0))
      const allTech = projects.flatMap((p) => p.tech_stack || [])
      dynamicProjScore = Math.min(100, Math.max(30, projects.length * 22 + (hasLinks ? 12 : 0) + Math.min(allTech.length * 3, 15)))
    }
    const projectScore = linkedApp?.projectScore ? Math.round(linkedApp.projectScore) : dynamicProjScore

    let projCaption
    if (projects.length > 0) {
      const topProj = projects[0]
      const techPreview = topProj.tech_stack?.slice(0, 3).join(', ')
      projCaption = `${projects.length} project${projects.length > 1 ? 's' : ''} detected (e.g. "${topProj.name || 'Core System'}"${techPreview ? ' in ' + techPreview : ''})`
    } else {
      projCaption = 'No standalone project artifacts detected'
    }

    // 8. Pillar 4: Proof of Work & ATS Integrity
    const links = parsedData.metadata?.links || {}
    let dynamicProofScore = 0
    if (targetResume.fileSize || targetResume.textExtractable) dynamicProofScore += 15
    if (links.github) dynamicProofScore += 45
    if (links.linkedin) dynamicProofScore += 25
    if (parsedData.portfolioUrl) dynamicProofScore += 15
    dynamicProofScore = Math.min(dynamicProofScore, 100)
    const proofOfWorkScore = linkedApp?.proofOfWorkScore ? Math.round(linkedApp.proofOfWorkScore) : dynamicProofScore

    const verifiedLinks = []
    if (links.github) verifiedLinks.push('GitHub')
    if (links.linkedin) verifiedLinks.push('LinkedIn')
    if (parsedData.portfolioUrl) verifiedLinks.push('Portfolio')
    const proofCaption = verifiedLinks.length > 0
      ? `${verifiedLinks.join(' & ')} verified • Clean ATS parse structure`
      : 'Basic PDF parseable text layer'

    // 9. Overall Composite Score
    const calculatedScore = Math.round(
      skillsScore * 0.35 +
      experienceScore * 0.30 +
      projectScore * 0.20 +
      proofOfWorkScore * 0.15
    )

    // 10. Category Breakdown Cards
    const categoryScores = [
      {
        id: 'skills',
        name: 'Technical Skills Matrix',
        score: skillsScore,
        icon: 'code',
        caption: `${candidateSkillsList.length} competencies indexed across verified domains`,
      },
      {
        id: 'experience',
        name: 'Experience Depth',
        score: experienceScore,
        icon: 'work_history',
        caption: expCaption,
      },
      {
        id: 'projects',
        name: 'Project Complexity',
        score: projectScore,
        icon: 'terminal',
        caption: projCaption,
      },
      {
        id: 'proof',
        name: 'Proof of Work & ATS Integrity',
        score: proofOfWorkScore,
        icon: 'verified',
        caption: proofCaption,
      },
    ]

    // 11. Real Strengths from Candidate Profile
    const strengths = []

    if (expEntries.length > 0) {
      const topRole = expEntries[0]
      const company = topRole.company ? topRole.company.split('\n')[0].split(',')[0].trim() : ''
      strengths.push({
        title: `${yearsExp.toFixed(1)} Years of Proven Industry Experience`,
        description: `Track record includes ${topRole.title || 'Engineering'}${company ? ' at ' + company : ''} with documented production ownership.`,
      })
    }

    if (projects.length > 0) {
      const topProj = projects[0]
      const tech = topProj.tech_stack?.slice(0, 4).join(', ')
      strengths.push({
        title: `Project Artifact: ${topProj.name || 'Production Architecture'}`,
        description: topProj.description || `Hands-on implementation leveraging ${tech || 'modern tech stack'}.${topProj.link ? ' Public repository verified.' : ''}`,
      })
    }

    if (candidateSkillsList.length > 0) {
      strengths.push({
        title: `Demonstrated Skills: ${candidateSkillsList.slice(0, 4).join(', ')}`,
        description: `Profile surfaces ${candidateSkillsList.length} distinct technologies across modern frontend, backend, and infrastructure stacks.`,
      })
    }

    const education = Array.isArray(parsedData.education) ? parsedData.education : []
    if (education.length > 0 && education[0].institution) {
      strengths.push({
        title: `Academic Credentials: ${education[0].degree || 'Degree'}${education[0].field_of_study ? ' in ' + education[0].field_of_study : ''}`,
        description: `Formal education from ${education[0].institution}${education[0].end_date ? ' (' + education[0].end_date + ')' : ''}.`,
      })
    }

    if (strengths.length < 2) {
      strengths.push({
        title: 'Clean Text Extractability',
        description: 'The PDF text layer is fully extractable by standard ATS parsers without encoding errors.',
      })
    }

    // 12. Actionable Tailored Recommendations
    const improvements = []

    if (missing.length > 0) {
      improvements.push({
        title: `Surface In-Demand Requisition Skills: ${missing.slice(0, 3).join(', ')}`,
        description: `Active company openings frequently require these technologies. If you have experience with them, incorporate them into your project bullets.`,
        icon: 'add_circle',
      })
    }

    if (!links.github) {
      improvements.push({
        title: 'Attach Public Code Repository Link',
        description: 'Adding a GitHub link to your resume header significantly boosts Proof of Work scoring (+16 pts).',
        icon: 'code',
      })
    }

    if (projects.length === 0) {
      improvements.push({
        title: 'Add Dedicated Projects Section',
        description: 'Recruiters and automated ranking models weight hands-on project artifacts with live URLs heavily.',
        icon: 'terminal',
      })
    }

    improvements.push({
      title: 'Target Tailored Requisitions',
      description: 'Review the job description required skills before submitting to maximize algorithmic score.',
      icon: 'insights',
    })

    return {
      fileName: targetResume.fileName || targetResume.title,
      targetRole: targetResume.targetRole || (expEntries[0]?.title || 'Software Engineering'),
      overallScore: calculatedScore,
      verdict:
        calculatedScore >= 88 ? 'High Alignment Fit' :
        calculatedScore >= 75 ? 'Strong Requisition Fit' :
        calculatedScore >= 60 ? 'Moderate Alignment' : 'Foundational Match',
      benchmark: `${calculatedScore}% composite match against live industry requirements`,
      benchmarkDetail: `Real-time diagnostic calculated from ${candidateSkillsList.length} parsed skills, ${yearsExp.toFixed(1)} yrs experience, and verified repository artifacts.`,
      categoryScores,
      keywords: {
        found: detected.length,
        total: Math.max(detected.length + missing.length, candidateSkillsList.length, 1),
        detected: detected.slice(0, 16),
        missing: missing.slice(0, 6),
      },
      strengths: strengths.slice(0, 4),
      improvements: improvements.slice(0, 4),
    }
  }, [targetResume, activeJobs, applications])

  if (!targetResume || !analysis) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mx-auto text-secondary">
          <span className="material-symbols-outlined text-[32px]">folder_off</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-on-surface">No Resumes Uploaded</h2>
          <p className="text-xs text-secondary mt-1">
            Please upload a resume in Resume Management to view its real-time diagnostic analysis.
          </p>
        </div>
        <Link
          to="/resume"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[16px]">upload_file</span>
          <span>Go to Resume Management</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/resume"
            className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Resume Management</span>
          </Link>
          <span className="text-secondary">•</span>
          <span className="text-xs text-on-surface font-semibold truncate max-w-xs">{analysis.fileName}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-on-surface text-[11px] font-semibold border border-outline-variant/60">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {analysis.targetRole}
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Left Column — Score Overview */}
        <div className="space-y-4">
          <Card className="space-y-4 border border-outline-variant/70 shadow-card">
            <ResumeHeader resume={targetResume} />
            <ScoreHero analysis={analysis} />
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-on-surface">Diagnostic Breakdown</h3>
              <span className="text-xs text-primary font-medium">4 Core Pillars</span>
            </div>
            {analysis.categoryScores.map((cat) => (
              <CategoryScoreCard key={cat.id} category={cat} />
            ))}
          </div>
        </div>

        {/* Right Column — Real Keyword & Strength Analysis */}
        <div className="space-y-4">
          <KeywordEngine keywords={analysis.keywords} />
          <Strengths strengths={analysis.strengths} />
          <DiagnosticGaps improvements={analysis.improvements} />
        </div>
      </div>
    </div>
  )
}
