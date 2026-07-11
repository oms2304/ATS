import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  createDocument,
  getDocuments,
  updateDocumentMeta,
  getDocumentVersions,
  archiveDocument,
  restoreDocument,
  duplicateDocument,
  linkDocumentToJob,
  unlinkDocumentFromJob,
} from '../controllers/documents.controller';
import { checkOwnership } from '../middleware/ownership.middleware';

vi.mock('../lib/prisma', () => ({
  default: {
    job: { findUnique: vi.fn() },
    document: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    documentVersion: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    jobDocumentLink: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
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

  it('lists all of the user\'s documents with content and linked job when no jobId is given', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        type: 'cover_letter',
        title: 'Cover Letter',
        updatedAt: new Date(),
        versions: [{ content: 'Dear Hiring Team', version_number: 1 }],
        jobs: [{ job: { id: 'job-1', title: 'Engineer', company: 'Acme' } }],
      },
    ] as any);

    await getDocuments(req, res);

    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user_id: 'user-123' }),
      })
    );
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.data[0].content).toBe('Dear Hiring Team');
    expect(payload.data[0].job).toEqual({ id: 'job-1', title: 'Engineer', company: 'Acme' });
  });
});

describe('updateDocumentMeta (S3-002)', () => {
  it('updates the title and returns 200 (happy path)', async () => {
    const req = mockReq({
      params: { id: 'doc-1' },
      body: { title: 'New Title' },
    });
    const res = mockRes();
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: 'doc-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.document.update).mockResolvedValue({
      id: 'doc-1',
      user_id: 'user-123',
      type: 'resume',
      title: 'New Title',
      status: 'active',
      tags: [],
    } as any);

    await updateDocumentMeta(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { title: 'New Title' },
    });
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.title).toBe('New Title');
  });

  it("updates status to 'archived' and returns 200", async () => {
    const req = mockReq({
      params: { id: 'doc-1' },
      body: { status: 'archived' },
    });
    const res = mockRes();
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: 'doc-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.document.update).mockResolvedValue({
      id: 'doc-1',
      user_id: 'user-123',
      type: 'resume',
      title: 'My Resume',
      status: 'archived',
      tags: [],
    } as any);

    await updateDocumentMeta(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'archived' },
    });
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.data.status).toBe('archived');
  });

  it('updates tags and returns 200', async () => {
    const req = mockReq({
      params: { id: 'doc-1' },
      body: { tags: ['frontend', '2026'] },
    });
    const res = mockRes();
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: 'doc-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.document.update).mockResolvedValue({
      id: 'doc-1',
      user_id: 'user-123',
      type: 'resume',
      title: 'My Resume',
      status: 'active',
      tags: ['frontend', '2026'],
    } as any);

    await updateDocumentMeta(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { tags: ['frontend', '2026'] },
    });
  });

  it('returns 400 with field error when status is not a valid enum value', async () => {
    const req = mockReq({
      params: { id: 'doc-1' },
      body: { status: 'deleted' },
    });
    const res = mockRes();

    await updateDocumentMeta(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ status: expect.any(Array) }),
      })
    );
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('returns 400 when title is an empty string', async () => {
    const req = mockReq({
      params: { id: 'doc-1' },
      body: { title: '' },
    });
    const res = mockRes();

    await updateDocumentMeta(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('returns 403 when the document belongs to another user', async () => {
    const req = mockReq({
      params: { id: 'doc-1' },
      body: { title: 'New Title' },
    });
    const res = mockRes();
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: 'doc-1', user_id: 'someone-else' } as any);

    await updateDocumentMeta(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the document does not exist', async () => {
    const req = mockReq({
      params: { id: 'doc-missing' },
      body: { title: 'New Title' },
    });
    const res = mockRes();
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    await updateDocumentMeta(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    const req = mockReq({
      user: undefined,
      params: { id: 'doc-1' },
      body: { title: 'New Title' },
    });
    const res = mockRes();

    await updateDocumentMeta(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });
});

describe('getDocumentVersions (S3-003)', () => {
  it('returns versions ordered newest first (happy path)', async () => {
    const req = mockReq({ params: { id: 'doc-1' } });
    const res = mockRes();
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: 'doc-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.documentVersion.findMany).mockResolvedValue([
      { id: 'ver-3', document_id: 'doc-1', version_number: 3, label: 'Final', content: 'v3 content' },
      { id: 'ver-2', document_id: 'doc-1', version_number: 2, label: null, content: 'v2 content' },
      { id: 'ver-1', document_id: 'doc-1', version_number: 1, label: 'Initial', content: 'v1 content' },
    ] as any);

    await getDocumentVersions(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.documentVersion.findMany).toHaveBeenCalledWith({
      where: { document_id: 'doc-1' },
      orderBy: { version_number: 'desc' },
    });
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(3);
    expect(payload.data[0].version_number).toBe(3);
    expect(payload.data[2].version_number).toBe(1);
  });

  it('returns 403 when the document belongs to another user', async () => {
    const req = mockReq({ params: { id: 'doc-1' } });
    const res = mockRes();
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: 'doc-1', user_id: 'someone-else' } as any);

    await getDocumentVersions(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.documentVersion.findMany).not.toHaveBeenCalled();
  });

  it('returns 404 when the document does not exist', async () => {
    const req = mockReq({ params: { id: 'doc-missing' } });
    const res = mockRes();
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    await getDocumentVersions(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.documentVersion.findMany).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated (no token)', async () => {
    const req = mockReq({ user: undefined, params: { id: 'doc-1' } });
    const res = mockRes();

    await getDocumentVersions(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.documentVersion.findMany).not.toHaveBeenCalled();
  });
});

describe('S2-024 regression — createDocument defaults (S3-002)', () => {
  it('newly created documents still default to status: "active" and empty tags: []', async () => {
    const req = mockReq({ body: validBody });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.jobDocumentLink.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.document.create).mockResolvedValue({
      id: 'doc-1',
      user_id: 'user-123',
      type: 'resume',
      title: 'My Resume',
      status: 'active',
      tags: [],
    } as any);
    vi.mocked(prisma.documentVersion.create).mockResolvedValue({
      id: 'ver-1',
      document_id: 'doc-1',
      version_number: 1,
      content: validBody.content,
    } as any);
    vi.mocked(prisma.jobDocumentLink.create).mockResolvedValue({ id: 'link-1' } as any);

    await createDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe('active');
    expect(payload.data.tags).toEqual([]);
  });
});

describe('archiveDocument (S3-008)', () => {
  it('archives an active document: sets archivedAt and returns 200', async () => {
    const req = mockReq({ params: { id: 'doc-1' } });
    const res = mockRes();
    const existing = { id: 'doc-1', user_id: 'user-123', archivedAt: null };
    const archived = { id: 'doc-1', user_id: 'user-123', archivedAt: new Date() };
    vi.mocked(prisma.document.findFirst).mockResolvedValue(existing as any);
    vi.mocked(prisma.document.update).mockResolvedValue(archived as any);

    await archiveDocument(req, res);

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { archivedAt: expect.any(Date) },
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: archived });
  });

  it('does not delete or update any DocumentVersion when archiving (S3-BR-009)', async () => {
    const req = mockReq({ params: { id: 'doc-1' } });
    const res = mockRes();
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: 'doc-1',
      user_id: 'user-123',
      archivedAt: null,
    } as any);
    vi.mocked(prisma.document.update).mockResolvedValue({
      id: 'doc-1',
      archivedAt: new Date(),
    } as any);

    await archiveDocument(req, res);

    expect(prisma.documentVersion.delete).not.toHaveBeenCalled();
    expect(prisma.documentVersion.update).not.toHaveBeenCalled();
  });

  it('returns 409 when archiving an already-archived document', async () => {
    const req = mockReq({ params: { id: 'doc-1' } });
    const res = mockRes();
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: 'doc-1',
      user_id: 'user-123',
      archivedAt: new Date(),
    } as any);

    await archiveDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the document does not exist', async () => {
    const req = mockReq({ params: { id: 'doc-999' } });
    const res = mockRes();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    await archiveDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { id: 'doc-1' } });
    const res = mockRes();

    await archiveDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
  });
});

describe('restoreDocument (S3-008)', () => {
  it('restores an archived document: clears archivedAt and returns 200', async () => {
    const req = mockReq({ params: { id: 'doc-1' } });
    const res = mockRes();
    const existing = { id: 'doc-1', user_id: 'user-123', archivedAt: new Date() };
    const restored = { id: 'doc-1', user_id: 'user-123', archivedAt: null };
    vi.mocked(prisma.document.findFirst).mockResolvedValue(existing as any);
    vi.mocked(prisma.document.update).mockResolvedValue(restored as any);

    await restoreDocument(req, res);

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { archivedAt: null },
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: restored });
  });

  it('returns 409 when restoring a document that is not archived', async () => {
    const req = mockReq({ params: { id: 'doc-1' } });
    const res = mockRes();
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: 'doc-1',
      user_id: 'user-123',
      archivedAt: null,
    } as any);

    await restoreDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the document does not exist', async () => {
    const req = mockReq({ params: { id: 'doc-999' } });
    const res = mockRes();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    await restoreDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { id: 'doc-1' } });
    const res = mockRes();

    await restoreDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
  });
});

describe('document ownership (S3-008)', () => {
  it('returns 403 when archiving a document owned by another user (via checkOwnership)', async () => {
    const req = mockReq({ params: { id: 'doc-1' } });
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'doc-1',
      user_id: 'someone-else',
    } as any);

    await checkOwnership('document')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Access denied' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('getDocuments archive filtering (S3-008)', () => {
  it('default list (no ?archived= param) excludes archived documents', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.document.findMany).mockResolvedValue([] as any);

    await getDocuments(req, res);

    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'user-123',
          archivedAt: null,
        }),
      })
    );
  });

  it('?archived=true returns only archived documents', async () => {
    const req = mockReq({ query: { archived: 'true' } });
    const res = mockRes();
    vi.mocked(prisma.document.findMany).mockResolvedValue([] as any);

    await getDocuments(req, res);

    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'user-123',
          archivedAt: { not: null },
        }),
      })
    );
  });

  it('regression: default list still returns active documents with full S2-024 shape (content, job)', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.document.findMany).mockResolvedValue([
      {
        id: 'doc-1',
        type: 'cover_letter',
        title: 'Cover Letter',
        archivedAt: null,
        updatedAt: new Date(),
        versions: [{ content: 'Dear Hiring Team', version_number: 1 }],
        jobs: [{ job: { id: 'job-1', title: 'Engineer', company: 'Acme' } }],
      },
    ] as any);

    await getDocuments(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: 'user-123',
          archivedAt: null,
        }),
      })
    );
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].content).toBe('Dear Hiring Team');
    expect(payload.data[0].job).toEqual({ id: 'job-1', title: 'Engineer', company: 'Acme' });
  });
});

describe('duplicateDocument (S3-007)', () => {
  it('creates a new document and version copied from the source, titled with "(Copy)" suffix', async () => {
    const req = mockReq({ params: { id: 'doc-1' } });
    const res = mockRes();
    const source = {
      id: 'doc-1',
      user_id: 'user-123',
      type: 'resume',
      title: 'My Resume',
      status: 'active',
      tags: ['urgent'],
    };
    const latestVersion = { id: 'ver-1', document_id: 'doc-1', version_number: 2, content: 'Latest resume text' };
    const newDoc = { id: 'doc-2', user_id: 'user-123', type: 'resume', title: 'My Resume (Copy)', status: 'active', tags: ['urgent'] };
    const newVersion = { id: 'ver-2', document_id: 'doc-2', version_number: 1, content: 'Latest resume text' };

    vi.mocked(prisma.document.findFirst).mockResolvedValue(source as any);
    vi.mocked(prisma.documentVersion.findFirst).mockResolvedValue(latestVersion as any);
    vi.mocked(prisma.document.create).mockResolvedValue(newDoc as any);
    vi.mocked(prisma.documentVersion.create).mockResolvedValue(newVersion as any);

    await duplicateDocument(req, res);

    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        user_id: 'user-123',
        type: 'resume',
        title: 'My Resume (Copy)',
        status: 'active',
        tags: ['urgent'],
      },
    });
    expect(prisma.documentVersion.create).toHaveBeenCalledWith({
      data: {
        document_id: 'doc-2',
        version_number: 1,
        content: 'Latest resume text',
      },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { ...newDoc, content: 'Latest resume text' },
    });
  });

  it('duplicates a document with no existing version using null content', async () => {
    const req = mockReq({ params: { id: 'doc-1' } });
    const res = mockRes();
    const source = { id: 'doc-1', user_id: 'user-123', type: 'resume', title: 'Empty Doc', status: 'active', tags: [] };
    const newDoc = { id: 'doc-2', user_id: 'user-123', type: 'resume', title: 'Empty Doc (Copy)', status: 'active', tags: [] };
    const newVersion = { id: 'ver-2', document_id: 'doc-2', version_number: 1, content: null };

    vi.mocked(prisma.document.findFirst).mockResolvedValue(source as any);
    vi.mocked(prisma.documentVersion.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.document.create).mockResolvedValue(newDoc as any);
    vi.mocked(prisma.documentVersion.create).mockResolvedValue(newVersion as any);

    await duplicateDocument(req, res);

    expect(prisma.documentVersion.create).toHaveBeenCalledWith({
      data: {
        document_id: 'doc-2',
        version_number: 1,
        content: null,
      },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  // NON-HAPPY PATH: document not found
  it('returns 404 when the source document does not exist', async () => {
    const req = mockReq({ params: { id: 'doc-999' } });
    const res = mockRes();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    await duplicateDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  // NON-HAPPY PATH: unauthenticated
  it('returns 401 when unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { id: 'doc-1' } });
    const res = mockRes();

    await duplicateDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
  });

  // REGRESSION: ownership — duplicating another user's document must be blocked
  // by the user_id filter in findFirst, so it should behave exactly like "not found"
  it('does not duplicate a document owned by a different user (ownership enforced via findFirst filter)', async () => {
    const req = mockReq({ params: { id: 'doc-1' } });
    const res = mockRes();
    // findFirst is called with { id, user_id: userId }, so another user's doc
    // simply won't match and resolves to null — same 404 path as a missing doc.
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    await duplicateDocument(req, res);

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc-1', user_id: 'user-123' },
    });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
describe('linkDocumentToJob (S3-009)', () => {
  it('links an existing document to a job with no prior link (happy path)', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { documentId: 'doc-1', type: 'resume' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: 'doc-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.documentVersion.findFirst).mockResolvedValue({ id: 'ver-1', version_number: 1 } as any);
    vi.mocked(prisma.jobDocumentLink.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.jobDocumentLink.create).mockResolvedValue({ id: 'link-1', job_id: 'job-1', document_id: 'doc-1', type: 'resume' } as any);

    await linkDocumentToJob(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.jobDocumentLink.create).toHaveBeenCalledWith({
      data: { job_id: 'job-1', document_id: 'doc-1', document_version_id: 'ver-1', type: 'resume' },
    });
  });

  it('replaces an existing link when confirmedReplace is true', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { documentId: 'doc-2', type: 'resume', confirmedReplace: true },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: 'doc-2', user_id: 'user-123' } as any);
    vi.mocked(prisma.documentVersion.findFirst).mockResolvedValue({ id: 'ver-2', version_number: 1 } as any);
    vi.mocked(prisma.jobDocumentLink.findUnique).mockResolvedValue({
      id: 'link-1', document_id: 'doc-1', type: 'resume', document: { id: 'doc-1', title: 'Old Resume' },
    } as any);
    vi.mocked(prisma.jobDocumentLink.update).mockResolvedValue({ id: 'link-1', document_id: 'doc-2', type: 'resume' } as any);

    await linkDocumentToJob(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.jobDocumentLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { document_id: 'doc-2', document_version_id: 'ver-2' },
    });
  });

  it('returns 409 when replacing an existing link without confirmation (S3-BR-011)', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { documentId: 'doc-2', type: 'resume' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: 'doc-2', user_id: 'user-123' } as any);
    vi.mocked(prisma.documentVersion.findFirst).mockResolvedValue({ id: 'ver-2', version_number: 1 } as any);
    vi.mocked(prisma.jobDocumentLink.findUnique).mockResolvedValue({
      id: 'link-1', document_id: 'doc-1', type: 'resume', document: { id: 'doc-1', title: 'Old Resume' },
    } as any);

    await linkDocumentToJob(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.jobDocumentLink.update).not.toHaveBeenCalled();
  });

  it('returns 403 when the job belongs to another user (S3-BR-012)', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { documentId: 'doc-1', type: 'resume' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'someone-else' } as any);

    await linkDocumentToJob(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.jobDocumentLink.create).not.toHaveBeenCalled();
  });

  it('returns 403 when the document belongs to another user (S3-BR-012)', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { documentId: 'doc-1', type: 'resume' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ id: 'doc-1', user_id: 'someone-else' } as any);

    await linkDocumentToJob(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.jobDocumentLink.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the job does not exist', async () => {
    const req = mockReq({
      params: { jobId: 'job-999' },
      body: { documentId: 'doc-1', type: 'resume' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await linkDocumentToJob(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 404 when the document does not exist', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { documentId: 'doc-999', type: 'resume' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

    await linkDocumentToJob(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when body fails validation (bad type)', async () => {
    const req = mockReq({
      params: { jobId: 'job-1' },
      body: { documentId: 'doc-1', type: 'not_a_real_type' },
    });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);

    await linkDocumentToJob(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 401 when unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { jobId: 'job-1' }, body: {} });
    const res = mockRes();

    await linkDocumentToJob(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('unlinkDocumentFromJob (S3-009)', () => {
  it('unlinks a document from a job and returns 204 (happy path)', async () => {
    const req = mockReq({ params: { jobId: 'job-1', type: 'resume' } });
    const res = mockRes();
    (res as any).send = vi.fn().mockReturnValue(res);
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.jobDocumentLink.findUnique).mockResolvedValue({ id: 'link-1', job_id: 'job-1', type: 'resume' } as any);
    vi.mocked(prisma.jobDocumentLink.delete).mockResolvedValue({ id: 'link-1' } as any);

    await unlinkDocumentFromJob(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(prisma.jobDocumentLink.delete).toHaveBeenCalledWith({ where: { id: 'link-1' } });
  });

  it('returns 404 when no document is linked for that type', async () => {
    const req = mockReq({ params: { jobId: 'job-1', type: 'resume' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'user-123' } as any);
    vi.mocked(prisma.jobDocumentLink.findUnique).mockResolvedValue(null);

    await unlinkDocumentFromJob(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.jobDocumentLink.delete).not.toHaveBeenCalled();
  });

  it('returns 403 when the job belongs to another user (S3-BR-012)', async () => {
    const req = mockReq({ params: { jobId: 'job-1', type: 'resume' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: 'job-1', user_id: 'someone-else' } as any);

    await unlinkDocumentFromJob(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.jobDocumentLink.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when the job does not exist', async () => {
    const req = mockReq({ params: { jobId: 'job-999', type: 'resume' } });
    const res = mockRes();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await unlinkDocumentFromJob(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const req = mockReq({ user: undefined, params: { jobId: 'job-1', type: 'resume' } });
    const res = mockRes();

    await unlinkDocumentFromJob(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
