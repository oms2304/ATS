'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

type PrepNote = {
  id: string
  category: string
  content: string
  createdAt: string
  updatedAt: string
}

const CATEGORIES = [
  { value: 'company_info', label: 'Company Info' },
  { value: 'talking_points', label: 'Talking Points' },
  { value: 'questions_to_ask', label: 'Questions to Ask' },
  { value: 'technical_prep', label: 'Technical Prep' },
] as const

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value
}

export function PrepNotesSection({ jobId }: { jobId: string }) {
  const [notes, setNotes] = useState<PrepNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState<PrepNote | null>(null)
  const [form, setForm] = useState({ category: 'company_info', content: '' })
  const [saving, setSaving] = useState(false)

  

  

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await apiFetch(`/api/jobs/${jobId}/prep-notes`)
        if (!cancelled && res.success) setNotes(res.data)
      } catch {
        // leave existing list in place on transient failure
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [jobId])
  
  async function handleSave() {
    if (!form.content.trim()) return
    setSaving(true)
    try {
      if (editingNote) {
        const res = await apiFetch(`/api/prep-notes/${editingNote.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        })
        setNotes((prev) => prev.map((n) => (n.id === editingNote.id ? res.data : n)))
      } else {
        const res = await apiFetch(`/api/jobs/${jobId}/prep-notes`, {
          method: 'POST',
          body: JSON.stringify(form),
        })
        setNotes((prev) => [...prev, res.data])
      }
      setShowForm(false)
      setEditingNote(null)
      setForm({ category: 'company_info', content: '' })
    } catch {
      // keep form open
    }
    setSaving(false)
  }

  async function handleDelete(noteId: string) {
    if (!window.confirm('Delete this prep note?')) return
    try {
      await apiFetch(`/api/prep-notes/${noteId}`, { method: 'DELETE' })
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch {
      // ignore
    }
  }

  function handleEdit(note: PrepNote) {
    setEditingNote(note)
    setForm({ category: note.category, content: note.content })
    setShowForm(true)
  }

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-white">Interview Prep Notes</h2>
        <button
          onClick={() => {
            setEditingNote(null)
            setForm({ category: 'company_info', content: '' })
            setShowForm(true)
          }}
          className="text-xs px-3 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 transition-colors"
        >
          + Add
        </button>
      </div>

      {showForm && (
        <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs text-[#8b949e] block mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#2f81f4]"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#8b949e] block mb-1">Content</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={4}
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#2f81f4] resize-none"
              placeholder="Notes for this category..."
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.content.trim()}
              className="text-xs px-3 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingNote ? 'Update' : 'Add'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingNote(null) }}
              className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#8b949e]">Loading...</p>
      ) : notes.length === 0 && !showForm ? (
        <p className="text-sm text-[#8b949e]">No prep notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="border border-[#30363d] rounded-lg p-3">
              <div className="flex justify-between items-start">
                <span className="text-xs px-2 py-0.5 rounded bg-[#2d1f6e] text-[#bc8cff]">
                  {categoryLabel(note.category)}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(note)} className="text-xs text-[#8b949e] hover:text-white transition-colors">Edit</button>
                  <button onClick={() => handleDelete(note.id)} className="text-xs text-[#f85149] hover:text-red-400 transition-colors">Delete</button>
                </div>
              </div>
              <p className="text-xs text-[#e6edf3] mt-2 whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}