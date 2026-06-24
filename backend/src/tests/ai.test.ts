import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response } from 'express'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret'
process.env.OPENAI_API_KEY = 'test-openai-key'

const { openaiCreateMock } = vi.hoisted(() => ({
  openaiCreateMock: vi.fn(),
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    job: {
      findUnique: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
    },
    experience: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    education: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    skill: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    careerPreferences: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    revokedToken: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
  default: {
    job: {
      findUnique: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
    },
    experience: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    education: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    skill: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    careerPreferences: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    revokedToken: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}))

vi.mock('openai', () => {
  class OpenAIMock {
    chat = {
      completions: {
        create: openaiCreateMock,
      },
    }
  }
  return { default: OpenAIMock }
})

import { prisma } from '../lib/prisma'
import { generateResume, generateCoverLetter } from '../controllers/ai.controller'
import { authMiddleware } from '../middleware/auth.middleware'

const mockRes = () => {
  const res = {} as Response
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.send = vi.fn().mockReturnValue(res)
  return res
}

const mockReq = (overrides = {}) =>
  ({
    user: { userId: 'user-123', email: 'test@test.com' },
    body: {},
    params: {},
    ...overrides,
  }) as any as Request

const fakeJob = {
  id: 'job-1',
  user_id: 'user-123',
  title: 'Senior Engineer',
  company: 'Acme',
  jobPostingBody: 'We are hiring a senior engineer with React experience.',
  stage: 'Interested',
}

function makeToken(userId = 'user-123', email = 'test@test.com') {
  return jwt.sign({ userId, email }, 'test-secret', { expiresIn: '7d' })
}

const app = express()
app.use(express.json())
app.post('/api/ai/generate-resume', authMiddleware, generateResume)
app.post('/api/ai/generate-cover-letter', authMiddleware, generateCoverLetter)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.experience.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.education.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.skill.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.careerPreferences.findUnique).mockResolvedValue(null as any)
  vi.mocked(prisma.profile.findUnique).mockResolvedValue(null as any)
  vi.mocked(prisma.revokedToken.findUnique).mockResolvedValue(null as any)
})

describe('generateResume (controller)', () => {
  it('returns 200 with a non-empty draft string for a valid job owned by the user', async () => {
    const req = mockReq({ body: { jobId: 'job-1' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Generated resume draft here' } }],
    })

    await generateResume(req, res)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { draft: 'Generated resume draft here' },
    })
  })

  it('returns 400 with "jobId is required" when jobId is missing', async () => {
    const req = mockReq({ body: {} })
    const res = mockRes()

    await generateResume(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'jobId is required',
    })
  })

  it('returns 404 with "Job not found" when the job does not exist', async () => {
    const req = mockReq({ body: { jobId: 'job-999' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null)

    await generateResume(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Job not found',
    })
  })

  it('returns 403 with "Access denied" when the job is owned by another user', async () => {
    const req = mockReq({ body: { jobId: 'job-1' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      ...fakeJob,
      user_id: 'someone-else',
    } as any)

    await generateResume(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Access denied',
    })
  })

  it('returns 500 with "AI did not return a response" when OpenAI returns empty content', async () => {
    const req = mockReq({ body: { jobId: 'job-1' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: '' } }],
    })

    await generateResume(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'AI did not return a response',
    })
  })

  it('returns 500 with "AI did not return a response" when OpenAI returns no choices', async () => {
    const req = mockReq({ body: { jobId: 'job-1' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({ choices: [] })

    await generateResume(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'AI did not return a response',
    })
  })
})

describe('POST /api/ai/generate-resume (full route)', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .post('/api/ai/generate-resume')
      .send({ jobId: 'job-1' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'No token provided' })
  })

  it('returns 200 with draft for a valid token and job', async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Tailored resume content' } }],
    })

    const token = makeToken()
    const res = await request(app)
      .post('/api/ai/generate-resume')
      .set('Authorization', `Bearer ${token}`)
      .send({ jobId: 'job-1' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      data: { draft: 'Tailored resume content' },
    })
  })
})

describe('generateCoverLetter (controller)', () => {
  it('returns 200 with a non-empty draft string for a valid job owned by the user', async () => {
    const req = mockReq({ body: { jobId: 'job-1' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Generated cover letter draft here' } }],
    })

    await generateCoverLetter(req, res)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { draft: 'Generated cover letter draft here' },
    })
  })

  it('returns 400 with "jobId is required" when jobId is missing', async () => {
    const req = mockReq({ body: {} })
    const res = mockRes()

    await generateCoverLetter(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'jobId is required',
    })
  })

  it('returns 404 with "Job not found" when the job does not exist', async () => {
    const req = mockReq({ body: { jobId: 'job-999' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null)

    await generateCoverLetter(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Job not found',
    })
  })

  it('returns 403 with "Access denied" when the job is owned by another user', async () => {
    const req = mockReq({ body: { jobId: 'job-1' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      ...fakeJob,
      user_id: 'someone-else',
    } as any)

    await generateCoverLetter(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Access denied',
    })
  })

  it('returns 500 with "AI did not return a response" when OpenAI returns empty content', async () => {
    const req = mockReq({ body: { jobId: 'job-1' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: '' } }],
    })

    await generateCoverLetter(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'AI did not return a response',
    })
  })

  it('returns 500 with "AI did not return a response" when OpenAI returns no choices', async () => {
    const req = mockReq({ body: { jobId: 'job-1' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({ choices: [] })

    await generateCoverLetter(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'AI did not return a response',
    })
  })
})

describe('POST /api/ai/generate-cover-letter (full route)', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .post('/api/ai/generate-cover-letter')
      .send({ jobId: 'job-1' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'No token provided' })
  })

  it('returns 200 with draft for a valid token and job', async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Tailored cover letter content' } }],
    })

    const token = makeToken()
    const res = await request(app)
      .post('/api/ai/generate-cover-letter')
      .set('Authorization', `Bearer ${token}`)
      .send({ jobId: 'job-1' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      data: { draft: 'Tailored cover letter content' },
    })
  })
})