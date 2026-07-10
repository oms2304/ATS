import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { upsertResearchNoteSchema } from '../schemas/researchnote.schema';

export const getResearchNote = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const note = await prisma.researchNote.findUnique({ where: { job_id: jobId } });
    return res.status(200).json({ success: true, data: note });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch research note' });
  }
};

export const upsertResearchNote = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const parsed = upsertResearchNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const note = await prisma.researchNote.upsert({
      where: { job_id: jobId },
      create: { job_id: jobId, content: parsed.data.content },
      update: { content: parsed.data.content },
    });
    return res.status(200).json({ success: true, data: note });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to save research note' });
  }
};

export const deleteResearchNote = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const existing = await prisma.researchNote.findUnique({ where: { job_id: jobId } });
    if (!existing) return res.status(404).json({ success: false, error: 'Research note not found' });

    await prisma.researchNote.delete({ where: { job_id: jobId } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to delete research note' });
  }
};