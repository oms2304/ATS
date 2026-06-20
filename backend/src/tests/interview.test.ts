import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import {
  getFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
} from '../controllers/followup.controller';

vi.mock('../lib/prisma', () => ({
  default: {
    job: {
      findUnique: vi.fn(),
    },
    followUp: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

const fakeJob = { id: 'job-1', user_id: 'user-123' };
const fakeFollowUp = {
  id: 'followup-1',
  job_id: 'job-1',
  title: 'Send thank you email',
  dueDate: new Date('2026-07-05T09:00:00Z'),
  completed: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getFollowUps', () => {
  it('should return follow-ups for a job the user owns', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.followUp.findMany).mockResolvedValue([fakeFollowUp] as any);

    await getFollowUps(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [fakeFollowUp] });
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { jobId: 'job-1' } });
    const res = mockRes();

    await getFollowUps(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 404 if job does not exist', async () => {
    const req = mockReq({ params: { jobId: 'job-999' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await getFollowUps(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'someone-else' } as any);

    await getFollowUps(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('createFollowUp', () => {
  it('should create a follow-up and return 201', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { title: 'Send thank you email', dueDate: '2026-07-05T09:00:00.000Z' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.followUp.create).mockResolvedValue(fakeFollowUp as any);

    await createFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeFollowUp });
  });

  it('should return 400 if title is missing', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { dueDate: '2026-07-05T09:00:00.000Z' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);

    await createFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, fields: expect.objectContaining({ title: expect.any(Array) }) })
    );
  });

  it('should return 400 if dueDate is missing', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { title: 'Follow up' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);

    await createFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, fields: expect.objectContaining({ dueDate: expect.any(Array) }) })
    );
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { title: 'Follow up', dueDate: '2026-07-05T09:00:00.000Z' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'someone-else' } as any);

    await createFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { jobId: 'job-1' }, body: {} });
    const res = mockRes();

    await createFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('updateFollowUp', () => {
  it('should update a follow-up and return 200', async () => {
    const req = mockReq({
      params: { id: 'followup-1' },
      body: { completed: true },
    });
    const res = mockRes();
    vi.mocked(prisma.followUp.findUnique).mockResolvedValue({ ...fakeFollowUp, job: fakeJob } as any);
    vi.mocked(prisma.followUp.update).mockResolvedValue({ ...fakeFollowUp, completed: true } as any);

    await updateFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 404 if follow-up not found', async () => {
    const req = mockReq({ params: { id: 'followup-999' }, body: { completed: true } });
    const res = mockRes();
    vi.mocked(prisma.followUp.findUnique).mockResolvedValue(null);

    await updateFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({ params: { id: 'followup-1' }, body: { completed: true } });
    const res = mockRes();
    vi.mocked(prisma.followUp.findUnique).mockResolvedValue({
      ...fakeFollowUp,
      job: { id: 'job-1', user_id: 'someone-else' },
    } as any);

    await updateFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('deleteFollowUp', () => {
  it('should delete a follow-up and return 204', async () => {
    const req = mockReq({ params: { id: 'followup-1' } });
    const res = mockRes();
    vi.mocked(prisma.followUp.findUnique).mockResolvedValue({ ...fakeFollowUp, job: fakeJob } as any);
    vi.mocked(prisma.followUp.delete).mockResolvedValue(fakeFollowUp as any);

    await deleteFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('should return 404 if follow-up not found', async () => {
    const req = mockReq({ params: { id: 'followup-999' } });
    const res = mockRes();
    vi.mocked(prisma.followUp.findUnique).mockResolvedValue(null);

    await deleteFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({ params: { id: 'followup-1' } });
    const res = mockRes();
    vi.mocked(prisma.followUp.findUnique).mockResolvedValue({
      ...fakeFollowUp,
      job: { id: 'job-1', user_id: 'someone-else' },
    } as any);

    await deleteFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { id: 'followup-1' } });
    const res = mockRes();

    await deleteFollowUp(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});