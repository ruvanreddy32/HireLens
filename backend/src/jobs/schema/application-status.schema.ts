import {z} from 'zod';

export const applicationStatusSchema=z.object({
    status:z.enum(["APPLIED","SHORTLISTED","REJECTED","REVIEWING"])
});
export type applicationStatusInput=z.infer<typeof applicationStatusSchema>;