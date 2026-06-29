import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// calculateCompletionScore is a pure function; the controller imports prisma at
// module load, so we stub it even though the score logic never touches it.
vi.mock('../lib/prisma', () => ({
  default: { profile: { findUnique: vi.fn() } },
  prisma: { profile: { findUnique: vi.fn() } },
}));

import {
  calculateCompletionScore,
  getCompletionScore,
} from '../controllers/profile.controller';
import prisma from '../lib/prisma';

// The five baseline fields that count toward completeness.
const FULL = {
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '555-1234',
  location: 'NYC',
  summary: 'Engineer',
};

describe('calculateCompletionScore (S2-026, profile completeness)', () => {
  it('returns 0 for a completely empty profile', () => {
    expect(calculateCompletionScore({})).toBe(0);
  });

  it('returns 100 when all five baseline fields are filled', () => {
    expect(calculateCompletionScore(FULL)).toBe(100);
  });

  it('scales linearly across the boundaries (each field = 20%)', () => {
    expect(calculateCompletionScore({ firstName: 'Jane' })).toBe(20);
    expect(calculateCompletionScore({ firstName: 'Jane', lastName: 'Doe' })).toBe(40);
    expect(
      calculateCompletionScore({ firstName: 'Jane', lastName: 'Doe', phone: '5' })
    ).toBe(60);
    expect(
      calculateCompletionScore({ firstName: 'Jane', lastName: 'Doe', phone: '5', location: 'NYC' })
    ).toBe(80);
  });

  it('treats null, undefined, and empty string as not completed', () => {
    expect(
      calculateCompletionScore({
        firstName: '',
        lastName: null,
        phone: undefined,
        location: '',
        summary: '',
      })
    ).toBe(0);
  });

  it('ignores fields outside the baseline set (e.g. linkedIn)', () => {
    expect(calculateCompletionScore({ linkedIn: 'https://x.com' })).toBe(0);
  });

  it('counts a partially filled profile correctly when extra fields are present', () => {
    expect(
      calculateCompletionScore({ ...FULL, summary: '', linkedIn: 'https://x.com' })
    ).toBe(80);
  });
});

const mockRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) =>
  ({ user: { userId: 'user-123' }, body: {}, params: {}, ...overrides }) as any as Request;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCompletionScore endpoint (S2-026)', () => {
  it('returns a zeroed score when the user has no profile yet', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);

    await getCompletionScore(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.data.completionScore).toBe(0);
    expect(payload.data.total_fields).toBe(5);
  });

  it('reports the persisted completion score', async () => {
    const req = mockReq();
    const res = mockRes();
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({ completionScore: 80 } as any);

    await getCompletionScore(req, res);

    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.data.completionScore).toBe(80);
    expect(payload.data.completed_fields).toBe(4);
  });

  it('returns 401 when unauthenticated', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();

    await getCompletionScore(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
