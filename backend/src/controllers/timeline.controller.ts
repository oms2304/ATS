import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getTimeline = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== user_id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const [activities, interviews, followUps] = await Promise.all([
      prisma.jobActivity.findMany({ where: { job_id: jobId } }),
      prisma.interview.findMany({ where: { job_id: jobId } }),
      prisma.followUp.findMany({ where: { job_id: jobId } }),
    ]);

    const events = [
      // job created
      { type: 'created', date: job.createdAt, note: `Job added: ${job.title} at ${job.company}` },
      // stage changes
      ...activities.map((a) => ({ type: a.type, date: a.createdAt, note: a.note ?? '' })),
      // interviews
      ...interviews.map((i) => ({ type: 'interview', date: i.date, note: `${i.roundType} interview${i.notes ? ': ' + i.notes : ''}` })),
      // follow-ups
      ...followUps.map((f) => ({ type: 'followup', date: f.dueDate, note: `Follow-up: ${f.title}${f.completed ? ' (completed)' : ''}` })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return res.status(200).json({ success: true, data: events });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch timeline' });
  }
};