import { z } from 'zod';

export const DOCUMENT_TYPES = ['resume', 'cover_letter'] as const;

export const createDocumentSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
