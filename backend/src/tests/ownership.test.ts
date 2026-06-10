import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  getProfile,
  createProfile,
  getCompletionScore,
} from '../controllers/profile.controller';
import { checkOwnership } from '../middleware/ownership.middleware';

vi.mock('../lib/prisma', () => ({
  default: {
    profile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
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
    ...overrides,
  }) as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getProfile', () => {
  it('should return profile for authenticated user', async () => {
    const req = mockReq();
    const res = mockRes();
    const fakeProfile = { id: 'profile-1', user_id: 'user-123', first_name: 'John', last_name: 'Doe', completion_score: 40 };
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(fakeProfile as any);
    await getProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 401 if not authenticated', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    await getProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 404 if profile not found', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);
    await getProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('createProfile', () => {
  it('should create profile and return 201', async () => {
    const req = mockReq({ body: { first_name: 'John', last_name: 'Doe' } });
    const res = mockRes();
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);
    const fakeProfile = { id: 'profile-1', user_id: 'user-123', first_name: 'John', last_name: 'Doe', completion_score: 40 };
    vi.mocked(prisma.profile.create).mockResolvedValue(fakeProfile as any);
    await createProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('should return 400 if first_name missing', async () => {
    const req = mockReq({ body: { last_name: 'Doe' } });
    const res = mockRes();
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);
    await createProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 401 if not authenticated', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    await createProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 409 if profile already exists', async () => {
    const req = mockReq({ body: { first_name: 'John', last_name: 'Doe' } });
    const res = mockRes();
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({ id: 'profile-1' } as any);
    await createProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('getCompletionScore', () => {
  it('should return completion score for existing profile', async () => {
    const req = mockReq();
    const res = mockRes();
    const fakeProfile = { id: 'profile-1', user_id: 'user-123', completion_score: 80 };
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(fakeProfile as any);
    await getCompletionScore(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ completion_score: 80, completed_fields: 4, total_fields: 5 });
  });

  it('should return 0 score if no profile exists', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);
    await getCompletionScore(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ completion_score: 0, completed_fields: 0, total_fields: 5 });
  });

  it('should return 401 if not authenticated', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    await getCompletionScore(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('ownership middleware', () => {
  const mockNext = () => vi.fn() as unknown as NextFunction;

  it('allows the owner to access their own record', async () => {
    const req = mockReq({ params: { id: 'job-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      id: 'job-1',
      user_id: 'user-123',
    } as any);

    await checkOwnership('job')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks a cross-user read with 403', async () => {
    const req = mockReq({ params: { id: 'job-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      id: 'job-1',
      user_id: 'user-999',
    } as any);

    await checkOwnership('job')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Access denied' });
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks a cross-user update with 403', async () => {
    const req = mockReq({ params: { id: 'job-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      id: 'job-1',
      user_id: 'user-999',
    } as any);

    await checkOwnership('job')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Access denied' });
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks a cross-user delete with 403', async () => {
    const req = mockReq({ params: { id: 'job-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      id: 'job-1',
      user_id: 'user-999',
    } as any);

    await checkOwnership('job')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Access denied' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when the record does not exist', async () => {
    const req = mockReq({ params: { id: 'job-missing' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null);

    await checkOwnership('job')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Record not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no token / user is present', async () => {
    const req = mockReq({ user: undefined, params: { id: 'job-1' } });
    const res = mockRes();
    const next = mockNext();

    await checkOwnership('job')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });
});
