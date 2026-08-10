import "server-only"
import nodemailer from "nodemailer"

export interface SendEmailInput {
  to: string
  subject: string
  text: string
  html?: string
}

function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM)
}

/**
 * Отправка email через SMTP. Без SMTP_HOST — no-op (in-app уведомления остаются).
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!isEmailConfigured()) return false
  if (!input.to?.includes("@")) return false

  const port = Number(process.env.SMTP_PORT ?? 587)
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  })

  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
  return true
}
