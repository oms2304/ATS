import Link from 'next/link'

type Job = {
  id: string
  title: string
  company: string
  stage: string
  updatedAt: string
}

const STAGE_BADGE: Record<string, { bg: string; text: string }> = {
  Interested: { bg: '#21262d', text: '#8b949e' },
  Applied: { bg: '#1f3d6e', text: '#58a6ff' },
  Interview: { bg: '#2d1f6e', text: '#bc8cff' },
  Offer: { bg: '#1a3d2b', text: '#3fb950' },
  Rejected: { bg: '#3d1f1f', text: '#f85149' },
  Archived: { bg: '#21262d', text: '#8b949e' },
}

const STAGE_PROGRESS: Record<string, number> = {
  Interested: 15,
  Applied: 40,
  Interview: 70,
  Offer: 100,
  Rejected: 100,
  Archived: 100,
}

function formatDate(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface JobCardProps {
  job: Job
  onEdit: (job: Job) => void
}

export function JobCard({ job, onEdit }: JobCardProps) {
  const badge = STAGE_BADGE[job.stage] ?? STAGE_BADGE.Interested
  const progress = STAGE_PROGRESS[job.stage] ?? 0

  return (
    <div
      data-testid="job-card"
      className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 hover:border-[#2f81f4] transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs text-[#8b949e]" data-testid="job-company">{job.company}</p>
        <span
          className="text-xs px-2 py-1 rounded"
          style={{ backgroundColor: badge.bg, color: badge.text }}
          data-testid="job-stage"
        >
          {job.stage}
        </span>
      </div>
      <h3 className="text-white font-medium mb-1" data-testid="job-title">{job.title}</h3>
      <p className="text-xs text-[#8b949e] mb-3" data-testid="job-date">
        Updated {formatDate(job.updatedAt)}
      </p>
      <div className="h-1.5 w-full rounded-full bg-[#21262d] mb-4">
        <div
          className="h-1.5 rounded-full bg-[#2f81f4] transition-all"
          style={{ width: `${progress}%` }}
          data-testid="job-progress"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
        <button
          onClick={() => onEdit(job)}
          className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
        >
          Edit
        </button>
        <Link
          href={`/jobs/${job.id}`}
          className="text-xs px-3 py-1.5 text-[#8b949e] rounded hover:text-white transition-colors"
        >
          View
        </Link>
      </div>
    </div>
  )
}