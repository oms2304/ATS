import { describe, it, expect, vi } from 'vitest'
import jwt from 'jsonwebtoken'

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test_secret_for_testing_only'
})

import { authMiddleware } from '../middleware/auth.middleware'
import { signToken } from '../lib/jwt'

function mockReq(headers = {}) {
  return { headers } as any
}

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function mockNext() {
  return vi.fn()
}

describe('authMiddleware', () => {
  it('valid token passes', () => {
    const token = signToken({ userId: 'user123', email: 'test@test.com' })
    const req = mockReq({ authorization: `Bearer ${token}` })
    const res = mockRes()
    const next = mockNext()

    authMiddleware(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.user?.userId).toBe('user123')
    expect(req.user?.email).toBe('test@test.com')
  })

  it('missing token returns 401', () => {
    const req = mockReq()
    const res = mockRes()
    const next = mockNext()

    authMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No token provided' })
    expect(next).not.toHaveBeenCalled()
  })

  it('invalid token returns 401', () => {
    const req = mockReq({ authorization: 'Bearer invalidtoken123' })
    const res = mockRes()
    const next = mockNext()

    authMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid or expired token' })
    expect(next).not.toHaveBeenCalled()
  })

  it('malformed header returns 401', () => {
    const req = mockReq({ authorization: 'token123' })
    const res = mockRes()
    const next = mockNext()

    authMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No token provided' })
    expect(next).not.toHaveBeenCalled()
  })

  it('expired token returns 401', async () => {
    const token = jwt.sign(
      { userId: 'user123', email: 'test@test.com' },
      process.env.JWT_SECRET as string,
      { expiresIn: '1s' }
    )

    await new Promise((resolve) => setTimeout(resolve, 1500))

    const req = mockReq({ authorization: `Bearer ${token}` })
    const res = mockRes()
    const next = mockNext()

    authMiddleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
