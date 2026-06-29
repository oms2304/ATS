import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../lib/prisma', () => ({
  prisma: { job: { findMany: vi.fn() } },
  default: { job: { findMany: vi.fn() } },
}));

import { getDashboardMetrics } from '../controllers/metrics.controller';
import { prisma } from '../lib/prisma';

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) =>
  ({ user: { userId: 'user-123' }, body: {}, params: {}, query: {}, ...overrides }) as any as Request;

const jobsAt = (...stages: string[]) => stages.map((stage, i) => ({ id: `job-${i}`, stage }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDashboardMetrics (S2-026, S2-BR-022/023)', () => {
  it('tallies stage counts from persisted jobs', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.job.findMany).mockResolvedValue(
      jobsAt('Interested', 'Interested', 'Applied', 'Interview', 'Offer', 'Rejected', 'Archived') as any
    );

    await getDashboardMetrics(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = (res.json as any).mock.calls[0][0];
    expect(data.stageCounts).toEqual({
      Interested: 2,
      Applied: 1,
      Interview: 1,
      Offer: 1,
      Rejected: 1,
      Archived: 1,
    });
    expect(data.totalJobs).toBe(7);
  });

  it('computes response tracking: applied excludes Interested, responded = Interview/Offer/Rejected', async () => {
    const req = mockReq();
    const res = mockRes();
    // 1 Interested (not applied), 1 Applied (applied, no response),
    // Interview + Offer + Rejected (applied AND responded) => applied=4, responded=3
    vi.mocked(prisma.job.findMany).mockResolvedValue(
      jobsAt('Interested', 'Applied', 'Interview', 'Offer', 'Rejected') as any
    );

    await getDashboardMetrics(req, res);

    const { data } = (res.json as any).mock.calls[0][0];
    expect(data.totalApplied).toBe(4);
    expect(data.totalResponded).toBe(3);
    expect(data.responseRate).toBe(75); // round(3/4 * 100)
  });

  it('returns a 0 response rate when nothing has been applied to (no divide-by-zero)', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.job.findMany).mockResolvedValue(jobsAt('Interested', 'Interested') as any);

    await getDashboardMetrics(req, res);

    const { data } = (res.json as any).mock.calls[0][0];
    expect(data.totalApplied).toBe(0);
    expect(data.responseRate).toBe(0);
  });

  it('scopes the metrics query to the authenticated user (per-user ownership)', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.job.findMany).mockResolvedValue([] as any);

    await getDashboardMetrics(req, res);

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ user_id: 'user-123' }) })
    );
  });

  it('returns 401 when unauthenticated', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();

    await getDashboardMetrics(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
