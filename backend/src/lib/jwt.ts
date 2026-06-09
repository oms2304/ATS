import jwt from 'jsonwebtoken'

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not set in environment variables')
  }
  return secret
}

export function signToken(payload: { userId: string; email?: string }): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string; email?: string } | null {
  try {
    return jwt.verify(token, getSecret()) as { userId: string; email?: string }
  } catch {
    return null
  }
}
