import Link from 'next/link'

type DocumentItem = {
  id: string
  type: string
  title: string
  content: string | null
  versionNumber: number
  updatedAt: string
  status?: string
  tags?: string[]
  job: { id: string; title: string; company: string } | null
}

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  resume: { bg: '#1f3d6e', text: '#58a6ff', label: 'Resume' },
  cover_letter: { bg: '#2d1f6e', text: '#bc8cff', label: 'Cover Letter' },
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: '#1a3d2b', text: '#3fb950', label: 'Active' },
  archived: { bg: '#21262d', text: '#8b949e', label: 'Archived' },
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

interface DocumentCardProps {
  doc: DocumentItem
  onView: (doc: DocumentItem) => void
}

// S3-001: Document Library card — mirrors JobCard visual language
// (type badge instead of stage badge, no progress bar since documents
// don't have a pipeline stage).
// S3-006: adds status badge + tag chips so filtered/sorted results are
// visually distinguishable in the grid.
export function DocumentCard({ doc, onView }: DocumentCardProps) {
  const badge = TYPE_BADGE[doc.type] ?? TYPE_BADGE.resume
  const statusBadge = doc.status ? STATUS_BADGE[doc.status] ?? STATUS_BADGE.active : null

  return (
    <div
      data-testid="document-card"
      className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 transition-colors hover:border-[#2f81f4]"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1">
          <span
            className="text-xs px-2 py-1 rounded"
            style={{ backgroundColor: badge.bg, color: badge.text }}
            data-testid="document-type"
          >
            {badge.label}
          </span>
          {statusBadge && (
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: statusBadge.bg, color: statusBadge.text }}
              data-testid="document-status"
            >
              {statusBadge.label}
            </span>
          )}
        </div>
        <span className="text-xs text-[#8b949e]" data-testid="document-version">
          v{doc.versionNumber}
        </span>
      </div>

      <h3 className="text-white font-medium mb-1 truncate" data-testid="document-title">
        {doc.title}
      </h3>

      {doc.job && (
        <p className="text-xs mb-1 truncate">
          <Link
            href={`/jobs/${doc.job.id}`}
            className="text-[#58a6ff] hover:underline"
            data-testid="document-job-link"
          >
            {doc.job.title} at {doc.job.company}
          </Link>
        </p>
      )}

      <p className="text-xs text-[#8b949e] mb-2" data-testid="document-date">
        Updated {formatDate(doc.updatedAt)}
      </p>

      {doc.tags && doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2" data-testid="document-tags">
          {doc.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full bg-[#21262d] text-[#8b949e]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
        <button
          onClick={() => onView(doc)}
          className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
          data-testid="document-view-button"
        >
          View
        </button>
      </div>
    </div>
  )
}
