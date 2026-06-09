import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { register, login } from '../controllers/auth.controller'

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  },
  default: {
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

import type { User } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { sendVerificationEmail } from '../lib/email'
import { signToken } from '../lib/jwt'

const app = express()
app.use(express.json())
app.post('/api/auth/register', register)

const mockUser = {
  id: 'clx123',
  name: 'Jacob',
  email: 'jacob@example.com',
  password: 'hashed',
  is_verified: false,
  ver_token: 'tok',
  reset_token: null,
  reset_token_expire: null,
  createdAt: new Date(),
  updatedAt: new Date()
} as unknown as User

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a user and returns 201 with token on valid input', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser)

    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com',
      password: 'password123'
    })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBe('mock-token')
    expect(res.body.data.user.email).toBe('jacob@example.com')
    expect(signToken).toHaveBeenCalledWith({
      userId: 'clx123',
      email: 'jacob@example.com'
    })
    expect(sendVerificationEmail).toHaveBeenCalledWith('jacob@example.com', expect.any(String))
  })

  it('hashes password before saving', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser)

    await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com',
      password: 'password123'
    })

    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0]
    expect(createCall.data.password).not.toBe('password123')
    expect(createCall.data.password).toBeTruthy()
  })

  it('creates an empty profile linked to the user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser)

    await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com',
      password: 'password123'
    })

    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0]
    const createData = createCall.data as { profile?: unknown }
    expect(createData.profile).toEqual({
      create: {
        first_name: '',
        last_name: '',
        completion_score: 0
      }
    })
  })

  it('returns 400 when email already exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

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

  it('rejects password shorter than 8 characters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com',
      password: 'abc123'
    })

    expect(res.status).toBe(400)
    expect(res.body.fields.password).toBeDefined()
  })

  it('rejects password without a number', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com',
      password: 'passwordonly'
    })

    expect(res.status).toBe(400)
    expect(res.body.fields.password).toBeDefined()
  })

  it('rejects password without a letter', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com',
      password: '12345678'
    })

    expect(res.status).toBe(400)
    expect(res.body.fields.password).toBeDefined()
  })

  it('ignores extra fields in request body', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser)

    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com',
      password: 'password123',
      role: 'admin',
      isAdmin: true
    })

    expect(res.status).toBe(201)
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0]
    expect(createCall.data).not.toHaveProperty('role')
    expect(createCall.data).not.toHaveProperty('isAdmin')
  })
})

const loginApp = express()
loginApp.use(express.json())
loginApp.post('/api/auth/login', login)

const TEST_SECRET = 'test-secret'
const loginPassword = 'password123'
const loginPasswordHash = bcrypt.hashSync(loginPassword, 10)
const loginUser = { ...mockUser, password: loginPasswordHash } as unknown as User

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with token and user info on valid credentials', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(loginUser)

    const res = await request(loginApp).post('/api/auth/login').send({
      email: 'jacob@example.com',
      password: loginPassword
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBe('mock-token')
    expect(res.body.data.user).toEqual({
      id: 'clx123',
      name: 'Jacob',
      email: 'jacob@example.com'
    })
    expect(signToken).toHaveBeenCalledWith({
      userId: 'clx123',
      email: 'jacob@example.com'
    })
  })

  it('returns a valid JWT that can be verified', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(loginUser)

    const realToken = jwt.sign(
      { userId: 'clx123', email: 'jacob@example.com' },
      TEST_SECRET,
      { expiresIn: '7d' }
    )
    vi.mocked(signToken).mockReturnValueOnce(realToken)

    const res = await request(loginApp).post('/api/auth/login').send({
      email: 'jacob@example.com',
      password: loginPassword
    })

    expect(res.status).toBe(200)
    const decoded = jwt.verify(res.body.data.token, TEST_SECRET)
    expect(decoded).toMatchObject({
      userId: 'clx123',
      email: 'jacob@example.com'
    })
  })

  it('returns 401 with generic error on wrong password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(loginUser)

    const res = await request(loginApp).post('/api/auth/login').send({
      email: 'jacob@example.com',
      password: 'wrongpassword1'
    })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      success: false,
      error: 'Invalid email or password'
    })
  })

  it('returns 401 with generic error when email not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const res = await request(loginApp).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: loginPassword
    })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({
      success: false,
      error: 'Invalid email or password'
    })
  })

  it('uses the same generic error for wrong email and wrong password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
    const wrongEmail = await request(loginApp).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: loginPassword
    })

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(loginUser)
    const wrongPassword = await request(loginApp).post('/api/auth/login').send({
      email: 'jacob@example.com',
      password: 'wrongpassword1'
    })

    expect(wrongEmail.body.error).toBe(wrongPassword.body.error)
    expect(wrongEmail.body.error).toBe('Invalid email or password')
  })

  it('returns 400 with field error when email is missing', async () => {
    const res = await request(loginApp).post('/api/auth/login').send({
      password: loginPassword
    })

    expect(res.status).toBe(400)
    expect(res.body.fields.email).toBeDefined()
  })

  it('returns 400 with field error when password is missing', async () => {
    const res = await request(loginApp).post('/api/auth/login').send({
      email: 'jacob@example.com'
    })

    expect(res.status).toBe(400)
    expect(res.body.fields.password).toBeDefined()
  })

  it('returns 400 on invalid email format', async () => {
    const res = await request(loginApp).post('/api/auth/login').send({
      email: 'not-an-email',
      password: loginPassword
    })

    expect(res.status).toBe(400)
    expect(res.body.fields.email).toBeDefined()
  })

  it('returns 400 on empty request body', async () => {
    const res = await request(loginApp).post('/api/auth/login').send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.fields).toBeDefined()
  })
})
