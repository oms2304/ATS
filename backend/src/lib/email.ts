import { Resend } from 'resend'

// To deliver to arbitrary recipients, verify a domain in Resend and set
// EMAIL_FROM to an address on that domain. The onboarding@resend.dev fallback
// only delivers to your own Resend account email.
const DEFAULT_FROM = 'ATS for Job Seekers <onboarding@resend.dev>'

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`
  await resend.emails.send({
    from: process.env.EMAIL_FROM || DEFAULT_FROM,
    to: email,
    subject: 'Verify your email',
    html: `
      <h2>Welcome to ATS for Job Seekers</h2>
      <p>Click the link below to verify your email.</p>
      <a href="${url}">Verify my email</a>
      <p>This link expires in 24 hours.</p>
    `
  })
}
