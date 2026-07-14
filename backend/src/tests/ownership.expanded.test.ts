import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { checkOwnership } from '../middleware/ownership.middleware'

vi.mock('../lib/prisma', () => ({
  default: {
    document: { findUnique: vi.fn() },
    experience: { findUnique: vi.fn() },
    profile: { findUnique: vi.fn() },
  },
}))

import prisma from '../lib/prisma'

const mockRes = () => {
  const res = {} as Response
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

const mockReq = (overrides = {}) =>
  ({
    user: { userId: 'user-123', email: 'test@test.com' },
    params: {},
    ...overrides,
  }) as unknown as Request

const mockNext = () => vi.fn() as unknown as NextFunction

beforeEach(() => {
  vi.clearAllMocks()
})

describe('checkOwnership — expanded security/ownership coverage', () => {
  it('allows the owner of a userId-keyed model (profile)', async () => {
    const req = mockReq({ params: { id: 'p1' } })
    const res = mockRes()
    const next = mockNext()
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({
      id: 'p1',
      userId: 'user-123',
    } as any)

    await checkOwnership('profile')(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('blocks cross-user access on a userId-keyed model (profile) with 403', async () => {
    const req = mockReq({ params: { id: 'p1' } })
    const res = mockRes()
    const next = mockNext()
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({
      id: 'p1',
      userId: 'user-999',
    } as any)

    await checkOwnership('profile')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Access denied' })
    expect(next).not.toHaveBeenCalled()
  })

  it('enforces ownership on the document model (user_id-keyed) too', async () => {
    const req = mockReq({ params: { id: 'd1' } })
    const res = mockRes()
    const next = mockNext()
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: 'd1',
      user_id: 'user-999',
    } as any)

    await checkOwnership('document')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('reads the record id from a custom param name', async () => {
    const req = mockReq({ params: { experienceId: 'e1' } })
    const res = mockRes()
    const next = mockNext()
    vi.mocked(prisma.experience.findUnique).mockResolvedValue({
      id: 'e1',
      userId: 'user-123',
    } as any)

    await checkOwnership('experience', 'experienceId')(req, res, next)

    expect(prisma.experience.findUnique).toHaveBeenCalledWith({ where: { id: 'e1' } })
    expect(next).toHaveBeenCalled()
  })

  it('returns 500 (fails closed) when the ownership lookup throws', async () => {
    const req = mockReq({ params: { id: 'd1' } })
    const res = mockRes()
    const next = mockNext()
    vi.mocked(prisma.document.findUnique).mockRejectedValue(new Error('db down'))

    await checkOwnership('document')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(next).not.toHaveBeenCalled()
  })
})
