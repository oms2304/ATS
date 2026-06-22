import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { educationSchema, dateRangeRefine } from '../schemas/education.schema';

export const getEducations = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const educations = await prisma.education.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
    return res.status(200).json({ success: true, data: educations });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch educations' });
  }
};

export const createEducation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const parsed = educationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }
    if (!dateRangeRefine(parsed.data)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: { endDate: ['End date cannot be earlier than start date'] },
      });
    }
    const education = await prisma.education.create({
      data: {
        ...parsed.data,
        userId,
        startDate: new Date(parsed.data.startDate),
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      },
    });
    return res.status(201).json({ success: true, data: education });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to create education' });
  }
};

export const updateEducation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const parsed = educationSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }
    if (!dateRangeRefine(parsed.data)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: { endDate: ['End date cannot be earlier than start date'] },
      });
    }
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate);
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'endDate')) {
      data.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
    }
    const education = await prisma.education.update({
      where: { id: req.params.id as string },
      data,
    });
    return res.status(200).json({ success: true, data: education });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to update education' });
  }
};

export const deleteEducation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const existing = await prisma.education.findUnique({
      where: { id: req.params.id as string },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Education not found' });
    await prisma.education.delete({ where: { id: req.params.id as string } });
    return res.status(200).json({ success: true, data: { message: 'Education deleted' } });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to delete education' });
  }
};