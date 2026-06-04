import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { sendVerificationEmail } from '../lib/email'
import { registerSchema } from '../schemas/auth.schema'

export async function register(req: Request, res: Response) {
  const result = registerSchema.safeParse(req.body)

  if (!result.success) {
    const fields: Record<string, string> = {}
    for (const issue of result.error.issues) {
      fields[issue.path[0] as string] = issue.message
    }
    return res.status(400).json({ success: false, error: 'Validation failed', fields })
  }

  const { name, email, password } = result.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return res.status(400).json({ success: false, error: 'Email already in use' })
  }

  const hashed = await bcrypt.hash(password, 10)
  const verificationToken = crypto.randomBytes(32).toString('hex')

  const user = await prisma.user.create({
    data: { name, email, password: hashed, verificationToken }
  })

  const token = signToken({ userId: user.id })

  try {
    await sendVerificationEmail(email, verificationToken)
  } catch {
    // email failure should not block registration
  }

  return res.status(201).json({
    success: true,
    data: {
      token,
      user: { id: user.id, name: user.name, email: user.email }
    }
  })
}
