import * as Sentry from "@sentry/nextjs"
import { Resend } from "resend"

function createResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return null
  }
  return new Resend(apiKey)
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? "noreply@qrstudio.app"

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .logo { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 24px; }
    .logo span { color: #6366f1; }
    h1 { font-size: 18px; color: #111827; margin: 0 0 8px; }
    p { font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0 0 16px; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">QR <span>Studio</span></div>
      ${body}
    </div>
    <div class="footer">
      QR Studio — Des QR codes qui fonctionnent, même après impression.
    </div>
  </div>
</body>
</html>`
}

export const emailService = {
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const client = createResendClient()
    if (!client) return

    try {
      await client.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: "Bienvenue sur QR Studio 🎉",
        html: wrapHtml(`
          <h1>Bienvenue ${name} !</h1>
          <p>Votre compte QR Studio a été créé avec succès. Vous pouvez dès maintenant créer vos premiers QR codes dynamiques.</p>
          <p>Commencez par créer votre premier QR code — c'est rapide et intuitif.</p>
          <p style="text-align:center;margin-top:24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">
              Se connecter
            </a>
          </p>
        `),
      })
    } catch (error) {
      Sentry.captureException(error)
    }
  },

  async sendInvitationEmail(email: string, workspaceName: string, inviteToken: string, invitedByName: string): Promise<void> {
    const client = createResendClient()
    if (!client) return

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invite/${inviteToken}`

    try {
      await client.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: `${invitedByName} vous invite à rejoindre ${workspaceName}`,
        html: wrapHtml(`
          <h1>Invitation à rejoindre ${workspaceName}</h1>
          <p>${invitedByName} vous invite à collaborer sur l'espace de travail <strong>${workspaceName}</strong>.</p>
          <p style="text-align:center;margin-top:24px;">
            <a href="${inviteUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">
              Accepter l'invitation
            </a>
          </p>
          <p style="font-size:12px;color:#9ca3af;">Ce lien expire dans 7 jours.</p>
        `),
      })
    } catch (error) {
      Sentry.captureException(error)
    }
  },

  async sendAccountDeletionConfirmation(email: string): Promise<void> {
    const client = createResendClient()
    if (!client) return

    try {
      await client.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: "Votre compte QR Studio a été supprimé",
        html: wrapHtml(`
          <h1>Compte supprimé</h1>
          <p>Votre compte QR Studio et toutes les données associées ont été définitivement supprimés.</p>
          <p>Si vous n'êtes pas à l'origine de cette action, contactez immédiatement notre support.</p>
        `),
      })
    } catch (error) {
      Sentry.captureException(error)
    }
  },

  async sendPasswordChanged(email: string): Promise<void> {
    const client = createResendClient()
    if (!client) return

    try {
      await client.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: "Votre mot de passe QR Studio a été modifié",
        html: wrapHtml(`
          <h1>Mot de passe modifié</h1>
          <p>Le mot de passe de votre compte QR Studio vient d'être changé avec succès.</p>
          <p>Si vous n'avez pas effectué cette modification, veuillez contacter le support immédiatement.</p>
        `),
      })
    } catch (error) {
      Sentry.captureException(error)
    }
  },
}
