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

  it('returns 422 on a backward (non-forward) transition (S2-BR-007 / C12)', async () => {
    const req = mockReq({ body: { stage: 'Applied' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Interview' } as any);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    const body = (res.json as any).mock.calls[0][0];
    expect(body).toMatchObject({
      success: false,
      error: 'Invalid stage transition',
      details: expect.objectContaining({
        from: 'Interview',
        to: 'Applied',
        allowed: ['Offer', 'Rejected'],
        requiresConfirmation: true,
      }),
    });
    expect(prisma.stageTransition.create).not.toHaveBeenCalled();
    expect(prisma.jobActivity.create).not.toHaveBeenCalled();
  });

  it('returns 422 with an empty allowed list when the current stage is terminal (Rejected)', async () => {
    const req = mockReq({ body: { stage: 'Interview' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Rejected' } as any);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    const body = (res.json as any).mock.calls[0][0];
    expect(body.details.allowed).toEqual([]);
    expect(prisma.stageTransition.create).not.toHaveBeenCalled();
    expect(prisma.jobActivity.create).not.toHaveBeenCalled();
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

  // Override path (S2-BR-007 / C12): when the frontend warning dialog has
  // captured explicit user confirmation, the controller must accept the
  // non-forward transition and still write the transition + activity rows.
  it('accepts a non-forward transition when confirmedOverride is true and records the change', async () => {
    const req = mockReq({ body: { stage: 'Applied', confirmedOverride: true } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Interview' } as any);
    vi.mocked(prisma.job.update).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Applied' } as any);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as any).mock.calls[0][0];
    expect(body).toMatchObject({ success: true, data: { stage: 'Applied' } });
    expect(prisma.stageTransition.create).toHaveBeenCalledWith({
      data: { job_id: 'job-1', fromStage: 'Interview', toStage: 'Applied' },
    });
    expect(prisma.jobActivity.create).toHaveBeenCalledWith({
      data: {
        job_id: 'job-1',
        type: 'stage_change',
        note: 'Stage changed from Interview to Applied',
      },
    });
  });

  it('does not require confirmedOverride on a forward transition', async () => {
    const req = mockReq({ body: { stage: 'Applied' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Interested' } as any);
    vi.mocked(prisma.job.update).mockResolvedValue({ id: 'job-1', user_id: 'user-123', stage: 'Applied' } as any);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.stageTransition.create).toHaveBeenCalled();
    expect(prisma.jobActivity.create).toHaveBeenCalled();
  });
});
