import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import {
  getPrepNotes,
  createPrepNote,
  updatePrepNote,
  deletePrepNote,
} from '../controllers/prepnote.controller';

vi.mock('../lib/prisma', () => ({
  default: {
    job: {
      findUnique: vi.fn(),
    },
    prepNote: {
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
const fakePrepNote = {
  id: 'prepnote-1',
  job_id: 'job-1',
  category: 'talking_points',
  content: 'Mention my experience with TypeScript.',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPrepNotes', () => {
  it('should return prep notes for a job the user owns', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.prepNote.findMany).mockResolvedValue([fakePrepNote] as any);

    await getPrepNotes(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [fakePrepNote] });
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { jobId: 'job-1' } });
    const res = mockRes();

    await getPrepNotes(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 404 if job does not exist', async () => {
    const req = mockReq({ params: { jobId: 'job-999' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await getPrepNotes(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({ params: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'someone-else' } as any);

    await getPrepNotes(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('createPrepNote', () => {
  it('should create a prep note and return 201', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { category: 'talking_points', content: 'Mention my experience with TypeScript.' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);
    vi.mocked(prisma.prepNote.create).mockResolvedValue(fakePrepNote as any);

    await createPrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakePrepNote });
  });

  it('should return 400 if category is invalid', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { category: 'not_a_real_category', content: 'Some content' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);

    await createPrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, fields: expect.objectContaining({ category: expect.any(Array) }) })
    );
  });

  it('should return 400 if content is missing', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { category: 'talking_points' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any);

    await createPrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, fields: expect.objectContaining({ content: expect.any(Array) }) })
    );
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { category: 'talking_points', content: 'Some content' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'someone-else' } as any);

    await createPrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { jobId: 'job-1' }, body: {} });
    const res = mockRes();

    await createPrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 404 if job does not exist', async () => {
    const req = mockReq({
      params: { jobId: 'job-999' },
      body: { category: 'talking_points', content: 'Some content' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await createPrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('updatePrepNote', () => {
  it('should update a prep note and return 200', async () => {
    const req = mockReq({
      params: { id: 'prepnote-1' },
      body: { content: 'Updated content' },
    });
    const res = mockRes();
    vi.mocked(prisma.prepNote.findUnique).mockResolvedValue({ ...fakePrepNote, job: fakeJob } as any);
    vi.mocked(prisma.prepNote.update).mockResolvedValue({ ...fakePrepNote, content: 'Updated content' } as any);

    await updatePrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 404 if prep note not found', async () => {
    const req = mockReq({ params: { id: 'prepnote-999' }, body: { content: 'x' } });
    const res = mockRes();
    vi.mocked(prisma.prepNote.findUnique).mockResolvedValue(null);

    await updatePrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({ params: { id: 'prepnote-1' }, body: { content: 'x' } });
    const res = mockRes();
    vi.mocked(prisma.prepNote.findUnique).mockResolvedValue({
      ...fakePrepNote,
      job: { id: 'job-1', user_id: 'someone-else' },
    } as any);

    await updatePrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { id: 'prepnote-1' }, body: {} });
    const res = mockRes();

    await updatePrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('deletePrepNote', () => {
  it('should delete a prep note and return 204', async () => {
    const req = mockReq({ params: { id: 'prepnote-1' } });
    const res = mockRes();
    vi.mocked(prisma.prepNote.findUnique).mockResolvedValue({ ...fakePrepNote, job: fakeJob } as any);
    vi.mocked(prisma.prepNote.delete).mockResolvedValue(fakePrepNote as any);

    await deletePrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('should return 404 if prep note not found', async () => {
    const req = mockReq({ params: { id: 'prepnote-999' } });
    const res = mockRes();
    vi.mocked(prisma.prepNote.findUnique).mockResolvedValue(null);

    await deletePrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 403 if user does not own the job', async () => {
    const req = mockReq({ params: { id: 'prepnote-1' } });
    const res = mockRes();
    vi.mocked(prisma.prepNote.findUnique).mockResolvedValue({
      ...fakePrepNote,
      job: { id: 'job-1', user_id: 'someone-else' },
    } as any);

    await deletePrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 401 if unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { id: 'prepnote-1' } });
    const res = mockRes();

    await deletePrepNote(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});