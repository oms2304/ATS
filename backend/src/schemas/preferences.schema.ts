import { z } from 'zod';

const WORK_MODES = ['Remote', 'Hybrid', 'On-site'] as const;

export const preferencesSchema = z
  .object({
    targetRoles: z.array(z.string()).optional().default([]),
    preferredLocations: z.array(z.string()).optional().default([]),
    workMode: z.enum(WORK_MODES).optional().nullable(),
    salaryMin: z.number().int().min(0).optional().nullable(),
    salaryMax: z.number().int().min(0).optional().nullable(),
  })
  .refine(
    (data) => {
      if (
        data.salaryMin !== null &&
        data.salaryMin !== undefined &&
        data.salaryMax !== null &&
        data.salaryMax !== undefined
      ) {
        return data.salaryMax >= data.salaryMin;
      }
      return true;
    },
    {
      message: 'Maximum salary cannot be less than minimum salary',
      path: ['salaryMax'],
    },
  );