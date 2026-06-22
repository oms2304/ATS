import { z } from 'zod';

const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;

export const skillSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  category: z.string().optional(),
  proficiency: z.enum(PROFICIENCY_LEVELS).optional().nullable(),
  order: z.number().optional().default(0),
});