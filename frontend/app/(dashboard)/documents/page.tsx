'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiFetch,
  archiveDocument,
  downloadDocument,
  duplicateDocument,
  renameDocument,
  restoreDocument,
} from '@/lib/api';
import { HistoryDialog } from '@/components/documents/HistoryDialog';
import { MetadataDialog } from '@/components/documents/MetadataDialog';
import { UploadDocumentDialog } from '@/components/documents/UploadDocumentDialog';
import { DocumentItem } from '@/components/documents/types';
import { DocumentCard } from '@/components/ui/document-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type TypeFilter = 'All' | 'resume' | 'cover_letter';
type SortOption = 'updatedDesc' | 'updatedAsc' | 'titleAsc';
type StatusScope = 'active' | 'archived' | 'all';

function typeLabel(type: string) {
  return type === 'cover_letter' ? 'Cover Letter' : 'Resume';
}

function formatDateTime(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function actionMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function fetchDocs(scope: StatusScope): Promise<DocumentItem[]> {
  const archived =
    scope === 'archived' ? 'true' : scope === 'all' ? 'all' : 'false';
  const response = await apiFetch(`/api/documents?archived=${archived}`);
  return response.success && Array.isArray(response.data) ? response.data : [];
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusScope, setStatusScope] = useState<StatusScope>('active');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [tagFilter, setTagFilter] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('updatedDesc');
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [metadataDoc, setMetadataDoc] = useState<DocumentItem | null>(null);
  const [historyDoc, setHistoryDoc] = useState<DocumentItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Callers that trigger a refetch from an event handler raise `loading`
  // themselves; the effect below relies on its initial value instead.
  const loadDocs = useCallback(
    async (scope: StatusScope = statusScope) => {
      try {
        setDocs(await fetchDocs(scope));
      } catch (error) {
        setDocs([]);
        setActionError(
          actionMessage(error, 'Could not load your document library.')
        );
      } finally {
        setLoading(false);
      }
    },
    [statusScope]
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const items = await fetchDocs(statusScope);
        if (!cancelled) setDocs(items);
      } catch (error) {
        if (cancelled) return;
        setDocs([]);
        setActionError(
          actionMessage(error, 'Could not load your document library.')
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [statusScope]);

  async function handleDuplicate(doc: DocumentItem) {
    setActionError(null);
    try {
      const response = await duplicateDocument(doc.id);
      if (response.success && response.data) {
        setDocs((current) => [response.data, ...current]);
      }
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : '';
      setActionError(
        `Could not duplicate document. Please try again.${detail}`
      );
    }
  }

  async function handleRename(doc: DocumentItem, newTitle: string) {
    setActionError(null);
    try {
      const response = await renameDocument(doc.id, newTitle);
      if (response.success) {
        setDocs((current) =>
          current.map((item) =>
            item.id === doc.id ? { ...item, title: newTitle } : item
          )
        );
      }
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : '';
      setActionError(`Could not rename document. Please try again.${detail}`);
    }
  }

  async function handleArchive(doc: DocumentItem) {
    setActionError(null);
    try {
      const response = await archiveDocument(doc.id);
      if (response.success) {
        if (statusScope === 'all') {
          setDocs((current) =>
            current.map((item) =>
              item.id === doc.id
                ? {
                    ...item,
                    status: 'archived',
                    archivedAt:
                      response.data?.archivedAt ?? new Date().toISOString(),
                  }
                : item
            )
          );
        } else {
          setDocs((current) => current.filter((item) => item.id !== doc.id));
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : '';
      setActionError(`Could not archive document. Please try again.${detail}`);
    }
  }

  async function handleRestore(doc: DocumentItem) {
    setActionError(null);
    try {
      const response = await restoreDocument(doc.id);
      if (response.success) {
        if (statusScope === 'all') {
          setDocs((current) =>
            current.map((item) =>
              item.id === doc.id
                ? { ...item, status: 'active', archivedAt: null }
                : item
            )
          );
        } else {
          setDocs((current) => current.filter((item) => item.id !== doc.id));
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? ` ${error.message}` : '';
      setActionError(`Could not restore document. Please try again.${detail}`);
    }
  }

  async function handleDownload(doc: DocumentItem) {
    setActionError(null);
    try {
      await downloadDocument(doc.id, doc.fileName || `${doc.title}.txt`);
    } catch (error) {
      setActionError(
        actionMessage(error, 'Could not download document. Please try again.')
      );
    }
  }

  const availableTags = useMemo(
    () =>
      Array.from(new Set(docs.flatMap((document) => document.tags ?? []))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [docs]
  );

  const visibleDocs = useMemo(() => {
    const result = docs.filter(
      (document) =>
        (typeFilter === 'All' || document.type === typeFilter) &&
        (tagFilter === 'All' || document.tags?.includes(tagFilter))
    );

    result.sort((a, b) => {
      if (sortBy === 'titleAsc') return a.title.localeCompare(b.title);
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return sortBy === 'updatedAsc' ? aTime - bTime : bTime - aTime;
    });

    return result;
  }, [docs, sortBy, tagFilter, typeFilter]);

  const showArchived = statusScope === 'archived';

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Documents</h1>
          <p className="text-sm text-[#8b949e]">
            Upload files or manage resumes and cover letters saved from job
            drafts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="rounded bg-[#2f81f4] px-4 py-2 text-sm font-medium text-white hover:bg-[#3f91ff]"
          >
            Upload document
          </button>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setStatusScope((current) =>
                current === 'archived' ? 'active' : 'archived'
              );
            }}
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
        <p
          className="text-sm text-[#f85149]"
          data-testid="action-error"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {!loading && docs.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <select
            value={statusScope}
            onChange={(event) => {
              setLoading(true);
              setStatusScope(event.target.value as StatusScope);
            }}
            aria-label="Filter by document status"
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All statuses</option>
          </select>
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as TypeFilter)
            }
            data-testid="type-filter"
            aria-label="Filter by document type"
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none"
          >
            <option value="All">All types</option>
            <option value="resume">Resume</option>
            <option value="cover_letter">Cover Letter</option>
          </select>
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            aria-label="Filter by document tag"
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none"
          >
            <option value="All">All tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            data-testid="sort-select"
            aria-label="Sort documents"
            className="bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white focus:border-[#2f81f4] focus:ring-1 focus:ring-[#2f81f4] outline-none"
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
            : 'No saved documents yet. Upload one here or save a generated job document.'}
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
              onDownload={handleDownload}
              onHistory={setHistoryDoc}
              onEdit={setMetadataDoc}
              onDuplicate={handleDuplicate}
              onRename={handleRename}
              onArchive={handleArchive}
              onRestore={handleRestore}
            />
          ))}
        </div>
      )}

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={async () => {
          setLoading(true);
          setStatusScope('active');
          await loadDocs('active');
        }}
      />
      <MetadataDialog
        document={metadataDoc}
        open={!!metadataDoc}
        onOpenChange={(open) => !open && setMetadataDoc(null)}
        onSaved={async () => {
          setLoading(true);
          await loadDocs();
        }}
      />
      <HistoryDialog
        document={historyDoc}
        open={!!historyDoc}
        onOpenChange={(open) => !open && setHistoryDoc(null)}
      />
      <Dialog
        open={!!activeDoc}
        onOpenChange={(open) => !open && setActiveDoc(null)}
      >
        <DialogContent className="sm:max-w-2xl bg-[#161b22] text-white border border-[#30363d]">
          {activeDoc && (
            <>
              <DialogHeader>
                <DialogTitle>{activeDoc.title}</DialogTitle>
                <DialogDescription className="text-[#8b949e]">
                  {typeLabel(activeDoc.type)} · v{activeDoc.versionNumber} ·
                  Updated {formatDateTime(activeDoc.updatedAt)}
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
  );
}
