'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

type ResearchNote = {
  id: string
  content: string
  updatedAt: string
} | null

export function ResearchNotesSection({ jobId }: { jobId: string }) {
  const [note, setNote] = useState<ResearchNote>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await apiFetch(`/api/jobs/${jobId}/research-note`)
        if (!cancelled && res.success) {
          setNote(res.data)
          setInput(res.data?.content ?? '')
        }
      } catch {
        // leave existing state on transient failure
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [jobId])

  async function handleSave() {
    if (!input.trim()) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/jobs/${jobId}/research-note`, {
        method: 'PUT',
        body: JSON.stringify({ content: input }),
      })
      if (res.success) {
        setNote(res.data)
        setEditing(false)
      }
    } catch {
      // keep form open
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm('Delete these research notes?')) return
    try {
      await apiFetch(`/api/jobs/${jobId}/research-note`, { method: 'DELETE' })
      setNote(null)
      setInput('')
      setEditing(false)
    } catch {
      // ignore
    }
  }

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-white">Company Research Notes</h2>
        {!editing && (
          <button
            onClick={() => { setInput(note?.content ?? ''); setEditing(true) }}
            className="text-xs px-3 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 transition-colors"
          >
            {note ? 'Edit' : '+ Add'}
          </button>
        )}
      </div>

      {editing && (
        <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs text-[#8b949e] block mb-1">Notes</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={6}
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#2f81f4] resize-none"
              placeholder="Company mission, culture, recent news, funding, competitors..."
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !input.trim()}
              className="text-xs px-3 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : note ? 'Update' : 'Add'}
            </button>
            <button
              onClick={() => { setEditing(false); setInput(note?.content ?? '') }}
              className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#8b949e]">Loading...</p>
      ) : !editing && (
        note ? (
          <div className="border border-[#30363d] rounded-lg p-3">
            <p className="text-sm text-[#e6edf3] whitespace-pre-wrap">{note.content}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setInput(note.content); setEditing(true) }} className="text-xs text-[#8b949e] hover:text-white transition-colors">Edit</button>
              <button onClick={handleDelete} className="text-xs text-[#f85149] hover:text-red-400 transition-colors">Delete</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#8b949e]">No research notes yet.</p>
        )
      )}
    </div>
  )
}