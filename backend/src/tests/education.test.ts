import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  getEducations,
  createEducation,
  updateEducation,
  deleteEducation,
} from '../controllers/education.controller';
import { checkOwnership } from '../middleware/ownership.middleware';

vi.mock('../lib/prisma', () => ({
  default: {
    education: {
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

describe('createEducation', () => {
  it('should create an education and return 201', async () => {
    const req = mockReq({
      body: {
        school: 'NJIT',
        degree: 'B.S. Computer Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2019-09-01',
        endDate: '2023-05-01',
        isCurrent: false,
        gpa: '3.8',
      },
    });
    const res = mockRes();
    const fakeEdu = {
      id: 'edu-1',
      userId: 'user-123',
      school: 'NJIT',
      degree: 'B.S. Computer Science',
      fieldOfStudy: 'Computer Science',
      startDate: new Date('2019-09-01'),
      endDate: new Date('2023-05-01'),
      isCurrent: false,
      gpa: '3.8',
      order: 0,
    };
    vi.mocked(prisma.education.create).mockResolvedValue(fakeEdu as any);

    await createEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeEdu });
  });

  it('should persist the userId from the token', async () => {
    const req = mockReq({
      body: {
        school: 'NJIT',
        degree: 'B.S. CS',
        startDate: '2019-09-01',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.education.create).mockResolvedValue({ id: 'edu-1' } as any);

    await createEducation(req, res);

    expect(prisma.education.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-123' }),
    });
  });

  it('should convert startDate string to a Date', async () => {
    const req = mockReq({
      body: {
        school: 'NJIT',
        degree: 'B.S. CS',
        startDate: '2019-09-15',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.education.create).mockResolvedValue({ id: 'edu-1' } as any);

    await createEducation(req, res);

    const createArg = vi.mocked(prisma.education.create).mock.calls[0][0] as any;
    expect(createArg.data.startDate).toBeInstanceOf(Date);
  });

  it('should set endDate to null when not provided', async () => {
    const req = mockReq({
      body: {
        school: 'NJIT',
        degree: 'B.S. CS',
        startDate: '2019-09-01',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.education.create).mockResolvedValue({ id: 'edu-1' } as any);

    await createEducation(req, res);

    const createArg = vi.mocked(prisma.education.create).mock.calls[0][0] as any;
    expect(createArg.data.endDate).toBeNull();
  });

  it('should return 400 with field error if school is missing', async () => {
    const req = mockReq({
      body: { degree: 'B.S. CS', startDate: '2019-09-01' },
    });
    const res = mockRes();

    await createEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ school: expect.any(Array) }),
      }),
    );
  });

  it('should return 400 with field error if degree is missing', async () => {
    const req = mockReq({
      body: { school: 'NJIT', startDate: '2019-09-01' },
    });
    const res = mockRes();

    await createEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ degree: expect.any(Array) }),
      }),
    );
  });

  it('should return 400 with field error if startDate is missing', async () => {
    const req = mockReq({
      body: { school: 'NJIT', degree: 'B.S. CS' },
    });
    const res = mockRes();

    await createEducation(req, res);

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
        school: 'NJIT',
        degree: 'B.S. CS',
        startDate: '2023-09-01',
        endDate: '2019-05-01',
        isCurrent: false,
      },
    });
    const res = mockRes();

    await createEducation(req, res);

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
        school: 'NJIT',
        degree: 'B.S. CS',
        startDate: '2023-09-01',
        isCurrent: true,
      },
    });
    const res = mockRes();
    vi.mocked(prisma.education.create).mockResolvedValue({ id: 'edu-1' } as any);

    await createEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('should pass validation when isCurrent is false with no endDate', async () => {
    const req = mockReq({
      body: {
        school: 'NJIT',
        degree: 'B.S. CS',
        startDate: '2023-09-01',
        isCurrent: false,
      },
    });
    const res = mockRes();
    vi.mocked(prisma.education.create).mockResolvedValue({ id: 'edu-1' } as any);

    await createEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('should accept gpa as a string like "3.8"', async () => {
    const req = mockReq({
      body: {
        school: 'NJIT',
        degree: 'B.S. CS',
        startDate: '2019-09-01',
        endDate: '2023-05-01',
        gpa: '3.8',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.education.create).mockResolvedValue({ id: 'edu-1' } as any);

    await createEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createArg = vi.mocked(prisma.education.create).mock.calls[0][0] as any;
    expect(createArg.data.gpa).toBe('3.8');
  });

  it('should accept gpa as a string like "4.0"', async () => {
    const req = mockReq({
      body: {
        school: 'NJIT',
        degree: 'B.S. CS',
        startDate: '2019-09-01',
        endDate: '2023-05-01',
        gpa: '4.0',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.education.create).mockResolvedValue({ id: 'edu-1' } as any);

    await createEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createArg = vi.mocked(prisma.education.create).mock.calls[0][0] as any;
    expect(createArg.data.gpa).toBe('4.0');
  });

  it('should ignore extra fields in the request body', async () => {
    const req = mockReq({
      body: {
        school: 'NJIT',
        degree: 'B.S. CS',
        startDate: '2019-09-01',
        hacker: 'should be stripped',
        userId: 'spoofed-user',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.education.create).mockResolvedValue({ id: 'edu-1' } as any);

    await createEducation(req, res);

    const createArg = vi.mocked(prisma.education.create).mock.calls[0][0] as any;
    expect(createArg.data).not.toHaveProperty('hacker');
    expect(createArg.data.userId).toBe('user-123');
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({
      user: undefined,
      body: { school: 'NJIT', degree: 'B.S. CS', startDate: '2019-09-01' },
    });
    const res = mockRes();

    await createEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('getEducations', () => {
  it('should return only the authenticated user\'s educations', async () => {
    const req = mockReq();
    const res = mockRes();
    const fakeEdus = [{ id: 'edu-1', userId: 'user-123', school: 'NJIT' }];
    vi.mocked(prisma.education.findMany).mockResolvedValue(fakeEdus as any);

    await getEducations(req, res);

    expect(prisma.education.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      orderBy: { order: 'asc' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeEdus });
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();

    await getEducations(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('updateEducation', () => {
  it('should update an education and return 200', async () => {
    const req = mockReq({
      params: { id: 'edu-1' },
      body: { school: 'Stanford' },
    });
    const res = mockRes();
    const updated = { id: 'edu-1', userId: 'user-123', school: 'Stanford' };
    vi.mocked(prisma.education.update).mockResolvedValue(updated as any);

    await updateEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
    expect(prisma.education.update).toHaveBeenCalledWith({
      where: { id: 'edu-1' },
      data: expect.objectContaining({ school: 'Stanford' }),
    });
  });

  it('should return 400 with field error on invalid update payload', async () => {
    const req = mockReq({
      params: { id: 'edu-1' },
      body: { endDate: '2019-01-01', startDate: '2023-01-01', isCurrent: false },
    });
    const res = mockRes();

    await updateEducation(req, res);

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
      params: { id: 'edu-1' },
      body: { school: 'Stanford' },
    });
    const res = mockRes();

    await updateEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('education ownership', () => {
  const mockNext = () => vi.fn() as unknown as NextFunction;

  it('should block another user from updating with 403 (camelCase userId)', async () => {
    const req = mockReq({ params: { id: 'edu-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.education.findUnique).mockResolvedValue({
      id: 'edu-1',
      userId: 'someone-else',
    } as any);

    await checkOwnership('education')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Access denied' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow the owner through (camelCase userId)', async () => {
    const req = mockReq({ params: { id: 'edu-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.education.findUnique).mockResolvedValue({
      id: 'edu-1',
      userId: 'user-123',
    } as any);

    await checkOwnership('education')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 404 if record not found', async () => {
    const req = mockReq({ params: { id: 'edu-999' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.education.findUnique).mockResolvedValue(null);

    await checkOwnership('education')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if no token is present', async () => {
    const req = mockReq({ user: undefined, params: { id: 'edu-1' } });
    const res = mockRes();
    const next = mockNext();

    await checkOwnership('education')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should block another user from deleting with 403', async () => {
    const req = mockReq({ params: { id: 'edu-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.education.findUnique).mockResolvedValue({
      id: 'edu-1',
      userId: 'someone-else',
    } as any);

    await checkOwnership('education')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('deleteEducation', () => {
  it('should delete an education and return 200', async () => {
    const req = mockReq({ params: { id: 'edu-1' } });
    const res = mockRes();
    const existing = { id: 'edu-1', userId: 'user-123' };
    vi.mocked(prisma.education.findUnique).mockResolvedValue(existing as any);
    vi.mocked(prisma.education.delete).mockResolvedValue(existing as any);

    await deleteEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.education.delete).toHaveBeenCalledWith({ where: { id: 'edu-1' } });
  });

  it('should return 404 if education not found', async () => {
    const req = mockReq({ params: { id: 'edu-999' } });
    const res = mockRes();
    vi.mocked(prisma.education.findUnique).mockResolvedValue(null);

    await deleteEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({ user: undefined, params: { id: 'edu-1' } });
    const res = mockRes();

    await deleteEducation(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});