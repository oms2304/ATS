'use client'

import { apiFetch } from '@/lib/api'

export const STAGES = ['Interested', 'Applied', 'Interview', 'Offer', 'Rejected'] as const

export const STAGE_BADGE: Record<string, { bg: string; text: string }> = {
    Interested: { bg: '#21262d', text: '#8b949e'},
    Applied: { bg: '#1f3d6e', text: '#58a6ff'},
    Interview:  { bg: '#2d1f6e', text: '#bc8cff' },
    Offer:      { bg: '#1a3d2b', text: '#3fb950' },
    Rejected:   { bg: '#3d1f1f', text: '#f85149' },
    Archived:   { bg: '#21262d', text: '#8b949e' },
}

export async function updateJobStage(jobId: string, stage: string) {
    return apiFetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
    })
}

export function StageSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const badge = STAGE_BADGE[value] ?? STAGE_BADGE.Interested
  return (
    <select
      value={value}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault() 
        e.stopPropagation()
        }}
      onChange={(e) => { e.stopPropagation(); onChange(e.target.value) }}
      className="text-xs px-2 py-1 rounded appearance-none cursor-pointer outline-none focus:ring-1 focus:ring-[#2f81f4] disabled:opacity-50"
      style={{ backgroundColor: badge.bg, color: badge.text }}
    >
      {STAGES.map((s) => (
        <option key={s} value={s} className="bg-[#161b22] text-white">{s}</option>
      ))}
    </select>
  )
}