process.env.JWT_SECRET = 'test-secret'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { signToken } from '../lib/jwt'
import { authMiddleware } from '../middleware/auth.middleware'

// Control the revokedToken lookup per test.
const { revokedFindUnique } = vi.hoisted(() => ({ revokedFindUnique: vi.fn() }))

vi.mock('../lib/prisma', () => ({
  default: {
    revokedToken: { findUnique: revokedFindUnique },
  },
}))

const app = express()
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user })
})

describe('authMiddleware — token revocation (security)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a revoked (logged-out) token with 401', async () => {
    // Token itself is validly signed, but has been revoked (e.g. after logout).
    revokedFindUnique.mockResolvedValue({ id: 'revoked-1', token: 'x' })
    const token = signToken({ userId: 'user-123', email: 'test@example.com' })

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      success: false,
      error: 'Invalid or expired token',
    })
  })

  it('allows a valid, non-revoked token through', async () => {
    revokedFindUnique.mockResolvedValue(null)
    const token = signToken({ userId: 'user-123', email: 'test@example.com' })

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.user).toMatchObject({ userId: 'user-123' })
  })

  it('rejects an empty Bearer value with 401 and never checks revocation', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer ')

    expect(res.status).toBe(401)
    expect(revokedFindUnique).not.toHaveBeenCalled()
  })
})
