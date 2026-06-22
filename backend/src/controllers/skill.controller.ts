import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { skillSchema } from '../schemas/skill.schema';

export const getSkills = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const skills = await prisma.skill.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
    return res.status(200).json({ success: true, data: skills });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch skills' });
  }
};

export const createSkill = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const parsed = skillSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const existing = await prisma.skill.findFirst({
      where: {
        userId,
        name: { equals: parsed.data.name, mode: 'insensitive' },
      },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: { name: ['You already have this skill'] },
      });
    }

    const skill = await prisma.skill.create({
      data: {
        ...parsed.data,
        userId,
      },
    });
    return res.status(201).json({ success: true, data: skill });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to create skill' });
  }
};

export const updateSkill = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const parsed = skillSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    if (parsed.data.name) {
      const existing = await prisma.skill.findFirst({
        where: {
          userId,
          name: { equals: parsed.data.name, mode: 'insensitive' },
          NOT: { id: req.params.id as string },
        },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          fields: { name: ['You already have this skill'] },
        });
      }
    }

    const skill = await prisma.skill.update({
      where: { id: req.params.id as string },
      data: parsed.data,
    });
    return res.status(200).json({ success: true, data: skill });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to update skill' });
  }
};

export const deleteSkill = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await prisma.skill.delete({ where: { id: req.params.id as string } });
    return res.status(200).json({ success: true, data: { message: 'Skill deleted' } });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to delete skill' });
  }
};

export const reorderSkills = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { orderedIds } = req.body as { orderedIds?: string[] };
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ success: false, error: 'orderedIds must be an array' });
    }
    await Promise.all(
      orderedIds.map((id, index) =>
        prisma.skill.update({
          where: { id, userId },
          data: { order: index },
        }),
      ),
    );
    return res.status(200).json({ success: true, data: { message: 'Order updated' } });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to reorder skills' });
  }
};