import {z} from 'zod';
export const applicationParamsSchema = z.object({
    jobId:z.string().uuid("invalid jobId"),
    applicationId:z.string().uuid("invalid application Id")
})

export type applicationParamsInput=z.infer<typeof applicationParamsSchema>