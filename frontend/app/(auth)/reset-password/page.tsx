'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowRight, CircleCheck, Eye, EyeOff, Loader, Lock } from 'lucide-react'
import { apiFetch } from '@/lib/api'

function fieldBorderClass(hasError: boolean) {
  return hasError ? 'border-error' : 'border-outline-variant'
}

function ResetPasswordInner() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState(() =>
    token ? '' : 'This reset link is missing its token. Please request a new one.'
  )
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [done, setDone] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setFieldErrors(prev => ({ ...prev, [name]: '' }))
    setGeneralError('')
  }

  function validate() {
    const errors: Record<string, string> = {}
    if (form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    } else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errors.password = 'Password must contain at least one letter and one number'
    }
    if (form.confirm !== form.password) {
      errors.confirm = 'Passwords do not match'
    }
    return errors
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError('')

    if (!token) {
      setGeneralError('This reset link is missing its token. Please request a new one.')
      return
    }

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const data = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password: form.password })
      })

      if (!data.success) {
        if (data.fields) {
          setFieldErrors(data.fields)
        } else {
          setGeneralError(data.error ?? 'Reset failed. The link may have expired.')
        }
        return
      }

      setDone(true)
      setTimeout(() => router.push('/login'), 1500)
    } catch {
      setGeneralError('Something went wrong. Please try again.')
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
            Choose a new password
          </p>
        </header>

        <div className="w-full h-px bg-outline-variant mb-xl" />

        {done ? (
          <div className="rounded-lg border border-outline-variant bg-background p-md text-center">
            <CircleCheck className="w-7 h-7 mx-auto text-primary" />
            <p className="text-on-surface text-body-sm font-body-sm mt-xs">
              Your password has been updated. Redirecting to login...
            </p>
          </div>
        ) : (
          <>
            {generalError && (
              <p className="text-error text-[12px] text-center mb-md">{generalError}</p>
            )}

            <form className="space-y-md" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-xs">
                <label className="text-on-surface font-label-md text-label-md ml-1" htmlFor="password">
                  New password
                </label>
                <div className="relative group input-focus-glow rounded-lg">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                  <input
                    className={`w-full bg-background border rounded-lg py-2.5 pl-10 pr-10 text-on-surface text-body-md placeholder:text-outline focus:border-primary focus:ring-0 transition-all outline-none ${fieldBorderClass(!!fieldErrors.password)}`}
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(prev => !prev)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-error text-[12px] mt-1">{fieldErrors.password}</p>
                )}
              </div>

              <div className="flex flex-col gap-xs">
                <label className="text-on-surface font-label-md text-label-md ml-1" htmlFor="confirm">
                  Confirm new password
                </label>
                <div className="relative group input-focus-glow rounded-lg">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                  <input
                    className={`w-full bg-background border rounded-lg py-2.5 pl-10 pr-4 text-on-surface text-body-md placeholder:text-outline focus:border-primary focus:ring-0 transition-all outline-none ${fieldBorderClass(!!fieldErrors.confirm)}`}
                    id="confirm"
                    name="confirm"
                    placeholder="••••••••"
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={handleChange}
                  />
                </div>
                {fieldErrors.confirm && (
                  <p className="text-error text-[12px] mt-1">{fieldErrors.confirm}</p>
                )}
              </div>

              <button
                className="w-full bg-primary-container hover:bg-primary-container/90 active:scale-[0.98] text-white font-label-md text-body-lg py-3 rounded-lg flex items-center justify-center gap-2 transition-all mt-xl shadow-lg shadow-primary-container/10 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
                type="submit"
                disabled={loading || !token}
              >
                {loading ? (
                  <>
                    <Loader className="w-[18px] h-[18px] animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    Set new password
                    <ArrowRight className="w-[18px] h-[18px]" />
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  )
}