'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, CircleCheck, CircleX, Loader } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type Status = 'verifying' | 'success' | 'error'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'error')
  const [message, setMessage] = useState(
    token ? 'Verifying your email...' : 'This verification link is missing its token.'
  )
  const hasRun = useRef(false)

  useEffect(() => {
    if (!token || hasRun.current) return
    hasRun.current = true

    async function verify() {
      try {
        const data = await apiFetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token as string)}`
        )
        if (data.success) {
          setStatus('success')
          setMessage(data.message ?? 'Your email has been verified.')
        } else {
          setStatus('error')
          setMessage(data.error ?? 'We could not verify your email.')
        }
      } catch {
        setStatus('error')
        setMessage('Something went wrong. Please try again.')
      }
    }

    verify()
  }, [token])

  const Icon =
    status === 'verifying'
      ? Loader
      : status === 'success'
        ? CircleCheck
        : CircleX
  const iconClass =
    status === 'verifying'
      ? 'w-14 h-14 text-primary animate-spin'
      : status === 'success'
        ? 'w-14 h-14 text-primary'
        : 'w-14 h-14 text-error'

  return (
    <main className="relative z-10 w-full max-w-[440px] bg-surface-container border border-outline-variant rounded-xl p-xl shadow-2xl">
      <header className="flex flex-col items-center text-center mb-xl">
        <h1 className="text-on-surface font-headline-lg text-headline-lg mb-xs">
          ATS for Job Seekers
        </h1>
        <p className="text-on-surface-variant font-body-md text-body-md">
          Email verification
        </p>
      </header>

      <div className="w-full h-px bg-outline-variant mb-xl" />

      <div className="flex flex-col items-center text-center gap-md">
        <Icon className={iconClass} />
        <p className="text-on-surface font-body-md text-body-md">{message}</p>

        {status !== 'verifying' && (
          <Link
            className="w-full bg-primary-container hover:bg-primary-container/90 active:scale-[0.98] text-white font-label-md text-body-lg py-3 rounded-lg flex items-center justify-center gap-2 transition-all mt-md shadow-lg shadow-primary-container/10"
            href="/login"
          >
            Continue to Login
            <ArrowRight className="w-[18px] h-[18px]" />
          </Link>
        )}
      </div>
    </main>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="ats-auth dark bg-background text-on-background flex items-center justify-center p-md h-screen">
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-container rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary-container rounded-full blur-[120px]" />
      </div>

      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  )
}
