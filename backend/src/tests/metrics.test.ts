import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../lib/prisma', () => ({
  prisma: {
    job: { findMany: vi.fn() },
    stageTransition: { count: vi.fn(), findMany: vi.fn() },
  },
  default: {
    job: { findMany: vi.fn() },
    stageTransition: { count: vi.fn(), findMany: vi.fn() },
  },
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

// Default: no stage transitions unless a test overrides these.
function mockNoTransitions() {
  vi.mocked(prisma.stageTransition.count).mockResolvedValue(0 as any);
  vi.mocked(prisma.stageTransition.findMany).mockResolvedValue([] as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNoTransitions();
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

describe('getDashboardMetrics - S3-014 Velocity (S3-BR-013)', () => {
  it('returns the count of Interested->Applied transitions in the last 7 days', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.job.findMany).mockResolvedValue(jobsAt('Applied', 'Applied') as any);
    vi.mocked(prisma.stageTransition.count).mockResolvedValue(3 as any);

    await getDashboardMetrics(req, res);

    expect(prisma.stageTransition.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fromStage: 'Interested',
          toStage: 'Applied',
          changedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    );
    const { data } = (res.json as any).mock.calls[0][0];
    expect(data.velocity).toBe(3);
  });

  it('returns 0 velocity when the user has no jobs (skips the query, no divide-by-zero risk)', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.job.findMany).mockResolvedValue([] as any);

    await getDashboardMetrics(req, res);

    const { data } = (res.json as any).mock.calls[0][0];
    expect(data.velocity).toBe(0);
    expect(prisma.stageTransition.count).not.toHaveBeenCalled();
  });
});

describe('getDashboardMetrics - S3-014 Stage Conversion (S3-BR-014, S3-BR-015)', () => {
  it('computes conversion rate as percentage of Applied jobs that reached Interview within 14 days', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.job.findMany).mockResolvedValue(jobsAt('Interview', 'Interview', 'Applied', 'Applied') as any);

    const appliedAt1 = new Date('2024-01-01T00:00:00Z');
    const appliedAt2 = new Date('2024-01-05T00:00:00Z');
    const appliedAt3 = new Date('2024-01-10T00:00:00Z');
    const appliedAt4 = new Date('2024-01-15T00:00:00Z');

    (vi.mocked(prisma.stageTransition.findMany) as any).mockImplementation((args: any) => {
      if (args.where.toStage === 'Applied') {
        return Promise.resolve([
          { job_id: 'job-0', changedAt: appliedAt1 },
          { job_id: 'job-1', changedAt: appliedAt2 },
          { job_id: 'job-2', changedAt: appliedAt3 },
          { job_id: 'job-3', changedAt: appliedAt4 },
        ] as any);
      }
      if (args.where.toStage === 'Interview') {
        return Promise.resolve([
          // job-0 converts: 10 days after Applied (within 14)
          { job_id: 'job-0', changedAt: new Date(appliedAt1.getTime() + 10 * 24 * 60 * 60 * 1000) },
          // job-1 does NOT convert: 20 days after Applied (over 14)
          { job_id: 'job-1', changedAt: new Date(appliedAt2.getTime() + 20 * 24 * 60 * 60 * 1000) },
          // job-2 and job-3 never reach Interview
        ] as any);
      }
      return Promise.resolve([] as any);
    });

    await getDashboardMetrics(req, res);

    const { data } = (res.json as any).mock.calls[0][0];
    // 1 converted out of 4 Applied jobs = 25%
    expect(data.stageConversionRate).toBe(25);
  });

  it('returns 0 conversion rate when no jobs have reached Applied (no divide-by-zero)', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.job.findMany).mockResolvedValue(jobsAt('Interested') as any);

    await getDashboardMetrics(req, res);

    const { data } = (res.json as any).mock.calls[0][0];
    expect(data.stageConversionRate).toBe(0);
  });

  it('does not count a job converting more than 14 days after Applied', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.job.findMany).mockResolvedValue(jobsAt('Interview') as any);

    const appliedAt = new Date('2024-01-01T00:00:00Z');
    (vi.mocked(prisma.stageTransition.findMany) as any).mockImplementation((args: any) => {
      if (args.where.toStage === 'Applied') {
        return Promise.resolve([{ job_id: 'job-0', changedAt: appliedAt }] as any);
      }
      if (args.where.toStage === 'Interview') {
        // exactly 15 days later -> should NOT count
        return Promise.resolve([
          { job_id: 'job-0', changedAt: new Date(appliedAt.getTime() + 15 * 24 * 60 * 60 * 1000) },
        ] as any);
      }
      return Promise.resolve([] as any);
    });

    await getDashboardMetrics(req, res);

    const { data } = (res.json as any).mock.calls[0][0];
    expect(data.stageConversionRate).toBe(0);
  });

  it('scopes stage transition queries to the authenticated user\'s job IDs', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.job.findMany).mockResolvedValue(jobsAt('Applied') as any);

    await getDashboardMetrics(req, res);

    expect(prisma.stageTransition.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ job_id: { in: ['job-0'] } }) })
    );
  });

  // S3-BR-015: metrics reflect persisted historical events, not current job
  // state. Moving a job's stage backward (e.g. Applied -> Interested via a
  // confirmed override, S2-BR-007) creates a new transition record but does
  // NOT erase the original Interested->Applied transition — so velocity and
  // conversion numbers are stable history, not something a user can reset by
  // toggling a job's stage back and forth.
  it('does not erase a prior Interested->Applied transition from velocity when the job is later moved backward', async () => {
    const req = mockReq();
    const res = mockRes();
    // The job's *current* stage is back to Interested, but the historical
    // transition still exists and should still be counted.
    vi.mocked(prisma.job.findMany).mockResolvedValue(jobsAt('Interested') as any);
    vi.mocked(prisma.stageTransition.count).mockResolvedValue(1 as any);

    await getDashboardMetrics(req, res);

    const { data } = (res.json as any).mock.calls[0][0];
    expect(data.velocity).toBe(1);
  });
});
