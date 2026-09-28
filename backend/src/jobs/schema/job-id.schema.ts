import {z} from 'zod';
export const jobIdSchema=z.object({
    jobId:z.string().uuid('Invalid job ID')
})
export type jobIdInput=z.infer<typeof jobIdSchema>