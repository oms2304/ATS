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

    </div>
  )
}
