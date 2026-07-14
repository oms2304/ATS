'use client';

import { FormEvent, useState } from 'react';
import { uploadDocumentFormData } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => Promise<void> | void;
};

function uploadErrorMessage(error: unknown) {
  const typed = error as Error & {
    data?: { fields?: { file?: string[]; title?: string[]; type?: string[] } };
  };
  return (
    typed.data?.fields?.file?.[0] ||
    typed.data?.fields?.title?.[0] ||
    typed.data?.fields?.type?.[0] ||
    typed.message ||
    'Upload failed. Please try again.'
  );
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  onUploaded,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#161b22] text-white border border-[#30363d] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription className="text-[#8b949e]">
            Add a PDF, DOCX, or TXT file up to 5MB to your private library.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open so each upload starts from clean state. */}
        {open && (
          <UploadForm onOpenChange={onOpenChange} onUploaded={onUploaded} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadForm({
  onOpenChange,
  onUploaded,
}: Pick<Props, 'onOpenChange' | 'onUploaded'>) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<'resume' | 'cover_letter'>('resume');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function selectFile(selected: File | null) {
    setFile(selected);
    setError('');
    if (selected && !title.trim()) {
      setTitle(selected.name.replace(/\.[^.]+$/, ''));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Choose a PDF, DOCX, or TXT file.');
      return;
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setError('Only PDF, DOCX, and TXT files are supported.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File must be 5MB or smaller.');
      return;
    }
    const normalizedTitle = title.trim();
    if (!normalizedTitle || normalizedTitle.length > 120) {
      setError('Title must be between 1 and 120 characters.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await uploadDocumentFormData(file, type, normalizedTitle);
      await onUploaded();
      onOpenChange(false);
    } catch (uploadError) {
      setError(uploadErrorMessage(uploadError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-1 text-sm" htmlFor="document-file">
        File
        <input
          id="document-file"
          autoFocus
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          disabled={submitting}
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-[#c9d1d9] file:mr-3 file:rounded file:border-0 file:bg-[#21262d] file:px-3 file:py-1 file:text-white"
        />
      </label>
      <label className="grid gap-1 text-sm" htmlFor="document-title">
        Title
        <input
          id="document-title"
          value={title}
          maxLength={120}
          required
          onChange={(event) => setTitle(event.target.value)}
          disabled={submitting}
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-white"
        />
      </label>
      <label className="grid gap-1 text-sm" htmlFor="document-upload-type">
        Document type
        <select
          id="document-upload-type"
          value={type}
          onChange={(event) =>
            setType(event.target.value as 'resume' | 'cover_letter')
          }
          disabled={submitting}
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-white"
        >
          <option value="resume">Resume</option>
          <option value="cover_letter">Cover Letter</option>
        </select>
      </label>
      <p
        role="status"
        aria-live="polite"
        className={`min-h-5 text-sm ${error ? 'text-[#f85149]' : 'text-[#8b949e]'}`}
      >
        {error || (submitting ? 'Uploading securely…' : '')}
      </p>
      <DialogFooter>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
          className="rounded border border-[#30363d] px-4 py-2 text-sm text-[#c9d1d9]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[#2f81f4] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? 'Uploading…' : 'Upload'}
        </button>
      </DialogFooter>
    </form>
  );
}
