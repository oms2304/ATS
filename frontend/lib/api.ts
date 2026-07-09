const BASE = process.env.NEXT_PUBLIC_API_URL

export async function apiFetch(path: string, options?: RequestInit) {
  const token =
    (typeof window !== 'undefined' &&
      (localStorage.getItem('token') || localStorage.getItem('auth_token'))) ||
    ''

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Request failed with status ${res.status}`
    const err = new Error(message) as Error & { status?: number; data?: unknown }
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

export const archiveJob = (id: string) =>
  apiFetch(`/api/jobs/${id}/archive`, { method: 'PATCH' })
export const restoreJob = (id: string) =>
  apiFetch(`/api/jobs/${id}/restore`, { method: 'PATCH' })
export const archiveDocument = (id: string) =>
  apiFetch(`/api/documents/${id}/archive`, { method: 'PATCH' })
export const restoreDocument = (id: string) =>
  apiFetch(`/api/documents/${id}/restore`, { method: 'PATCH' })