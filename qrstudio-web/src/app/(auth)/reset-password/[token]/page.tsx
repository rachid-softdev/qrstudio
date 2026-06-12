import type { Metadata } from "next"
import { ResetPasswordForm } from "@/app/(auth)/reset-password/[token]/components/reset-password-form"

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe — QR Studio",
  description: "Définissez un nouveau mot de passe pour votre compte QR Studio",
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
        <p className="text-sm text-muted-foreground">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>
      </div>
      <ResetPasswordForm token={token} />
      <p className="text-center text-sm text-muted-foreground">
        <a href="/login" className="font-medium text-primary hover:underline">
          Retour à la connexion
        </a>
      </p>
    </div>
  )
}
