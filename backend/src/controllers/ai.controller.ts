import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
      model: 'gpt-4o',
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