const BASE = process.env.NEXT_PUBLIC_API_URL

export async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    },
    ...options
  })
  return res.json()
}