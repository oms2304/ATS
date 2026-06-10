'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'

type JobFormProps = {
  jobId?: string
  initialData?: {
    title: string
    company: string
    jobPostingBody: string
    stage: string
  }
  onSuccess: (job: unknown) => void
  onCancel: () => void
}

const STAGES = ['Interested', 'Applied', 'Interview', 'Offer', 'Rejected', 'Archived']

export function JobForm({ jobId, initialData, onSuccess, onCancel }: JobFormProps) {
  const [form, setForm] = useState({
    title: initialData?.title || '',
    company: initialData?.company || '',
    jobPostingBody: initialData?.jobPostingBody || '',
    stage: initialData?.stage || 'Interested',
  })
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [generalError, setGeneralError] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrors({ ...errors, [e.target.name]: [] })
    setGeneralError('')
  }

  function validate() {
    const newErrors: Record<string, string[]> = {}
    if (!form.title.trim()) newErrors.title = ['Title is required']
    if (!form.company.trim()) newErrors.company = ['Company is required']
    if (!form.jobPostingBody.trim()) newErrors.jobPostingBody = ['Job posting body is required']
    return newErrors
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError('')

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)

    const res = await apiFetch(jobId ? `/api/jobs/${jobId}` : '/api/jobs', {
      method: jobId ? 'PATCH' : 'POST',
      body: JSON.stringify(form),
    })

    setLoading(false)

    if (!res.success) {
      if (res.fields) {
        setErrors(res.fields)
      } else {
        setGeneralError(res.error || 'Something went wrong')
      }
      return
    }

    onSuccess(res.data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {generalError && <p className="text-sm text-[#f85149]">{generalError}</p>}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#8b949e]">Job Title</label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g. Senior Software Engineer"
          className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all"
        />
        {errors.title?.[0] && <p className="text-xs text-[#f85149]">{errors.title[0]}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#8b949e]">Company</label>
        <input
          name="company"
          value={form.company}
          onChange={handleChange}
          placeholder="e.g. Acme Corp"
          className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all"
        />
        {errors.company?.[0] && <p className="text-xs text-[#f85149]">{errors.company[0]}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#8b949e]">Stage</label>
        <select
          name="stage"
          value={form.stage}
          onChange={handleChange}
          className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all appearance-none"
        >
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#8b949e]">Job Posting Body</label>
        <textarea
          name="jobPostingBody"
          value={form.jobPostingBody}
          onChange={handleChange}
          placeholder="Paste the full job description here..."
          rows={6}
          className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all resize-y min-h-[150px]"
        />
        {errors.jobPostingBody?.[0] && (
          <p className="text-xs text-[#f85149]">{errors.jobPostingBody[0]}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm bg-[#2f81f4] text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : jobId ? 'Update Job' : 'Save Job'}
        </button>
      </div>
    </form>
  )
}
