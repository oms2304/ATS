import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import {
  createDocumentSchema,
  updateDocumentMetaSchema,
  linkDocumentSchema,
} from '../schemas/document.schema';
import {
  uploadFile,
  ensureBucketExists,
  parseOwnedObjectPath,
  downloadObject,
  copyObject,
  deleteObject,
  StorageServiceError,
} from '../lib/storage';
import logger from '../lib/logger';

// S3-004: Upload a file (PDF/DOCX/TXT) as a new Document + initial DocumentVersion.
// Storage is Supabase Storage (private bucket); the file URL is a path reference,
// and the existing download route (S3-005) enforces ownership before serving bytes.
export async function uploadDocument(req: Request, res: Response) {
  let uploadedPath: string | undefined;
  let databaseCommitted = false;
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: { file: ['A file is required'] },
      });
    }

    const { type, title } = req.body;
    if (!type || !['resume', 'cover_letter'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: { type: ['type must be resume or cover_letter'] },
      });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: { title: ['Title is required'] },
      });
    }

    await ensureBucketExists();

    const uploaded = await uploadFile(
      userId,
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype
    );
    uploadedPath = uploaded.path;

    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: { user_id: userId, type, title: String(title).trim() },
      });
      const version = await tx.documentVersion.create({
        data: {
          document_id: document.id,
          version_number: 1,
          label: 'Uploaded file',
          fileUrl: uploaded.signedUrl,
          fileName: req.file!.originalname,
          mimeType: req.file!.mimetype,
          fileSize: req.file!.size,
        },
      });
      return { document, version };
    });
    databaseCommitted = true;

    return res.status(201).json({
      success: true,
      data: { ...result.document, version: result.version },
    });
  } catch (error) {
    if (uploadedPath && !databaseCommitted) {
      try {
        await deleteObject(uploadedPath);
      } catch (cleanupError) {
        logger.warn('upload_cleanup_failed', {
          path: uploadedPath,
          error:
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError),
        });
      }
    }
    logger.error('upload_document_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(error instanceof StorageServiceError ? 503 : 500).json({
      success: false,
      error:
        error instanceof StorageServiceError
          ? 'Storage is unavailable'
          : 'Failed to upload document',
    });
  }
}

// List the current user's saved documents. When ?jobId= is supplied, returns the
// documents linked to that job (after verifying the job belongs to the user).
export async function getDocuments(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.query.jobId ? String(req.query.jobId) : undefined;

    if (jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job)
        return res.status(404).json({ success: false, error: 'Job not found' });
      if (job.user_id !== userId)
        return res.status(403).json({ success: false, error: 'Access denied' });

      const links = await prisma.jobDocumentLink.findMany({
        where: { job_id: jobId },
        include: { document: true, document_version: true },
      });
      const data = links.map((link) => ({
        id: link.document.id,
        type: link.type,
        title: link.document.title,
        content: link.document_version.content,
        versionId: link.document_version.id,
        versionNumber: link.document_version.version_number,
        label: link.document_version.label,
        fileName: link.document_version.fileName,
        mimeType: link.document_version.mimeType,
        fileSize: link.document_version.fileSize,
        hasFile: !!link.document_version.fileUrl,
        jobId: link.job_id,
        updatedAt: link.document.updatedAt,
        status: link.document.status,
        tags: link.document.tags,
        archivedAt: link.document.archivedAt,
      }));
      return res.status(200).json({ success: true, data });
    }

    const archiveScope = String(req.query.archived ?? 'false');
    if (!['false', 'true', 'all'].includes(archiveScope)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: { archived: ['archived must be false, true, or all'] },
      });
    }

    const documents = await prisma.document.findMany({
      where: {
        user_id: userId,
        ...(archiveScope === 'all'
          ? {}
          : archiveScope === 'true'
            ? { archivedAt: { not: null } }
            : { archivedAt: null }),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: { orderBy: { version_number: 'desc' }, take: 1 },
        jobs: { include: { job: true } },
      },
    });
    const data = documents.map((doc) => {
      const latest = doc.versions[0];
      const link = doc.jobs[0];
      return {
        id: doc.id,
        type: doc.type,
        title: doc.title,
        content: latest?.content ?? null,
        versionId: latest?.id ?? null,
        versionNumber: latest?.version_number ?? 1,
        label: latest?.label ?? null,
        fileName: latest?.fileName ?? null,
        mimeType: latest?.mimeType ?? null,
        fileSize: latest?.fileSize ?? null,
        hasFile: !!latest?.fileUrl,
        updatedAt: doc.updatedAt,
        status: doc.status,
        tags: doc.tags,
        archivedAt: doc.archivedAt,
        job: link?.job
          ? {
              id: link.job.id,
              title: link.job.title,
              company: link.job.company,
            }
          : null,
      };
    });
    return res.status(200).json({ success: true, data });
  } catch {
    return res
      .status(500)
      .json({ success: false, error: 'Failed to fetch documents' });
  }
}

// Save a generated/edited draft as a document record linked to a job (S2-024).
// One document is kept per (job, type); re-saving adds a new version and repoints
// the job link at it. Ownership of the target job is enforced (S2-BR-021).
export async function createDocument(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });

    const parsed = createDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }
    const { jobId, type, title, content } = parsed.data;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job)
      return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== userId)
      return res.status(403).json({ success: false, error: 'Access denied' });

    const existingLink = await prisma.jobDocumentLink.findUnique({
      where: { job_id_type: { job_id: jobId, type } },
    });

    if (existingLink) {
      const latest = await prisma.documentVersion.findFirst({
        where: { document_id: existingLink.document_id },
        orderBy: { version_number: 'desc' },
      });
      const version = await prisma.documentVersion.create({
        data: {
          document_id: existingLink.document_id,
          version_number: (latest?.version_number ?? 0) + 1,
          label: 'Saved revision',
          content,
        },
      });
      await prisma.jobDocumentLink.update({
        where: { id: existingLink.id },
        data: { document_version_id: version.id },
      });
      const document = await prisma.document.update({
        where: { id: existingLink.document_id },
        data: { title },
      });
      return res
        .status(200)
        .json({ success: true, data: { ...document, content } });
    }

    const document = await prisma.document.create({
      data: { user_id: userId, type, title },
    });
    const version = await prisma.documentVersion.create({
      data: {
        document_id: document.id,
        version_number: 1,
        label: 'Initial draft',
        content,
      },
    });
    await prisma.jobDocumentLink.create({
      data: {
        job_id: jobId,
        document_id: document.id,
        document_version_id: version.id,
        type,
      },
    });
    return res
      .status(201)
      .json({ success: true, data: { ...document, content } });
  } catch {
    return res
      .status(500)
      .json({ success: false, error: 'Failed to save document' });
  }
}

export async function getDocumentById(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    const document = await prisma.document.findUnique({
      where: { id: req.params.id as string },
      include: {
        versions: { orderBy: { version_number: 'desc' }, take: 1 },
      },
    });
    if (!document)
      return res
        .status(404)
        .json({ success: false, error: 'Document not found' });
    return res.status(200).json({ success: true, data: document });
  } catch {
    return res
      .status(500)
      .json({ success: false, error: 'Failed to fetch document' });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    const existing = await prisma.document.findUnique({
      where: { id: req.params.id as string },
      include: { versions: true },
    });
    if (!existing)
      return res
        .status(404)
        .json({ success: false, error: 'Document not found' });
    await prisma.document.delete({ where: { id: req.params.id as string } });

    for (const version of existing.versions) {
      if (!version.fileUrl) continue;
      try {
        const path = parseOwnedObjectPath(version.fileUrl, userId);
        await deleteObject(path);
      } catch (error) {
        logger.warn('document_storage_cleanup_failed', {
          documentId: existing.id,
          versionId: version.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return res
      .status(200)
      .json({ success: true, data: { message: 'Document deleted' } });
  } catch {
    return res
      .status(500)
      .json({ success: false, error: 'Failed to delete document' });
  }
}

export async function updateDocumentMeta(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });

    const parsed = updateDocumentMetaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const document = await prisma.document.findUnique({
      where: { id: req.params.id as string },
    });
    if (!document)
      return res
        .status(404)
        .json({ success: false, error: 'Document not found' });
    if (document.user_id !== userId)
      return res.status(403).json({ success: false, error: 'Access denied' });

    const updateData = {
      ...parsed.data,
      ...(parsed.data.status === 'archived'
        ? { archivedAt: document.archivedAt ?? new Date() }
        : parsed.data.status === 'active'
          ? { archivedAt: null }
          : {}),
    };

    const updated = await prisma.document.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('updateDocumentMeta error:', error);
    return res
      .status(500)
      .json({ success: false, error: 'Failed to update document' });
  }
}

export async function getDocumentVersions(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });

    const document = await prisma.document.findUnique({
      where: { id: req.params.id as string },
    });
    if (!document)
      return res
        .status(404)
        .json({ success: false, error: 'Document not found' });
    if (document.user_id !== userId)
      return res.status(403).json({ success: false, error: 'Access denied' });

    const versions = await prisma.documentVersion.findMany({
      where: { document_id: req.params.id as string },
      orderBy: { version_number: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: versions.map((version) => ({
        id: version.id,
        document_id: version.document_id,
        version_number: version.version_number,
        label: version.label,
        fileName: version.fileName,
        mimeType: version.mimeType,
        fileSize: version.fileSize,
        content: version.content,
        createdAt: version.createdAt,
      })),
    });
  } catch (error) {
    console.error('getDocumentVersions error:', error);
    return res
      .status(500)
      .json({ success: false, error: 'Failed to get versions' });
  }
}

export async function archiveDocument(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await prisma.document.findFirst({
      where: { id: req.params.id as string, user_id: userId },
    });
    if (!existing)
      return res
        .status(404)
        .json({ success: false, error: 'Document not found' });
    if (existing.archivedAt)
      return res
        .status(409)
        .json({ success: false, error: 'Document is already archived' });

    const document = await prisma.document.update({
      where: { id: req.params.id as string },
      data: { archivedAt: new Date(), status: 'archived' },
    });

    return res.status(200).json({ success: true, data: document });
  } catch {
    return res
      .status(500)
      .json({ success: false, error: 'Failed to archive document' });
  }
}

export async function restoreDocument(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await prisma.document.findFirst({
      where: { id: req.params.id as string, user_id: userId },
    });
    if (!existing)
      return res
        .status(404)
        .json({ success: false, error: 'Document not found' });
    if (!existing.archivedAt)
      return res
        .status(409)
        .json({ success: false, error: 'Document is not archived' });

    const document = await prisma.document.update({
      where: { id: req.params.id as string },
      data: { archivedAt: null, status: 'active' },
    });

    return res.status(200).json({ success: true, data: document });
  } catch {
    return res
      .status(500)
      .json({ success: false, error: 'Failed to restore document' });
  }
}

// S3-007: Duplicate a document. Creates a new Document + a single DocumentVersion
// copied from the source document's latest version. The duplicate always starts
// active (not archived) and is not linked to any job — job links are per-type and
// cardinality-constrained (S3-BR-010), so a duplicate can't silently inherit them.
export async function duplicateDocument(req: Request, res: Response) {
  let copiedPath: string | undefined;
  let databaseCommitted = false;
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await prisma.document.findFirst({
      where: { id: req.params.id as string, user_id: userId },
    });
    if (!existing)
      return res
        .status(404)
        .json({ success: false, error: 'Document not found' });

    const latestVersion = await prisma.documentVersion.findFirst({
      where: { document_id: existing.id },
      orderBy: { version_number: 'desc' },
    });
    if (!latestVersion) {
      return res.status(400).json({
        success: false,
        error: 'Document has no versions to duplicate',
      });
    }

    let copiedFileUrl: string | null = null;
    if (latestVersion.fileUrl) {
      const sourcePath = parseOwnedObjectPath(latestVersion.fileUrl, userId);
      const copied = await copyObject(userId, sourcePath);
      copiedPath = copied.path;
      copiedFileUrl = copied.signedUrl;
    }

    const result = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.document.create({
        data: {
          user_id: userId,
          type: existing.type,
          title: `${existing.title} (Copy)`,
          status: 'active',
          tags: existing.tags,
          archivedAt: null,
        },
      });
      const version = await tx.documentVersion.create({
        data: {
          document_id: duplicate.id,
          version_number: 1,
          label: latestVersion.label,
          content: latestVersion.content,
          fileUrl: copiedFileUrl,
          fileName: latestVersion.fileName,
          mimeType: latestVersion.mimeType,
          fileSize: latestVersion.fileSize,
        },
      });
      return { duplicate, version };
    });
    databaseCommitted = true;

    return res.status(201).json({
      success: true,
      data: {
        ...result.duplicate,
        content: result.version.content,
        versionId: result.version.id,
        versionNumber: result.version.version_number,
        label: result.version.label,
        fileName: result.version.fileName,
        mimeType: result.version.mimeType,
        fileSize: result.version.fileSize,
        hasFile: !!result.version.fileUrl,
        job: null,
      },
    });
  } catch (error) {
    if (copiedPath && !databaseCommitted) {
      try {
        await deleteObject(copiedPath);
      } catch (cleanupError) {
        logger.warn('duplicate_storage_cleanup_failed', {
          path: copiedPath,
          error:
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError),
        });
      }
    }
    logger.error('duplicate_document_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ success: false, error: 'Failed to duplicate document' });
  }
}

type DownloadableVersion = {
  id: string;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  content: string | null;
};

function safeDownloadName(value: string): string {
  const cleaned = value
    .replace(/[\r\n]/g, '')
    .replace(/[\\/]/g, '_')
    .replace(/[";]/g, '')
    .trim()
    .slice(0, 180);
  return cleaned || 'document';
}

async function sendVersionDownload(
  res: Response,
  userId: string,
  documentTitle: string,
  version: DownloadableVersion
) {
  let body: Buffer;
  let mimeType: string;
  let filename: string;

  if (version.fileUrl) {
    const path = parseOwnedObjectPath(version.fileUrl, userId);
    body = await downloadObject(path);
    mimeType = version.mimeType || 'application/octet-stream';
    filename = safeDownloadName(version.fileName || documentTitle);
  } else if (version.content !== null) {
    body = Buffer.from(version.content, 'utf8');
    mimeType = 'text/plain; charset=utf-8';
    const title = safeDownloadName(documentTitle);
    filename = title.toLowerCase().endsWith('.txt') ? title : `${title}.txt`;
  } else {
    return res.status(404).json({
      success: false,
      error: 'Document version has no downloadable content',
    });
  }

  const asciiName = filename.replace(/[^\x20-\x7e]/g, '_');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', String(body.length));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  return res.status(200).send(body);
}

function sendDownloadFailure(res: Response, error: unknown) {
  logger.error('document_download_failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  return res.status(error instanceof StorageServiceError ? 503 : 500).json({
    success: false,
    error:
      error instanceof StorageServiceError
        ? 'Storage is unavailable'
        : 'Failed to download document',
  });
}

export async function downloadDocument(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const document = await prisma.document.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, title: true },
    });
    if (!document) {
      return res
        .status(404)
        .json({ success: false, error: 'Document not found' });
    }
    const version = await prisma.documentVersion.findFirst({
      where: { document_id: document.id },
      orderBy: { version_number: 'desc' },
    });
    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Document has no versions',
      });
    }
    return await sendVersionDownload(res, userId, document.title, version);
  } catch (error) {
    return sendDownloadFailure(res, error);
  }
}

export async function downloadDocumentVersion(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const document = await prisma.document.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, title: true },
    });
    if (!document) {
      return res
        .status(404)
        .json({ success: false, error: 'Document not found' });
    }
    const version = await prisma.documentVersion.findFirst({
      where: {
        id: req.params.versionId as string,
        document_id: document.id,
      },
    });
    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Document version not found',
      });
    }
    return await sendVersionDownload(res, userId, document.title, version);
  } catch (error) {
    return sendDownloadFailure(res, error);
  }
}

// Link an existing library document to a job (S3-009). Enforces S3-BR-010
// (one resume + one cover letter per job) and S3-BR-011 (confirmation required
// before replacing an existing link) — mirrors the confirmedOverride pattern
// used for job stage transitions.
export async function linkDocumentToJob(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job)
      return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== userId)
      return res.status(403).json({ success: false, error: 'Access denied' });

    const parsed = linkDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: parsed.error.flatten().fieldErrors,
      });
    }
    const { documentId, type, confirmedReplace } = parsed.data;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document)
      return res
        .status(404)
        .json({ success: false, error: 'Document not found' });
    if (document.user_id !== userId)
      return res.status(403).json({ success: false, error: 'Access denied' });

    const latestVersion = await prisma.documentVersion.findFirst({
      where: { document_id: documentId },
      orderBy: { version_number: 'desc' },
    });
    if (!latestVersion) {
      return res
        .status(400)
        .json({ success: false, error: 'Document has no versions to link' });
    }

    const existingLink = await prisma.jobDocumentLink.findUnique({
      where: { job_id_type: { job_id: jobId, type } },
      include: { document: true },
    });

    if (
      existingLink &&
      existingLink.document_id !== documentId &&
      !confirmedReplace
    ) {
      return res.status(409).json({
        success: false,
        error: 'A document is already linked for this type',
        existing: {
          documentId: existingLink.document_id,
          title: existingLink.document.title,
        },
      });
    }

    const link = existingLink
      ? await prisma.jobDocumentLink.update({
          where: { id: existingLink.id },
          data: {
            document_id: documentId,
            document_version_id: latestVersion.id,
          },
        })
      : await prisma.jobDocumentLink.create({
          data: {
            job_id: jobId,
            document_id: documentId,
            document_version_id: latestVersion.id,
            type,
          },
        });

    return res.status(200).json({ success: true, data: link });
  } catch {
    return res
      .status(500)
      .json({ success: false, error: 'Failed to link document' });
  }
}

// Unlink a document from a job by type (S3-009).
export async function unlinkDocumentFromJob(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, error: 'Unauthorized' });

    const jobId = req.params.jobId as string;
    const type = req.params.type as string;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job)
      return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.user_id !== userId)
      return res.status(403).json({ success: false, error: 'Access denied' });

    const existingLink = await prisma.jobDocumentLink.findUnique({
      where: { job_id_type: { job_id: jobId, type } },
    });
    if (!existingLink)
      return res
        .status(404)
        .json({ success: false, error: 'No document linked for this type' });

    await prisma.jobDocumentLink.delete({ where: { id: existingLink.id } });
    return res.status(204).send();
  } catch {
    return res
      .status(500)
      .json({ success: false, error: 'Failed to unlink document' });
  }
}
