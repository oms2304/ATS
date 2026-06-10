import { Router } from 'express';
import { checkOwnership } from '../middleware/ownership.middleware';
import {
  getDocuments,
  createDocument,
  getDocumentById,
  deleteDocument,
} from '../controllers/documents.controller';

const router = Router();

router.get('/', getDocuments);
router.post('/', createDocument);
router.get('/:id', checkOwnership('document'), getDocumentById);
router.delete('/:id', checkOwnership('document'), deleteDocument);

export default router;
