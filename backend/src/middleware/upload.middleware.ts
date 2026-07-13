import { Request, Response, NextFunction, RequestHandler } from 'express';
import multer, { MulterError } from 'multer';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('UNSUPPORTED_FORMAT'));
    }
    cb(null, true);
  },
});

export const uploadMiddleware: RequestHandler = (req, res, next) => {
  multerInstance.single('file')(req, res, (err) => {
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(new Error('FILE_TOO_LARGE'));
    }
    return next(err);
  });
};

export function uploadErrorHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err?.message === 'UNSUPPORTED_FORMAT') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      fields: { file: ['Only PDF, DOCX, and TXT files are supported'] },
    });
  }
  if (err?.message === 'FILE_TOO_LARGE') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      fields: { file: ['File must be 5MB or smaller'] },
    });
  }
  return next(err);
}
