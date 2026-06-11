import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { profileSchema } from '../schemas/profile.schema';

const BASELINE_FIELDS = ['firstName', 'lastName', 'phone', 'linkedIn', 'summary'] as const;

function calculateCompletionScore(profile: Partial<Record<string, unknown>>): number {
  const completed = BASELINE_FIELDS.filter(
    (field) => profile[field] !== null && profile[field] !== undefined && profile[field] !== ''
  ).length;
  return Math.round((completed / BASELINE_FIELDS.length) * 100);
}

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    return res.status(200).json({ success: true, data: profile });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const createProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const existing = await prisma.profile.findUnique({ where: { userId } });
    if (existing) return res.status(409).json({ success: false, error: 'Profile already exists' });
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const completionScore = calculateCompletionScore(parsed.data);
    const profile = await prisma.profile.create({
      data: { ...parsed.data, userId, completionScore },
    });
    return res.status(201).json({ success: true, data: profile });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const existing = await prisma.profile.findUnique({ where: { userId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Profile not found' });
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const merged = { ...existing, ...parsed.data };
    const completionScore = calculateCompletionScore(merged);
    const profile = await prisma.profile.update({
      where: { userId },
      data: { ...parsed.data, completionScore },
    });
    return res.status(200).json({ success: true, data: profile });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getCompletionScore = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      return res.status(200).json({
        success: true,
        data: { completionScore: 0, completed_fields: 0, total_fields: 5 },
      });
    }
    return res.status(200).json({
      success: true,
      data: {
        completionScore: profile.completionScore,
        completed_fields: Math.round((profile.completionScore / 100) * 5),
        total_fields: 5,
      },
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
