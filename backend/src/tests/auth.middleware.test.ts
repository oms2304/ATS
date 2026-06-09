process.env.JWT_SECRET = 'test-secret'

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { signToken } from '../lib/jwt'
import { authMiddleware } from '../middleware/auth.middleware'

const app = express()
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user })
})

describe('authMiddleware', () => {
  it('valid token passes and req.user is attached', async () => {
    const token = signToken({ userId: 'user-123', email: 'test@example.com' })

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.user).toMatchObject({
      userId: 'user-123',
      email: 'test@example.com',
    })
  })

  it('missing token returns 401 with "No token provided"', async () => {
    const res = await request(app).get('/protected')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'No token provided' })
  })

  it('invalid token returns 401 with "Invalid or expired token"', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer garbage')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      success: false,
      error: 'Invalid or expired token',
    })
  })

  it('malformed header with no Bearer prefix returns 401', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'token123')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'No token provided' })
  })

  it('expired token returns 401', async () => {
    const expiredToken = jwt.sign(
      { userId: 'user-123', email: 'test@example.com' },
      'test-secret',
      { expiresIn: -10 }
    )

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${expiredToken}`)

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      success: false,
      error: 'Invalid or expired token',
    })
  })
})
