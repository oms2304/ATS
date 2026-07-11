'use client'

import { useEffect, useState } from 'react'
import { apiFetch, duplicateDocument, renameDocument } from '@/lib/api'
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
  job: { id: string; title: string; company: string } | null
}

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

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('/api/documents')
        if (res.success && Array.isArray(res.data)) setDocs(res.data)
      } catch {
        // leave the list empty so the page still renders
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-1">Documents</h1>
        <p className="text-sm text-[#8b949e]">
          Resumes and cover letters you&apos;ve saved from your job drafts.
        </p>
      </div>

      {actionError && (
        <p className="text-sm text-[#f85149]" data-testid="action-error">
          {actionError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[#8b949e]">Loading...</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-[#8b949e]">
          No saved documents yet. Open a job, generate a resume or cover letter, and click Save.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onView={setActiveDoc}
              onDuplicate={handleDuplicate}
              onRename={handleRename}
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
