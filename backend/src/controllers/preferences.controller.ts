import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { preferencesSchema } from '../schemas/preferences.schema';

export const getPreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const preferences = await prisma.careerPreferences.findUnique({
      where: { userId },
    });
    return res.status(200).json({ success: true, data: preferences });
  } catch (error) {
    console.error('getPreferences error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
};

export const upsertPreferences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const preferences = await prisma.careerPreferences.upsert({
      where: { userId },
      update: parsed.data,
      create: {
        ...parsed.data,
        userId,
      },
    });

    return res.status(200).json({ success: true, data: preferences });
  } catch (error) {
    console.error('upsertPreferences error:', error);
    return res.status(500).json({ success: false, error: 'Failed to save preferences' });
  }
};