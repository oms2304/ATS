const BASE = process.env.NEXT_PUBLIC_API_URL;

function getToken() {
  return (
    (typeof window !== 'undefined' &&
      (localStorage.getItem('token') || localStorage.getItem('auth_token'))) ||
    ''
  );
}

function requestHeaders(options?: RequestInit) {
  const headers = new Headers(options?.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const isFormData =
    typeof FormData !== 'undefined' && options?.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: requestHeaders(options),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Request failed with status ${res.status}`;
    const err = new Error(message) as Error & {
      status?: number;
      data?: unknown;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function downloadFilename(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8);
    } catch {
      return fallback;
    }
  }
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallback;
}

export async function apiDownloadBlob(path: string, fallback = 'document') {
  const res = await fetch(`${BASE}${path}`, {
    headers: requestHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      (data && (data.error || data.message)) ||
      `Download failed with status ${res.status}`;
    const error = new Error(message) as Error & {
      status?: number;
      data?: unknown;
    };
    error.status = res.status;
    error.data = data;
    throw error;
  }

  const blob = await res.blob();
  const filename = downloadFilename(
    res.headers.get('Content-Disposition'),
    fallback
  );
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const uploadDocumentFormData = (
  file: File,
  type: 'resume' | 'cover_letter',
  title: string
) => {
  const formData = new FormData();
  formData.set('file', file);
  formData.set('type', type);
  formData.set('title', title);
  return apiFetch('/api/documents/upload', {
    method: 'POST',
    body: formData,
  });
};

export const getDocumentVersions = (id: string) =>
  apiFetch(`/api/documents/${id}/versions`);

export const updateDocumentMetadata = (
  id: string,
  fields: { title?: string; status?: 'active' | 'archived'; tags?: string[] }
) =>
  apiFetch(`/api/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });

export const downloadDocument = (id: string, fallback?: string) =>
  apiDownloadBlob(`/api/documents/${id}/download`, fallback);

export const downloadDocumentVersion = (
  id: string,
  versionId: string,
  fallback?: string
) =>
  apiDownloadBlob(
    `/api/documents/${id}/versions/${versionId}/download`,
    fallback
  );

export const archiveJob = (id: string) =>
  apiFetch(`/api/jobs/${id}/archive`, { method: 'PATCH' });
export const restoreJob = (id: string) =>
  apiFetch(`/api/jobs/${id}/restore`, { method: 'PATCH' });
export const archiveDocument = (id: string) =>
  apiFetch(`/api/documents/${id}/archive`, { method: 'PATCH' });
export const restoreDocument = (id: string) =>
  apiFetch(`/api/documents/${id}/restore`, { method: 'PATCH' });

export const duplicateDocument = (id: string) =>
  apiFetch(`/api/documents/${id}/duplicate`, { method: 'POST' });
export const renameDocument = (id: string, title: string) =>
  apiFetch(`/api/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
