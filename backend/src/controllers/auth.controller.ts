import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email'
import { registerSchema, loginSchema, resendVerificationSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.schema'

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
            firstName: '',
            lastName: '',
            completionScore: 0
          }
        }
      }
    })

    try {
      await sendVerificationEmail(email, ver_token)
    } catch (emailError) {
      // email failure should not block registration
      console.error('sendVerificationEmail error:', emailError)
    }

    return res.status(201).json({
      success: true,
      data: {
        message:
          'Account created. Check your email to verify your account before logging in.'
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

export async function login(req: Request, res: Response) {
  try {
    const result = loginSchema.safeParse(req.body)

    if (!result.success) {
      const fields: Record<string, string> = {}
      for (const issue of result.error.issues) {
        fields[issue.path[0] as string] = issue.message
      }
      return res.status(400).json({ success: false, error: 'Validation failed', fields })
    }

    const { email, password } = result.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' })
    }

    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in',
        needsVerification: true,
        email: user.email
      })
    }

    const token = signToken({ userId: user.id, email: user.email })

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email }
      }
    })
  } catch (error) {
    console.error('login error:', error)
    return res.status(500).json({ success: false, error: 'Login failed' })
  }
}

export async function resendVerification(req: Request, res: Response) {
  try {
    const result = resendVerificationSchema.safeParse(req.body)

    if (!result.success) {
      const fields: Record<string, string> = {}
      for (const issue of result.error.issues) {
        fields[issue.path[0] as string] = issue.message
      }
      return res.status(400).json({ success: false, error: 'Validation failed', fields })
    }

    const { email } = result.data
    const user = await prisma.user.findUnique({ where: { email } })

    if (user && !user.is_verified) {
      const ver_token = crypto.randomBytes(32).toString('hex')
      await prisma.user.update({ where: { id: user.id }, data: { ver_token } })
      try {
        await sendVerificationEmail(email, ver_token)
      } catch (emailError) {
        console.error('sendVerificationEmail error:', emailError)
      }
    }

    return res.status(200).json({
      success: true,
      message:
        'If an unverified account exists for that email, a verification link has been sent.'
    })
  } catch (error) {
    console.error('resendVerification error:', error)
    return res
      .status(500)
      .json({ success: false, error: 'Could not resend verification email' })
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.query

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing verification token' })
    }

    const user = await prisma.user.findFirst({ where: { ver_token: token } })

    if (!user) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid or expired verification token' })
    }

    if (user.is_verified) {
      return res.json({ success: true, message: 'Email already verified' })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { is_verified: true, ver_token: null }
    })

    return res.json({ success: true, message: 'Email verified successfully' })
  } catch (error) {
    console.error('verifyEmail error:', error)
    return res.status(500).json({ success: false, error: 'Verification failed' })
  }
}



export async function logout(req: Request, res: Response) {
  try {
    return res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' }
    })
  } catch (error) {
    console.error('logout error:', error)
    return res.status(500).json({ success: false, error: 'Logout failed' })
  }
}

const RESET_TTL_MS = 60*60*1000 // 1hr to match email

export async function requestPasswordReset(req: Request, res: Response) {
  try {
    const result = forgotPasswordSchema.safeParse(req.body)
    if (!result.success) {
      const fields: Record<string, string> = {}
      for (const issue of result.error.issues) {
        fields[issue.path[0] as string] = issue.message
      }
      return res.status(400).json({ success: false, error: 'Validation failed', fields })
    }

    const { email } = result.data
    const user = await prisma.user.findUnique({ where: { email }})

    if (user) {
      const reset_token = crypto.randomBytes(32).toString('hex')
      await prisma.user.update({
        where: {id: user.id },
        data: {
          reset_token,
          reset_token_expire: new Date(Date.now() + RESET_TTL_MS),
        },

      })
      try {
        await sendPasswordResetEmail(email, reset_token)
      } catch (emailError) {
        console.error('sendPasswrodResetEmail error:', emailError)
      }
    }
    return res.status(200).json({
      success: true, 
      message:
      'If an account exists for that email, a password reset link has been sent',
    })
  } catch (error) {
    console.error('requestPasswordReset error: ', error)
    return res
      .status(500)
      .json({success: false, error: 'Could not process reset request'})
  }
}

export async function confirmPasswordReset(req: Request, res: Response) {
  try {
    const result = resetPasswordSchema.safeParse(req.body)
    if (!result.success) {
      const fields: Record<string, string> = {}
      for(const issue of result.error.issues) {
        fields[issue.path[0] as string] = issue.message
      }
      return res.status(400).json({success: false, error: 'Validation failed', fields })
    }

    const { token, password } = result.data
    const user = await prisma.user.findFirst({ where: { reset_token: token } })

    if (!user || !user.reset_token_expire || user.reset_token_expire < new Date()) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid or expired reset token' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        reset_token: null,
        reset_token_expire: null,
        is_verified: true, // controlling the inbox proves email ownership
      },
    })
    return res
      .status(200)
      .json({ success: true, message: 'Password reset successfully' })
  } catch (error) {
    console.error('confirmPasswordReset error:', error)
    return res.status(500).json({ success: false, error: 'Password reset failed' })
  }
}