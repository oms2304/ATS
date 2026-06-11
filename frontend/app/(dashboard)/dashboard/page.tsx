'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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

const STAGES = ['Interested', 'Applied', 'Interview', 'Offer', 'Rejected', 'Archived']

type StageStyle = {
  badgeBg: string
  badgeText: string
  badgeBorder: string
  bar: string
  barOpacity: number
}

const STAGE_STYLE: Record<string, StageStyle> = {
  Interested: {
    badgeBg: '#2d363e',
    badgeText: '#c1c6d6',
    badgeBorder: '#414753',
    bar: '#414753',
    barOpacity: 1,
  },
  Applied: {
    badgeBg: 'rgba(172,199,255,0.15)',
    badgeText: '#acc7ff',
    badgeBorder: 'rgba(172,199,255,0.10)',
    bar: '#acc7ff',
    barOpacity: 1,
  },
  Interview: {
    badgeBg: 'rgba(90,33,171,0.20)',
    badgeText: '#d5bbff',
    badgeBorder: 'rgba(90,33,171,0.10)',
    bar: '#d5bbff',
    barOpacity: 1,
  },
  Offer: {
    badgeBg: 'rgba(39,166,64,0.20)',
    badgeText: '#67df70',
    badgeBorder: 'rgba(39,166,64,0.10)',
    bar: '#67df70',
    barOpacity: 1,
  },
  Rejected: {
    badgeBg: 'rgba(147,0,10,0.20)',
    badgeText: '#ffb4ab',
    badgeBorder: 'rgba(147,0,10,0.10)',
    bar: '#ffb4ab',
    barOpacity: 0.5,
  },
  Archived: {
    badgeBg: '#2d363e',
    badgeText: '#8b919f',
    badgeBorder: '#414753',
    bar: '#8b919f',
    barOpacity: 1,
  },
}

const STAGE_PROGRESS: Record<string, number> = {
  Interested: 5,
  Applied: 25,
  Interview: 60,
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
  })
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('All')

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
    return jobs.filter((job) => {
      const matchesStage = stageFilter === 'All' || job.stage === stageFilter
      const matchesSearch =
        !term ||
        job.title.toLowerCase().includes(term) ||
        job.company.toLowerCase().includes(term)
      return matchesStage && matchesSearch
    })
  }, [jobs, search, stageFilter])

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

  if (loading) {
    return <div className="py-12 text-[#c1c6d6] text-sm">Loading...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full md:w-auto flex flex-col md:flex-row gap-2 flex-1 max-w-2xl">
          <div className="relative w-full md:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c1c6d6]">
              <SearchIcon />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs..."
              className="w-full bg-[#182028] border border-[#414753] rounded-lg py-2 pl-10 pr-3 text-sm text-[#dae3ee] placeholder-[#8b919f] focus:outline-none focus:border-[#acc7ff] focus:ring-1 focus:ring-[#acc7ff] transition-colors"
            />
          </div>
          <div className="relative w-full md:w-48">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full bg-[#182028] border border-[#414753] rounded-lg py-2 pl-3 pr-10 text-sm text-[#dae3ee] appearance-none focus:outline-none focus:border-[#acc7ff] focus:ring-1 focus:ring-[#acc7ff] transition-colors cursor-pointer"
            >
              <option value="All">Filter by stage</option>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#c1c6d6] pointer-events-none">
              <ChevronDownIcon />
            </span>
          </div>
        </div>
        <button
          onClick={handleAddJob}
          className="w-full md:w-auto flex items-center justify-center gap-1 bg-[#468fff] text-[#00285a] px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          <PlusIcon />
          Add Job
        </button>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-[#c1c6d6] text-lg mb-2">
            {jobs.length === 0 ? 'No jobs yet' : 'No jobs match your filters'}
          </p>
          <p className="text-[#8b919f] text-sm mb-6">
            {jobs.length === 0
              ? 'Add your first job to get started'
              : 'Try adjusting your search or stage filter'}
          </p>
          {jobs.length === 0 && (
            <button
              onClick={handleAddJob}
              className="bg-[#468fff] text-[#00285a] px-6 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Add Job
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const style = STAGE_STYLE[job.stage] ?? STAGE_STYLE.Interested
            const progress = STAGE_PROGRESS[job.stage] ?? 0
            const initial = job.company?.charAt(0)?.toUpperCase() ?? '?'
            return (
              <div
                key={job.id}
                className="bg-[#182028] border border-[#414753] rounded-lg p-4 hover:border-[#8b919f] transition-colors flex flex-col gap-2"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded bg-[#2d363e] border border-[#414753] flex items-center justify-center shrink-0 text-xl font-semibold text-[#c1c6d6] select-none">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-[#dae3ee] truncate">
                      {job.title}
                    </h3>
                    <p className="text-[13px] text-[#c1c6d6] truncate">{job.company}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium border"
                    style={{
                      backgroundColor: style.badgeBg,
                      color: style.badgeText,
                      borderColor: style.badgeBorder,
                    }}
                  >
                    {job.stage}
                  </span>
                  <span className="text-xs text-[#8b919f]">
                    Updated {formatDate(job.updatedAt)}
                  </span>
                </div>

                <div className="mt-1">
                  <div className="w-full h-1 bg-[#2d363e] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: style.bar,
                        opacity: style.barOpacity,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[#414753]/50">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="px-3 py-1.5 rounded text-xs font-medium text-[#c1c6d6] hover:text-[#dae3ee] hover:bg-[#2d363e] transition-colors"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleEditJob(job)}
                    className="px-3 py-1.5 rounded text-xs font-medium border border-[#414753] text-[#dae3ee] hover:bg-[#2d363e] transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
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
