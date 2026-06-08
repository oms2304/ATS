import { Resend } from 'resend'

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`
  await resend.emails.send({
    from: 'ATS for Job Seekers <onboarding@resend.dev>',
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
