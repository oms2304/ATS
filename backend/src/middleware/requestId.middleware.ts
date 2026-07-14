import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Attaches a unique id to every request so a log line can be traced back to the
// exact request. Reuses an inbound X-Request-Id if present, otherwise generates
// one, and echoes it back on the response for client/support correlation.
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const id = (typeof incoming === 'string' && incoming.length > 0 && incoming) || randomUUID();
  (req as Request & { id?: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

export default requestId;
