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
    researchNote: {
      upsert: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
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
    researchNote: {
      upsert: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
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
import { generateResume, generateCoverLetter, rewriteDraft, generateCompanyResearch } from '../controllers/ai.controller'
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
app.post('/api/ai/rewrite', authMiddleware, rewriteDraft)
app.post('/api/ai/jobs/:jobId/generate-research', authMiddleware, generateCompanyResearch)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.experience.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.education.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.skill.findMany).mockResolvedValue([] as any)
  vi.mocked(prisma.careerPreferences.findUnique).mockResolvedValue(null as any)
  vi.mocked(prisma.profile.findUnique).mockResolvedValue(null as any)
  vi.mocked(prisma.revokedToken.findUnique).mockResolvedValue(null as any)
  vi.mocked(prisma.researchNote.upsert).mockResolvedValue(null as any)
  vi.mocked(prisma.researchNote.findUnique).mockResolvedValue(null as any)
  vi.mocked(prisma.researchNote.delete).mockResolvedValue(null as any)
  vi.mocked(prisma.researchNote.create).mockResolvedValue(null as any)
  vi.mocked(prisma.researchNote.update).mockResolvedValue(null as any)
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

describe('rewriteDraft (controller)', () => {
  it('returns 200 with a non-empty draft string for valid content and instruction', async () => {
    const req = mockReq({
      body: { content: 'This is my current draft paragraph.', instruction: 'Make it more formal' },
    })
    const res = mockRes()
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Rewritten and improved draft content' } }],
    })

    await rewriteDraft(req, res)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { draft: 'Rewritten and improved draft content' },
    })
  })

  it('returns 400 with field error on content when content is missing', async () => {
    const req = mockReq({ body: { instruction: 'Make it more formal' } })
    const res = mockRes()

    await rewriteDraft(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      fields: { content: ['Content is required'] },
    })
  })

  it('returns 400 with field error on content when content is an empty string', async () => {
    const req = mockReq({ body: { content: '', instruction: 'Make it more formal' } })
    const res = mockRes()

    await rewriteDraft(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      fields: { content: ['Content is required'] },
    })
  })

  it('returns 400 with field error on content when content is only whitespace', async () => {
    const req = mockReq({ body: { content: '   \n  ', instruction: 'Make it more formal' } })
    const res = mockRes()

    await rewriteDraft(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      fields: { content: ['Content is required'] },
    })
  })

  it('returns 400 with field error on instruction when instruction is missing', async () => {
    const req = mockReq({ body: { content: 'Some draft content here' } })
    const res = mockRes()

    await rewriteDraft(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      fields: { instruction: ['Instruction is required'] },
    })
  })

  it('returns 400 with field error on instruction when instruction is an empty string', async () => {
    const req = mockReq({ body: { content: 'Some draft content here', instruction: '' } })
    const res = mockRes()

    await rewriteDraft(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      fields: { instruction: ['Instruction is required'] },
    })
  })

  it('returns 400 with field error on instruction when instruction is only whitespace', async () => {
    const req = mockReq({ body: { content: 'Some draft content here', instruction: '   ' } })
    const res = mockRes()

    await rewriteDraft(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      fields: { instruction: ['Instruction is required'] },
    })
  })

  it('returns 200 with a draft for very long content', async () => {
    const longContent = 'This is a sentence. '.repeat(500).trim()
    const req = mockReq({
      body: { content: longContent, instruction: 'Summarize it' },
    })
    const res = mockRes()
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Summary of the long content' } }],
    })

    await rewriteDraft(req, res)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { draft: 'Summary of the long content' },
    })
  })

  it('returns 500 with "AI did not return a response" when OpenAI returns empty content', async () => {
    const req = mockReq({
      body: { content: 'Some draft content here', instruction: 'Make it better' },
    })
    const res = mockRes()
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: '' } }],
    })

    await rewriteDraft(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'AI did not return a response',
    })
  })
})

describe('POST /api/ai/rewrite (full route)', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .post('/api/ai/rewrite')
      .send({ content: 'Some draft', instruction: 'Improve it' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'No token provided' })
  })

  it('returns 200 with draft for a valid token and body', async () => {
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Improved draft content' } }],
    })

    const token = makeToken()
    const res = await request(app)
      .post('/api/ai/rewrite')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Original draft content', instruction: 'Make it more concise' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      data: { draft: 'Improved draft content' },
    })
  })
})

describe('generateCompanyResearch (controller)', () => {
  it('returns 200 with a non-empty draft string for a valid job owned by the user', async () => {
    const req = mockReq({ params: { jobId: 'job-1' }, body: { context: 'I already know they use React' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Structured research notes draft here' } }],
    })

    await generateCompanyResearch(req, res)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { draft: 'Structured research notes draft here' },
    })
  })

  it('returns 200 with a draft when no optional context is provided', async () => {
    const req = mockReq({ params: { jobId: 'job-1' }, body: {} })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Notes without extra context' } }],
    })

    await generateCompanyResearch(req, res)

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { draft: 'Notes without extra context' },
    })
  })

  it('returns 401 with "Unauthorized" when no user is present on the request', async () => {
    const req = mockReq({ user: undefined, params: { jobId: 'job-1' } })
    const res = mockRes()

    await generateCompanyResearch(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Unauthorized',
    })
  })

  it('returns 404 with "Job not found" when the job does not exist', async () => {
    const req = mockReq({ params: { jobId: 'job-999' }, body: {} })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null)

    await generateCompanyResearch(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Job not found',
    })
  })

  it('returns 403 with "Access denied" when the job is owned by another user', async () => {
    const req = mockReq({ params: { jobId: 'job-1' }, body: {} })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue({
      ...fakeJob,
      user_id: 'someone-else',
    } as any)

    await generateCompanyResearch(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Access denied',
    })
  })

  it('returns 500 with "AI did not return a response" when OpenAI returns empty content', async () => {
    const req = mockReq({ params: { jobId: 'job-1' }, body: {} })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: '' } }],
    })

    await generateCompanyResearch(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'AI did not return a response',
    })
  })

  it('returns 500 with "AI did not return a response" when OpenAI returns no choices', async () => {
    const req = mockReq({ params: { jobId: 'job-1' }, body: {} })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({ choices: [] })

    await generateCompanyResearch(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'AI did not return a response',
    })
  })

  it('does not write to researchNote or call any researchNote method (regression)', async () => {
    const req = mockReq({ params: { jobId: 'job-1' }, body: { context: 'Some context' } })
    const res = mockRes()
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Research notes draft' } }],
    })

    await generateCompanyResearch(req, res)

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { draft: expect.any(String) } })
    expect(prisma.researchNote.upsert).not.toHaveBeenCalled()
    expect(prisma.researchNote.findUnique).not.toHaveBeenCalled()
    expect(prisma.researchNote.delete).not.toHaveBeenCalled()
    expect(prisma.researchNote.create).not.toHaveBeenCalled()
    expect(prisma.researchNote.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/ai/jobs/:jobId/generate-research (full route)', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app)
      .post('/api/ai/jobs/job-1/generate-research')
      .send({ context: 'Some context' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ success: false, error: 'No token provided' })
  })

  it('returns 200 with draft for a valid token, job, and body', async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue(fakeJob as any)
    openaiCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'Tailored research notes content' } }],
    })

    const token = makeToken()
    const res = await request(app)
      .post('/api/ai/jobs/job-1/generate-research')
      .set('Authorization', `Bearer ${token}`)
      .send({ context: 'Optional context' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      success: true,
      data: { draft: 'Tailored research notes content' },
    })
  })
})