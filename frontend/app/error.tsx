'use client'

import { useEffect } from 'react'

// Route-level error boundary (Next.js App Router). Catches render/runtime
// errors in this segment, logs them consistently with actionable context,
// and shows a recoverable fallback instead of a blank screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[client error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred. You can try again.
        {error.digest ? ` (ref: ${error.digest})` : ''}
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </div>
  )
}
