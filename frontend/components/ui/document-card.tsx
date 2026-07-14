import { useState } from 'react';
import Link from 'next/link';
import { DocumentItem, formatFileSize } from '@/components/documents/types';

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> =
  {
    resume: { bg: '#1f3d6e', text: '#58a6ff', label: 'Resume' },
    cover_letter: { bg: '#2d1f6e', text: '#bc8cff', label: 'Cover Letter' },
  };

const STATUS_BADGE: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  active: { bg: '#1a3d2b', text: '#3fb950', label: 'Active' },
  archived: { bg: '#21262d', text: '#8b949e', label: 'Archived' },
};

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

interface DocumentCardProps {
  doc: DocumentItem;
  onView: (doc: DocumentItem) => void;
  onDuplicate: (doc: DocumentItem) => void;
  onRename: (doc: DocumentItem, newTitle: string) => void;
  onArchive: (doc: DocumentItem) => void;
  onRestore: (doc: DocumentItem) => void;
  onDownload?: (doc: DocumentItem) => void;
  onHistory?: (doc: DocumentItem) => void;
  onEdit?: (doc: DocumentItem) => void;
}

// S3-001: Document Library card — mirrors JobCard visual language
// (type badge instead of stage badge, no progress bar since documents
// don't have a pipeline stage).
// S3-006: adds status badge + tag chips so filtered/sorted results are
// visually distinguishable in the grid.
// S3-007: adds inline rename (click Rename to reveal a text input) and a
// Duplicate action that creates a copy via the parent's onDuplicate handler.
// S3-008: adds Archive/Restore actions. Archived state is driven by
// `archivedAt` (the real archive mechanism, set by the archive/restore
// endpoints) rather than the separate `status` field — mirrors how
// JobCard derives its "Archived" display from job.archivedAt instead of
// job.stage, since the two are independent fields on the model.
export function DocumentCard({
  doc,
  onView,
  onDuplicate,
  onRename,
  onArchive,
  onRestore,
  onDownload,
  onHistory,
  onEdit,
}: DocumentCardProps) {
  const badge = TYPE_BADGE[doc.type] ?? TYPE_BADGE.resume;
  const isArchived = !!doc.archivedAt;
  const statusBadge = isArchived
    ? STATUS_BADGE.archived
    : doc.status
      ? (STATUS_BADGE[doc.status] ?? STATUS_BADGE.active)
      : null;
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(doc.title);

  function startRename() {
    setDraftTitle(doc.title);
    setIsRenaming(true);
  }

  function cancelRename() {
    setIsRenaming(false);
    setDraftTitle(doc.title);
  }

  function submitRename() {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== doc.title) {
      onRename(doc, trimmed);
    }
    setIsRenaming(false);
  }

  return (
    <div
      data-testid="document-card"
      className={`bg-[#161b22] border rounded-lg p-4 transition-colors ${
        isArchived
          ? 'border-[#30363d] opacity-60'
          : 'border-[#30363d] hover:border-[#2f81f4]'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1">
          <span
            className="text-xs px-2 py-1 rounded"
            style={{ backgroundColor: badge.bg, color: badge.text }}
            data-testid="document-type"
          >
            {badge.label}
          </span>
          {statusBadge && (
            <span
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: statusBadge.bg,
                color: statusBadge.text,
              }}
              data-testid="document-status"
            >
              {statusBadge.label}
            </span>
          )}
        </div>
        <span className="text-xs text-[#8b949e]" data-testid="document-version">
          v{doc.versionNumber}
        </span>
      </div>

      {isRenaming ? (
        <div className="mb-1 flex items-center gap-1">
          <input
            autoFocus
            value={draftTitle}
            maxLength={120}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') cancelRename();
            }}
            data-testid="document-rename-input"
            className="flex-1 bg-[#0d1117] border border-[#2f81f4] rounded px-2 py-1 text-sm text-white outline-none"
          />
          <button
            onClick={submitRename}
            data-testid="document-rename-save"
            className="text-xs px-2 py-1 rounded bg-[#2f81f4] text-white hover:bg-[#3f91ff] transition-colors"
          >
            Save
          </button>
          <button
            onClick={cancelRename}
            data-testid="document-rename-cancel"
            className="text-xs px-2 py-1 rounded border border-[#30363d] text-[#8b949e] hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <h2
          className="text-white font-medium mb-1 truncate"
          data-testid="document-title"
        >
          {doc.title}
        </h2>
      )}

      {doc.job && (
        <p className="text-xs mb-1 truncate">
          <Link
            href={`/jobs/${doc.job.id}`}
            className="text-[#58a6ff] hover:underline"
            data-testid="document-job-link"
          >
            {doc.job.title} at {doc.job.company}
          </Link>
        </p>
      )}

      <p className="text-xs text-[#8b949e] mb-2" data-testid="document-date">
        Updated {formatDate(doc.updatedAt)}
      </p>

      {doc.fileName && (
        <p
          className="mb-2 truncate text-xs text-[#8b949e]"
          data-testid="document-file"
        >
          {doc.fileName}
          {doc.fileSize != null ? ` · ${formatFileSize(doc.fileSize)}` : ''}
        </p>
      )}

      {doc.tags && doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2" data-testid="document-tags">
          {doc.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full bg-[#21262d] text-[#8b949e]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-[#30363d]">
        {!isRenaming && (
          <>
            {!isArchived && (
              <button
                onClick={startRename}
                className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
                data-testid="document-rename-button"
              >
                Rename
              </button>
            )}
            {!isArchived && (
              <button
                onClick={() => onDuplicate(doc)}
                className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
                data-testid="document-duplicate-button"
              >
                Duplicate
              </button>
            )}
            {isArchived ? (
              <button
                onClick={() => onRestore(doc)}
                className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
                data-testid="document-restore-button"
              >
                Restore
              </button>
            ) : (
              <button
                onClick={() => onArchive(doc)}
                className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
                data-testid="document-archive-button"
              >
                Archive
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(doc)}
                className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
                data-testid="document-edit-button"
              >
                Edit
              </button>
            )}
            {onHistory && (
              <button
                onClick={() => onHistory(doc)}
                className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
                data-testid="document-history-button"
              >
                History
              </button>
            )}
            {onDownload && (doc.content || doc.hasFile) && (
              <button
                onClick={() => onDownload(doc)}
                className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
                data-testid="document-download-button"
              >
                Download
              </button>
            )}
            {doc.content && (
              <button
                onClick={() => onView(doc)}
                className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors"
                data-testid="document-view-button"
              >
                View
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
