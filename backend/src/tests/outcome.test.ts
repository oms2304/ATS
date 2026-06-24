import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { updateJob } from '../controllers/jobs.controller';

vi.mock('../lib/prisma', () => ({
  default: {
    job: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '../lib/prisma';

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) =>
  ({
    user: { userId: 'user-123', email: 'test@test.com' },
    body: {},
    params: {},
    ...overrides,
  }) as any as Request;

const fakeJob = {
  id: 'job-1',
  user_id: 'user-123',
  title: 'Engineer',
  company: 'Acme',
  jobPostingBody: 'We are hiring',
  stage: 'Rejected',
  outcomeNote: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('outcome tracking (S2-013)', () => {
  it('should save an outcome note on a Rejected job and return 200', async () => {
    const req = mockReq({
      params: { id: 'job-1' },
      body: { outcomeNote: 'Rejected after final round, poor culture fit feedback.' },
    });
    const res = mockRes();
    const updated = { ...fakeJob, outcomeNote: 'Rejected after final round, poor culture fit feedback.' };
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.job.update).mockResolvedValue(updated as any);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ outcomeNote: 'Rejected after final round, poor culture fit feedback.' }),
    });
  });

  it('should save an outcome note on an Offer job', async () => {
    const req = mockReq({
      params: { id: 'job-1' },
      body: { outcomeNote: 'Received offer, negotiating salary.' },
    });
    const res = mockRes();
    const offerJob = { ...fakeJob, stage: 'Offer' };
    const updated = { ...offerJob, outcomeNote: 'Received offer, negotiating salary.' };
    vi.mocked(prisma.job.findUnique).mockResolvedValue(offerJob as any);
    vi.mocked(prisma.job.update).mockResolvedValue(updated as any);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ outcomeNote: 'Received offer, negotiating salary.' }),
    });
  });

  it('should clear an outcome note when null is passed', async () => {
    const req = mockReq({
      params: { id: 'job-1' },
      body: { outcomeNote: null },
    });
    const res = mockRes();
    const jobWithNote = { ...fakeJob, outcomeNote: 'Old note' };
    const updated = { ...fakeJob, outcomeNote: null };
    vi.mocked(prisma.job.findUnique).mockResolvedValue(jobWithNote as any);
    vi.mocked(prisma.job.update).mockResolvedValue(updated as any);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ outcomeNote: null }),
    });
  });

  it('should return 404 if job not found', async () => {
    const req = mockReq({
      params: { id: 'job-999' },
      body: { outcomeNote: 'Some note' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({
      user: undefined,
      params: { id: 'job-1' },
      body: { outcomeNote: 'Some note' },
    });
    const res = mockRes();

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});