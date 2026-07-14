'use client';

import { useEffect, useState } from 'react';
import { apiFetch, downloadDocument } from '@/lib/api';

type LibraryDoc = {
  id: string;
  type: string;
  title: string;
  content: string | null;
  hasFile?: boolean;
  versionNumber: number;
  updatedAt: string;
};

type LinkedDoc = {
  documentId: string;
  title: string;
  content: string | null;
  hasFile?: boolean;
  versionNumber: number;
  updatedAt: string;
} | null;

const DOC_TYPES = [
  { value: 'resume', label: 'Resume' },
  { value: 'cover_letter', label: 'Cover Letter' },
] as const;

function formatDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
export function JobDocumentLinks({ jobId }: { jobId: string }) {
  const [library, setLibrary] = useState<LibraryDoc[]>([]);
  const [links, setLinks] = useState<Record<string, LinkedDoc>>({
    resume: null,
    cover_letter: null,
  });
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [confirmReplace, setConfirmReplace] = useState<{
    type: string;
    documentId: string;
    existingTitle: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [libRes, linkedRes] = await Promise.all([
          apiFetch('/api/documents'),
          apiFetch(`/api/documents?jobId=${jobId}`),
        ]);
        if (cancelled) return;
        if (libRes.success && Array.isArray(libRes.data))
          setLibrary(libRes.data);
        if (linkedRes.success && Array.isArray(linkedRes.data)) {
          const next: Record<string, LinkedDoc> = {
            resume: null,
            cover_letter: null,
          };
          for (const doc of linkedRes.data) {
            next[doc.type] = {
              documentId: doc.id,
              title: doc.title,
              content: doc.content,
              hasFile: doc.hasFile,
              versionNumber: doc.versionNumber,
              updatedAt: doc.updatedAt,
            };
          }
          setLinks(next);
        }
      } catch {
        // leave existing state on transient failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function performLink(
    type: string,
    documentId: string,
    confirmedReplace = false
  ) {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/documents/jobs/${jobId}/link`, {
        method: 'PUT',
        body: JSON.stringify({ documentId, type, confirmedReplace }),
      });
      if (res.success) {
        const doc = library.find((d) => d.id === documentId);
        setLinks((prev) => ({
          ...prev,
          [type]: {
            documentId,
            title: doc?.title ?? '',
            content: doc?.content ?? null,
            hasFile: doc?.hasFile,
            versionNumber: doc?.versionNumber ?? 1,
            updatedAt: doc?.updatedAt ?? new Date().toISOString(),
          },
        }));
        setSelecting(null);
        setSelectedDocId('');
        setConfirmReplace(null);
      }
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        const doc = library.find((d) => d.id === documentId);
        setConfirmReplace({
          type,
          documentId,
          existingTitle:
            links[type]?.title ?? doc?.title ?? 'the current document',
        });
      }
    }
    setSaving(false);
  }

  async function handleUnlink(type: string) {
    if (!window.confirm('Unlink this document from the job?')) return;
    try {
      await apiFetch(`/api/documents/jobs/${jobId}/link/${type}`, {
        method: 'DELETE',
      });
      setLinks((prev) => ({ ...prev, [type]: null }));
    } catch {
      // ignore
    }
  }

  async function handleDownload(document: NonNullable<LinkedDoc>) {
    setDownloadError('');
    try {
      await downloadDocument(document.documentId, `${document.title}.txt`);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : 'Could not download document.'
      );
    }
  }

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
      <h2 className="text-sm font-semibold text-white mb-4">
        Linked Documents
      </h2>
      {downloadError && (
        <p role="alert" className="mb-3 text-xs text-[#f85149]">
          {downloadError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[#8b949e]">Loading...</p>
      ) : (
        <div className="space-y-4">
          {DOC_TYPES.map(({ value, label }) => {
            const linked = links[value];
            const availableForType = library.filter((d) => d.type === value);
            return (
              <div
                key={value}
                className="border border-[#30363d] rounded-lg p-3"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs px-2 py-0.5 rounded bg-[#2d1f6e] text-[#bc8cff]">
                    {label}
                  </span>
                  {selecting !== value && (
                    <div className="flex gap-3">
                      {linked && (linked.content || linked.hasFile) && (
                        <button
                          onClick={() => handleDownload(linked)}
                          className="text-xs text-[#8b949e] hover:text-white transition-colors"
                        >
                          Download
                        </button>
                      )}
                      {linked && (
                        <button
                          onClick={() => handleUnlink(value)}
                          className="text-xs text-[#f85149] hover:underline"
                        >
                          Unlink
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelecting(value);
                          setSelectedDocId('');
                        }}
                        className="text-xs text-[#2f81f4] hover:underline"
                      >
                        {linked ? 'Change' : 'Link'}
                      </button>
                    </div>
                  )}
                </div>

                {linked ? (
                  <div className="mt-2">
                    <p className="text-sm text-white">{linked.title}</p>
                    <p className="text-xs text-[#8b949e] mt-0.5">
                      v{linked.versionNumber} · Updated{' '}
                      {formatDate(linked.updatedAt)}
                    </p>
                  </div>
                ) : selecting !== value ? (
                  <p className="text-sm text-[#8b949e] mt-2">
                    No {label.toLowerCase()} linked.
                  </p>
                ) : null}

                {selecting === value && (
                  <div className="mt-3 space-y-2">
                    {availableForType.length === 0 ? (
                      <p className="text-xs text-[#8b949e]">
                        No {label.toLowerCase()}s in your library yet. Save one
                        from a job&apos;s AI draft first.
                      </p>
                    ) : (
                      <select
                        value={selectedDocId}
                        onChange={(e) => setSelectedDocId(e.target.value)}
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#2f81f4]"
                      >
                        <option value="">Select a document...</option>
                        {availableForType.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title} (v{d.versionNumber})
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          selectedDocId && performLink(value, selectedDocId)
                        }
                        disabled={!selectedDocId || saving}
                        className="text-xs px-3 py-1.5 bg-[#2f81f4] text-white rounded hover:bg-blue-600 disabled:opacity-50"
                      >
                        {saving ? 'Linking...' : 'Link'}
                      </button>
                      <button
                        onClick={() => {
                          setSelecting(null);
                          setSelectedDocId('');
                        }}
                        className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirmReplace && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: '#161b22',
              border: '1px solid #f85149',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
            }}
          >
            <h3
              style={{
                color: '#f85149',
                fontSize: '16px',
                fontWeight: 600,
                marginBottom: '8px',
              }}
            >
              Replace Linked Document
            </h3>
            <p
              style={{
                color: '#8b949e',
                fontSize: '14px',
                marginBottom: '20px',
              }}
            >
              This job already has{' '}
              <strong style={{ color: '#e6edf3' }}>
                {confirmReplace.existingTitle}
              </strong>{' '}
              linked. Replacing it will not delete the document from your
              library.
            </p>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setConfirmReplace(null)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #30363d',
                  background: 'transparent',
                  color: '#8b949e',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  performLink(
                    confirmReplace.type,
                    confirmReplace.documentId,
                    true
                  )
                }
                style={{
                  padding: '8px 16px',
                  background: '#f85149',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
