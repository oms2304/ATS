import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  reorderSkills,
} from '../controllers/skill.controller';
import { checkOwnership } from '../middleware/ownership.middleware';

vi.mock('../lib/prisma', () => ({
  default: {
    skill: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
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

describe('createSkill', () => {
  it('should create a skill and return 201', async () => {
    const req = mockReq({
      body: {
        name: 'React',
        category: 'Frontend',
        proficiency: 'Advanced',
      },
    });
    const res = mockRes();
    const fakeSkill = {
      id: 'skill-1',
      userId: 'user-123',
      name: 'React',
      category: 'Frontend',
      proficiency: 'Advanced',
      order: 0,
    };
    vi.mocked(prisma.skill.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.skill.create).mockResolvedValue(fakeSkill as any);

    await createSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeSkill });
  });

  it('should persist the userId from the token', async () => {
    const req = mockReq({
      body: { name: 'TypeScript' },
    });
    const res = mockRes();
    vi.mocked(prisma.skill.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.skill.create).mockResolvedValue({ id: 'skill-1' } as any);

    await createSkill(req, res);

    expect(prisma.skill.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-123', name: 'TypeScript' }),
    });
  });

  it('should return 400 with field error if name is missing', async () => {
    const req = mockReq({
      body: { category: 'Frontend', proficiency: 'Beginner' },
    });
    const res = mockRes();

    await createSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Validation failed',
        fields: expect.objectContaining({ name: expect.any(Array) }),
      }),
    );
  });

  it('should return 400 with "You already have this skill" if exact duplicate name exists', async () => {
    const req = mockReq({
      body: { name: 'React', category: 'Frontend' },
    });
    const res = mockRes();
    vi.mocked(prisma.skill.findFirst).mockResolvedValue({
      id: 'skill-99',
      userId: 'user-123',
      name: 'React',
    } as any);

    await createSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      fields: { name: ['You already have this skill'] },
    });
    expect(prisma.skill.create).not.toHaveBeenCalled();
  });

  it('should return 400 with "You already have this skill" if duplicate is case-insensitive', async () => {
    const req = mockReq({
      body: { name: 'react', category: 'Frontend' },
    });
    const res = mockRes();
    vi.mocked(prisma.skill.findFirst).mockResolvedValue({
      id: 'skill-99',
      userId: 'user-123',
      name: 'React',
    } as any);

    await createSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: { name: ['You already have this skill'] },
      }),
    );
    expect(prisma.skill.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-123',
        name: { equals: 'react', mode: 'insensitive' },
      },
    });
  });

  it('should accept a skill with no category or proficiency', async () => {
    const req = mockReq({
      body: { name: 'Go' },
    });
    const res = mockRes();
    vi.mocked(prisma.skill.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.skill.create).mockResolvedValue({ id: 'skill-1' } as any);

    await createSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.skill.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Go' }),
    });
  });

  it('should ignore extra fields in the request body', async () => {
    const req = mockReq({
      body: {
        name: 'Python',
        hacker: 'should be stripped',
        userId: 'spoofed-user',
      },
    });
    const res = mockRes();
    vi.mocked(prisma.skill.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.skill.create).mockResolvedValue({ id: 'skill-1' } as any);

    await createSkill(req, res);

    const createArg = vi.mocked(prisma.skill.create).mock.calls[0][0] as any;
    expect(createArg.data).not.toHaveProperty('hacker');
    expect(createArg.data.userId).toBe('user-123');
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({
      user: undefined,
      body: { name: 'React' },
    });
    const res = mockRes();

    await createSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('getSkills', () => {
  it('should return only the authenticated user\'s skills ordered by order asc', async () => {
    const req = mockReq();
    const res = mockRes();
    const fakeSkills = [{ id: 'skill-1', userId: 'user-123', name: 'React' }];
    vi.mocked(prisma.skill.findMany).mockResolvedValue(fakeSkills as any);

    await getSkills(req, res);

    expect(prisma.skill.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      orderBy: { order: 'asc' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: fakeSkills });
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();

    await getSkills(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('updateSkill', () => {
  it('should update a skill and return 200', async () => {
    const req = mockReq({
      params: { id: 'skill-1' },
      body: { proficiency: 'Expert' },
    });
    const res = mockRes();
    const updated = {
      id: 'skill-1',
      userId: 'user-123',
      name: 'React',
      proficiency: 'Expert',
    };
    vi.mocked(prisma.skill.update).mockResolvedValue(updated as any);

    await updateSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: updated });
    expect(prisma.skill.update).toHaveBeenCalledWith({
      where: { id: 'skill-1' },
      data: expect.objectContaining({ proficiency: 'Expert' }),
    });
  });

  it('should return 400 with field error if name is empty in update payload', async () => {
    const req = mockReq({
      params: { id: 'skill-1' },
      body: { name: '' },
    });
    const res = mockRes();

    await updateSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        fields: expect.objectContaining({ name: expect.any(Array) }),
      }),
    );
  });

  it('should return 400 with duplicate error when updating to a name owned by another skill', async () => {
    const req = mockReq({
      params: { id: 'skill-1' },
      body: { name: 'TypeScript' },
    });
    const res = mockRes();
    vi.mocked(prisma.skill.findFirst).mockResolvedValue({
      id: 'skill-2',
      userId: 'user-123',
      name: 'TypeScript',
    } as any);

    await updateSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      fields: { name: ['You already have this skill'] },
    });
    expect(prisma.skill.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-123',
        name: { equals: 'TypeScript', mode: 'insensitive' },
        NOT: { id: 'skill-1' },
      },
    });
    expect(prisma.skill.update).not.toHaveBeenCalled();
  });

  it('should not trigger duplicate error when updating to the same name it already has', async () => {
    const req = mockReq({
      params: { id: 'skill-1' },
      body: { name: 'React', proficiency: 'Expert' },
    });
    const res = mockRes();
    vi.mocked(prisma.skill.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.skill.update).mockResolvedValue({
      id: 'skill-1',
      userId: 'user-123',
      name: 'React',
      proficiency: 'Expert',
    } as any);

    await updateSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.skill.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-123',
        name: { equals: 'React', mode: 'insensitive' },
        NOT: { id: 'skill-1' },
      },
    });
    expect(prisma.skill.update).toHaveBeenCalled();
  });

  it('should not run duplicate check when name is not in update payload', async () => {
    const req = mockReq({
      params: { id: 'skill-1' },
      body: { category: 'Tools' },
    });
    const res = mockRes();
    vi.mocked(prisma.skill.update).mockResolvedValue({ id: 'skill-1' } as any);

    await updateSkill(req, res);

    expect(prisma.skill.findFirst).not.toHaveBeenCalled();
    expect(prisma.skill.update).toHaveBeenCalledWith({
      where: { id: 'skill-1' },
      data: expect.objectContaining({ category: 'Tools' }),
    });
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({
      user: undefined,
      params: { id: 'skill-1' },
      body: { proficiency: 'Expert' },
    });
    const res = mockRes();

    await updateSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('skill ownership', () => {
  const mockNext = () => vi.fn() as unknown as NextFunction;

  it('should block another user from updating with 403', async () => {
    const req = mockReq({ params: { id: 'skill-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      id: 'skill-1',
      userId: 'someone-else',
    } as any);

    await checkOwnership('skill')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Access denied' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow the owner through', async () => {
    const req = mockReq({ params: { id: 'skill-1' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      id: 'skill-1',
      userId: 'user-123',
    } as any);

    await checkOwnership('skill')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 404 if record not found', async () => {
    const req = mockReq({ params: { id: 'skill-999' } });
    const res = mockRes();
    const next = mockNext();
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(null);

    await checkOwnership('skill')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if no token is present', async () => {
    const req = mockReq({ user: undefined, params: { id: 'skill-1' } });
    const res = mockRes();
    const next = mockNext();

    await checkOwnership('skill')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('deleteSkill', () => {
  it('should delete a skill and return 200', async () => {
    const req = mockReq({ params: { id: 'skill-1' } });
    const res = mockRes();
    vi.mocked(prisma.skill.delete).mockResolvedValue({ id: 'skill-1' } as any);

    await deleteSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'Skill deleted' },
    });
    expect(prisma.skill.delete).toHaveBeenCalledWith({ where: { id: 'skill-1' } });
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({ user: undefined, params: { id: 'skill-1' } });
    const res = mockRes();

    await deleteSkill(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('reorderSkills', () => {
  it('should update order to index for each id', async () => {
    const req = mockReq({
      body: { orderedIds: ['skill-3', 'skill-1', 'skill-2'] },
    });
    const res = mockRes();
    vi.mocked(prisma.skill.update).mockResolvedValue({} as any);

    await reorderSkills(req, res);

    expect(prisma.skill.update).toHaveBeenCalledTimes(3);
    expect(prisma.skill.update).toHaveBeenCalledWith({
      where: { id: 'skill-3', userId: 'user-123' },
      data: { order: 0 },
    });
    expect(prisma.skill.update).toHaveBeenCalledWith({
      where: { id: 'skill-1', userId: 'user-123' },
      data: { order: 1 },
    });
    expect(prisma.skill.update).toHaveBeenCalledWith({
      where: { id: 'skill-2', userId: 'user-123' },
      data: { order: 2 },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 400 if orderedIds is not an array', async () => {
    const req = mockReq({ body: { orderedIds: 'not-an-array' } });
    const res = mockRes();

    await reorderSkills(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 401 if user is not authenticated', async () => {
    const req = mockReq({
      user: undefined,
      body: { orderedIds: ['skill-1'] },
    });
    const res = mockRes();

    await reorderSkills(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});