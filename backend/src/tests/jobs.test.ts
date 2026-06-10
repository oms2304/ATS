import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createJob, getJobs, getJobById, updateJob, deleteJob } from '../controllers/jobs.controller';
import { checkOwnership } from '../middleware/ownership.middleware';

vi.mock('../lib/prisma', () => ({
  default: {
    job: {
      create: vi.fn(),
      findMany: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createJob', () => {
  it('should create a job and return 201', async () => {
    const req = mockReq({
      body: { title: 'Engineer', company: 'Acme', stage: 'Interested', jobPostingBody: 'We are hiring' },
    });
    const res = mockRes();
    const fakeJob = { id: 'job-1', title: 'Engineer', company: 'Acme', stage: 'Interested', user_id: 'user-123' };
    vi.mocked(prisma.job.create).mockResolvedValue(fakeJob as any);

    await createJob(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeJob });
  });

  it('should persist the userId from the token', async () => {
    const req = mockReq({
      body: { title: 'Engineer', company: 'Acme', jobPostingBody: 'We are hiring' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.create).mockResolvedValue({ id: 'job-1' } as any);

    await createJob(req, res);

    expect(prisma.job.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ user_id: 'user-123' }),
    });
  });

  it('should return 400 with a field error if title is missing', async () => {
    const req = mockReq({ body: { company: 'Acme', jobPostingBody: 'We are hiring' } });
    const res = mockRes();

    await createJob(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ title: expect.any(Array) }),
      })
    );
  });

  it('should return 400 with a field error if company is missing', async () => {
    const req = mockReq({ body: { title: 'Engineer', jobPostingBody: 'We are hiring' } });
    const res = mockRes();

    await createJob(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ company: expect.any(Array) }),
      })
    );
  });

  it('should return 400 with a field error if jobPostingBody is missing', async () => {
    const req = mockReq({ body: { title: 'Engineer', company: 'Acme' } });
    const res = mockRes();

    await createJob(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ jobPostingBody: expect.any(Array) }),
      })
    );
  });

  it('should return 400 if title is an empty string', async () => {
    const req = mockReq({
      body: { title: '', company: 'Acme', jobPostingBody: 'We are hiring' },
    });
    const res = mockRes();

    await createJob(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ title: expect.any(Array) }),
      })
    );
  });

  it('should default the stage to Interested when not provided', async () => {
    const req = mockReq({
      body: { title: 'Engineer', company: 'Acme', jobPostingBody: 'We are hiring' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.create).mockResolvedValue({ id: 'job-1' } as any);

    await createJob(req, res);

    expect(prisma.job.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ stage: 'Interested' }),
    });
  });

  it('should ignore extra fields in the request body', async () => {
    const req = mockReq({
      body: {
        title: 'Engineer',
        company: 'Acme',
        jobPostingBody: 'We are hiring',
        hacker: 'should be stripped',
        user_id: 'spoofed-user',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.job.create).mockResolvedValue({ id: 'job-1' } as any);

    await createJob(req, res);

    const createArg = vi.mocked(prisma.job.create).mock.calls[0][0] as any;
    expect(createArg.data).not.toHaveProperty('hacker');
    expect(createArg.data.user_id).toBe('user-123');
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
    const fakeJobs = [{ id: 'job-1', title: 'Engineer', user_id: 'user-123' }];
    vi.mocked(prisma.job.findMany).mockResolvedValue(fakeJobs as any);

    await getJobs(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeJobs });
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
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);

    await getJobById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 404 if job not found', async () => {
    const req = mockReq({ params: { id: 'job-999' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

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
  it('should update a job and return 200 with the updated data', async () => {
    const req = mockReq({ params: { id: 'job-1' }, body: { title: 'Senior Engineer' } });
    const res = mockRes();
    const existing = { id: 'job-1', user_id: 'user-123', title: 'Engineer' };
    const updated = { id: 'job-1', user_id: 'user-123', title: 'Senior Engineer' };
    vi.mocked(prisma.job.findUnique).mockResolvedValue(existing as any);
    vi.mocked(prisma.job.update).mockResolvedValue(updated as any);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ title: 'Senior Engineer' }),
    });
  });

  it('should return 404 if job not found', async () => {
    const req = mockReq({ params: { id: 'job-999' }, body: { title: 'X' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await updateJob(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('job ownership', () => {
  const mockNext = () => vi.fn() as unknown as NextFunction;

  it('should block updating another user\'s job with 403', async () => {
    const req = mockReq({ params: { id: 'job-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      id: 'job-1',
      user_id: 'someone-else',
    } as any);

    await checkOwnership('job')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Access denied' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('deleteJob', () => {
  it('should delete a job and return 204', async () => {
    const req = mockReq({ params: { id: 'job-1' } });
    const res = mockRes();
    const fakeJob = { id: 'job-1', userId: 'user-123' };
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.job.delete).mockResolvedValue(fakeJob as any);

    await deleteJob(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('should return 404 if job not found', async () => {
    const req = mockReq({ params: { id: 'job-999' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

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
