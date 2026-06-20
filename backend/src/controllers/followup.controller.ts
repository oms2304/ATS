import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createFollowUpSchema, updateFollowUpSchema } from '../schemas/followup.schema';

export const getFollowUps = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const followUps = await prisma.followUp.findMany({
      where: { job_id: jobId },
      orderBy: { dueDate: 'asc' },
    });
    return res.status(200).json({ success: true, data: followUps });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch follow-ups' });
  }
};

export const createFollowUp = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const parsed = createFollowUpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const followUp = await prisma.followUp.create({
      data: { ...parsed.data, job_id: jobId, dueDate: new Date(parsed.data.dueDate) },
    });
    return res.status(201).json({ success: true, data: followUp });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to create follow-up' });
  }
};

export const updateFollowUp = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.followUp.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Follow-up not found' });
    if (existing.job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const parsed = updateFollowUpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.dueDate) data.dueDate = new Date(parsed.data.dueDate);

    const followUp = await prisma.followUp.update({ where: { id }, data });
    return res.status(200).json({ success: true, data: followUp });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to update follow-up' });
  }
};

export const deleteFollowUp = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.followUp.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Follow-up not found' });
    if (existing.job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    await prisma.followUp.delete({ where: { id } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to delete follow-up' });
  }
};