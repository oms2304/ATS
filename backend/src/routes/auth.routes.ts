import { Router } from 'express'
import {
  register,
  login,
  verifyEmail,
  resendVerification,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  changePassword,
} from '../controllers/auth.controller'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/resend-verification', resendVerification)
router.get('/verify-email', verifyEmail)
router.post('/logout', logout)
router.post('/forgot-password', requestPasswordReset)
router.post('/reset-password', confirmPasswordReset)
router.post('/change-password', authMiddleware, changePassword)

export default router