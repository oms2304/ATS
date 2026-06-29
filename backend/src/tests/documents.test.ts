import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import {
  createDocument,
  getDocuments,
} from '../controllers/documents.controller';

vi.mock('../lib/prisma', () => ({
  default: {
    job: { findUnique: vi.fn() },
    document: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    documentVersion: { create: vi.fn(), findFirst: vi.fn() },
    jobDocumentLink: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
import prisma from '../lib/prisma';

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) =>
  ({
    user: { userId: 'user-123', email: 'test@test.com' },
    body: {},
    params: {},
    query: {},
    ...overrides,
  }) as any as Request;

const validBody = {
  jobId: 'job-1',
  type: 'resume',
  title: 'My Resume',
  content: 'Generated resume text',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createDocument (S2-024)', () => {
  it('saves a new draft as a document linked to the job (happy path)', async () => {
    const req = mockReq({ body: validBody });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.jobDocumentLink.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.document.create).mockResolvedValue({ id: 'doc-1', user_id: 'user-123', type: 'resume', title: 'My Resume' } as any);
    vi.mocked(prisma.documentVersion.create).mockResolvedValue({ id: 'ver-1', document_id: 'doc-1', version_number: 1, content: validBody.content } as any);
    vi.mocked(prisma.jobDocumentLink.create).mockResolvedValue({ id: 'link-1' } as any);

    await createDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.jobDocumentLink.create).toHaveBeenCalledWith({
      data: {
        job_id: 'job-1',
        document_id: 'doc-1',
        document_version_id: 'ver-1',
        type: 'resume',
      },
    });
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.content).toBe(validBody.content);
  });

  it('adds a new version and repoints the link when re-saving the same type', async () => {
    const req = mockReq({ body: validBody });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.jobDocumentLink.findUnique).mockResolvedValue({ id: 'link-1', document_id: 'doc-1', type: 'resume' } as any);
    vi.mocked(prisma.documentVersion.findFirst).mockResolvedValue({ version_number: 1 } as any);
    vi.mocked(prisma.documentVersion.create).mockResolvedValue({ id: 'ver-2', document_id: 'doc-1', version_number: 2 } as any);
    vi.mocked(prisma.document.update).mockResolvedValue({ id: 'doc-1', title: 'My Resume' } as any);

    await createDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.documentVersion.create).toHaveBeenCalledWith({
      data: { document_id: 'doc-1', version_number: 2, content: validBody.content },
    });
    expect(prisma.jobDocumentLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { document_version_id: 'ver-2' },
    });
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('returns 403 and saves nothing when the job belongs to another user (S2-BR-021)', async () => {
    const req = mockReq({ body: validBody });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'someone-else' } as any);

    await createDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(prisma.jobDocumentLink.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the job does not exist', async () => {
    const req = mockReq({ body: validBody });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await createDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('returns 400 with a field error when content is missing', async () => {
    const req = mockReq({ body: { jobId: 'job-1', type: 'resume', title: 'My Resume' } });
    const res = mockRes();

    await createDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ content: expect.any(Array) }),
      })
    );
  });

  it('returns 401 when unauthenticated', async () => {
    const req = mockReq({ user: undefined, body: validBody });
    const res = mockRes();

    await createDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('getDocuments (S2-024)', () => {
  it('returns documents linked to a job the user owns (persisted state in view)', async () => {
    const req = mockReq({ query: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.jobDocumentLink.findMany).mockResolvedValue([
      {
        job_id: 'job-1',
        type: 'resume',
        document: { id: 'doc-1', title: 'My Resume', updatedAt: new Date() },
        document_version: { content: 'Generated resume text', version_number: 2 },
      },
    ] as any);

    await getDocuments(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].content).toBe('Generated resume text');
    expect(payload.data[0].type).toBe('resume');
  });

  it('returns 403 when requesting documents for another user\'s job (S2-BR-021)', async () => {
    const req = mockReq({ query: { jobId: 'job-1' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'someone-else' } as any);

    await getDocuments(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.jobDocumentLink.findMany).not.toHaveBeenCalled();
  });
});
