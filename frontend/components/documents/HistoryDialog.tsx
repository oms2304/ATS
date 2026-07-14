'use client';

import { useEffect, useState } from 'react';
import { downloadDocumentVersion, getDocumentVersions } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocumentItem, DocumentVersion, formatFileSize } from './types';

type Props = {
  document: DocumentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export function HistoryDialog({ document, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#161b22] text-white border border-[#30363d] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription className="text-[#8b949e]">
            {document
              ? `Every saved version of ${document.title}.`
              : 'Saved document versions.'}
          </DialogDescription>
        </DialogHeader>
        {/* Remounts per document so history is fetched fresh on each open. */}
        {open && document && (
          <HistoryBody key={document.id} document={document} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoryBody({ document }: { document: DocumentItem }) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getDocumentVersions(document.id)
      .then((response) => {
        if (!cancelled) {
          setVersions(Array.isArray(response.data) ? response.data : []);
        }
      })
      .catch((loadError: Error) => {
        if (!cancelled) {
          setError(loadError.message || 'Could not load version history.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [document.id]);

  async function download(version: DocumentVersion) {
    setDownloading(version.id);
    setError('');
    try {
      await downloadDocumentVersion(
        document.id,
        version.id,
        version.fileName || `${document.title}-v${version.version_number}.txt`
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Could not download this version.'
      );
    } finally {
      setDownloading(null);
    }
  }

  return (
    <>
      <p
        role="status"
        aria-live="polite"
        className={`min-h-5 text-sm ${error ? 'text-[#f85149]' : 'text-[#8b949e]'}`}
      >
        {error || (loading ? 'Loading history…' : '')}
      </p>
      {!loading && !error && versions.length === 0 && (
        <p className="text-sm text-[#8b949e]">No versions are available.</p>
      )}
      {versions.length > 0 && (
        <ol
          className="max-h-[28rem] space-y-3 overflow-y-auto"
          aria-label="Document versions"
        >
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#30363d] bg-[#0d1117] p-3"
            >
              <div>
                <p className="font-medium">
                  Version {version.version_number}
                  {version.label ? ` · ${version.label}` : ''}
                </p>
                <p className="text-xs text-[#8b949e]">
                  {formatDate(version.createdAt)}
                  {version.fileName
                    ? ` · ${version.fileName}`
                    : ' · Generated text'}
                  {version.fileSize != null
                    ? ` · ${formatFileSize(version.fileSize)}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => download(version)}
                disabled={downloading === version.id}
                className="rounded border border-[#30363d] px-3 py-1.5 text-xs text-[#c9d1d9] hover:border-[#444c56] hover:text-white disabled:opacity-60"
              >
                {downloading === version.id ? 'Downloading…' : 'Download'}
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
