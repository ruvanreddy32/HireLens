import {z} from 'zod';

export const createJob = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Maximum length of 100 characters is crossed'),
  description: z.string().max(10000, 'Maximum length of 10000 exceeded').optional().default(''),
  location: z.string().optional().default(''),
  workMode: z.enum(['ONSITE', 'REMOTE', 'HYBRID']).optional().default('HYBRID'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'INTERNSHIP']).optional().default('FULL_TIME'),
  minExperience: z.number().nonnegative().optional().default(0),
  maxExperience: z.number().nonnegative().optional(),
  education: z.string().optional(),
  requiredSkills: z.array(z.string()).optional().default([]),
  preferredSkills: z.array(z.string()).optional().default([]),
  minSalary: z.number().optional(),
  maxSalary: z.number().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED']).optional(),
  isActive: z.boolean().optional(),
});

export type createJobInput=z.infer<typeof createJob>