'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch, duplicateDocument, renameDocument, archiveDocument, restoreDocument } from '@/lib/api'
import { DocumentCard } from '@/components/ui/document-card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type DocItem = {
  id: string
  type: string
  title: string
  content: string | null
  versionNumber: number
  updatedAt: string
  status?: string
  tags?: string[]
  archivedAt?: string | null
  job: { id: string; title: string; company: string } | null
}

type TypeFilter = 'All' | 'resume' | 'cover_letter'
type SortOption = 'updatedDesc' | 'updatedAsc' | 'titleAsc'

function typeLabel(type: string) {
  return type === 'cover_letter' ? 'Cover Letter' : 'Resume'
}

function formatDateTime(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDoc, setActiveDoc] = useState<DocItem | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // S3-008: toggles between the active library and the archived view.
  // The backend excludes archived documents from the default list, same
  // as jobs, so we refetch with ?archived=true when this is on. This
  // toggle is also the sole way to view archived/active state — there is
  // no separate "status" filter, since a document's real archived state
  // lives on archivedAt (set by this toggle's fetch), not the status field.
  const [showArchived, setShowArchived] = useState(false)

  // S3-006: filter and sort state for the document library
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All')
  const [sortBy, setSortBy] = useState<SortOption>('updatedDesc')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await apiFetch(`/api/documents${showArchived ? '?archived=true' : ''}`)
        if (res.success && Array.isArray(res.data)) setDocs(res.data)
      } catch {
        // leave the list empty so the page still renders
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [showArchived])

  // S3-007: duplicate a document. Prepends the new copy to the list so the
  // user sees it immediately without a full refetch.
  async function handleDuplicate(doc: DocItem) {
    setActionError(null)
    try {
      const res = await duplicateDocument(doc.id)
      if (res.success && res.data) {
        setDocs((prev) => [res.data, ...prev])
      }
    } catch {
      setActionError('Could not duplicate document. Please try again.')
    }
  }

  // S3-007: rename a document. Updates the title in place on success.
  async function handleRename(doc: DocItem, newTitle: string) {
    setActionError(null)
    try {
      const res = await renameDocument(doc.id, newTitle)
      if (res.success) {
        setDocs((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, title: newTitle } : d))
        )
      }
    } catch {
      setActionError('Could not rename document. Please try again.')
    }
  }

  // S3-008: archive a document. Since the current view only shows one
  // "side" (active or archived) at a time, a successfully archived
  // document is removed from the active view immediately.
  async function handleArchive(doc: DocItem) {
    setActionError(null)
    try {
      const res = await archiveDocument(doc.id)
      if (res.success) {
        setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      }
    } catch {
      setActionError('Could not archive document. Please try again.')
    }
  }

  // S3-008: restore an archived document back to active.
  async function handleRestore(doc: DocItem) {
    setActionError(null)
    try {
      const res = await restoreDocument(doc.id)
      if (res.success) {
        setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      }
    } catch {
      setActionError('Could not restore document. Please try again.')
    }
  }

  // S3-006: derive the filtered/sorted list shown in the grid
  const visibleDocs = useMemo(() => {
    let result = [...docs]

    if (typeFilter !== 'All') {
      result = result.filter((doc) => doc.type === typeFilter)
    }

    result.sort((a, b) => {
      if (sortBy === 'titleAsc') return a.title.localeCompare(b.title)
      const aTime = new Date(a.updatedAt).getTime()
      const bTime = new Date(b.updatedAt).getTime()
      return sortBy === 'updatedAsc' ? aTime - bTime : bTime - aTime
    })

    return result
  }, [docs, typeFilter, sortBy])

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Documents</h1>
          <p className="text-sm text-[#8b949e]">
            Resumes and cover letters you&apos;ve saved from your job drafts.
          </p>
        </div>
        <button
          onClick={() => setShowArchived((v) => !v)}
          data-testid="toggle-archived-documents"
          className={`text-sm px-4 py-2 rounded border transition-colors ${
            showArchived
              ? 'bg-[#21262d] border-[#444c56] text-white'
              : 'bg-[#0d1117] border-[#30363d] text-[#8b949e] hover:text-white hover:border-[#444c56]'
          }`}
        >
          {showArchived ? 'Show active' : 'Show archived'}
        </button>
      </div>

      {actionError && (
        <p className="text-sm text-[#f85149]" data-testid="action-error">
          {actionError}
        </p>
      )}

      {!loading && docs.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            data-testid="type-filter"
            aria-label="Filter by document type"
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all appearance-none"
          >
            <option value="All">All types</option>
            <option value="resume">Resume</option>
            <option value="cover_letter">Cover Letter</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            data-testid="sort-select"
            aria-label="Sort documents"
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none transition-all appearance-none"
          >
            <option value="updatedDesc">Last Updated (Newest)</option>
            <option value="updatedAsc">Last Updated (Oldest)</option>
            <option value="titleAsc">Title (A-Z)</option>
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#8b949e]">Loading...</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-[#8b949e]">
          {showArchived
            ? 'No archived documents.'
            : 'No saved documents yet. Open a job, generate a resume or cover letter, and click Save.'}
        </p>
      ) : visibleDocs.length === 0 ? (
        <p className="text-sm text-[#8b949e]" data-testid="no-match-message">
          No documents match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onView={setActiveDoc}
              onDuplicate={handleDuplicate}
              onRename={handleRename}
              onArchive={handleArchive}
              onRestore={handleRestore}
            />
          ))}
        </div>
      )}

      <Dialog open={!!activeDoc} onOpenChange={(open) => !open && setActiveDoc(null)}>
        <DialogContent className="sm:max-w-2xl bg-[#161b22] text-white border border-[#30363d]">
          {activeDoc && (
            <>
              <DialogHeader>
                <DialogTitle>{activeDoc.title}</DialogTitle>
                <DialogDescription className="text-[#8b949e]">
                  {typeLabel(activeDoc.type)} · v{activeDoc.versionNumber} · Updated{' '}
                  {formatDateTime(activeDoc.updatedAt)}
                  {activeDoc.job && (
                    <>
                      {' · '}
                      {activeDoc.job.title} at {activeDoc.job.company}
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <pre className="whitespace-pre-wrap font-sans text-sm text-[#c9d1d9] bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 max-h-[28rem] overflow-y-auto">
                {activeDoc.content}
              </pre>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
