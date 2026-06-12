import type { Metadata } from "next"
import { ForgotPasswordForm } from "@/app/(auth)/forgot-password/components/forgot-password-form"

export const metadata: Metadata = {
  title: "Mot de passe oublié — QR Studio",
  description: "Réinitialisez votre mot de passe QR Studio",
}

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
        <p className="text-sm text-muted-foreground">
          Saisissez votre adresse email et nous vous enverrons un lien pour
          réinitialiser votre mot de passe.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  )
}
