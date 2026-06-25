import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { getTimeline } from '../controllers/timeline.controller';

vi.mock('../lib/prisma', () => ({
  default: {
    job: {
      findUnique: vi.fn(),
    },
    jobActivity: {
      findMany: vi.fn(),
    },
    interview: {
      findMany: vi.fn(),
    },
    followUp: {
      findMany: vi.fn(),
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
  createdAt: new Date('2026-06-01T10:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getTimeline (S2-010)', () => {
  it('should return chronological events including created, stage changes, interviews, and follow-ups', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();

    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.jobActivity.findMany).mockResolvedValue([
      { id: 'a1', job_id: 'job-1', type: 'stage_change', note: 'Stage changed from Interested to Applied', createdAt: new Date('2026-06-05T10:00:00Z') },
    ] as any);
    vi.mocked(prisma.interview.findMany).mockResolvedValue([
      { id: 'i1', job_id: 'job-1', roundType: 'Technical', date: new Date('2026-06-10T14:00:00Z'), notes: 'System design' },
    ] as any);
    vi.mocked(prisma.followUp.findMany).mockResolvedValue([
      { id: 'f1', job_id: 'job-1', title: 'Send thank you', dueDate: new Date('2026-06-11T09:00:00Z'), completed: false },
    ] as any);

    await getTimeline(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const result = (res.json as any).mock.calls[0][0];
    expect(result.success).toBe(true);
    expect(result.data.length).toBe(4);
    const dates = result.data.map((e: any) => new Date(e.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it('should return just the created event when no other activity exists', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();

    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.jobActivity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.interview.findMany).mockResolvedValue([]);
    vi.mocked(prisma.followUp.findMany).mockResolvedValue([]);

    await getTimeline(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const result = (res.json as any).mock.calls[0][0];
    expect(result.data.length).toBe(1);
    expect(result.data[0].type).toBe('created');
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { jobId: 'job-1' } });
    const res = mockRes();

    await getTimeline(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 404 if job not found', async () => {
    const req = mockReq({ params: { jobId: 'job-999' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await getTimeline(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ ...fakeJob, user_id: 'someone-else' } as any);

    await getTimeline(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});