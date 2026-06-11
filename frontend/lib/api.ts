const BASE = process.env.NEXT_PUBLIC_API_URL

export async function apiFetch(path: string, options?: RequestInit) {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('auth_token') ||
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

  return res.json()
}
