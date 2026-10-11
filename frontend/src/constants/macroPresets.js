// Macro Weight Presets for Requisitions & Candidate Scoring
// Aligned with docs/designs.md and docs/DesignDecisions.md (DD03 Macro Weight Sliders)

export const MACRO_PRESETS = {
  balanced: {
    key: 'balanced',
    name: 'Balanced (Standard)',
    description: 'Standard mid-level software engineering and design requisition weights',
    weights: { skills: 35, experience: 30, projects: 20, proof_of_work: 15 },
  },
  early_career_hacker: {
    key: 'early_career_hacker',
    name: 'Early Career Hacker',
    description: 'High-output junior/fresher builders with low corporate tenure but strong artifacts',
    weights: { skills: 25, experience: 5, projects: 35, proof_of_work: 35 },
  },
  enterprise_staff: {
    key: 'enterprise_staff',
    name: 'Enterprise Staff / NDA',
    description: 'Staff/Principal/Architects operating under strict NDAs with zero public open-source',
    weights: { skills: 30, experience: 45, projects: 20, proof_of_work: 5 },
  },
  open_source_specialist: {
    key: 'open_source_specialist',
    name: 'Open Source Specialist',
    description: 'DevRel, OSS maintainers, community-first engineers with public contributions',
    weights: { skills: 25, experience: 15, projects: 25, proof_of_work: 35 },
  },
  deep_tech_r_and_d: {
    key: 'deep_tech_r_and_d',
    name: 'Deep Tech & Applied AI',
    description: 'Applied AI, ML systems, systems research with high project and paper complexity',
    weights: { skills: 40, experience: 15, projects: 35, proof_of_work: 10 },
  },
  custom: {
    key: 'custom',
    name: 'Custom Sliders',
    description: 'Custom dynamic sliders calibrated specifically for this requisition',
    weights: { skills: 35, experience: 30, projects: 20, proof_of_work: 15 },
  },
}
