import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { experienceSchema } from '../schemas/experience.schema';

export const getExperiences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const experiences = await prisma.experience.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
    return res.status(200).json({ success: true, data: experiences });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch experiences' });
  }
};

export const createExperience = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const parsed = experienceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }
    const experience = await prisma.experience.create({
      data: {
        ...parsed.data,
        userId,
        startDate: new Date(parsed.data.startDate),
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      },
    });
    return res.status(201).json({ success: true, data: experience });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to create experience' });
  }
};

export const updateExperience = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const parsed = experienceSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate);
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'endDate')) {
      data.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
    }
    const experience = await prisma.experience.update({
      where: { id: req.params.id as string },
      data,
    });
    return res.status(200).json({ success: true, data: experience });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to update experience' });
  }
};

export const deleteExperience = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const existing = await prisma.experience.findUnique({
      where: { id: req.params.id as string },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Experience not found' });
    await prisma.experience.delete({ where: { id: req.params.id as string } });
    return res.status(200).json({ success: true, data: { message: 'Experience deleted' } });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to delete experience' });
  }
};

export const reorderExperiences = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { orderedIds } = req.body as { orderedIds?: string[] };
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ success: false, error: 'orderedIds must be an array' });
    }
    await Promise.all(
      orderedIds.map((id, index) =>
        prisma.experience.update({
          where: { id, userId },
          data: { order: index },
        }),
      ),
    );
    return res.status(200).json({ success: true, data: { message: 'Order updated' } });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to reorder experiences' });
  }
};