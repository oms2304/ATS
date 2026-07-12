import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

export async function getDashboardMetrics(req: Request, res: Response) {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const jobs = await prisma.job.findMany({
      where: { user_id: userId, archivedAt: null },   // exclude archived from metrics
    })

    // Stage counts
    const stageCounts: Record<string, number> = {
      Interested: 0,
      Applied: 0,
      Interview: 0,
      Offer: 0,
      Rejected: 0,
      Archived: 0,
    }
    jobs.forEach((job) => {
      if (stageCounts[job.stage] !== undefined) {
        stageCounts[job.stage]++
      }
    })

    // Response tracking
    const totalApplied = jobs.filter(j => j.stage !== 'Interested').length
    const totalResponded = jobs.filter(j => ['Interview', 'Offer', 'Rejected'].includes(j.stage)).length
    const responseRate = totalApplied > 0 ? Math.round((totalResponded / totalApplied) * 100) : 0

    // S3-014 / S3-BR-013: Velocity = count of Interested -> Applied transitions
    // in a rolling 7-day window, scoped to this user's jobs.
    const jobIds = jobs.map(j => j.id)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS)

    const velocity = jobIds.length === 0 ? 0 : await prisma.stageTransition.count({
      where: {
        job_id: { in: jobIds },
        fromStage: 'Interested',
        toStage: 'Applied',
        changedAt: { gte: sevenDaysAgo },
      },
    })

    // S3-014 / S3-BR-014: Stage conversion = percentage of jobs that reached
    // Applied which also reached Interview within 14 days of that Applied
    // transition, using persisted timestamps (S3-BR-015).
    const appliedTransitions = jobIds.length === 0 ? [] : await prisma.stageTransition.findMany({
      where: {
        job_id: { in: jobIds },
        toStage: 'Applied',
      },
      orderBy: { changedAt: 'asc' },
    })

    const interviewTransitions = jobIds.length === 0 ? [] : await prisma.stageTransition.findMany({
      where: {
        job_id: { in: jobIds },
        toStage: 'Interview',
      },
      orderBy: { changedAt: 'asc' },
    })

    // Use the earliest Applied transition per job (a job can only meaningfully
    // "convert" once), then check for an Interview transition on the same job
    // within 14 days of that Applied timestamp.
    const firstAppliedByJob = new Map<string, Date>()
    for (const t of appliedTransitions) {
      if (!firstAppliedByJob.has(t.job_id)) {
        firstAppliedByJob.set(t.job_id, t.changedAt)
      }
    }

    const interviewsByJob = new Map<string, Date[]>()
    for (const t of interviewTransitions) {
      const list = interviewsByJob.get(t.job_id) ?? []
      list.push(t.changedAt)
      interviewsByJob.set(t.job_id, list)
    }

    let convertedCount = 0
    for (const [jobId, appliedAt] of firstAppliedByJob) {
      const interviewDates = interviewsByJob.get(jobId) ?? []
      const converted = interviewDates.some(
        (d) => d.getTime() - appliedAt.getTime() <= FOURTEEN_DAYS_MS && d.getTime() >= appliedAt.getTime()
      )
      if (converted) convertedCount++
    }

    const totalAppliedTransitions = firstAppliedByJob.size
    const stageConversionRate = totalAppliedTransitions > 0
      ? Math.round((convertedCount / totalAppliedTransitions) * 100)
      : 0

    return res.status(200).json({
      success: true,
      data: {
        stageCounts,
        totalJobs: jobs.length,
        totalApplied,
        totalResponded,
        responseRate,
        velocity,
        stageConversionRate,
      }
    })
  } catch (error) {
    console.error('metrics error:', error)
    return res.status(500).json({ success: false, error: 'Failed to fetch metrics' })
  }
}
