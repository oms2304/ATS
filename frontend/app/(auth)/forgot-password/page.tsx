'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

function fieldBorderClass(hasError: boolean) {
  return hasError ? 'border-error' : 'border-outline-variant'
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    setFieldError('')
    setGeneralError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError('')

    if (!email.trim()) {
      setFieldError('Email is required')
      return
    }

    setLoading(true)
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      })
      // always show success — backend never reveals whether the email exists
      setSent(true)
    } catch {
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ats-auth dark bg-background text-on-background flex items-center justify-center p-md h-screen">
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-container rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary-container rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 w-full max-w-[440px] bg-surface-container border border-outline-variant rounded-xl p-xl shadow-2xl">
        <header className="flex flex-col items-center text-center mb-xl">
          <h1 className="text-on-surface font-headline-lg text-headline-lg mb-xs">
            ATS for Job Seekers
          </h1>
          <p className="text-on-surface-variant font-body-md text-body-md">
            Reset your password
          </p>
        </header>

        <div className="w-full h-px bg-outline-variant mb-xl" />

        {sent ? (
          <div className="rounded-lg border border-outline-variant bg-background p-md text-center">
            <span className="material-symbols-outlined text-[28px] text-primary">
              mark_email_unread
            </span>
            <p className="text-on-surface text-body-sm font-body-sm mt-xs">
              If an account exists for that email, we&apos;ve sent a link to reset your password.
            </p>
          </div>
        ) : (
          <>
            {generalError && (
              <p className="text-error text-[12px] text-center mb-md">{generalError}</p>
            )}

            <form className="space-y-md" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-xs">
                <label className="text-on-surface font-label-md text-label-md ml-1" htmlFor="email">
                  Email
                </label>
                <div className="relative group input-focus-glow rounded-lg">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
                    mail
                  </span>
                  <input
                    className={`w-full bg-background border rounded-lg py-2.5 pl-10 pr-4 text-on-surface text-body-md placeholder:text-outline focus:border-primary focus:ring-0 transition-all outline-none ${fieldBorderClass(!!fieldError)}`}
                    id="email"
                    name="email"
                    placeholder="john@example.com"
                    type="email"
                    value={email}
                    onChange={handleChange}
                  />
                </div>
                {fieldError && (
                  <p className="text-error text-[12px] mt-1">{fieldError}</p>
                )}
              </div>

              <button
                className="w-full bg-primary-container hover:bg-primary-container/90 active:scale-[0.98] text-white font-label-md text-body-lg py-3 rounded-lg flex items-center justify-center gap-2 transition-all mt-xl shadow-lg shadow-primary-container/10 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    Sending...
                  </>
                ) : (
                  <>
                    Send reset link
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}

        <footer className="mt-xl text-center">
          <p className="text-on-surface-variant font-body-sm text-body-sm">
            Remembered it?{' '}
            <Link
              className="text-primary-container hover:text-primary-container/80 font-medium hover:underline transition-all"
              href="/login"
            >
              Back to login
            </Link>
          </p>
        </footer>
      </main>
    </div>
  )
}