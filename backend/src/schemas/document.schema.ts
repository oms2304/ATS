import { z } from 'zod';

export const DOCUMENT_TYPES = ['resume', 'cover_letter'] as const;

export const createDocumentSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
});

export const updateDocumentMetaSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  status: z.enum(['active', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
});

export const createVersionSchema = z
  .object({
    content: z.string().optional(),
    fileUrl: z.string().optional(),
    label: z.string().optional(),
  })
  .refine((data) => !!data.content || !!data.fileUrl, {
    message: 'Either content or fileUrl is required',
    path: ['content'],
  });
export const linkDocumentSchema = z.object({
  documentId: z.string().min(1, 'documentId is required'),
  type: z.enum(DOCUMENT_TYPES),
  confirmedReplace: z.boolean().optional(),
});

export type LinkDocumentInput = z.infer<typeof linkDocumentSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentMetaInput = z.infer<typeof updateDocumentMetaSchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
