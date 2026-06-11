import { z } from 'zod';

export const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedIn: z.string().optional(),
  summary: z.string().optional(),
});
