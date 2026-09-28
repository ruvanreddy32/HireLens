import {z} from 'zod'

export const loginSchema=z.object({
    email : z.string().email('Invalid Email'),
    password:z.string().min(2,'Minimum length 2')
});

export type loginInput=z.infer<typeof loginSchema>