import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt'
import prisma from '../lib/prisma'

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]
  const decoded = verifyToken(token)

  if (!decoded) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }

  const revoked = await prisma.revokedToken.findUnique({ where: { token } })
  if (revoked) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }

  req.user = decoded
  next()
}
