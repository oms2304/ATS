import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';

type WithId = Request & { id?: string; user?: { userId?: string } };

// Operational error carrying an explicit HTTP status. Throw this from
// controllers for expected failures (validation, not found, forbidden, ...).
export class AppError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

// Handles any unmatched route. Register AFTER all routes.
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: 'Not found',
    requestId: (req as WithId).id,
  });
}

// Centralized error handler. Register LAST, after routes and notFoundHandler.
// Express 5 automatically forwards rejected promises from async handlers here,
// so controllers can simply throw. Every failure is logged with actionable
// context (request id, method, path, user) and returned in a consistent shape.
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // next is required for Express to recognize this as an error handler
  _next: NextFunction
) {
  const isApp = err instanceof AppError;
  const status = isApp ? err.status : 500;
  const message = isApp ? err.message : 'Internal server error';

  logger.error('request_failed', {
    requestId: (req as WithId).id,
    method: req.method,
    path: req.originalUrl,
    userId: (req as WithId).user?.userId,
    status,
    errorName: err instanceof Error ? err.name : typeof err,
    errorMessage: err instanceof Error ? err.message : String(err),
    // include stack only for unexpected (non-operational) errors
    stack: !isApp && err instanceof Error ? err.stack : undefined,
  });

  res.status(status).json({
    success: false,
    error: message,
    code: isApp ? err.code : undefined,
    requestId: (req as WithId).id,
  });
}
