import type { Metadata } from "next"
import { RegisterForm } from "@/app/(auth)/register/components/register-form"

export const metadata: Metadata = {
  title: "Créer un compte — QR Studio",
  description: "Créez votre espace QR Studio et commencez à générer des QR codes dynamiques",
}

export default function RegisterPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Créer un compte</h1>
        <p className="text-sm text-muted-foreground">
          Créez votre espace QR Studio et commencez à générer des QR codes
          dynamiques
        </p>
      </div>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <a href="/login" className="font-medium text-primary hover:underline">
          Se connecter
        </a>
      </p>
    </div>
  )
}
