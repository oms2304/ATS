'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { apiFetch } from '@/lib/api'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const [showConfirm, setShowConfirm] = useState(false)

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwFieldErrors, setPwFieldErrors] = useState<Record<string, string>>({})
  const [pwGeneralError, setPwGeneralError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  function fieldBorderClass(hasError: boolean) {
    return hasError ? 'border-[#f85149]' : 'border-[#30363d]'
  }

  function handlePwChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setPwForm(prev => ({ ...prev, [name]: value }))
    setPwFieldErrors(prev => ({ ...prev, [name]: '' }))
    setPwGeneralError('')
    setPwSuccess('')
  }

  function validatePw() {
    const errors: Record<string, string> = {}
    if (pwForm.next.length < 8) {
      errors.next = 'Password must be at least 8 characters'
    } else if (!/[A-Za-z]/.test(pwForm.next) || !/[0-9]/.test(pwForm.next)) {
      errors.next = 'Password must contain at least one letter and one number'
    }
    if (pwForm.confirm !== pwForm.next) {
      errors.confirm = 'Passwords do not match'
    }
    return errors
  }

  async function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwGeneralError('')
    setPwSuccess('')

    const errors = validatePw()
    if (Object.keys(errors).length > 0) {
      setPwFieldErrors(errors)
      return
    }

    setPwLoading(true)
    try {
      const data = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: pwForm.current,
          newPassword: pwForm.next,
        }),
      })

      if (!data.success) {
        if (data.fields) {
          setPwFieldErrors(data.fields)
        } else {
          setPwGeneralError(data.error ?? 'Could not update password')
        }
        return
      }

      setPwForm({ current: '', next: '', confirm: '' })
      setPwSuccess('Password updated')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setPwGeneralError(message)
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] p-6 text-[#e6edf3]">
      <div className="max-w-2xl mx-auto">

        <h1 className="text-2xl font-semibold text-white mb-6">Settings</h1>

        {/* Account Section */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg mb-4">
          <div className="px-6 py-4 border-b border-[#30363d]">
            <h2 className="text-base font-semibold text-white">Account</h2>
            <p className="text-sm text-[#8b949e] mt-1">Manage your account information</p>
          </div>
          <div className="px-6 py-4 flex flex-col gap-4">
            <div>
              <label className="text-xs text-[#8b949e] uppercase tracking-wide">Name</label>
              <p className="text-white mt-1">{user?.name ?? '—'}</p>
            </div>
            <div>
              <label className="text-xs text-[#8b949e] uppercase tracking-wide">Email</label>
              <p className="text-white mt-1">{user?.email ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Password Section */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg mb-4">
          <div className="px-6 py-4 border-b border-[#30363d]">
            <h2 className="text-base font-semibold text-white">Password</h2>
            <p className="text-sm text-[#8b949e] mt-1">Update your password to keep your account secure</p>
          </div>
          <form className="px-6 py-4 flex flex-col gap-4" onSubmit={handlePwSubmit} noValidate>
            {pwGeneralError && (
              <p className="text-sm text-[#f85149]">{pwGeneralError}</p>
            )}
            {pwSuccess && (
              <p className="text-sm text-[#3fb950]">{pwSuccess}</p>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8b949e] uppercase tracking-wide" htmlFor="current">
                Current password
              </label>
              <input
                id="current"
                name="current"
                type="password"
                autoComplete="current-password"
                value={pwForm.current}
                onChange={handlePwChange}
                className={`bg-[#0d1117] border rounded-md px-3 py-2 text-sm text-white placeholder:text-[#6e7681] focus:border-[#2f81f4] focus:outline-none transition-colors ${fieldBorderClass(!!pwFieldErrors.current)}`}
              />
              {pwFieldErrors.current && (
                <p className="text-xs text-[#f85149] mt-1">{pwFieldErrors.current}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8b949e] uppercase tracking-wide" htmlFor="next">
                New password
              </label>
              <input
                id="next"
                name="next"
                type="password"
                autoComplete="new-password"
                value={pwForm.next}
                onChange={handlePwChange}
                className={`bg-[#0d1117] border rounded-md px-3 py-2 text-sm text-white placeholder:text-[#6e7681] focus:border-[#2f81f4] focus:outline-none transition-colors ${fieldBorderClass(!!pwFieldErrors.next)}`}
              />
              {pwFieldErrors.next && (
                <p className="text-xs text-[#f85149] mt-1">{pwFieldErrors.next}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8b949e] uppercase tracking-wide" htmlFor="confirm">
                Confirm new password
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={pwForm.confirm}
                onChange={handlePwChange}
                className={`bg-[#0d1117] border rounded-md px-3 py-2 text-sm text-white placeholder:text-[#6e7681] focus:border-[#2f81f4] focus:outline-none transition-colors ${fieldBorderClass(!!pwFieldErrors.confirm)}`}
              />
              {pwFieldErrors.confirm && (
                <p className="text-xs text-[#f85149] mt-1">{pwFieldErrors.confirm}</p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={pwLoading}
                className="text-sm px-4 py-2 bg-[#2f81f4] text-white rounded-md hover:bg-[#2f81f4]/90 active:scale-[0.98] transition-all shadow-sm shadow-[#2f81f4]/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {pwLoading ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="bg-[#161b22] border border-[#f85149]/40 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f85149]/40 bg-gradient-to-r from-[#f85149]/10 to-transparent">
            <h2 className="text-base font-semibold text-[#f85149]">Danger Zone</h2>
            <p className="text-sm text-[#8b949e] mt-1">Irreversible actions for your account</p>
          </div>
          <div className="px-6 py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f85149]/10 border border-[#f85149]/30 text-[#f85149]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              <div>
                <p className="text-sm text-white font-medium">Sign out</p>
                <p className="text-xs text-[#8b949e] mt-0.5">End your current session on this device</p>
              </div>
            </div>
            {showConfirm ? (
              <div className="flex items-center gap-2 animate-[fadeIn_0.15s_ease-out]">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="text-sm px-4 py-2 border border-[#30363d] text-[#8b949e] rounded-md hover:text-white hover:border-[#444c56] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={logout}
                  className="text-sm px-4 py-2 bg-[#f85149] text-white rounded-md hover:bg-red-600 active:scale-[0.98] transition-all shadow-sm shadow-[#f85149]/20"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center gap-2 text-sm px-4 py-2 border border-[#f85149]/60 text-[#f85149] rounded-md hover:bg-[#f85149]/10 hover:border-[#f85149] transition-colors"
              >
                <span>Sign out</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
          {showConfirm && (
            <div className="px-6 pb-4 -mt-1 text-xs text-[#8b949e] animate-[fadeIn_0.15s_ease-out]">
              You can sign back in at any time.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}