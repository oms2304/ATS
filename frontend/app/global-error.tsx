'use client'

import { useEffect } from 'react'

// Global error boundary (Next.js App Router). Catches errors thrown in the
// root layout itself, which the segment-level error.tsx cannot. Must render
// its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <h2>Something went wrong</h2>
          <p>
            An unexpected error occurred.
            {error.digest ? ` (ref: ${error.digest})` : ''}
          </p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  )
}
