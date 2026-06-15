'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Eye, EyeOff, Loader, Lock, Mail, MailPlus, User } from 'lucide-react'
import { apiFetch } from '@/lib/api'

function fieldBorderClass(hasError: boolean) {
  return hasError ? 'border-error' : 'border-outline-variant'
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setFieldErrors(prev => ({ ...prev, [name]: '' }))
    setGeneralError('')
  }

  function validate() {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = 'Name is required'
    if (!form.email.trim()) errors.email = 'Email is required'
    if (!form.password) errors.password = 'Password is required'
    else if (form.password.length < 8)
      errors.password = 'Password must be at least 8 characters'
    else if (!/[A-Za-z]/.test(form.password))
      errors.password = 'Password must contain at least one letter'
    else if (!/[0-9]/.test(form.password))
      errors.password = 'Password must contain at least one number'
    if (form.password !== form.confirmPassword)
      errors.confirmPassword = 'Passwords do not match'
    return errors
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError('')

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password
        })
      })

      if (!data.success) {
        if (data.fields) {
          setFieldErrors(data.fields)
        } else {
          setGeneralError(data.error ?? 'Registration failed')
        }
        return
      }

      setSuccessMessage(
        data.data?.message ?? 'Account created! Check your email to verify your account.'
      )
    } catch (err) {
      setGeneralError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      )
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
            Track your job search like a pro
          </p>
        </header>

        <div className="w-full h-px bg-outline-variant mb-xl" />

        {successMessage ? (
          <div className="flex flex-col items-center text-center gap-md py-md">
            <MailPlus className="w-14 h-14 text-primary" />
            <p className="text-on-surface font-label-md text-body-lg">Check your email</p>
            <p className="text-on-surface-variant font-body-md text-body-md">
              {successMessage}
            </p>
            <Link
              className="w-full bg-primary-container hover:bg-primary-container/90 active:scale-[0.98] text-white font-label-md text-body-lg py-3 rounded-lg flex items-center justify-center gap-2 transition-all mt-md shadow-lg shadow-primary-container/10"
              href="/login"
            >
              Go to Login
              <ArrowRight className="w-[18px] h-[18px]" />
            </Link>
          </div>
        ) : (
          <>
            {generalError && (
              <p className="text-error text-[12px] text-center mb-md">{generalError}</p>
            )}

            <form className="space-y-md" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-xs">
            <label
              className="text-on-surface font-label-md text-label-md ml-1"
              htmlFor="fullName"
            >
              Full Name
            </label>
            <div className="relative group input-focus-glow rounded-lg">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
              <input
                className={`w-full bg-background border rounded-lg py-2.5 pl-10 pr-4 text-on-surface text-body-md placeholder:text-outline focus:border-primary focus:ring-0 transition-all outline-none ${fieldBorderClass(!!fieldErrors.name)}`}
                id="fullName"
                name="name"
                placeholder="John Doe"
                type="text"
                value={form.name}
                onChange={handleChange}
              />
            </div>
            {fieldErrors.name && (
              <p className="text-error text-[12px] mt-1">{fieldErrors.name}</p>
            )}
          </div>

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

          <div className="flex flex-col gap-xs">
            <label
              className="text-on-surface font-label-md text-label-md ml-1"
              htmlFor="confirmPassword"
            >
              Confirm Password
            </label>
            <div className="relative group input-focus-glow rounded-lg">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
              <input
                className={`w-full bg-background border rounded-lg py-2.5 pl-10 pr-10 text-on-surface text-body-md placeholder:text-outline focus:border-primary focus:ring-0 transition-all outline-none ${fieldBorderClass(!!fieldErrors.confirmPassword)}`}
                id="confirmPassword"
                name="confirmPassword"
                placeholder="••••••••"
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={handleChange}
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                type="button"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowConfirmPassword(prev => !prev)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="text-error text-[12px] mt-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button
            className="w-full bg-primary-container hover:bg-primary-container/90 active:scale-[0.98] text-white font-label-md text-body-lg py-3 rounded-lg flex items-center justify-center gap-2 transition-all mt-xl shadow-lg shadow-primary-container/10 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader className="w-[18px] h-[18px] animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-[18px] h-[18px]" />
              </>
            )}
          </button>
            </form>
          </>
        )}

        <footer className="mt-xl text-center">
          <p className="text-on-surface-variant font-body-sm text-body-sm">
            Already have an account?{' '}
            <Link
              className="text-primary-container hover:text-primary-container/80 font-medium hover:underline transition-all"
              href="/login"
            >
              Login
            </Link>
          </p>
        </footer>
      </main>
    </div>
  )
}
