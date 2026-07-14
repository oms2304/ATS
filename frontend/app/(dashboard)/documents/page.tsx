'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, duplicateDocument, renameDocument, archiveDocument, restoreDocument, getDocumentVersions, uploadDocumentFile } from '@/lib/api'
import { DocumentCard } from '@/components/ui/document-card'
import { UploadCloud, FileText, X, AlertCircle } from 'lucide-react'
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
  fileUrl?: string | null
  fileName?: string | null
  mimeType?: string | null
  fileSize?: number | null
  versionNumber: number
  updatedAt: string
  status?: string
  tags?: string[]
  archivedAt?: string | null
  job: { id: string; title: string; company: string } | null
}
type DocVersion = {
  id: string
  version_number: number
  label: string | null
  content: string | null
  createdAt: string
}

type TypeFilter = 'All' | 'resume' | 'cover_letter'
type SortOption = 'updatedDesc' | 'updatedAsc' | 'titleAsc'
type UploadType = 'resume' | 'cover_letter'

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
  const [versions, setVersions] = useState<DocVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)

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

  // S3-004: upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null)
  const uploadFileInputRef = useRef<HTMLInputElement>(null)
  const [uploadType, setUploadType] = useState<UploadType>('resume')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const fetchDocuments = useCallback(async () => {
    const res = await apiFetch(`/api/documents${showArchived ? '?archived=true' : ''}`)
    if (res.success && Array.isArray(res.data)) setDocs(res.data)
    return res
  }, [showArchived])

  // Effect only runs the fetch inline (not via a shared function reference)
  // to satisfy react-hooks/set-state-in-effect. fetchDocuments is reused
  // separately below for the post-upload refetch, which runs from a click
  // handler rather than an effect, so it isn't subject to that rule.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        await fetchDocuments()
      } catch {
        // leave the list empty so the page still renders
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [fetchDocuments])

  // S3-004: upload a new document file (PDF, DOCX, or TXT). Backend enforces
  // format/size validation (S3-BR-004, S3-BR-005); errors are surfaced inline.
  // Refetches the full list afterward rather than constructing a card from
  // the response, since the upload response nests fields differently
  // (data.version) than the list endpoint's flattened shape.
  function resetUploadForm() {
    setUploadFileObj(null)
    setUploadType('resume')
    setUploadTitle('')
    setUploadError(null)
    if (uploadFileInputRef.current) uploadFileInputRef.current.value = ''
  }

  async function handleUploadSubmit() {
    setUploadError(null)

    if (!uploadFileObj) {
      setUploadError('Please choose a file to upload.')
      return
    }
    if (!uploadTitle.trim()) {
      setUploadError('Please enter a title.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFileObj)
      formData.append('type', uploadType)
      formData.append('title', uploadTitle.trim())

      const res = await uploadDocumentFile(formData)
      if (res.success) {
        setShowUploadModal(false)
        resetUploadForm()
        await fetchDocuments()
      }
    } catch (err) {
      const fieldErrors = (err as { data?: { fields?: Record<string, string[]> } })?.data?.fields
      const firstFieldError = fieldErrors && Object.values(fieldErrors)[0]?.[0]
      setUploadError(firstFieldError || (err as Error)?.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

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
        <div className="flex gap-2">
          <button
            onClick={() => {
              resetUploadForm()
              setShowUploadModal(true)
            }}
            data-testid="open-upload-modal"
            className="text-sm px-4 py-2 rounded bg-[#2f81f4] text-white hover:bg-[#3f91ff] transition-colors"
          >
            Upload Document
          </button>
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
            : 'No saved documents yet. Upload a file, or open a job and generate a resume or cover letter.'}
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
              onView={(d) => {
                setActiveDoc(d)
                setVersions([])
                setVersionsLoading(true)
                getDocumentVersions(d.id)
                  .then((res: { data?: DocVersion[] }) => setVersions(res?.data ?? []))
                  .catch(() => setVersions([]))
                  .finally(() => setVersionsLoading(false))
              }}
              onDuplicate={handleDuplicate}
              onRename={handleRename}
              onArchive={handleArchive}
              onRestore={handleRestore}
            />
          ))}
        </div>
      )}

      <Dialog open={!!activeDoc} onOpenChange={(open) => !open && setActiveDoc(null)}>
        <DialogContent className="sm:max-w-2xl bg-[#161b22] text-white border border-[#30363d] max-h-[85vh] overflow-y-auto">
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

              {activeDoc.fileUrl ? (
                <div
                  className="flex items-center justify-between gap-3 bg-[#0d1117] border border-[#30363d] rounded px-3 py-3"
                  data-testid="document-file-info"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{activeDoc.fileName ?? 'Uploaded file'}</p>
                    <p className="text-xs text-[#8b949e]">
                      {activeDoc.mimeType ?? 'Unknown type'}
                      {typeof activeDoc.fileSize === 'number' &&
                        ` · ${(activeDoc.fileSize / 1024).toFixed(0)} KB`}
                    </p>
                  </div>
                  <a
                    href={activeDoc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="document-file-download-link"
                    className="text-xs px-3 py-1.5 rounded bg-[#2f81f4] text-white hover:bg-[#3f91ff] transition-colors shrink-0"
                  >
                    Open / Download
                  </a>
                </div>
              ) : activeDoc.content ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-[#c9d1d9] bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 max-h-[28rem] overflow-y-auto">
                  {activeDoc.content}
                </pre>
              ) : (
                <p className="text-sm text-[#8b949e]" data-testid="document-no-content">
                  No content available for this document.
                </p>
              )}

              <div className="mt-4 border-t border-[#30363d] pt-3">
                <p className="text-sm font-medium text-white mb-2">Version History</p>
                {versionsLoading ? (
                  <p className="text-xs text-[#8b949e]">Loading versions...</p>
                ) : versions.length === 0 ? (
                  <p className="text-xs text-[#8b949e]">No version history available.</p>
                ) : (
                  <ul className="space-y-2 max-h-40 overflow-y-auto" data-testid="version-history-list">
                    {versions.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between text-xs text-[#c9d1d9] bg-[#0d1117] border border-[#30363d] rounded px-3 py-2"
                      >
                        <span>
                          v{v.version_number}
                          {v.label ? ` — ${v.label}` : ''}
                        </span>
                        <span className="text-[#8b949e]">{formatDateTime(v.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showUploadModal}
        onOpenChange={(open) => {
          if (!open) resetUploadForm()
          setShowUploadModal(open)
        }}
      >
        <DialogContent className="sm:max-w-lg bg-[#161b22] text-white border border-[#30363d]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UploadCloud size={18} className="text-[#2f81f4]" />
              Upload Document
            </DialogTitle>
            <DialogDescription className="text-[#8b949e]">
              Add an existing resume or cover letter to your library.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <input
              ref={uploadFileInputRef}
              id="upload-file-input"
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => setUploadFileObj(e.target.files?.[0] ?? null)}
              data-testid="upload-file-input"
              className="sr-only"
            />

            {uploadFileObj ? (
              <div className="flex items-center gap-3 bg-[#0d1117] border border-[#2f81f4] rounded-lg px-4 py-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-[#1f3d6e] flex items-center justify-center">
                  <FileText size={18} className="text-[#58a6ff]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate" data-testid="upload-selected-filename">
                    {uploadFileObj.name}
                  </p>
                  <p className="text-xs text-[#8b949e]">
                    {(uploadFileObj.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadFileObj(null)
                    if (uploadFileInputRef.current) uploadFileInputRef.current.value = ''
                  }}
                  aria-label="Remove selected file"
                  className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => uploadFileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#30363d] rounded-lg px-4 py-8 text-[#8b949e] hover:text-white hover:border-[#2f81f4] hover:bg-[#0d1117] transition-colors"
              >
                <UploadCloud size={28} />
                <span className="text-sm font-medium">Click to choose a file</span>
                <div className="flex gap-1.5 mt-1">
                  {['PDF', 'DOCX', 'TXT'].map((ext) => (
                    <span
                      key={ext}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[#21262d] text-[#8b949e]"
                    >
                      {ext}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-[#8b949e]">Up to 5MB</span>
              </button>
            )}

            <div>
              <label className="block text-xs text-[#8b949e] mb-2">Type</label>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Document type">
                <button
                  type="button"
                  onClick={() => setUploadType('resume')}
                  data-testid="upload-type-resume"
                  className={`text-sm px-3 py-2 rounded border transition-colors ${
                    uploadType === 'resume'
                      ? 'bg-[#1f3d6e] border-[#2f81f4] text-white'
                      : 'bg-[#0d1117] border-[#30363d] text-[#8b949e] hover:text-white hover:border-[#444c56]'
                  }`}
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => setUploadType('cover_letter')}
                  data-testid="upload-type-cover-letter"
                  className={`text-sm px-3 py-2 rounded border transition-colors ${
                    uploadType === 'cover_letter'
                      ? 'bg-[#2d1f6e] border-[#bc8cff] text-white'
                      : 'bg-[#0d1117] border-[#30363d] text-[#8b949e] hover:text-white hover:border-[#444c56]'
                  }`}
                >
                  Cover Letter
                </button>
              </div>
              <select
                aria-hidden="true"
                tabIndex={-1}
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value as UploadType)}
                data-testid="upload-type-select"
                className="sr-only"
              >
                <option value="resume">Resume</option>
                <option value="cover_letter">Cover Letter</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#8b949e] mb-1" htmlFor="upload-title-input">
                Title
              </label>
              <input
                id="upload-title-input"
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Alice Anderson Resume"
                data-testid="upload-title-input"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none"
              />
            </div>

            {uploadError && (
              <div
                className="flex items-start gap-2 bg-[#3d1f1f] border border-[#f85149]/40 rounded px-3 py-2"
                data-testid="upload-error"
              >
                <AlertCircle size={16} className="text-[#f85149] shrink-0 mt-0.5" />
                <p className="text-sm text-[#f85149]">{uploadError}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d] mt-1">
              <button
                onClick={() => {
                  resetUploadForm()
                  setShowUploadModal(false)
                }}
                className="text-sm px-4 py-2 rounded border border-[#30363d] text-[#8b949e] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={uploading}
                data-testid="upload-submit-button"
                className="text-sm px-4 py-2 rounded bg-[#2f81f4] text-white hover:bg-[#3f91ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
