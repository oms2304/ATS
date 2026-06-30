import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { createJobSchema, updateJobSchema } from '../schemas/job.schema';

// Canonical forward-only workflow (S2-BR-005 / C12). Each value is the set of
// stages a job is allowed to move to from the key stage. Rejected and Archived
// are terminal — an empty array means no forward move is allowed.
export const FORWARD_TRANSITIONS: Record<string, string[]> = {
  Interested: ['Applied', 'Rejected'],
  Applied: ['Interview', 'Rejected'],
  Interview: ['Offer', 'Rejected'],
  Offer: ['Rejected'],
  Rejected: [],
  Archived: [],
};

function isForwardTransition(from: string, to: string): boolean {
  return FORWARD_TRANSITIONS[from]?.includes(to) ?? false;
}

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

    const showArchived = req.query.archived === 'true';

    const rows = await prisma.job.findMany({
      where: {
        user_id,
        archivedAt: showArchived ? { not: null } : null,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Invariant: any row with archivedAt set is, by definition, archived.
    // Force the stage column to 'Archived' on the response so the frontend
    // always sees a consistent shape even if the underlying row was written
    // by an older code path (or by direct DB access) that didn't set stage.
    const jobs = rows.map((j) =>
      j.archivedAt && j.stage !== 'Archived' ? { ...j, stage: 'Archived' } : j
    );

    return res.status(200).json({ success: true, data: jobs });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
  }
};

export const getJobById = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const row = await prisma.job.findUnique({
      where: { id: req.params.id as string },
    });
    if (!row) return res.status(404).json({ success: false, error: 'Job not found' });

    // Invariant: any row with archivedAt set is, by definition, archived.
    const job =
      row.archivedAt && row.stage !== 'Archived'
        ? { ...row, stage: 'Archived' }
        : row;

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

    // Pick only the Job columns we actually want to write. `confirmedOverride`
    // is a request-side flag (S2-BR-007 / C12), not a Job column — spreading
    // it into prisma.job.update triggers an "Unknown argument" error on the
    // real DB and silently 500s. We read it from `parsed.data` for the
    // forward-transition guard below, then exclude it from the update.
    const { confirmedOverride, ...jobFields } = parsed.data;

    // Forward-transition guard runs BEFORE any DB write so a blocked
    // transition persists nothing (S2-BR-007 / C12). Leaving the Archived
    // stage is always allowed — any non-Archived target also un-archives
    // the job, so the user's intent ("move this out of the archive") is
    // unambiguous and we don't gate it behind the override prompt.
    if (parsed.data.stage && parsed.data.stage !== existing.stage) {
      const isForward = isForwardTransition(existing.stage, parsed.data.stage);
      const leavingArchive = existing.stage === 'Archived';

      if (!isForward && !leavingArchive && !confirmedOverride) {
        return res.status(422).json({
          success: false,
          error: 'Invalid stage transition',
          details: {
            from: existing.stage,
            to: parsed.data.stage,
            allowed: FORWARD_TRANSITIONS[existing.stage] ?? [],
            requiresConfirmation: true,
          },
        });
      }
    }

    // If the stage is changing to anything other than 'Archived' on a job
    // that is currently archived, clear archivedAt in the same write so the
    // row is consistent: stage in [Interested..Rejected] implies active.
    const willUnarchive =
      parsed.data.stage &&
      parsed.data.stage !== 'Archived' &&
      parsed.data.stage !== existing.stage &&
      existing.archivedAt;

    const job = await prisma.job.update({
      where: { id: req.params.id as string },
      data: {
        ...jobFields,
        updatedAt: new Date(),
        ...(willUnarchive ? { archivedAt: null } : {}),
      },
    });

    if (parsed.data.stage && parsed.data.stage !== existing.stage) {
      await prisma.stageTransition.create({
        data: {
          job_id: job.id,
          fromStage: existing.stage,
          toStage: parsed.data.stage,
        },
      });
      await prisma.jobActivity.create({
        data: {
          job_id: job.id,
          type: 'stage_change',
          note: willUnarchive
            ? `Stage changed from ${existing.stage} to ${parsed.data.stage} (unarchived)`
            : `Stage changed from ${existing.stage} to ${parsed.data.stage}`,
        },
      });
    }

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

// archive
export const archiveJob = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await prisma.job.findFirst({
      where: { id: req.params.id as string, user_id },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Job not found' });
    if (existing.archivedAt)
      return res.status(409).json({ success: false, error: 'Job is already archived' });

    const job = await prisma.job.update({
      where: { id: req.params.id as string },
      data: { archivedAt: new Date(), stage: 'Archived' },
    });

    return res.status(200).json({ success: true, data: job });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to archive job' });
  }
};

// restore
export const restoreJob = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await prisma.job.findFirst({
      where: { id: req.params.id as string, user_id },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Job not found' });
    if (!existing.archivedAt)
      return res.status(409).json({ success: false, error: 'Job is not archived' });

    const job = await prisma.job.update({
      where: { id: req.params.id as string },
      data: { archivedAt: null },
    });

    return res.status(200).json({ success: true, data: job });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to restore job' });
  }
};