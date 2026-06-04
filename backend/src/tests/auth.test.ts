import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { register } from '../controllers/auth.controller'

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}))

vi.mock('../lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../lib/jwt', () => ({
  signToken: vi.fn().mockReturnValue('mock-token')
}))

import { prisma } from '../lib/prisma'

const app = express()
app.use(express.json())
app.post('/api/auth/register', register)

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a user and returns a token on valid input', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'clx123',
      name: 'Jacob',
      email: 'jacob@example.com',
      password: 'hashed',
      emailVerified: false,
      verificationToken: 'tok',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com',
      password: 'password123'
    })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBe('mock-token')
    expect(res.body.data.user.email).toBe('jacob@example.com')
  })

  it('returns 400 when email already exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'existing',
      name: 'Old',
      email: 'jacob@example.com',
      password: 'hashed',
      emailVerified: false,
      verificationToken: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com',
      password: 'password123'
    })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('Email already in use')
  })

  it('returns 400 with field error when name is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'jacob@example.com',
      password: 'password123'
    })
    expect(res.status).toBe(400)
    expect(res.body.fields.name).toBeDefined()
  })

  it('returns 400 with field error when email is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      password: 'password123'
    })
    expect(res.status).toBe(400)
    expect(res.body.fields.email).toBeDefined()
  })

  it('returns 400 with field error when password is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com'
    })
    expect(res.status).toBe(400)
    expect(res.body.fields.password).toBeDefined()
  })

  it('rejects invalid email format', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'not-an-email',
      password: 'password123'
    })
    expect(res.status).toBe(400)
    expect(res.body.fields.email).toBeDefined()
  })

  it('rejects password shorter than 6 characters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com',
      password: 'abc'
    })
    expect(res.status).toBe(400)
    expect(res.body.fields.password).toBeDefined()
  })
})
