'use client';

import { FormEvent, useState } from 'react';
import { updateDocumentMetadata } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocumentItem, normalizeTags } from './types';

type Props = {
  document: DocumentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void> | void;
};

function errorMessage(error: unknown) {
  const typed = error as Error & {
    data?: {
      fields?: { title?: string[]; tags?: string[]; status?: string[] };
    };
  };
  return (
    typed.data?.fields?.title?.[0] ||
    typed.data?.fields?.tags?.[0] ||
    typed.data?.fields?.status?.[0] ||
    typed.message ||
    'Could not update the document.'
  );
}

export function MetadataDialog({
  document,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#161b22] text-white border border-[#30363d] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit document details</DialogTitle>
          <DialogDescription className="text-[#8b949e]">
            Update the library title, tags, and archive status.
          </DialogDescription>
        </DialogHeader>
        {/* Remounts per document so the form seeds from the current values. */}
        {open && document && (
          <MetadataForm
            key={document.id}
            document={document}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetadataForm({
  document,
  onOpenChange,
  onSaved,
}: Pick<Props, 'onOpenChange' | 'onSaved'> & { document: DocumentItem }) {
  const [title, setTitle] = useState(document.title);
  const [tags, setTags] = useState((document.tags ?? []).join(', '));
  const [status, setStatus] = useState<'active' | 'archived'>(
    document.archivedAt ? 'archived' : 'active'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedTitle = title.trim();
    const normalizedTags = normalizeTags(tags.split(','));
    if (!normalizedTitle || normalizedTitle.length > 120) {
      setError('Title must be between 1 and 120 characters.');
      return;
    }
    if (normalizedTags.length > 10) {
      setError('Use no more than 10 tags.');
      return;
    }
    if (normalizedTags.some((tag) => tag.length > 32)) {
      setError('Each tag must be 32 characters or fewer.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await updateDocumentMetadata(document.id, {
        title: normalizedTitle,
        tags: normalizedTags,
        status,
      });
      await onSaved();
      onOpenChange(false);
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <label className="grid gap-1 text-sm" htmlFor="metadata-title">
        Title
        <input
          id="metadata-title"
          autoFocus
          required
          maxLength={120}
          value={title}
          disabled={submitting}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-white"
        />
      </label>
      <label className="grid gap-1 text-sm" htmlFor="metadata-tags">
        Tags
        <input
          id="metadata-tags"
          value={tags}
          disabled={submitting}
          onChange={(event) => setTags(event.target.value)}
          placeholder="demo, nursing, priority"
          aria-describedby="metadata-tags-help"
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-white"
        />
        <span id="metadata-tags-help" className="text-xs text-[#8b949e]">
          Separate up to 10 tags with commas. Duplicates are removed.
        </span>
      </label>
      <label className="grid gap-1 text-sm" htmlFor="metadata-status">
        Status
        <select
          id="metadata-status"
          value={status}
          disabled={submitting}
          onChange={(event) =>
            setStatus(event.target.value as 'active' | 'archived')
          }
          className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-white"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <p
        role="status"
        aria-live="polite"
        className={`min-h-5 text-sm ${error ? 'text-[#f85149]' : 'text-[#8b949e]'}`}
      >
        {error || (submitting ? 'Saving changes…' : '')}
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
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </DialogFooter>
    </form>
  );
}
