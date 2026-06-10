import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createJobSchema, updateJobSchema } from '../schemas/job.schema';

export const createJob = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    const job = await prisma.job.create({
      data: { ...parsed.data, user_id },
    });
    return res.status(201).json(job);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getJobs = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ error: 'Unauthorized' });
    const jobs = await prisma.job.findMany({
      where: { user_id },
      orderBy: { updatedAt: 'desc' },
    });
    return res.status(200).json(jobs);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getJobById = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ error: 'Unauthorized' });
    const job = await prisma.job.findUnique({
      where: { id: req.params.id as string },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.status(200).json(job);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateJob = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await prisma.job.findUnique({
      where: { id: req.params.id as string },
    });
    if (!existing) return res.status(404).json({ error: 'Job not found' });
    const parsed = updateJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    const job = await prisma.job.update({
      where: { id: req.params.id as string },
      data: { ...parsed.data, updatedAt: new Date() },
    });
    return res.status(200).json(job);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteJob = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await prisma.job.findUnique({
      where: { id: req.params.id as string },
    });
    if (!existing) return res.status(404).json({ error: 'Job not found' });
    await prisma.job.delete({ where: { id: req.params.id as string } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
