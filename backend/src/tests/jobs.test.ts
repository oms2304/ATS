import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { createJob, getJobs, getJobById, updateJob, deleteJob } from '../controllers/jobs.controller';

vi.mock('../lib/prisma', () => ({
  default: {
    job: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
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
    user: { id: 'user-123', email: 'test@test.com' },
    body: {},
    params: {},
    ...overrides,
  }) as any as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createJob', () => {
  it('should create a job and return 201', async () => {
    const req = mockReq({
      body: { title: 'Engineer', company: 'Acme', stage: 'APPLIED' },
    });
    const res = mockRes();
    const fakeJob = { id: 'job-1', title: 'Engineer', company: 'Acme', stage: 'APPLIED', userId: 'user-123' };
    vi.mocked(prisma.job.create).mockResolvedValue(fakeJob as any);

    await createJob(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeJob);
  });

  it('should return 400 if title is missing', async () => {
    const req = mockReq({ body: { company: 'Acme' } });
    const res = mockRes();

    await createJob(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();

    await createJob(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('getJobs', () => {
  it('should return jobs for authenticated user', async () => {
    const req = mockReq();
    const res = mockRes();
    const fakeJobs = [{ id: 'job-1', title: 'Engineer', userId: 'user-123' }];
    vi.mocked(prisma.job.findMany).mockResolvedValue(fakeJobs as any);

    await getJobs(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeJobs);
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();

    await getJobs(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('getJobById', () => {
  it('should return a job by id for owner', async () => {
    const req = mockReq({ params: { id: 'job-1' } });
    const res = mockRes();
    const fakeJob = { id: 'job-1', userId: 'user-123' };
    vi.mocked(prisma.job.findFirst).mockResolvedValue(fakeJob as any);

    await getJobById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 404 if job not found', async () => {
    const req = mockReq({ params: { id: 'job-999' } });
    const res = mockRes();
    vi.mocked(prisma.job.findFirst).mockResolvedValue(null);

    await getJobById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({ user: undefined, params: { id: 'job-1' } });
    const res = mockRes();

    await getJobById(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('updateJob', () => {
  it('should update a job and return 200', async () => {
    const req = mockReq({ params: { id: 'job-1' }, body: { title: 'Senior Engineer' } });
    const res = mockRes();
    const fakeJob = { id: 'job-1', userId: 'user-123', title: 'Senior Engineer' };
    vi.mocked(prisma.job.findFirst).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.job.update).mockResolvedValue(fakeJob as any);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 404 if job not found', async () => {
    const req = mockReq({ params: { id: 'job-999' }, body: { title: 'X' } });
    const res = mockRes();
    vi.mocked(prisma.job.findFirst).mockResolvedValue(null);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('deleteJob', () => {
  it('should delete a job and return 204', async () => {
    const req = mockReq({ params: { id: 'job-1' } });
    const res = mockRes();
    const fakeJob = { id: 'job-1', userId: 'user-123' };
    vi.mocked(prisma.job.findFirst).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.job.delete).mockResolvedValue(fakeJob as any);

    await deleteJob(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('should return 404 if job not found', async () => {
    const req = mockReq({ params: { id: 'job-999' } });
    const res = mockRes();
    vi.mocked(prisma.job.findFirst).mockResolvedValue(null);

    await deleteJob(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({ user: undefined, params: { id: 'job-1' } });
    const res = mockRes();

    await deleteJob(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
