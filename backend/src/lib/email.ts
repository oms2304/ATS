import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`
  await resend.emails.send({
    from: 'ATS <noreply@yourdomain.com>',
    to: email,
    subject: 'Verify your email',
    html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`
  })
}
