'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { JobModal } from '@/components/forms/job-modal'
import { StageSelect, updateJobStage } from '@/components/ui/stage-select'

type Job = {
  id: string
  title: string
  company: string
  jobPostingBody: string
  stage: string
  createdAt: string
  updatedAt: string
}

const STAGES = ['Interested', 'Applied', 'Interview', 'Offer', 'Rejected', 'Archived']

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



export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('All')
  const [sortBy, setSortBy] = useState('updatedAt')

  useEffect(() => {
    async function fetchJobs() {
      const res = await apiFetch('/api/jobs')
      if (res.success) setJobs(res.data)
      setLoading(false)
    }
    fetchJobs()
  }, [])

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = jobs.filter((job) => {
      const matchesStage = stageFilter === 'All' || job.stage === stageFilter
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
  }, [jobs, search, stageFilter, sortBy])

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
  }

  async function handleStageChange(jobId: string, nextStage: string) {
    const prev = jobs.find((j) => j.id === jobId)?.stage
    if (!prev || prev === nextStage) return
    setJobs((js) => js.map((j) => (j.id === jobId ? { ...j, stage: nextStage } : j)))  // optimistic
    try {
      await updateJobStage(jobId, nextStage)
    } catch {
      setJobs((js) => js.map((j) => (j.id === jobId ? { ...j, stage: prev } : j)))     // rollback
    }
  }

  if (loading) return <div className="p-6 text-[#8b949e]">Loading...</div>

  return (
    <div className="min-h-screen bg-[#0d1117] p-6 text-[#e6edf3]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
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
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all appearance-none"
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
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all appearance-none"
>
            <option value="updatedAt">Last Activity</option>
            <option value="createdAt">Date Added</option>
            <option value="company">Company</option>
          </select>

          <button
            onClick={handleAddJob}
            className="flex items-center gap-2 bg-[#2f81f4] text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors"
          >
            + Add Job
          </button>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-[#8b949e] text-lg mb-2">
            {jobs.length === 0 ? 'No jobs yet' : 'No jobs match your filters'}
          </p>
          <p className="text-[#8b949e]/70 text-sm mb-6">
            {jobs.length === 0
              ? 'Add your first job to get started'
              : 'Try adjusting your search or stage filter'}
          </p>
          {jobs.length === 0 && (
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
            const badge = STAGE_BADGE[job.stage] ?? STAGE_BADGE.Interested
            const progress = STAGE_PROGRESS[job.stage] ?? 0
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 hover:border-[#2f81f4] transition-colors cursor-pointer block"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs text-[#8b949e]">{job.company}</p>
                  <StageSelect
                    value={job.stage}
                    onChange={(next) => handleStageChange(job.id, next)}
                  />
                </div>
                <h3 className="text-white font-medium mb-1">{job.title}</h3>
                <p className="text-xs text-[#8b949e] mb-3">
                  Updated {formatDate(job.updatedAt)}
                </p>
                <div className="h-1.5 w-full rounded-full bg-[#21262d] mb-4">
                  <div
                    className="h-1.5 rounded-full bg-[#2f81f4] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleEditJob(job)
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
