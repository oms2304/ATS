import { Router } from 'express';
import { checkOwnership } from '../middleware/ownership.middleware';
import { uploadMiddleware, uploadErrorHandler } from '../middleware/upload.middleware';
import {
  getDocuments,
  createDocument,
  getDocumentById,
  deleteDocument,
  updateDocumentMeta,
  getDocumentVersions,
  archiveDocument,
  restoreDocument,
  duplicateDocument,
  linkDocumentToJob,
  unlinkDocumentFromJob,
  uploadDocument,
} from '../controllers/documents.controller';
const router = Router();
router.get('/', getDocuments);
router.post('/', createDocument);
router.post('/upload', uploadMiddleware, uploadDocument, uploadErrorHandler);
router.get('/:id', checkOwnership('document'), getDocumentById);
router.patch('/:id', checkOwnership('document'), updateDocumentMeta);
router.delete('/:id', checkOwnership('document'), deleteDocument);
router.get('/:id/versions', checkOwnership('document'), getDocumentVersions);
router.patch('/:id/archive', checkOwnership('document'), archiveDocument);
router.patch('/:id/restore', checkOwnership('document'), restoreDocument);
router.post('/:id/duplicate', checkOwnership('document'), duplicateDocument);
router.put('/jobs/:jobId/link', linkDocumentToJob);
router.delete('/jobs/:jobId/link/:type', unlinkDocumentFromJob);

export default router;
