import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import {
  getPreferences,
  upsertPreferences,
} from '../controllers/preferences.controller';

vi.mock('../lib/prisma', () => ({
  default: {
    careerPreferences: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
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

describe('upsertPreferences', () => {
  it('should upsert preferences with valid data and return 200', async () => {
    const req = mockReq({
      body: {
        targetRoles: ['Frontend Developer', 'Full Stack Engineer'],
        preferredLocations: ['Remote', 'New York, NY'],
        workMode: 'Remote',
        salaryMin: 60000,
        salaryMax: 90000,
      },
    });
    const res = mockRes();
    const fakePrefs = {
      id: 'pref-1',
      userId: 'user-123',
      targetRoles: ['Frontend Developer', 'Full Stack Engineer'],
      preferredLocations: ['Remote', 'New York, NY'],
      workMode: 'Remote',
      salaryMin: 60000,
      salaryMax: 90000,
    };
    vi.mocked(prisma.careerPreferences.upsert).mockResolvedValue(fakePrefs as any);

    await upsertPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakePrefs });
    expect(prisma.careerPreferences.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      update: {
        targetRoles: ['Frontend Developer', 'Full Stack Engineer'],
        preferredLocations: ['Remote', 'New York, NY'],
        workMode: 'Remote',
        salaryMin: 60000,
        salaryMax: 90000,
      },
      create: {
        targetRoles: ['Frontend Developer', 'Full Stack Engineer'],
        preferredLocations: ['Remote', 'New York, NY'],
        workMode: 'Remote',
        salaryMin: 60000,
        salaryMax: 90000,
        userId: 'user-123',
      },
    });
  });

  it('should persist the userId from the token on create', async () => {
    const req = mockReq({
      body: {
        targetRoles: ['Frontend Developer'],
        preferredLocations: ['Remote'],
        workMode: 'Remote',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.careerPreferences.upsert).mockResolvedValue({ id: 'pref-1' } as any);

    await upsertPreferences(req, res);

    const upsertArg = vi.mocked(prisma.careerPreferences.upsert).mock.calls[0][0] as any;
    expect(upsertArg.create.userId).toBe('user-123');
    expect(upsertArg.where).toEqual({ userId: 'user-123' });
  });

  it('should call upsert again on a second PUT (update path is exercised)', async () => {
    const req1 = mockReq({
      body: { targetRoles: ['Frontend Developer'], preferredLocations: ['Remote'] },
    });
    const res1 = mockRes();
    vi.mocked(prisma.careerPreferences.upsert).mockResolvedValue({
      id: 'pref-1',
      userId: 'user-123',
      targetRoles: ['Frontend Developer'],
      preferredLocations: ['Remote'],
      workMode: null,
      salaryMin: null,
      salaryMax: null,
    } as any);

    await upsertPreferences(req1, res1);

    const req2 = mockReq({
      body: {
        targetRoles: ['Frontend Developer', 'Tech Lead'],
        preferredLocations: ['Remote'],
        workMode: 'Hybrid',
      },
    });
    const res2 = mockRes();
    vi.mocked(prisma.careerPreferences.upsert).mockResolvedValue({
      id: 'pref-1',
      userId: 'user-123',
      targetRoles: ['Frontend Developer', 'Tech Lead'],
      preferredLocations: ['Remote'],
      workMode: 'Hybrid',
      salaryMin: null,
      salaryMax: null,
    } as any);

    await upsertPreferences(req2, res2);

    expect(prisma.careerPreferences.upsert).toHaveBeenCalledTimes(2);
    const secondCallArg = vi.mocked(prisma.careerPreferences.upsert).mock.calls[1][0] as any;
    expect(secondCallArg.update.targetRoles).toEqual(['Frontend Developer', 'Tech Lead']);
    expect(secondCallArg.update.workMode).toBe('Hybrid');
    expect(secondCallArg.where).toEqual({ userId: 'user-123' });
  });

  it('should accept empty arrays for targetRoles and preferredLocations', async () => {
    const req = mockReq({
      body: {
        targetRoles: [],
        preferredLocations: [],
      },
    });
    const res = mockRes();
    vi.mocked(prisma.careerPreferences.upsert).mockResolvedValue({
      id: 'pref-1',
      userId: 'user-123',
      targetRoles: [],
      preferredLocations: [],
      workMode: null,
      salaryMin: null,
      salaryMax: null,
    } as any);

    await upsertPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const upsertArg = vi.mocked(prisma.careerPreferences.upsert).mock.calls[0][0] as any;
    expect(upsertArg.update.targetRoles).toEqual([]);
    expect(upsertArg.update.preferredLocations).toEqual([]);
  });

  it('should return 400 with field error when workMode is invalid', async () => {
    const req = mockReq({
      body: {
        targetRoles: [],
        preferredLocations: [],
        workMode: 'Part-time',
      },
    });
    const res = mockRes();

    await upsertPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Validation failed',
        fields: expect.objectContaining({ workMode: expect.any(Array) }),
      }),
    );
    expect(prisma.careerPreferences.upsert).not.toHaveBeenCalled();
  });

  it('should return 400 with salaryMax field error when salaryMax is less than salaryMin', async () => {
    const req = mockReq({
      body: {
        targetRoles: [],
        preferredLocations: [],
        salaryMin: 90000,
        salaryMax: 60000,
      },
    });
    const res = mockRes();

    await upsertPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Validation failed',
        fields: expect.objectContaining({ salaryMax: expect.any(Array) }),
      }),
    );
    expect(prisma.careerPreferences.upsert).not.toHaveBeenCalled();
  });

  it('should accept salary values of 0 as valid', async () => {
    const req = mockReq({
      body: {
        targetRoles: [],
        preferredLocations: [],
        salaryMin: 0,
        salaryMax: 0,
      },
    });
    const res = mockRes();
    vi.mocked(prisma.careerPreferences.upsert).mockResolvedValue({
      id: 'pref-1',
      userId: 'user-123',
      targetRoles: [],
      preferredLocations: [],
      workMode: null,
      salaryMin: 0,
      salaryMax: 0,
    } as any);

    await upsertPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const upsertArg = vi.mocked(prisma.careerPreferences.upsert).mock.calls[0][0] as any;
    expect(upsertArg.update.salaryMin).toBe(0);
    expect(upsertArg.update.salaryMax).toBe(0);
  });

  it('should accept equal salaryMin and salaryMax as valid', async () => {
    const req = mockReq({
      body: {
        targetRoles: [],
        preferredLocations: [],
        salaryMin: 75000,
        salaryMax: 75000,
      },
    });
    const res = mockRes();
    vi.mocked(prisma.careerPreferences.upsert).mockResolvedValue({ id: 'pref-1' } as any);

    await upsertPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should pass validation with an empty body and default array fields to []', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    vi.mocked(prisma.careerPreferences.upsert).mockResolvedValue({
      id: 'pref-1',
      userId: 'user-123',
      targetRoles: [],
      preferredLocations: [],
      workMode: null,
      salaryMin: null,
      salaryMax: null,
    } as any);

    await upsertPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const upsertArg = vi.mocked(prisma.careerPreferences.upsert).mock.calls[0][0] as any;
    expect(upsertArg.update.targetRoles).toEqual([]);
    expect(upsertArg.update.preferredLocations).toEqual([]);
    expect(upsertArg.update.workMode).toBeUndefined();
    expect(upsertArg.update.salaryMin).toBeUndefined();
    expect(upsertArg.update.salaryMax).toBeUndefined();
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({
      user: undefined,
      body: {
        targetRoles: ['Frontend Developer'],
        preferredLocations: ['Remote'],
      },
    });
    const res = mockRes();

    await upsertPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.careerPreferences.upsert).not.toHaveBeenCalled();
  });
});

describe('getPreferences', () => {
  it('should return the authenticated user preferences', async () => {
    const req = mockReq();
    const res = mockRes();
    const fakePrefs = {
      id: 'pref-1',
      userId: 'user-123',
      targetRoles: ['Frontend Developer'],
      preferredLocations: ['Remote'],
      workMode: 'Remote',
      salaryMin: 60000,
      salaryMax: 90000,
    };
    vi.mocked(prisma.careerPreferences.findUnique).mockResolvedValue(fakePrefs as any);

    await getPreferences(req, res);

    expect(prisma.careerPreferences.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakePrefs });
  });

  it('should return null data when no preferences are set yet', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.careerPreferences.findUnique).mockResolvedValue(null);

    await getPreferences(req, res);

    expect(prisma.careerPreferences.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();

    await getPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(prisma.careerPreferences.findUnique).not.toHaveBeenCalled();
  });
});