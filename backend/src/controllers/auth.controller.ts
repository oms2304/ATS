import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { sendVerificationEmail } from '../lib/email'
import { registerSchema } from '../schemas/auth.schema'

export async function register(req: Request, res: Response) {
  try {
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

    const hashedPassword = await bcrypt.hash(password, 10)
    const ver_token = crypto.randomBytes(32).toString('hex')

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        ver_token,
        profile: {
          create: {
            first_name: '',
            last_name: '',
            completion_score: 0
          }
        }
      }
    })

    try {
      await sendVerificationEmail(email, ver_token)
    } catch {
      // email failure should not block registration
    }

    const token = signToken({ userId: user.id, email: user.email })

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email }
      }
    })
  } catch (error) {
    console.error('register error:', error)

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return res.status(400).json({ success: false, error: 'Email already in use' })
    }

    return res.status(500).json({ success: false, error: 'Registration failed' })
  }
}
