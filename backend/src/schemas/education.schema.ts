import { z } from 'zod';

export const educationSchema = z
  .object({
    school: z.string().min(1, 'School name is required'),
    degree: z.string().min(1, 'Degree is required'),
    fieldOfStudy: z.string().optional(),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional().nullable(),
    isCurrent: z.boolean().optional().default(false),
    gpa: z.string().optional(),
    order: z.number().optional().default(0),
  })
  .refine(
    (data) => {
      if (!data.isCurrent && data.endDate && data.startDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'End date cannot be earlier than start date',
      path: ['endDate'],
    },
  );