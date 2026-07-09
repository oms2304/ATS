import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createPrepNoteSchema, updatePrepNoteSchema } from '../schemas/prepnote.schema';

export const getPrepNotes = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const prepNotes = await prisma.prepNote.findMany({
      where: { job_id: jobId },
      orderBy: { createdAt: 'asc' },
    });
    return res.status(200).json({ success: true, data: prepNotes });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch prep notes' });
  }
};

export const createPrepNote = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const parsed = createPrepNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const prepNote = await prisma.prepNote.create({
      data: { ...parsed.data, job_id: jobId },
    });
    return res.status(201).json({ success: true, data: prepNote });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to create prep note' });
  }
};

export const updatePrepNote = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.prepNote.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Prep note not found' });
    if (existing.job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const parsed = updatePrepNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const prepNote = await prisma.prepNote.update({ where: { id }, data: parsed.data });
    return res.status(200).json({ success: true, data: prepNote });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to update prep note' });
  }
};

export const deletePrepNote = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.prepNote.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Prep note not found' });
    if (existing.job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    await prisma.prepNote.delete({ where: { id } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to delete prep note' });
  }
};