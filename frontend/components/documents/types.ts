export type DocumentItem = {
  id: string;
  type: 'resume' | 'cover_letter' | string;
  title: string;
  content: string | null;
  versionId?: string | null;
  versionNumber: number;
  label?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  hasFile?: boolean;
  updatedAt: string;
  status?: string;
  tags?: string[];
  archivedAt?: string | null;
  job: { id: string; title: string; company: string } | null;
};

export type DocumentVersion = {
  id: string;
  document_id: string;
  version_number: number;
  label: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  content: string | null;
  createdAt: string;
};

export function formatFileSize(size?: number | null) {
  if (!size && size !== 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function normalizeTags(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
