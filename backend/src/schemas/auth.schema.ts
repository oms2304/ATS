import { z } from 'zod'
export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
})
export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})
export type LoginInput = z.infer<typeof loginSchema>

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address')
})
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>
