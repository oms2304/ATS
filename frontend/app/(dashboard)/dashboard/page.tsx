'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, archiveJob, restoreJob } from '@/lib/api'
import { JobModal } from '@/components/forms/job-modal'
import { JobCard } from '@/components/ui/job-card'

// Mirrors backend/src/controllers/jobs.controller.ts FORWARD_TRANSITIONS.
// Drives the non-forward warning prompt on the dashboard card stage dropdown
// (S2-BR-007 / C12).
const FORWARD_TRANSITIONS: Record<string, string[]> = {
  Interested: ['Applied', 'Rejected'],
  Applied: ['Interview', 'Rejected'],
  Interview: ['Offer', 'Rejected'],
  Offer: ['Archived', 'Rejected'],
  Rejected: [],
  Archived: [],
}

type Job = {
  id: string
  title: string
  company: string
  jobPostingBody: string
  stage: string
  createdAt: string
  updatedAt: string
  archivedAt?: string | null
}

// Archived is not a transition stage (S2-BR-005); it's a separate view.
const STAGES = ['Interested', 'Applied', 'Interview', 'Offer', 'Rejected']

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('All')
  const [sortBy, setSortBy] = useState('updatedAt')
  const [showArchived, setShowArchived] = useState(false)

  const [metrics, setMetrics] = useState<{
    stageCounts: Record<string, number>
    totalJobs: number
    totalApplied: number
    totalResponded: number
    responseRate: number
  } | null>(null)

  // Refetch jobs whenever the archived view is toggled.
  useEffect(() => {
    async function fetchJobs() {
      setLoading(true)
      const res = await apiFetch(`/api/jobs${showArchived ? '?archived=true' : ''}`)
      if (res.success) setJobs(res.data)
      setLoading(false)
    }
    fetchJobs()
  }, [showArchived])

  // Metrics are independent of the archived toggle; refetched after every mutation.
  const fetchMetrics = useCallback(async () => {
    const res = await apiFetch('/api/metrics')
    if (res.success) setMetrics(res.data)
  }, [])

  // Fire-and-forget initial fetch. We don't gate render on this; the metrics
  // card simply renders once `metrics` is non-null. The refetch is idempotent
  // so a second tick (e.g. from the mutation handlers) is harmless.
  useEffect(() => {
    // setState here happens inside the async callback, not synchronously after
    // the effect body returns. The lint rule for `set-state-in-effect` is a
    // false positive for "fetch-on-mount + refetch-on-mutation" patterns, which
    // are exactly what `fetchMetrics` implements.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMetrics()
  }, [fetchMetrics])

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = jobs.filter((job) => {
      // When viewing archived, the backend already returned the right set;
      // skip the stage filter so it doesn't hide them.
      const matchesStage = showArchived || stageFilter === 'All' || job.stage === stageFilter
      const matchesSearch =
        !term ||
        job.title.toLowerCase().includes(term) ||
        job.company.toLowerCase().includes(term) ||
        job.jobPostingBody.toLowerCase().includes(term)
      return matchesStage && matchesSearch
    })

    return [...filtered].sort((a, b) => {
     if (sortBy === 'company') {
       return a.company.localeCompare(b.company)
      }
      if (sortBy === 'createdAt') {
       return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
       // default: updatedAt (last activity)
     return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
   })
  }, [jobs, search, stageFilter, sortBy, showArchived])

  function handleAddJob() {
    setEditingJob(null)
    setModalOpen(true)
  }

  function handleEditJob(job: Job) {
    setEditingJob(job)
    setModalOpen(true)
  }

  function handleJobSuccess(job: Job) {
    setJobs((prev) => {
      const exists = prev.some((j) => j.id === job.id)
      return exists ? prev.map((j) => (j.id === job.id ? job : j)) : [job, ...prev]
    })
    fetchMetrics().catch(() => { /* stats stay; non-blocking */ })
  }

  async function handleStageChange(jobId: string, nextStage: string) {
    const job = jobs.find((j) => j.id === jobId)
    if (!job || job.stage === nextStage) return

    const allowed = FORWARD_TRANSITIONS[job.stage] ?? []
    const isForward = allowed.includes(nextStage)

    if (!isForward) {
      const confirmed = window.confirm(
        `Moving from ${job.stage} to ${nextStage} is not a standard forward transition.\n\n` +
        `Allowed next stages: ${allowed.join(', ') || 'None (terminal stage)'}\n\n` +
        `Override anyway?`
      )
      if (!confirmed) return
    }

    const prev = job.stage
    setJobs((js) => js.map((j) => (j.id === jobId ? { ...j, stage: nextStage } : j)))  // optimistic
    try {
      await apiFetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          stage: nextStage,
          confirmedOverride: !isForward,
        }),
      })
      fetchMetrics().catch(() => { /* stats stay; non-blocking */ })
    } catch {
      setJobs((js) => js.map((j) => (j.id === jobId ? { ...j, stage: prev } : j)))     // rollback
    }
  }

  async function handleArchive(jobId: string) {
    const snapshot = jobs
    setJobs((js) => js.filter((j) => j.id !== jobId))  // optimistic remove from active list
    try {
      await archiveJob(jobId)
      fetchMetrics().catch(() => { /* stats stay; non-blocking */ })
    } catch {
      setJobs(snapshot)  // rollback on failure
    }
  }

  async function handleRestore(jobId: string) {
    const snapshot = jobs
    setJobs((js) => js.filter((j) => j.id !== jobId))  // optimistic remove from archived view
    try {
      await restoreJob(jobId)
      fetchMetrics().catch(() => { /* stats stay; non-blocking */ })
    } catch {
      setJobs(snapshot)  // rollback on failure
    }
  }

  if (loading) return <div className="p-6 text-[#8b949e]">Loading...</div>

  return (
    <div className="min-h-screen bg-[#0d1117] p-6 text-[#e6edf3]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">
          {showArchived ? 'Archived Jobs' : 'Dashboard'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all"
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            aria-label="Filter by stage"
            disabled={showArchived}
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all appearance-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="All">All stages</option>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort jobs"
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all appearance-none"
>
            <option value="updatedAt">Last Activity</option>
            <option value="createdAt">Date Added</option>
            <option value="company">Company</option>
          </select>

          <button
            onClick={() => setShowArchived((v) => !v)}
            data-testid="toggle-archived"
            className={`text-sm px-4 py-2 rounded border transition-colors ${
              showArchived
                ? 'bg-[#21262d] border-[#444c56] text-white'
                : 'bg-[#0d1117] border-[#30363d] text-[#8b949e] hover:text-white hover:border-[#444c56]'
            }`}
          >
            {showArchived ? 'Show active' : 'Show archived'}
          </button>

          <button
            onClick={handleAddJob}
            className="flex items-center gap-2 bg-[#2f81f4] text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors"
          >
            + Add Job
          </button>
        </div>
      </div>

      {/* Metrics Section — hidden in archived view since metrics reflect active flow */}
      {metrics && !showArchived && (
        <div data-testid="metrics-section" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-center">
          <p data-testid="metric-total-jobs" className="text-2xl font-bold text-white">{metrics.totalJobs}</p>
          <p className="text-xs text-[#8b949e] mt-1">Total Jobs</p>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-center">
          <p data-testid="metric-applied" className="text-2xl font-bold text-[#58a6ff]">{metrics.totalApplied}</p>
          <p className="text-xs text-[#8b949e] mt-1">Applied</p>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-center">
          <p data-testid="metric-responses" className="text-2xl font-bold text-[#bc8cff]">{metrics.totalResponded}</p>
          <p className="text-xs text-[#8b949e] mt-1">Responses</p>
        </div>
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-center">
          <p data-testid="metric-response-rate" className="text-2xl font-bold text-[#3fb950]">{metrics.responseRate}%</p>
          <p className="text-xs text-[#8b949e] mt-1">Response Rate</p>
        </div>
      </div>
      )}

      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-[#8b949e] text-lg mb-2">
            {showArchived
              ? 'No archived jobs'
              : jobs.length === 0
              ? 'No jobs yet'
              : 'No jobs match your filters'}
          </p>
          <p className="text-[#8b949e]/70 text-sm mb-6">
            {showArchived
              ? 'Jobs you archive will appear here'
              : jobs.length === 0
              ? 'Add your first job to get started'
              : 'Try adjusting your search or stage filter'}
          </p>
          {!showArchived && jobs.length === 0 && (
            <button
              onClick={handleAddJob}
              className="bg-[#2f81f4] text-white px-6 py-2 rounded text-sm hover:bg-blue-600 transition-colors"
            >
              Add Job
            </button>
          )}
        </div>

      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            return (
                <JobCard
                  key={job.id}
                  job={{
                  id: job.id,
                  title: job.title,
                  company: job.company,
                  stage: job.stage,
                  updatedAt: job.updatedAt,
                  archivedAt: job.archivedAt,
                  }}
                  onEdit={(cardJob) => handleEditJob(jobs.find(j => j.id === cardJob.id)!)}
                  onStageChange={handleStageChange}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                />
            )
          })}
        </div>
      )}

      <JobModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        jobId={editingJob?.id}
        initialData={
          editingJob
            ? {
                title: editingJob.title,
                company: editingJob.company,
                jobPostingBody: editingJob.jobPostingBody,
                stage: editingJob.stage,
              }
            : undefined
        }
        onSuccess={(job) => handleJobSuccess(job as Job)}
      />
    </div>
  )
}