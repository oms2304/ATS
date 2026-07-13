import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import OpenAI from 'openai'

const apiKey = process.env.OPENAI_API_KEY
const isOpenRouter = !!apiKey && apiKey.startsWith('sk-or-')

const openai = new OpenAI({
  apiKey,
  baseURL: isOpenRouter ? 'https://openrouter.ai/api/v1' : undefined,
})

const RESUME_MODEL =
  process.env.AI_MODEL ?? (isOpenRouter ? 'openai/gpt-4o' : 'gpt-4o')

async function getFullProfile(userId: string) {
  const [profile, experiences, educations, skills, preferences] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.experience.findMany({ where: { userId }, orderBy: { order: 'asc' } }),
    prisma.education.findMany({ where: { userId }, orderBy: { order: 'asc' } }),
    prisma.skill.findMany({ where: { userId }, orderBy: { order: 'asc' } }),
    prisma.careerPreferences.findUnique({ where: { userId } }),
  ])

  return { profile, experiences, educations, skills, preferences }
}

function buildProfileText(data: Awaited<ReturnType<typeof getFullProfile>>): string {
  const { profile, experiences, educations, skills, preferences } = data
  const lines: string[] = []

  if (profile) {
    lines.push(`Name: ${profile.firstName} ${profile.lastName}`)
    if (profile.location) lines.push(`Location: ${profile.location}`)
    if (profile.linkedIn) lines.push(`LinkedIn: ${profile.linkedIn}`)
    if (profile.summary) lines.push(`\nSummary:\n${profile.summary}`)
  }

  if (experiences.length > 0) {
    lines.push('\nWork Experience:')
    for (const exp of experiences) {
      const end = exp.isCurrent ? 'Present' : exp.endDate ? new Date(exp.endDate).getFullYear() : ''
      lines.push(`- ${exp.title} at ${exp.company} (${new Date(exp.startDate).getFullYear()} - ${end})`)
      if (exp.description) lines.push(`  ${exp.description}`)
    }
  }

  if (educations.length > 0) {
    lines.push('\nEducation:')
    for (const edu of educations) {
      lines.push(`- ${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''} from ${edu.school}`)
    }
  }

  if (skills.length > 0) {
    lines.push('\nSkills:')
    lines.push(skills.map(s => s.name).join(', '))
  }

  if (preferences) {
    if (preferences.targetRoles.length > 0) {
      lines.push(`\nTarget Roles: ${preferences.targetRoles.join(', ')}`)
    }
    if (preferences.workMode) {
      lines.push(`Work Mode Preference: ${preferences.workMode}`)
    }
  }

  return lines.join('\n')
}

export async function generateResume(req: Request, res: Response) {
  try {
    const { jobId } = req.body

    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId is required' })
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } })

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' })
    }

    if (job.user_id !== req.user!.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const profileData = await getFullProfile(req.user!.userId)
    const profileText = buildProfileText(profileData)

    const completion = await openai.chat.completions.create({
      model: RESUME_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a professional resume writer. Write clear, concise, and tailored resumes. Use action verbs. Focus on achievements. Format with clear sections.',
        },
        {
          role: 'user',
          content: `Write a tailored resume for this candidate applying to the following job.

CANDIDATE PROFILE:
${profileText}

JOB POSTING:
${job.jobPostingBody}

Write a complete resume with these sections: Summary, Work Experience, Education, Skills. Tailor the content to match the job requirements. Keep it to one page worth of content.`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    })

    const draft = completion.choices[0]?.message?.content

    if (!draft) {
      return res.status(500).json({ success: false, error: 'AI did not return a response' })
    }

    return res.json({ success: true, data: { draft } })
  } catch (error) {
    console.error('generateResume error:', error)
    return res.status(500).json({ success: false, error: 'Failed to generate resume' })
  }
}

export async function generateCoverLetter(req: Request, res: Response) {
  try {
    const { jobId } = req.body

    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId is required' })
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } })

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' })
    }

    if (job.user_id !== req.user!.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const profileData = await getFullProfile(req.user!.userId)
    const profileText = buildProfileText(profileData)

    const completion = await openai.chat.completions.create({
      model: RESUME_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a professional cover letter writer. Write concise, tailored cover letters (3 short paragraphs) that connect the candidate\'s experience to the job, sound authentic, and avoid clichés.',
        },
        {
          role: 'user',
          content: `Write a tailored cover letter for this candidate applying to the following job.

CANDIDATE PROFILE:
${profileText}

JOB POSTING:
${job.jobPostingBody}

Write a cover letter addressed generically (e.g. "Dear Hiring Team,"). Do not invent placeholder names, contact info, or company facts. Do not include a subject line or the candidate's address block. Keep it under approximately 250 words and focus on 1-2 concrete experiences from the candidate's profile that match the job requirements.`,
        },
      ],
      max_tokens: 700,
      temperature: 0.7,
    })

    const draft = completion.choices[0]?.message?.content

    if (!draft) {
      return res.status(500).json({ success: false, error: 'AI did not return a response' })
    }

    return res.json({ success: true, data: { draft } })
  } catch (error) {
    console.error('generateCoverLetter error:', error)
    return res.status(500).json({ success: false, error: 'Failed to generate cover letter' })
  }
}

export async function rewriteDraft(req: Request, res: Response) {
  try {
    const { content, instruction } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: { content: ['Content is required'] },
      })
    }

    if (!instruction || !instruction.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields: { instruction: ['Instruction is required'] },
      })
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional writing assistant. Rewrite and improve documents based on user instructions. Keep the same general content and intent but improve based on the instruction.',
        },
        {
          role: 'user',
          content: `Here is the current draft:

${content}

Instruction: ${instruction}

Rewrite the draft following the instruction above. Return only the rewritten content with no additional commentary.`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    })

    const draft = completion.choices[0]?.message?.content

    if (!draft) {
      return res.status(500).json({ success: false, error: 'AI did not return a response' })
    }

    return res.json({ success: true, data: { draft } })
  } catch (error) {
    console.error('rewriteDraft error:', error)
    return res.status(500).json({ success: false, error: 'Failed to rewrite draft' })
  }
}

export async function generateCompanyResearch(req: Request, res: Response) {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const jobId = req.params.jobId as string
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' })
    if (job.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }

    const { context } = req.body as { context?: string }

    const completion = await openai.chat.completions.create({
      model: RESUME_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a company research assistant helping a job candidate prepare. Write factual, concise notes about the company based on what is publicly known and reasonable to infer from the job posting. Never invent specific numbers, funding amounts, executive names, or statistics you cannot verify — instead describe what the candidate should look up themselves.',
        },
        {
          role: 'user',
          content: `Company: ${job.company}
Job title: ${job.title}
Job posting:
${job.jobPostingBody}
${context ? `\nAdditional context from the candidate:\n${context}` : ''}

Write structured research notes covering: what the company likely does, what this role's focus probably is based on the posting, and 3-4 questions the candidate should research or ask about before interviewing. Keep it concise, use short paragraphs or bullet points.`,
        },
      ],
      max_tokens: 700,
      temperature: 0.4,
    })

    const draft = completion.choices[0]?.message?.content
    if (!draft) {
      return res.status(500).json({ success: false, error: 'AI did not return a response' })
    }

    return res.json({ success: true, data: { draft } })
  } catch (error) {
    console.error('generateCompanyResearch error:', error)
    return res.status(500).json({ success: false, error: 'Failed to generate company research' })
  }
}