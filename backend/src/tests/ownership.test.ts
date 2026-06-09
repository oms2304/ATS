import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import {
  getProfile,
  createProfile,
  getCompletionScore,
} from '../controllers/profile.controller';

vi.mock('../lib/prisma', () => ({
  default: {
    profile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
