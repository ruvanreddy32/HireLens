import {z} from 'zod';

export const registerSchema=z.object({
    name:z 
    .string()
    .min(2,'Name must contain at least 2 characters'),

    email: z
    .string()
    .email('Invalid email address'),

    password : z
    .string()
    .min(8,'Password must contain atleast 8 characters'),

    role: z.enum(['JOB_SEEKER','RECRUITER']),
});

export type registerInput = z.infer<typeof registerSchema>;