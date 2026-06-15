'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { JobModal } from '@/components/forms/job-modal'

type Job = {
  id: string
  title: string
  company: string
  jobPostingBody: string
  stage: string
  createdAt: string
  updatedAt: string
}

const STAGES = ['Interested', 'Applied', 'Interview', 'Offer', 'Rejected', 'Archived'] as const

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

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [updatingStage, setUpdatingStage] = useState(false)

  useEffect(() => {
    async function fetchJob() {
      const res = await apiFetch(`/api/jobs/${id}`)
      if (res.success) {
        setJob(res.data)
      } else if (res.status === 404) {
        setNotFound(true)
      }
      setLoading(false)
    }
    fetchJob()
  }, [id])

  function handleEdit() {
    setModalOpen(true)
  }

  async function handleDelete() {
    if (deleting) return
    if (typeof window !== 'undefined' && !window.confirm('Delete this job? This cannot be undone.')) {
      return
    }
    setDeleting(true)
    const res = await apiFetch(`/api/jobs/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.success) {
      router.push('/dashboard')
    }
  }

  async function handleStageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextStage = e.target.value
    if (!job || nextStage === job.stage || updatingStage) return
    setUpdatingStage(true)
    const previousStage = job.stage
    setJob({ ...job, stage: nextStage })
    const res = await apiFetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: nextStage }),
    })
    setUpdatingStage(false)
    if (!res.success) {
      setJob({ ...job, stage: previousStage })
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0d1117] p-6 text-[#8b949e]">Loading...</div>
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-[#0d1117] p-6 text-[#e6edf3]">
        <Link
          href="/dashboard"
          className="text-sm text-[#2f81f4] hover:underline"
        >
          &larr; Back to dashboard
        </Link>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="text-2xl font-semibold text-white mb-2">Job not found</h1>
          <p className="text-[#8b949e]">
            This job may have been deleted or you do not have access to it.
          </p>
        </div>
      </div>
    )
  }

  const badge = STAGE_BADGE[job.stage] ?? STAGE_BADGE.Interested
  const progress = STAGE_PROGRESS[job.stage] ?? 0

  return (
    <div className="min-h-screen bg-[#0d1117] p-6 text-[#e6edf3]">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard"
          className="text-sm text-[#2f81f4] hover:underline mb-4 inline-block"
        >
          &larr; Back to dashboard
        </Link>

        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
          <div className="flex justify-between items-start mb-3 gap-4">
            <div>
              <p className="text-sm text-[#8b949e] mb-1">{job.company}</p>
              <h1 className="text-2xl font-semibold text-white">{job.title}</h1>
            </div>
            <label className="shrink-0" title="Click to change status">
              <span className="sr-only">Stage</span>
              <select
                value={job.stage}
                onChange={handleStageChange}
                disabled={updatingStage}
                className="text-xs px-2 py-1 rounded appearance-none cursor-pointer outline-none focus:ring-1 focus:ring-[#2f81f4] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: badge.bg, color: badge.text }}
              >
                {STAGES.map((stage) => (
                  <option key={stage} value={stage} className="bg-[#161b22] text-white">
                    {stage}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="h-1.5 w-full rounded-full bg-[#21262d] mb-6">
            <div
              className="h-1.5 rounded-full bg-[#2f81f4] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p className="text-[#8b949e] mb-1">Created</p>
              <p className="text-white">{formatDate(job.createdAt) || '—'}</p>
            </div>
            <div>
              <p className="text-[#8b949e] mb-1">Updated</p>
              <p className="text-white">{formatDate(job.updatedAt) || '—'}</p>
            </div>
          </div>

          <div className="border-t border-[#30363d] pt-6">
            <h2 className="text-sm font-semibold text-white mb-3">Job Posting</h2>
            <div className="text-sm text-[#e6edf3] whitespace-pre-wrap leading-relaxed">
              {job.jobPostingBody || (
                <span className="text-[#8b949e] italic">No job posting body provided.</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-6 mt-6 border-t border-[#30363d]">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs px-3 py-1.5 border border-[#30363d] text-[#f85149] rounded hover:border-[#f85149] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={handleEdit}
              className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      <JobModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        jobId={job.id}
        initialData={{
          title: job.title,
          company: job.company,
          jobPostingBody: job.jobPostingBody,
          stage: job.stage,
        }}
        onSuccess={(updated) => {
          setJob(updated as Job)
        }}
      />
    </div>
  )
}
