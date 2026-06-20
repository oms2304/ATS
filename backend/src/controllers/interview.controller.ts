import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createInterviewSchema, updateInterviewSchema } from '../schemas/interview.schema';

export const getInterviews = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const interviews = await prisma.interview.findMany({
      where: { job_id: jobId },
      orderBy: { date: 'asc' },
    });
    return res.status(200).json({ success: true, data: interviews });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch interviews' });
  }
};

export const createInterview = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const parsed = createInterviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const interview = await prisma.interview.create({
      data: { ...parsed.data, job_id: jobId, date: new Date(parsed.data.date) },
    });
    return res.status(201).json({ success: true, data: interview });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to create interview' });
  }
};

export const updateInterview = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.interview.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Interview not found' });
    if (existing.job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const parsed = updateInterviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.date) data.date = new Date(parsed.data.date);

    const interview = await prisma.interview.update({ where: { id }, data });
    return res.status(200).json({ success: true, data: interview });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to update interview' });
  }
};

export const deleteInterview = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const id = req.params.id as string;
    const existing = await prisma.interview.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Interview not found' });
    if (existing.job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    await prisma.interview.delete({ where: { id } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to delete interview' });
  }
};