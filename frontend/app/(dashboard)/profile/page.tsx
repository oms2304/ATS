'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

type Profile = {
  firstName: string
  lastName: string
  phone: string
  location: string
  linkedIn: string
  summary: string
  completionScore: number
}

type Experience = {
  id: string
  title: string
  company: string
  startDate: string
  endDate: string | null
  isCurrent: boolean
  description: string | null
  order: number
}

const EMPTY_EXPERIENCE_FORM = {
  title: '',
  company: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  description: '',
}

const REQUIRED_FIELDS: (keyof Profile)[] = [
  'firstName',
  'lastName',
  'phone',
  'location',
  'summary'
]

const IDENTITY_FIELDS = [
  { label: 'First Name', name: 'firstName', required: true },
  { label: 'Last Name', name: 'lastName', required: true },
  { label: 'Phone', name: 'phone', required: true },
  { label: 'Location', name: 'location', required: true },
  { label: 'LinkedIn URL', name: 'linkedIn', required: false },
]

const PHONE_REGEX = /^[0-9+\-\s]+$/
const NAME_REGEX = /^[A-Za-z]+$/
const NAME_FIELDS = new Set(['firstName', 'lastName'])

function countWords(text: string) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

export default function ProfilePage() {
  const { user: authUser, setUser: setAuthUser } = useAuth()
  const [profile, setProfile] = useState<Profile>({
    firstName: '',
    lastName: '',
    phone: '',
    location: '',
    linkedIn: '',
    summary: '',
    completionScore: 0
  })
  const [loading, setLoading] = useState(true)
  const [savingIdentity, setSavingIdentity] = useState(false)
  const [savingSummary, setSavingSummary] = useState(false)
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [identityErrors, setIdentityErrors] = useState<Record<string, string>>({})
  const [summaryError, setSummaryError] = useState('')
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [loadingExperiences, setLoadingExperiences] = useState(true)
  const [showExperienceForm, setShowExperienceForm] = useState(false)
  const [editingExperience, setEditingExperience] = useState<Experience | null>(null)
  const [experienceForm, setExperienceForm] = useState({ ...EMPTY_EXPERIENCE_FORM })
  const [experienceErrors, setExperienceErrors] = useState<Record<string, string>>({})
  const [savingExperience, setSavingExperience] = useState(false)
  const [experienceGeneralError, setExperienceGeneralError] = useState('')

  useEffect(() => {
    async function fetchProfile() {
      const res = await apiFetch('/api/profile')
      if (res.success && res.data) {
        setProfile({
          firstName: res.data.firstName ?? '',
          lastName: res.data.lastName ?? '',
          phone: res.data.phone ?? '',
          location: res.data.location ?? '',
          linkedIn: res.data.linkedIn ?? '',
          summary: res.data.summary ?? '',
          completionScore: res.data.completionScore ?? 0,
        })
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    async function fetchExperiences() {
      try {
        const res = await apiFetch('/api/experience')
        if (res.success && Array.isArray(res.data)) {
          setExperiences(res.data)
        }
      } catch {
        // network/load failure: leave list empty so the page still renders
      } finally {
        setLoadingExperiences(false)
      }
    }
    fetchExperiences()
  }, [])

  function resetExperienceForm() {
    setExperienceForm({ ...EMPTY_EXPERIENCE_FORM })
    setExperienceErrors({})
    setExperienceGeneralError('')
    setEditingExperience(null)
  }

  function startEditExperience(exp: Experience) {
    setEditingExperience(exp)
    setExperienceForm({
      title: exp.title,
      company: exp.company,
      startDate: exp.startDate.split('T')[0],
      endDate: exp.endDate ? exp.endDate.split('T')[0] : '',
      isCurrent: exp.isCurrent,
      description: exp.description || '',
    })
    setExperienceErrors({})
    setExperienceGeneralError('')
    setShowExperienceForm(true)
  }

  async function saveExperience() {
    setSavingExperience(true)
    setExperienceErrors({})
    setExperienceGeneralError('')
    const isEdit = editingExperience !== null
    const url = isEdit ? `/api/experience/${editingExperience!.id}` : '/api/experience'
    const method = isEdit ? 'PATCH' : 'POST'
    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(experienceForm),
      })
      if (res.success) {
        if (isEdit) {
          setExperiences(prev => prev.map(e => e.id === res.data.id ? res.data : e))
        } else {
          setExperiences(prev => [...prev, res.data])
        }
        setShowExperienceForm(false)
        resetExperienceForm()
        showSaved(isEdit ? 'Experience updated' : 'Experience added')
      } else {
        if (res.fields) {
          setExperienceErrors(res.fields)
        } else {
          setExperienceGeneralError(res.error || 'Something went wrong')
        }
      }
    } catch {
      setExperienceGeneralError('Failed to save. Please try again.')
    } finally {
      setSavingExperience(false)
    }
  }

  async function deleteExperience(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this experience entry?')) {
      return
    }
    try {
      const res = await apiFetch(`/api/experience/${id}`, { method: 'DELETE' })
      if (res.success) {
        setExperiences(prev => prev.filter(e => e.id !== id))
        showSaved('Experience deleted')
      } else {
        setExperienceGeneralError(res.error || 'Failed to delete')
      }
    } catch {
      setExperienceGeneralError('Failed to delete. Please try again.')
    }
  }

  function calcCompletion(p: Profile) {
    const filled = REQUIRED_FIELDS.filter(
      f => p[f] && String(p[f]).trim() !== ''
    ).length
    return Math.round((filled / REQUIRED_FIELDS.length) * 100)
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key.length === 1 && /[0-9]/.test(e.key)) {
      e.preventDefault()
    }
  }

  function showSaved(message: string) {
    setSavedMessage(message)
    setTimeout(() => setSavedMessage(''), 2500)
  }

  function validateIdentity() {
    const errors: Record<string, string> = {}
    if (profile.firstName.trim() === '') {
      errors.firstName = 'First name is required'
    } else if (!NAME_REGEX.test(profile.firstName.trim())) {
      errors.firstName = 'Only letters are allowed'
    }
    if (profile.lastName.trim() === '') {
      errors.lastName = 'Last name is required'
    } else if (!NAME_REGEX.test(profile.lastName.trim())) {
      errors.lastName = 'Only letters are allowed'
    }
    if (profile.phone.trim() === '') {
      errors.phone = 'Phone is required'
    } else if (!PHONE_REGEX.test(profile.phone)) {
      errors.phone =
        'Phone can only contain numbers, dashes, plus signs, and spaces. Valid formats are 1234567890 or 123-456-7890 or +1-555-123-4567'
    }
    if (profile.location.trim() === '') {
      errors.location = 'Location is required'
    }
    return errors
  }

  function validateSummary() {
    if (profile.summary.trim() === '') {
      return 'Summary is required'
    }
    const count = countWords(profile.summary)
    if (count > 200) {
      return `${count} / 200 words over the limit`
    }
    return ''
  }

  async function saveIdentity() {
    const errors = validateIdentity()
    if (Object.keys(errors).length > 0) {
      setIdentityErrors(errors)
      return
    }
    setIdentityErrors({})
    setSavingIdentity(true)
    const res = await apiFetch('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(profile)
    })
    if (res.success && res.data) {
      const updatedFirstName = res.data.firstName ?? profile.firstName
      const updatedLastName = res.data.lastName ?? profile.lastName
      setProfile({
        firstName: updatedFirstName,
        lastName: updatedLastName,
        phone: res.data.phone ?? '',
        location: res.data.location ?? '',
        linkedIn: res.data.linkedIn ?? '',
        summary: res.data.summary ?? '',
        completionScore: res.data.completionScore ?? 0,
      })
      if (authUser) {
        setAuthUser({
          ...authUser,
          name: `${updatedFirstName} ${updatedLastName}`.trim(),
        })
      }
      setEditingIdentity(false)
      showSaved('Identity saved')
    }
    setSavingIdentity(false)
  }

  async function saveSummary() {
    const error = validateSummary()
    if (error) {
      setSummaryError(error)
      return
    }
    setSummaryError('')
    setSavingSummary(true)
    const res = await apiFetch('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(profile)
    })
    if (res.success && res.data) {
      setProfile({
        firstName: res.data.firstName ?? '',
        lastName: res.data.lastName ?? '',
        phone: res.data.phone ?? '',
        location: res.data.location ?? '',
        linkedIn: res.data.linkedIn ?? '',
        summary: res.data.summary ?? '',
        completionScore: res.data.completionScore ?? 0,
      })
      setEditingSummary(false)
      showSaved('Summary saved')
    }
    setSavingSummary(false)
  }

  const completion = calcCompletion(profile)
  const summaryWordCount = countWords(profile.summary)

  if (loading) {
    return (
      <div className="p-6 text-[#8b949e] text-sm">Loading...</div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 flex flex-col gap-6">

      <div>
        <h1 className="text-2xl font-semibold text-white mb-4">My Profile</h1>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2f81f4] rounded-full transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="text-sm text-[#8b949e] whitespace-nowrap">
            {completion}% complete
          </span>
        </div>
      </div>

      {savedMessage && (
        <div className="bg-[#1a3d2b] border border-[#3fb950] text-[#3fb950] text-sm px-4 py-2 rounded-lg">
          {savedMessage}
        </div>
      )}

      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-medium text-white">Identity & Contact</h2>
          {editingIdentity ? (
            <button
              onClick={saveIdentity}
              disabled={savingIdentity}
              className="text-sm px-4 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {savingIdentity ? 'Saving...' : 'Save'}
            </button>
          ) : (
            <button
              onClick={() => {
                setIdentityErrors({})
                setEditingIdentity(true)
              }}
              className="text-sm px-4 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {IDENTITY_FIELDS.map(field => (
            <div key={field.name} className="flex flex-col gap-1">
              <label className="text-xs text-[#8b949e]">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </label>
              <input
                name={field.name}
                value={String(profile[field.name as keyof Profile] ?? '')}
                onChange={handleChange}
                onKeyDown={NAME_FIELDS.has(field.name) ? handleNameKeyDown : undefined}
                readOnly={!editingIdentity}
                placeholder={
                  editingIdentity
                    ? `Enter ${field.label.toLowerCase()}`
                    : 'Not filled in yet'
                }
                pattern={NAME_FIELDS.has(field.name) ? '[A-Za-z]+' : undefined}
                inputMode={NAME_FIELDS.has(field.name) ? 'text' : undefined}
                maxLength={NAME_FIELDS.has(field.name) ? 50 : undefined}
                className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white placeholder-[#484f58] focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all read-only:opacity-60 read-only:cursor-default"
              />
              {identityErrors[field.name] && (
                <p className="text-red-500 text-xs">{identityErrors[field.name]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-medium text-white">
            Professional Summary
            <span className="text-red-500"> *</span>
          </h2>
          {editingSummary ? (
            <button
              onClick={saveSummary}
              disabled={savingSummary || summaryWordCount > 200}
              className="text-sm px-4 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {savingSummary ? 'Saving...' : 'Save'}
            </button>
          ) : (
            <button
              onClick={() => {
                setSummaryError('')
                setEditingSummary(true)
              }}
              className="text-sm px-4 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        <textarea
          name="summary"
          value={profile.summary}
          onChange={handleChange}
          readOnly={!editingSummary}
          placeholder={
            editingSummary
              ? 'Write your professional summary...'
              : 'Not filled in yet'
          }
          rows={5}
          className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white placeholder-[#484f58] focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all resize-y read-only:opacity-60 read-only:cursor-default"
        />
        {editingSummary && (
          <p
            className={`text-xs mt-1 ${
              summaryWordCount > 200 ? 'text-red-500' : 'text-[#8b949e]'
            }`}
          >
            {summaryWordCount} / 200 words
          </p>
        )}
        {summaryError && (
          <p className="text-red-500 text-xs mt-1">{summaryError}</p>
        )}
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-medium text-white">Experience</h2>
          {!showExperienceForm && (
            <button
              onClick={() => {
                resetExperienceForm()
                setShowExperienceForm(true)
              }}
              className="text-sm px-4 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 transition-colors"
            >
              Add Experience
            </button>
          )}
        </div>

        {showExperienceForm && (
          <div className="flex flex-col gap-3 mb-5 pb-5 border-b border-[#30363d]">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8b949e]">
                Job Title<span className="text-red-500"> *</span>
              </label>
              <input
                value={experienceForm.title}
                onChange={e => setExperienceForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter job title"
                className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white placeholder-[#484f58] focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all"
              />
              {experienceErrors.title && (
                <p className="text-red-500 text-xs">{experienceErrors.title}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8b949e]">
                Company<span className="text-red-500"> *</span>
              </label>
              <input
                value={experienceForm.company}
                onChange={e => setExperienceForm(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Enter company"
                className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white placeholder-[#484f58] focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all"
              />
              {experienceErrors.company && (
                <p className="text-red-500 text-xs">{experienceErrors.company}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#8b949e]">
                  Start Date<span className="text-red-500"> *</span>
                </label>
                <input
                  type="date"
                  value={experienceForm.startDate}
                  onChange={e => setExperienceForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white placeholder-[#484f58] focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all"
                />
                {experienceErrors.startDate && (
                  <p className="text-red-500 text-xs">{experienceErrors.startDate}</p>
                )}
              </div>

              {!experienceForm.isCurrent && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[#8b949e]">End Date</label>
                  <input
                    type="date"
                    value={experienceForm.endDate}
                    onChange={e => setExperienceForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white placeholder-[#484f58] focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all"
                  />
                  {experienceErrors.endDate && (
                    <p className="text-red-500 text-xs">{experienceErrors.endDate}</p>
                  )}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-[#8b949e] cursor-pointer">
              <input
                type="checkbox"
                checked={experienceForm.isCurrent}
                onChange={e => setExperienceForm(prev => ({
                  ...prev,
                  isCurrent: e.target.checked,
                  endDate: e.target.checked ? '' : prev.endDate,
                }))}
                className="accent-[#2f81f4]"
              />
              This is my current role
            </label>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8b949e]">Description</label>
              <textarea
                value={experienceForm.description}
                onChange={e => setExperienceForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your responsibilities and achievements..."
                rows={3}
                className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white placeholder-[#484f58] focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all resize-y"
              />
            </div>

            {experienceGeneralError && (
              <p className="text-red-500 text-xs">{experienceGeneralError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowExperienceForm(false)
                  resetExperienceForm()
                }}
                disabled={savingExperience}
                className="text-sm px-4 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveExperience}
                disabled={savingExperience}
                className="text-sm px-4 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {savingExperience
                  ? 'Saving...'
                  : editingExperience
                    ? 'Save Changes'
                    : 'Add Experience'}
              </button>
            </div>
          </div>
        )}

        {loadingExperiences ? (
          <p className="text-sm text-[#8b949e]">Loading experiences...</p>
        ) : experiences.length === 0 && !showExperienceForm ? (
          <p className="text-sm text-[#8b949e]">No experience added yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {experiences.map(exp => (
              <div
                key={exp.id}
                className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <p className="text-white font-medium">{exp.title}</p>
                    <p className="text-sm text-[#8b949e]">{exp.company}</p>
                    <p className="text-xs text-[#8b949e] mt-1">
                      {new Date(exp.startDate).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                      {' — '}
                      {exp.isCurrent
                        ? 'Present'
                        : exp.endDate
                          ? new Date(exp.endDate).toLocaleDateString('en-US', {
                              month: 'short',
                              year: 'numeric',
                            })
                          : ''}
                    </p>
                    {exp.description && (
                      <p className="text-sm text-[#8b949e] mt-2 whitespace-pre-wrap">
                        {exp.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => startEditExperience(exp)}
                      disabled={showExperienceForm}
                      className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteExperience(exp.id)}
                      className="text-xs px-3 py-1.5 border border-[#f85149]/50 text-[#f85149] rounded hover:bg-[#f85149]/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
