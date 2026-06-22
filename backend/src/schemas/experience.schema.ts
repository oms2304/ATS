import { z } from 'zod';

export const experienceBaseSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  company: z.string().min(1, 'Company is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().nullable(),
  isCurrent: z.boolean().optional().default(false),
  description: z.string().optional(),
  order: z.number().optional().default(0),
});

export const dateRangeRefine = (
  data: { startDate?: string; endDate?: string | null; isCurrent?: boolean },
) => {
  if (!data.isCurrent && data.endDate && data.startDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
};

export const experienceSchema = experienceBaseSchema.refine(dateRangeRefine, {
  message: 'End date cannot be earlier than start date',
  path: ['endDate'],
});

export const updateExperienceSchema = experienceBaseSchema.partial().refine(dateRangeRefine, {
  message: 'End date cannot be earlier than start date',
  path: ['endDate'],
});