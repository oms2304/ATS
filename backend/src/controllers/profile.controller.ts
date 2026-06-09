import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createProfileSchema, updateProfileSchema, calculateCompletionScore } from '../schemas/profile.schema';

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.profile.findUnique({ where: { user_id: userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.status(200).json(profile);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await prisma.profile.findUnique({ where: { user_id: userId } });
    if (existing) return res.status(409).json({ error: 'Profile already exists' });
    const parsed = createProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    const completion_score = calculateCompletionScore(parsed.data);
    const profile = await prisma.profile.create({
      data: { ...parsed.data, user_id: userId, completion_score },
    });
    return res.status(201).json(profile);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await prisma.profile.findUnique({ where: { user_id: userId } });
    if (!existing) return res.status(404).json({ error: 'Profile not found' });
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    const merged = { ...existing, ...parsed.data };
    const completion_score = calculateCompletionScore(merged);
    const profile = await prisma.profile.update({
      where: { user_id: userId },
      data: { ...parsed.data, completion_score },
    });
    return res.status(200).json(profile);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCompletionScore = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profile = await prisma.profile.findUnique({ where: { user_id: userId } });
    if (!profile) return res.status(200).json({ completion_score: 0, completed_fields: 0, total_fields: 5 });
    return res.status(200).json({
      completion_score: profile.completion_score,
      completed_fields: Math.round((profile.completion_score / 100) * 5),
      total_fields: 5,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
