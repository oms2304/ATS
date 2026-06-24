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

const STAGE_PROGRESS_COLOR: Record<string, string> = {
  Interested: '#8b949e',
  Applied: '#2f81f4',
  Interview: '#bc8cff',
  Offer: '#3fb950',
  Rejected: '#f85149',
  Archived: '#8b949e',
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

function getDaysSinceUpdate(updatedAt: string): number {
  const updated = new Date(updatedAt)
  const now = new Date()
  const diff = now.getTime() - updated.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

interface JobCardProps {
  job: Job
  onEdit: (job: Job) => void
}

export function JobCard({ job, onEdit }: JobCardProps) {
  const badge = STAGE_BADGE[job.stage] ?? STAGE_BADGE.Interested
  const progress = STAGE_PROGRESS[job.stage] ?? 0
  const progressColor = STAGE_PROGRESS_COLOR[job.stage] ?? '#2f81f4'
  const daysSinceUpdate = getDaysSinceUpdate(job.updatedAt)
  const isStale = daysSinceUpdate >= 7 && job.stage !== 'Rejected' && job.stage !== 'Archived'
  const isTerminal = job.stage === 'Rejected' || job.stage === 'Archived'

  return (
    <Link
      href={`/jobs/${job.id}`}
      data-testid="job-card"
      className={`bg-[#161b22] border rounded-lg p-4 transition-colors cursor-pointer block ${
        isTerminal
          ? 'border-[#30363d] opacity-60'
          : isStale
          ? 'border-[#f0883e] hover:border-[#f0883e]'
          : 'border-[#30363d] hover:border-[#2f81f4]'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <p className="text-xs text-[#8b949e]" data-testid="job-company">{job.company}</p>
        <div className="flex items-center gap-1">
          {isStale && (
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: '#3d2a1e', color: '#f0883e' }}
              data-testid="job-stale"
            >
              Stale
            </span>
          )}
          <span
            className="text-xs px-2 py-1 rounded"
            style={{ backgroundColor: badge.bg, color: badge.text }}
            data-testid="job-stage"
          >
            {job.stage}
          </span>
        </div>
      </div>
      <h3 className="text-white font-medium mb-1" data-testid="job-title">{job.title}</h3>
      <p className="text-xs text-[#8b949e] mb-3" data-testid="job-date">
        Updated {formatDate(job.updatedAt)}
      </p>
      <div className="h-1.5 w-full rounded-full bg-[#21262d] mb-4">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${progress}%`, backgroundColor: progressColor }}
          data-testid="job-progress"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onEdit(job)
          }}
          className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
        >
          Edit
        </button>
        <span className="text-xs px-3 py-1.5 text-[#8b949e] rounded">
          View
        </span>
      </div>
    </Link>
  )
}