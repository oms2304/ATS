import { z } from 'zod';

export const upsertResearchNoteSchema = z.object({
  content: z.string().min(1, 'Content is required'),
});

export type UpsertResearchNoteInput = z.infer<typeof upsertResearchNoteSchema>;