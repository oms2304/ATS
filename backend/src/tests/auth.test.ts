import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {
  register,
  login,
  resendVerification,
  verifyEmail,
  logout
} from '../controllers/auth.controller'

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  },
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
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

  it('creates a user and returns 201 with a verification message (no auto-login)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue(mockUser)

    const res = await request(app).post('/api/auth/register').send({
      name: 'Jacob',
      email: 'jacob@example.com',
      password: 'password123'
    })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBeUndefined()
    expect(res.body.data.message).toBeTruthy()
    expect(signToken).not.toHaveBeenCalled()
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
        firstName: '',
        lastName: '',
        completionScore: 0,
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
const loginUser = {
  ...mockUser,
  password: loginPasswordHash,
  is_verified: true
} as unknown as User
const unverifiedUser = {
  ...mockUser,
  password: loginPasswordHash,
  is_verified: false
} as unknown as User

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

  it('returns 403 with needsVerification when email is not verified', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(unverifiedUser)

    const res = await request(loginApp).post('/api/auth/login').send({
      email: 'jacob@example.com',
      password: loginPassword
    })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.needsVerification).toBe(true)
    expect(res.body.error).toBe('Please verify your email before logging in')
    expect(signToken).not.toHaveBeenCalled()
  })
})

const resendApp = express()
resendApp.use(express.json())
resendApp.post('/api/auth/resend-verification', resendVerification)

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('regenerates token and sends email for an unverified account', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(unverifiedUser)
    vi.mocked(prisma.user.update).mockResolvedValue(unverifiedUser)

    const res = await request(resendApp).post('/api/auth/resend-verification').send({
      email: 'jacob@example.com'
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledTimes(1)
    expect(sendVerificationEmail).toHaveBeenCalledWith('jacob@example.com', expect.any(String))
  })

  it('returns generic success without sending email when account does not exist', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const res = await request(resendApp).post('/api/auth/resend-verification').send({
      email: 'nobody@example.com'
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(sendVerificationEmail).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('does not send email when account is already verified', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(loginUser)

    const res = await request(resendApp).post('/api/auth/resend-verification').send({
      email: 'jacob@example.com'
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(sendVerificationEmail).not.toHaveBeenCalled()
  })

  it('returns 400 with field error on invalid email format', async () => {
    const res = await request(resendApp).post('/api/auth/resend-verification').send({
      email: 'not-an-email'
    })

    expect(res.status).toBe(400)
    expect(res.body.fields.email).toBeDefined()
  })
})

const verifyApp = express()
verifyApp.use(express.json())
verifyApp.get('/api/auth/verify-email', verifyEmail)

describe('GET /api/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies the user and clears the token on a valid token', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(unverifiedUser)
    vi.mocked(prisma.user.update).mockResolvedValue({
      ...unverifiedUser,
      is_verified: true,
      ver_token: null
    } as unknown as User)

    const res = await request(verifyApp)
      .get('/api/auth/verify-email')
      .query({ token: 'tok' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'clx123' },
      data: { is_verified: true, ver_token: null }
    })
  })

  it('returns 400 on an invalid token', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

    const res = await request(verifyApp)
      .get('/api/auth/verify-email')
      .query({ token: 'invalidtoken' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('returns 400 when no token is provided', async () => {
    const res = await request(verifyApp).get('/api/auth/verify-email')

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })
})


const logoutApp = express()
logoutApp.use(express.json())
logoutApp.post('/api/auth/logout', logout)

describe('POST /api/auth/logout', () => {
  // HAPPY PATH: logout returns 200
  it('returns 200 with success message', async () => {
    const res = await request(logoutApp).post('/api/auth/logout').send()
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.message).toBe('Logged out successfully')
  })

  // HAPPY PATH: logout works without any body
  it('returns 200 even with no request body', async () => {
    const res = await request(logoutApp).post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})