import {z} from 'zod';

export const createJob=z.object({
    title:z.string().min(3,'Minimum length of 3 character required').max(100,'Maximum length of 100 characters is crossed'),
    description:z.string().max(10000,"Maximum length of 10000 exceeded"),
    location:z.string(),
    workMode:z.enum(["ONSITE", "REMOTE", "HYBRID"]),
    employmentType:z.enum(["FULL_TIME", "PART_TIME", "INTERNSHIP"]),
    minExperience:z.number().nonnegative(),
    maxExperience:z.number().nonnegative().optional(),
    education:z.string().optional(),
    requiredSkills:z.array(z.string()).optional(),
    preferredSkills:z.array(z.string()).optional(),
    minSalary:z.number().optional(),
    maxSalary:z.number().optional(),
    isActive:z.boolean().default(true),

})

export type createJobInput=z.infer<typeof createJob>