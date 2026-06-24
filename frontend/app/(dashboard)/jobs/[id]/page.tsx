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
  deadline: string | null
  recruiterNotes: string | null
  createdAt: string
  updatedAt: string
}

type Interview = {
  id: string
  roundType: string
  date: string
  notes: string | null
}

type FollowUp = {
  id: string
  title: string
  dueDate: string
  completed: boolean
}

const STAGES = ['Interested', 'Applied', 'Interview', 'Offer', 'Rejected', 'Archived'] as const

const ROUND_TYPES = ['Phone Screen', 'Technical', 'Behavioral', 'System Design', 'HR', 'Final', 'Other'] as const

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
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTimeLocal(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [updatingStage, setUpdatingStage] = useState(false)

  // deadline + recruiter notes edit state
  const [editingMeta, setEditingMeta] = useState(false)
  const [deadlineInput, setDeadlineInput] = useState('')
  const [recruiterInput, setRecruiterInput] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

  // interviews
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [showInterviewForm, setShowInterviewForm] = useState(false)
  const [interviewForm, setInterviewForm] = useState({ roundType: 'Phone Screen', date: '', notes: '' })
  const [savingInterview, setSavingInterview] = useState(false)
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null)

  // follow-ups
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)
  const [followUpForm, setFollowUpForm] = useState({ title: '', dueDate: '' })
  const [savingFollowUp, setSavingFollowUp] = useState(false)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)

  // AI resume draft
  const [resumeDraft, setResumeDraft] = useState('')
  const [generatingResume, setGeneratingResume] = useState(false)
  const [resumeError, setResumeError] = useState('')

  // AI cover letter draft
  const [coverLetterDraft, setCoverLetterDraft] = useState('')
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false)
  const [coverLetterError, setCoverLetterError] = useState('')

  useEffect(() => {
    async function fetchAll() {
      const [jobRes, interviewRes, followUpRes] = await Promise.all([
        apiFetch(`/api/jobs/${id}`).catch(() => null),
        apiFetch(`/api/jobs/${id}/interviews`).catch(() => ({ data: [] })),
        apiFetch(`/api/jobs/${id}/followups`).catch(() => ({ data: [] })),
      ])
      if (!jobRes || !jobRes.success) {
        setNotFound(true)
      } else {
        setJob(jobRes.data)
        setDeadlineInput(jobRes.data.deadline ? formatDateTimeLocal(jobRes.data.deadline) : '')
        setRecruiterInput(jobRes.data.recruiterNotes ?? '')
      }
      if (interviewRes?.data) setInterviews(interviewRes.data)
      if (followUpRes?.data) setFollowUps(followUpRes.data)
      setLoading(false)
    }
    fetchAll()
  }, [id])

  async function handleStageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextStage = e.target.value
    if (!job || nextStage === job.stage || updatingStage) return
    setUpdatingStage(true)
    const prev = job.stage
    setJob({ ...job, stage: nextStage })
    try {
      await apiFetch(`/api/jobs/${id}`, { method: 'PATCH', body: JSON.stringify({ stage: nextStage }) })
    } catch {
      setJob({ ...job, stage: prev })
    }
    setUpdatingStage(false)
  }

  async function handleSaveMeta() {
    if (!job) return
    setSavingMeta(true)
    try {
      const res = await apiFetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          deadline: deadlineInput ? new Date(deadlineInput).toISOString() : null,
          recruiterNotes: recruiterInput || null,
        }),
      })
      setJob(res.data)
      setEditingMeta(false)
    } catch {
      // keep form open on error
    }
    setSavingMeta(false)
  }

  async function handleDelete() {
    if (deleting) return
    if (!window.confirm('Delete this job? This cannot be undone.')) return
    setDeleting(true)
    try {
      await apiFetch(`/api/jobs/${id}`, { method: 'DELETE' })
      router.push('/dashboard')
    } catch {
      setDeleting(false)
    }
  }

  // Interview handlers
  async function handleSaveInterview() {
    if (!interviewForm.date) return
    setSavingInterview(true)
    try {
      if (editingInterview) {
        const res = await apiFetch(`/api/interviews/${editingInterview.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...interviewForm, date: new Date(interviewForm.date).toISOString() }),
        })
        setInterviews((prev) => prev.map((i) => (i.id === editingInterview.id ? res.data : i)))
      } else {
        const res = await apiFetch(`/api/jobs/${id}/interviews`, {
          method: 'POST',
          body: JSON.stringify({ ...interviewForm, date: new Date(interviewForm.date).toISOString() }),
        })
        setInterviews((prev) => [...prev, res.data])
      }
      setShowInterviewForm(false)
      setEditingInterview(null)
      setInterviewForm({ roundType: 'Phone Screen', date: '', notes: '' })
    } catch {
      // keep form open
    }
    setSavingInterview(false)
  }

  async function handleDeleteInterview(interviewId: string) {
    if (!window.confirm('Delete this interview entry?')) return
    try {
      await apiFetch(`/api/interviews/${interviewId}`, { method: 'DELETE' })
      setInterviews((prev) => prev.filter((i) => i.id !== interviewId))
    } catch { /* ignore */ }
  }

  function handleEditInterview(interview: Interview) {
    setEditingInterview(interview)
    setInterviewForm({
      roundType: interview.roundType,
      date: formatDateTimeLocal(interview.date),
      notes: interview.notes ?? '',
    })
    setShowInterviewForm(true)
  }

  // Follow-up handlers
  async function handleSaveFollowUp() {
    if (!followUpForm.title || !followUpForm.dueDate) return
    setSavingFollowUp(true)
    try {
      if (editingFollowUp) {
        const res = await apiFetch(`/api/followups/${editingFollowUp.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...followUpForm, dueDate: new Date(followUpForm.dueDate).toISOString() }),
        })
        setFollowUps((prev) => prev.map((f) => (f.id === editingFollowUp.id ? res.data : f)))
      } else {
        const res = await apiFetch(`/api/jobs/${id}/followups`, {
          method: 'POST',
          body: JSON.stringify({ ...followUpForm, dueDate: new Date(followUpForm.dueDate).toISOString() }),
        })
        setFollowUps((prev) => [...prev, res.data])
      }
      setShowFollowUpForm(false)
      setEditingFollowUp(null)
      setFollowUpForm({ title: '', dueDate: '' })
    } catch {
      // keep form open
    }
    setSavingFollowUp(false)
  }

  async function handleToggleFollowUp(followUp: FollowUp) {
    try {
      const res = await apiFetch(`/api/followups/${followUp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !followUp.completed }),
      })
      setFollowUps((prev) => prev.map((f) => (f.id === followUp.id ? res.data : f)))
    } catch { /* ignore */ }
  }

  async function handleDeleteFollowUp(followUpId: string) {
    if (!window.confirm('Delete this follow-up?')) return
    try {
      await apiFetch(`/api/followups/${followUpId}`, { method: 'DELETE' })
      setFollowUps((prev) => prev.filter((f) => f.id !== followUpId))
    } catch { /* ignore */ }
  }

  function handleEditFollowUp(followUp: FollowUp) {
    setEditingFollowUp(followUp)
    setFollowUpForm({ title: followUp.title, dueDate: formatDateTimeLocal(followUp.dueDate) })
    setShowFollowUpForm(true)
  }

  // AI handlers
  async function handleGenerateResume() {
    setGeneratingResume(true)
    setResumeError('')
    try {
      const res = await apiFetch('/api/ai/generate-resume', {
        method: 'POST',
        body: JSON.stringify({ jobId: id }),
      })
      if (res.success) {
        setResumeDraft(res.data.draft)
      } else {
        setResumeError(res.error || 'Failed to generate resume')
      }
    } catch {
      setResumeError('Something went wrong. Please try again.')
    }
    setGeneratingResume(false)
  }

  async function handleGenerateCoverLetter() {
    setGeneratingCoverLetter(true)
    setCoverLetterError('')
    try {
      const res = await apiFetch('/api/ai/generate-cover-letter', {
        method: 'POST',
        body: JSON.stringify({ jobId: id }),
      })
      if (res.success) {
        setCoverLetterDraft(res.data.draft)
      } else {
        setCoverLetterError(res.error || 'Failed to generate cover letter')
      }
    } catch {
      setCoverLetterError('Something went wrong. Please try again.')
    }
    setGeneratingCoverLetter(false)
  }

  if (loading) return <div className="min-h-screen bg-[#0d1117] p-6 text-[#8b949e]">Loading...</div>

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-[#0d1117] p-6 text-[#e6edf3]">
        <Link href="/dashboard" className="text-sm text-[#2f81f4] hover:underline">&larr; Back to dashboard</Link>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="text-2xl font-semibold text-white mb-2">Job not found</h1>
          <p className="text-[#8b949e]">This job may have been deleted or you do not have access to it.</p>
        </div>
      </div>
    )
  }

  const badge = STAGE_BADGE[job.stage] ?? STAGE_BADGE.Interested
  const progress = STAGE_PROGRESS[job.stage] ?? 0

  return (
    <div className="min-h-screen bg-[#0d1117] p-6 text-[#e6edf3]">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/dashboard" className="text-sm text-[#2f81f4] hover:underline inline-block">&larr; Back to dashboard</Link>

        {/* Overview */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
          <div className="flex justify-between items-start mb-3 gap-4">
            <div>
              <p className="text-sm text-[#8b949e] mb-1">{job.company}</p>
              <h1 className="text-2xl font-semibold text-white">{job.title}</h1>
            </div>
            <label title="Click to change stage">
              <span className="sr-only">Stage</span>
              <select
                value={job.stage}
                onChange={handleStageChange}
                disabled={updatingStage}
                className="text-xs px-2 py-1 rounded appearance-none cursor-pointer outline-none focus:ring-1 focus:ring-[#2f81f4] disabled:opacity-50"
                style={{ backgroundColor: badge.bg, color: badge.text }}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s} className="bg-[#161b22] text-white">{s}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="h-1.5 w-full rounded-full bg-[#21262d] mb-6">
            <div className="h-1.5 rounded-full bg-[#2f81f4] transition-all" style={{ width: `${progress}%` }} />
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

          {/* Deadline + Recruiter Notes */}
          <div className="border-t border-[#30363d] pt-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold text-white">Details</h2>
              {!editingMeta && (
                <button
                  onClick={() => setEditingMeta(true)}
                  className="text-xs text-[#2f81f4] hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            {editingMeta ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#8b949e] block mb-1">Application Deadline</label>
                  <input
                    type="datetime-local"
                    value={deadlineInput}
                    onChange={(e) => setDeadlineInput(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#8b949e] block mb-1">Recruiter / Contact Notes</label>
                  <textarea
                    value={recruiterInput}
                    onChange={(e) => setRecruiterInput(e.target.value)}
                    rows={3}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] outline-none resize-none"
                    placeholder="e.g. Recruiter name, email, LinkedIn..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveMeta}
                    disabled={savingMeta}
                    className="text-xs px-3 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {savingMeta ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingMeta(false)
                      setDeadlineInput(job.deadline ? formatDateTimeLocal(job.deadline) : '')
                      setRecruiterInput(job.recruiterNotes ?? '')
                    }}
                    className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#8b949e] mb-1">Deadline</p>
                  <p className="text-white">{job.deadline ? formatDate(job.deadline) : '—'}</p>
                </div>
                <div>
                  <p className="text-[#8b949e] mb-1">Recruiter Notes</p>
                  <p className="text-white whitespace-pre-wrap">{job.recruiterNotes || '—'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Job Posting */}
          <div className="border-t border-[#30363d] pt-4">
            <h2 className="text-sm font-semibold text-white mb-3">Job Posting</h2>
            <div className="text-sm text-[#e6edf3] whitespace-pre-wrap leading-relaxed">
              {job.jobPostingBody || <span className="text-[#8b949e] italic">No job posting body provided.</span>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-6 mt-6 border-t border-[#30363d]">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs px-3 py-1.5 border border-[#30363d] text-[#f85149] rounded hover:border-[#f85149] transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
            >
              Edit
            </button>
          </div>
        </div>

        {/* AI Resume & Cover Letter */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-white mb-4">AI Drafts</h2>

          <button
            onClick={handleGenerateResume}
            disabled={generatingResume}
            className="text-sm px-4 py-2 bg-[#2f81f4] text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {generatingResume ? 'Generating...' : 'Generate Resume with AI'}
          </button>

          {resumeError && (
            <p className="text-sm text-[#f85149] mb-4">{resumeError}</p>
          )}

          {resumeDraft && (
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-xs text-[#8b949e]">Resume Draft — edit before saving</label>
              <textarea
                value={resumeDraft}
                onChange={(e) => setResumeDraft(e.target.value)}
                rows={14}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none resize-y"
              />
            </div>
          )}

          <button
            onClick={handleGenerateCoverLetter}
            disabled={generatingCoverLetter}
            className="text-sm px-4 py-2 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {generatingCoverLetter ? 'Generating...' : 'Generate Cover Letter with AI'}
          </button>

          {coverLetterError && (
            <p className="text-sm text-[#f85149] mb-4">{coverLetterError}</p>
          )}

          {coverLetterDraft && (
            <div className="flex flex-col gap-2 mt-4">
              <label className="text-xs text-[#8b949e]">Cover Letter Draft — edit before saving</label>
              <textarea
                value={coverLetterDraft}
                onChange={(e) => setCoverLetterDraft(e.target.value)}
                rows={12}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none resize-y"
              />
            </div>
          )}
        </div>

        {/* Interviews */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-white">Interviews</h2>
            <button
              onClick={() => { setEditingInterview(null); setInterviewForm({ roundType: 'Phone Screen', date: '', notes: '' }); setShowInterviewForm(true) }}
              className="text-xs px-3 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 transition-colors"
            >
              + Add
            </button>
          </div>

          {showInterviewForm && (
            <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 mb-4 space-y-3">
              <div>
                <label className="text-xs text-[#8b949e] block mb-1">Round Type</label>
                <select
                  value={interviewForm.roundType}
                  onChange={(e) => setInterviewForm({ ...interviewForm, roundType: e.target.value })}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#2f81f4]"
                >
                  {ROUND_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#8b949e] block mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={interviewForm.date}
                  onChange={(e) => setInterviewForm({ ...interviewForm, date: e.target.value })}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#2f81f4]"
                />
              </div>
              <div>
                <label className="text-xs text-[#8b949e] block mb-1">Notes</label>
                <textarea
                  value={interviewForm.notes}
                  onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#2f81f4] resize-none"
                  placeholder="Interviewer name, topics, prep notes..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveInterview}
                  disabled={savingInterview || !interviewForm.date}
                  className="text-xs px-3 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {savingInterview ? 'Saving...' : editingInterview ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={() => { setShowInterviewForm(false); setEditingInterview(null) }}
                  className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {interviews.length === 0 && !showInterviewForm ? (
            <p className="text-sm text-[#8b949e]">No interviews logged yet.</p>
          ) : (
            <div className="space-y-3">
              {interviews.map((interview) => (
                <div key={interview.id} className="border border-[#30363d] rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs px-2 py-0.5 rounded bg-[#2d1f6e] text-[#bc8cff] mr-2">{interview.roundType}</span>
                      <span className="text-xs text-[#8b949e]">{formatDate(interview.date)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditInterview(interview)} className="text-xs text-[#8b949e] hover:text-white transition-colors">Edit</button>
                      <button onClick={() => handleDeleteInterview(interview.id)} className="text-xs text-[#f85149] hover:text-red-400 transition-colors">Delete</button>
                    </div>
                  </div>
                  {interview.notes && <p className="text-xs text-[#8b949e] mt-2 whitespace-pre-wrap">{interview.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Follow-ups */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-white">Follow-ups & Reminders</h2>
            <button
              onClick={() => { setEditingFollowUp(null); setFollowUpForm({ title: '', dueDate: '' }); setShowFollowUpForm(true) }}
              className="text-xs px-3 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 transition-colors"
            >
              + Add
            </button>
          </div>

          {showFollowUpForm && (
            <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 mb-4 space-y-3">
              <div>
                <label className="text-xs text-[#8b949e] block mb-1">Title</label>
                <input
                  type="text"
                  value={followUpForm.title}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, title: e.target.value })}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#2f81f4]"
                  placeholder="e.g. Send thank you email, Follow up on offer..."
                />
              </div>
              <div>
                <label className="text-xs text-[#8b949e] block mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  value={followUpForm.dueDate}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, dueDate: e.target.value })}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#2f81f4]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveFollowUp}
                  disabled={savingFollowUp || !followUpForm.title || !followUpForm.dueDate}
                  className="text-xs px-3 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {savingFollowUp ? 'Saving...' : editingFollowUp ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={() => { setShowFollowUpForm(false); setEditingFollowUp(null) }}
                  className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {followUps.length === 0 && !showFollowUpForm ? (
            <p className="text-sm text-[#8b949e]">No follow-ups yet.</p>
          ) : (
            <div className="space-y-3">
              {followUps.map((f) => (
                <div key={f.id} className={`border rounded-lg p-3 flex justify-between items-start ${f.completed ? 'border-[#30363d] opacity-60' : 'border-[#30363d]'}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={f.completed}
                      onChange={() => handleToggleFollowUp(f)}
                      className="mt-0.5 accent-[#2f81f4]"
                    />
                    <div>
                      <p className={`text-sm ${f.completed ? 'line-through text-[#8b949e]' : 'text-white'}`}>{f.title}</p>
                      <p className="text-xs text-[#8b949e] mt-0.5">Due {formatDate(f.dueDate)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditFollowUp(f)} className="text-xs text-[#8b949e] hover:text-white transition-colors">Edit</button>
                    <button onClick={() => handleDeleteFollowUp(f.id)} className="text-xs text-[#f85149] hover:text-red-400 transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <JobModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        jobId={job.id}
        initialData={{ title: job.title, company: job.company, jobPostingBody: job.jobPostingBody, stage: job.stage }}
        onSuccess={(updated) => setJob({ ...job, ...(updated as Job) })}
      />
    </div>
  )
}