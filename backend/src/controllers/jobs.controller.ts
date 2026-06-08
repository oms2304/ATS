import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createJobSchema, updateJobSchema } from '../schemas/job.schema';

export const createJob = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    }

    const { title, company, stage, notes } = parsed.data;

    const job = await prisma.job.create({
      data: {
        title,
        company,
        stage,
        job_posting_body: notes ?? '',
        user_id: userId,
      },
    });

    return res.status(201).json(job);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getJobs = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const jobs = await prisma.job.findMany({
      where: { user_id: userId },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json(jobs);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getJobById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const job = await prisma.job.findFirst({
      where: { id: req.params.id as string, user_id: userId },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.status(200).json(job);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateJob = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.job.findFirst({
      where: { id: req.params.id as string, user_id: userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const parsed = updateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    }

    const { title, company, stage, notes } = parsed.data;

    const job = await prisma.job.update({
      where: { id: req.params.id as string },
      data: {
        ...(title !== undefined && { title }),
        ...(company !== undefined && { company }),
        ...(stage !== undefined && { stage }),
        ...(notes !== undefined && { job_posting_body: notes }),
        updatedAt: new Date(),
      },
    });

    return res.status(200).json(job);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteJob = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.job.findFirst({
      where: { id: req.params.id as string, user_id: userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await prisma.job.delete({ where: { id: req.params.id as string } });

    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
