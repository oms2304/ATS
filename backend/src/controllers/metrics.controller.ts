import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

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

    return res.status(200).json({
      success: true,
      data: {
        stageCounts,
        totalJobs: jobs.length,
        totalApplied,
        totalResponded,
        responseRate,
      }
    })
  } catch (error) {
    console.error('metrics error:', error)
    return res.status(500).json({ success: false, error: 'Failed to fetch metrics' })
  }
}