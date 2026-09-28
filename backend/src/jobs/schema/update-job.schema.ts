import { z } from 'zod';
import { createJob } from './create-job.schema';

export const updateJobSchema = createJob.partial();
export const updateJob = updateJobSchema;

export type updateJobInput = z.infer<typeof updateJobSchema>;

