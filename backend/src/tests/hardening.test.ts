import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { queryRawUnsafe } = vi.hoisted(() => ({ queryRawUnsafe: vi.fn() }));

vi.mock('../lib/prisma', () => {
  const client = { $queryRawUnsafe: queryRawUnsafe };
  return { default: client, prisma: client };
});

vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { app } from '../index';
import { authLimiter } from '../middleware/rateLimit.middleware';

describe('readiness and liveness probes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports ready when the database answers', async () => {
    queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
    expect(queryRawUnsafe).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports 503 without leaking the database error when the query fails', async () => {
    queryRawUnsafe.mockRejectedValue(
      new Error('connection refused to postgres://user:hunter2@db')
    );

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready' });
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
  });

  it('stays live without touching the database', async () => {
    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('reports the deployed commit from the platform environment', async () => {
    process.env.RENDER_GIT_COMMIT = 'abc1234';

    const response = await request(app).get('/version');

    expect(response.status).toBe(200);
    expect(response.body.commit).toBe('abc1234');

    delete process.env.RENDER_GIT_COMMIT;
  });
});

describe('rate limiting', () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('is skipped while NODE_ENV is test so suites are not throttled', async () => {
    const limited = express();
    limited.use(authLimiter);
    limited.get('/', (_req, res) => res.status(200).json({ success: true }));

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const response = await request(limited).get('/');
      expect(response.status).toBe(200);
    }
  });

  it('returns the standard error envelope with 429 once the window is exhausted', async () => {
    // The limiter only engages outside tests, so opt this one app back in.
    process.env.NODE_ENV = 'production';

    const limited = express();
    limited.use(authLimiter);
    limited.get('/', (_req, res) => res.status(200).json({ success: true }));

    let limitedResponse: request.Response | undefined;
    for (let attempt = 0; attempt < 21; attempt += 1) {
      const response = await request(limited).get('/');
      if (response.status === 429) {
        limitedResponse = response;
        break;
      }
    }

    expect(limitedResponse?.status).toBe(429);
    expect(limitedResponse?.body.success).toBe(false);
    expect(typeof limitedResponse?.body.error).toBe('string');
    expect(limitedResponse?.body.error).toMatch(/too many/i);
  });
});
