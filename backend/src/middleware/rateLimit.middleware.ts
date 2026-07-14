import { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

function createLimiter(
  windowMs: number,
  limit: number,
  message: string,
  userScoped = false
) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: userScoped
      ? (req: Request) =>
          req.user?.userId ?? ipKeyGenerator(req.ip ?? 'unknown')
      : undefined,
    handler: (req: Request, res: Response) =>
      res.status(429).json({
        success: false,
        error: message,
        requestId: (req as Request & { id?: string }).id,
      }),
  });
}

export const globalLimiter = createLimiter(
  15 * 60 * 1000,
  300,
  'Too many requests. Please wait a moment and try again.'
);

export const authLimiter = createLimiter(
  15 * 60 * 1000,
  20,
  'Too many authentication attempts. Please wait before trying again.'
);

export const aiLimiter = createLimiter(
  15 * 60 * 1000,
  30,
  'Too many AI requests. Please wait before trying again.',
  true
);

export const uploadLimiter = createLimiter(
  60 * 60 * 1000,
  30,
  'Too many uploads. Please wait before uploading another document.',
  true
);
