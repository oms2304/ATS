import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createJobSchema, updateJobSchema } from '../schemas/job.schema';

export const createJob = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }
    const job = await prisma.job.create({
      data: { ...parsed.data, user_id },
    });
    return res.status(201).json({ success: true, data: job });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to create job' });
  }
};

export const getJobs = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const jobs = await prisma.job.findMany({
      where: { user_id },
      orderBy: { updatedAt: 'desc' },
    });
    return res.status(200).json({ success: true, data: jobs });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
  }
};

export const getJobById = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const job = await prisma.job.findUnique({
      where: { id: req.params.id as string },
    });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    return res.status(200).json({ success: true, data: job });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch job' });
  }
};

export const updateJob = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const existing = await prisma.job.findUnique({
      where: { id: req.params.id as string },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Job not found' });
    const parsed = updateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }
    const job = await prisma.job.update({
      where: { id: req.params.id as string },
      data: { ...parsed.data, updatedAt: new Date() },
    });
    return res.status(200).json({ success: true, data: job });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to update job' });
  }
};

export const deleteJob = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const existing = await prisma.job.findUnique({
      where: { id: req.params.id as string },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Job not found' });
    await prisma.job.delete({ where: { id: req.params.id as string } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to delete job' });
  }
};
