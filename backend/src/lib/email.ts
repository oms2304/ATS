import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'ATS for Job Seekers <noreply@jacobmoawad.fun>'

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Confirm your email to get started',
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:48px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#161b22;border:1px solid #30363d;border-radius:12px;overflow:hidden;">

        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #30363d;">
            <p style="margin:0;font-size:16px;font-weight:600;color:#e6edf3;">ATS for Job Seekers</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#e6edf3;">Confirm your email address</h1>
            <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:#8b949e;">
              You are one step away from tracking your job search like a pro. Click the button below to verify your email and activate your account.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#2f81f4;border-radius:8px;">
                  <a href="${url}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                    Verify my email
                  </a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr><td style="border-top:1px solid #30363d;"></td></tr>
            </table>
            <p style="margin:0 0 6px;font-size:12px;color:#8b949e;">If the button does not work paste this link into your browser:</p>
            <p style="margin:0;font-size:12px;color:#2f81f4;word-break:break-all;">${url}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 32px;background:#0d1117;border-top:1px solid #30363d;">
            <p style="margin:0 0 4px;font-size:12px;color:#8b949e;">This link expires in 24 hours.</p>
            <p style="margin:0;font-size:12px;color:#8b949e;">If you did not create an account you can ignore this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your ATS password',
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:48px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#161b22;border:1px solid #30363d;border-radius:12px;overflow:hidden;">

        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #30363d;">
            <p style="margin:0;font-size:16px;font-weight:600;color:#e6edf3;">ATS for Job Seekers</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#e6edf3;">Reset your password</h1>
            <p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:#8b949e;">
              We received a request to reset your password. Click the button below to set a new one. This link expires in 1 hour.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#2f81f4;border-radius:8px;">
                  <a href="${url}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                    Reset my password
                  </a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr><td style="border-top:1px solid #30363d;"></td></tr>
            </table>
            <p style="margin:0 0 6px;font-size:12px;color:#8b949e;">If the button does not work paste this link into your browser:</p>
            <p style="margin:0;font-size:12px;color:#2f81f4;word-break:break-all;">${url}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 32px;background:#0d1117;border-top:1px solid #30363d;">
            <p style="margin:0 0 4px;font-size:12px;color:#8b949e;">This link expires in 1 hour.</p>
            <p style="margin:0;font-size:12px;color:#8b949e;">If you did not request a password reset you can ignore this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `
  })
}
