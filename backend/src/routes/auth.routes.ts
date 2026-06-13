import { Router } from 'express'
import {
  register,
  login,
  verifyEmail,
  resendVerification,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
} from '../controllers/auth.controller'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/resend-verification', resendVerification)
router.get('/verify-email', verifyEmail)
router.post('/logout', logout)
router.post('/forgot-password', requestPasswordReset)
router.post('/reset-password', confirmPasswordReset)

export default router