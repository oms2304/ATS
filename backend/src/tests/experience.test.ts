import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  getExperiences,
  createExperience,
  updateExperience,
  deleteExperience,
  reorderExperiences,
} from '../controllers/experience.controller';
import { checkOwnership } from '../middleware/ownership.middleware';

vi.mock('../lib/prisma', () => ({
  default: {
    experience: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

describe('createExperience', () => {
  it('should create an experience and return 201', async () => {
    const req = mockReq({
      body: {
        title: 'Software Engineer',
        company: 'Acme',
        startDate: '2023-01-01',
        endDate: '2024-01-01',
        isCurrent: false,
        description: 'Built things',
      },
    });
    const res = mockRes();
    const fakeExp = {
      id: 'exp-1',
      userId: 'user-123',
      title: 'Software Engineer',
      company: 'Acme',
      startDate: new Date('2023-01-01'),
      endDate: new Date('2024-01-01'),
      isCurrent: false,
      description: 'Built things',
      order: 0,
    };
    vi.mocked(prisma.experience.create).mockResolvedValue(fakeExp as any);

    await createExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeExp });
  });

  it('should persist the userId from the token', async () => {
    const req = mockReq({
      body: {
        title: 'Software Engineer',
        company: 'Acme',
        startDate: '2023-01-01',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.experience.create).mockResolvedValue({ id: 'exp-1' } as any);

    await createExperience(req, res);

    expect(prisma.experience.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-123' }),
    });
  });

  it('should convert startDate string to a Date', async () => {
    const req = mockReq({
      body: {
        title: 'Software Engineer',
        company: 'Acme',
        startDate: '2023-01-15',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.experience.create).mockResolvedValue({ id: 'exp-1' } as any);

    await createExperience(req, res);

    const createArg = vi.mocked(prisma.experience.create).mock.calls[0][0] as any;
    expect(createArg.data.startDate).toBeInstanceOf(Date);
  });

  it('should return 400 with field error if title is missing', async () => {
    const req = mockReq({
      body: { company: 'Acme', startDate: '2023-01-01' },
    });
    const res = mockRes();

    await createExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ title: expect.any(Array) }),
      }),
    );
  });

  it('should return 400 with field error if company is missing', async () => {
    const req = mockReq({
      body: { title: 'Engineer', startDate: '2023-01-01' },
    });
    const res = mockRes();

    await createExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ company: expect.any(Array) }),
      }),
    );
  });

  it('should return 400 with field error if startDate is missing', async () => {
    const req = mockReq({
      body: { title: 'Engineer', company: 'Acme' },
    });
    const res = mockRes();

    await createExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ startDate: expect.any(Array) }),
      }),
    );
  });

  it('should return 400 with field error if endDate is before startDate and not current', async () => {
    const req = mockReq({
      body: {
        title: 'Engineer',
        company: 'Acme',
        startDate: '2024-01-01',
        endDate: '2023-01-01',
        isCurrent: false,
      },
    });
    const res = mockRes();

    await createExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ endDate: expect.any(Array) }),
      }),
    );
  });

  it('should pass validation when isCurrent is true with no endDate', async () => {
    const req = mockReq({
      body: {
        title: 'Engineer',
        company: 'Acme',
        startDate: '2023-01-01',
        isCurrent: true,
      },
    });
    const res = mockRes();
    vi.mocked(prisma.experience.create).mockResolvedValue({ id: 'exp-1' } as any);

    await createExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('should pass validation when isCurrent is false with no endDate', async () => {
    const req = mockReq({
      body: {
        title: 'Engineer',
        company: 'Acme',
        startDate: '2023-01-01',
        isCurrent: false,
      },
    });
    const res = mockRes();
    vi.mocked(prisma.experience.create).mockResolvedValue({ id: 'exp-1' } as any);

    await createExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('should ignore extra fields in the request body', async () => {
    const req = mockReq({
      body: {
        title: 'Engineer',
        company: 'Acme',
        startDate: '2023-01-01',
        hacker: 'should be stripped',
        userId: 'spoofed-user',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.experience.create).mockResolvedValue({ id: 'exp-1' } as any);

    await createExperience(req, res);

    const createArg = vi.mocked(prisma.experience.create).mock.calls[0][0] as any;
    expect(createArg.data).not.toHaveProperty('hacker');
    expect(createArg.data.userId).toBe('user-123');
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({
      user: undefined,
      body: { title: 'Engineer', company: 'Acme', startDate: '2023-01-01' },
    });
    const res = mockRes();

    await createExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('getExperiences', () => {
  it('should return only the authenticated user\'s experiences', async () => {
    const req = mockReq();
    const res = mockRes();
    const fakeExps = [{ id: 'exp-1', userId: 'user-123', title: 'Engineer' }];
    vi.mocked(prisma.experience.findMany).mockResolvedValue(fakeExps as any);

    await getExperiences(req, res);

    expect(prisma.experience.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      orderBy: { order: 'asc' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeExps });
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();

    await getExperiences(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('updateExperience', () => {
  it('should update an experience and return 200', async () => {
    const req = mockReq({
      params: { id: 'exp-1' },
      body: { title: 'Senior Engineer' },
    });
    const res = mockRes();
    const updated = { id: 'exp-1', userId: 'user-123', title: 'Senior Engineer' };
    vi.mocked(prisma.experience.update).mockResolvedValue(updated as any);

    await updateExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
    expect(prisma.experience.update).toHaveBeenCalledWith({
      where: { id: 'exp-1' },
      data: expect.objectContaining({ title: 'Senior Engineer' }),
    });
  });

  it('should return 400 with field error on invalid update payload', async () => {
    const req = mockReq({
      params: { id: 'exp-1' },
      body: { endDate: '2020-01-01', startDate: '2024-01-01', isCurrent: false },
    });
    const res = mockRes();

    await updateExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ endDate: expect.any(Array) }),
      }),
    );
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({
      user: undefined,
      params: { id: 'exp-1' },
      body: { title: 'New' },
    });
    const res = mockRes();

    await updateExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('experience ownership', () => {
  const mockNext = () => vi.fn() as unknown as NextFunction;

  it('should block another user from updating with 403 (camelCase userId)', async () => {
    const req = mockReq({ params: { id: 'exp-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.experience.findUnique).mockResolvedValue({
      id: 'exp-1',
      userId: 'someone-else',
    } as any);

    await checkOwnership('experience')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Access denied' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow the owner through (camelCase userId)', async () => {
    const req = mockReq({ params: { id: 'exp-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.experience.findUnique).mockResolvedValue({
      id: 'exp-1',
      userId: 'user-123',
    } as any);

    await checkOwnership('experience')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should still allow owners through for legacy snake_case user_id models', async () => {
    const req = mockReq({ params: { id: 'job-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.experience.findUnique).mockResolvedValue({
      id: 'job-1',
      user_id: 'user-123',
    } as any);

    await checkOwnership('experience')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 404 if record not found', async () => {
    const req = mockReq({ params: { id: 'exp-999' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.experience.findUnique).mockResolvedValue(null);

    await checkOwnership('experience')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if no token is present', async () => {
    const req = mockReq({ user: undefined, params: { id: 'exp-1' } });
    const res = mockRes();
    const next = mockNext();

    await checkOwnership('experience')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('deleteExperience', () => {
  it('should delete an experience and return 200', async () => {
    const req = mockReq({ params: { id: 'exp-1' } });
    const res = mockRes();
    const existing = { id: 'exp-1', userId: 'user-123' };
    vi.mocked(prisma.experience.findUnique).mockResolvedValue(existing as any);
    vi.mocked(prisma.experience.delete).mockResolvedValue(existing as any);

    await deleteExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.experience.delete).toHaveBeenCalledWith({ where: { id: 'exp-1' } });
  });

  it('should return 404 if experience not found', async () => {
    const req = mockReq({ params: { id: 'exp-999' } });
    const res = mockRes();
    vi.mocked(prisma.experience.findUnique).mockResolvedValue(null);

    await deleteExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({ user: undefined, params: { id: 'exp-1' } });
    const res = mockRes();

    await deleteExperience(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('reorderExperiences', () => {
  it('should update order to index for each id', async () => {
    const req = mockReq({
      body: { orderedIds: ['exp-3', 'exp-1', 'exp-2'] },
    });
    const res = mockRes();
    vi.mocked(prisma.experience.update).mockResolvedValue({} as any);

    await reorderExperiences(req, res);

    expect(prisma.experience.update).toHaveBeenCalledTimes(3);
    expect(prisma.experience.update).toHaveBeenCalledWith({
      where: { id: 'exp-3', userId: 'user-123' },
      data: { order: 0 },
    });
    expect(prisma.experience.update).toHaveBeenCalledWith({
      where: { id: 'exp-1', userId: 'user-123' },
      data: { order: 1 },
    });
    expect(prisma.experience.update).toHaveBeenCalledWith({
      where: { id: 'exp-2', userId: 'user-123' },
      data: { order: 2 },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 400 if orderedIds is not an array', async () => {
    const req = mockReq({ body: { orderedIds: 'not-an-array' } });
    const res = mockRes();

    await reorderExperiences(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({
      user: undefined,
      body: { orderedIds: ['exp-1'] },
    });
    const res = mockRes();

    await reorderExperiences(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});