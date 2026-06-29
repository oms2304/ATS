import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../lib/prisma', () => ({
  default: {
    job: { findUnique: vi.fn(), update: vi.fn() },
    stageTransition: { create: vi.fn() },
    jobActivity: { create: vi.fn() },
  },
}));

import { updateJob } from '../controllers/jobs.controller';
import prisma from '../lib/prisma';

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) =>
  ({ user: { userId: 'user-123' }, body: {}, params: { id: 'job-1' }, ...overrides }) as any as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Stage transition persistence (S2-026, S2-BR-009)', () => {
  it('records a StageTransition with from/to stages on a forward change (workflow integrity)', async () => {
    const req = mockReq({ body: { stage: 'Applied' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Interested' } as any);
    vi.mocked(prisma.job.update).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Applied' } as any);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.stageTransition.create).toHaveBeenCalledWith({
      data: { job_id: 'job-1', fromStage: 'Interested', toStage: 'Applied' },
    });
    // Stage change also propagates a timeline activity event.
    expect(prisma.jobActivity.create).toHaveBeenCalledWith({
      data: {
        job_id: 'job-1',
        type: 'stage_change',
        note: 'Stage changed from Interested to Applied',
      },
    });
  });

  it('records a transition for a non-forward (override) change as well', async () => {
    const req = mockReq({ body: { stage: 'Interested' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Offer' } as any);
    vi.mocked(prisma.job.update).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Interested' } as any);

    await updateJob(req, res);

    expect(prisma.stageTransition.create).toHaveBeenCalledWith({
      data: { job_id: 'job-1', fromStage: 'Offer', toStage: 'Interested' },
    });
  });

  it('does NOT record a transition when the stage is unchanged', async () => {
    const req = mockReq({ body: { title: 'New Title' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Applied' } as any);
    vi.mocked(prisma.job.update).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Applied' } as any);

    await updateJob(req, res);

    expect(prisma.stageTransition.create).not.toHaveBeenCalled();
    expect(prisma.jobActivity.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid stage value without recording a transition (invalid input)', async () => {
    const req = mockReq({ body: { stage: 'NotARealStage' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Applied' } as any);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.stageTransition.create).not.toHaveBeenCalled();
  });
});
