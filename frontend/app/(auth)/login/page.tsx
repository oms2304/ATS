'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, Loader, Lock, Mail, MailPlus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

function fieldBorderClass(hasError: boolean) {
  return hasError ? 'border-error' : 'border-outline-variant'
}

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setFieldErrors(prev => ({ ...prev, [name]: '' }))
    setGeneralError('')
    setNeedsVerification(false)
    setResendMessage('')
  }

  function validate() {
    const errors: Record<string, string> = {}
    if (!form.email.trim()) errors.email = 'Email is required'
    if (!form.password) errors.password = 'Password is required'
    return errors
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError('')
    setNeedsVerification(false)
    setResendMessage('')

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          password: form.password
        })
      })

      if (!data.success) {
        if (data.needsVerification) {
          setNeedsVerification(true)
          setUnverifiedEmail(data.email ?? form.email)
          setGeneralError(data.error ?? 'Please verify your email before logging in')
        } else if (data.fields) {
          setFieldErrors(data.fields)
        } else {
          setGeneralError(data.error ?? 'Login failed')
        }
        return
      }

      const { token, user } = data.data
      login({ userId: user.id, name: user.name, email: user.email }, token)
      router.push('/dashboard')
    } catch (err) {
      setGeneralError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResendLoading(true)
    setResendMessage('')
    try {
      const data = await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: unverifiedEmail })
      })
      setResendMessage(
        data.message ?? 'If an unverified account exists for that email, a link has been sent.'
      )
    } catch (err) {
      setResendMessage(
        err instanceof Error
          ? err.message
          : 'Could not resend the email. Please try again.'
      )
    } finally {
      setResendLoading(false)
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
            Welcome back, sign in to continue
          </p>
        </header>

        <div className="w-full h-px bg-outline-variant mb-xl" />

        {generalError && !needsVerification && (
          <p className="text-error text-[12px] text-center mb-md">{generalError}</p>
        )}

        {needsVerification && (
          <div className="mb-md rounded-lg border border-outline-variant bg-background p-md text-center">
            <MailPlus className="w-7 h-7 mx-auto text-primary" />
            <p className="text-on-surface text-body-sm font-body-sm mt-xs">{generalError}</p>
            {resendMessage ? (
              <p className="text-on-surface-variant text-[12px] mt-xs">{resendMessage}</p>
            ) : (
              <button
                className="mt-md text-primary-container hover:text-primary-container/80 font-medium text-body-sm hover:underline transition-all disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center gap-1"
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
              >
                {resendLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Resend verification email'
                )}
              </button>
            )}
          </div>
        )}

        <form className="space-y-md" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-xs">
            <label
              className="text-on-surface font-label-md text-label-md ml-1"
              htmlFor="email"
            >
              Email
            </label>
            <div className="relative group input-focus-glow rounded-lg">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
              <input
                className={`w-full bg-background border rounded-lg py-2.5 pl-10 pr-4 text-on-surface text-body-md placeholder:text-outline focus:border-primary focus:ring-0 transition-all outline-none ${fieldBorderClass(!!fieldErrors.email)}`}
                id="email"
                name="email"
                placeholder="john@example.com"
                type="email"
                value={form.email}
                onChange={handleChange}
              />
            </div>
            {fieldErrors.email && (
              <p className="text-error text-[12px] mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div className="flex flex-col gap-xs">
            <label
              className="text-on-surface font-label-md text-label-md ml-1"
              htmlFor="password"
            >
              Password
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

          <div className="flex justify-end">
            <Link
              className="text-primary-container hover:text-primary-container/80 font-body-sm text-body-sm hover:underline transition-all"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>

          <button
            className="w-full bg-primary-container hover:bg-primary-container/90 active:scale-[0.98] text-white font-label-md text-body-lg py-3 rounded-lg flex items-center justify-center gap-2 transition-all mt-xl shadow-lg shadow-primary-container/10 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader className="w-[18px] h-[18px] animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Login
                <ArrowRight className="w-[18px] h-[18px]" />
              </>
            )}
          </button>
        </form>

        <footer className="mt-xl text-center">
          <p className="text-on-surface-variant font-body-sm text-body-sm">
            Don&apos;t have an account?{' '}
            <Link
              className="text-primary-container hover:text-primary-container/80 font-medium hover:underline transition-all"
              href="/register"
            >
              Register
            </Link>
          </p>
        </footer>
      </main>
    </div>
  )
}
