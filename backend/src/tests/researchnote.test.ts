import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import {
  getResearchNote,
  upsertResearchNote,
  deleteResearchNote,
} from '../controllers/researchnote.controller';

vi.mock('../lib/prisma', () => ({
  default: {
    job: {
      findUnique: vi.fn(),
    },
    researchNote: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
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
const fakeNote = {
  id: 'note-1',
  job_id: 'job-1',
  content: 'Company grew 40% YoY, focuses on healthcare SaaS.',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getResearchNote', () => {
  it('should return the research note for a job the user owns', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.researchNote.findUnique).mockResolvedValue(fakeNote as any);

    await getResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeNote });
  });

  it('should return 200 with null data if no note exists yet', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.researchNote.findUnique).mockResolvedValue(null);

    await getResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { jobId: 'job-1' } });
    const res = mockRes();

    await getResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 404 if job does not exist', async () => {
    const req = mockReq({ params: { jobId: 'job-999' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await getResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'someone-else' } as any);

    await getResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('upsertResearchNote', () => {
  it('should create a research note and return 200', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { content: 'Company grew 40% YoY, focuses on healthcare SaaS.' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.researchNote.upsert).mockResolvedValue(fakeNote as any);

    await upsertResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeNote });
  });

  it('should return 400 if content is missing', async () => {
    const req = mockReq({ params: { jobId: 'job-1' }, body: {} });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);

    await upsertResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, fields: expect.objectContaining({ content: expect.any(Array) }) })
    );
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({ params: { jobId: 'job-1' }, body: { content: 'x' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'someone-else' } as any);

    await upsertResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { jobId: 'job-1' }, body: {} });
    const res = mockRes();

    await upsertResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 404 if job does not exist', async () => {
    const req = mockReq({ params: { jobId: 'job-999' }, body: { content: 'x' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await upsertResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('deleteResearchNote', () => {
  it('should delete the research note and return 204', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.researchNote.findUnique).mockResolvedValue(fakeNote as any);
    vi.mocked(prisma.researchNote.delete).mockResolvedValue(fakeNote as any);

    await deleteResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('should return 404 if no research note exists', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.researchNote.findUnique).mockResolvedValue(null);

    await deleteResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'someone-else' } as any);

    await deleteResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { jobId: 'job-1' } });
    const res = mockRes();

    await deleteResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 404 if job does not exist', async () => {
    const req = mockReq({ params: { jobId: 'job-999' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await deleteResearchNote(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});