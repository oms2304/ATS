import { z } from 'zod';

const NAME_REGEX = /^[A-Za-z]+$/;

export const profileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .regex(NAME_REGEX, 'Only letters are allowed')
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .regex(NAME_REGEX, 'Only letters are allowed')
    .optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedIn: z.string().optional(),
  summary: z.string().optional(),
});
