import { z } from 'zod';

export const createProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  linkedIn: z.string().url('Invalid LinkedIn URL').optional(),
  summary: z.string().optional(),
});

export const updateProfileSchema = createProfileSchema.partial();

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const BASELINE_FIELDS = ['first_name', 'last_name', 'phone', 'linkedIn', 'summary'] as const;

export function calculateCompletionScore(profile: Partial<Record<string, unknown>>): number {
  const completed = BASELINE_FIELDS.filter(
    (field) => profile[field] !== null && profile[field] !== undefined && profile[field] !== ''
  ).length;
  return Math.round((completed / BASELINE_FIELDS.length) * 100);
}