import { z } from 'zod';

export const PREP_NOTE_CATEGORIES = [
  'company_info',
  'talking_points',
  'questions_to_ask',
  'technical_prep',
] as const;

export const createPrepNoteSchema = z.object({
  category: z.enum(PREP_NOTE_CATEGORIES),
  content: z.string().min(1, 'Content is required'),
});

export const updatePrepNoteSchema = createPrepNoteSchema.partial();

export type CreatePrepNoteInput = z.infer<typeof createPrepNoteSchema>;
export type UpdatePrepNoteInput = z.infer<typeof updatePrepNoteSchema>;