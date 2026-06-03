import { Suspense } from "react"
import type { Metadata } from "next"
import { LoginForm } from "@/app/(auth)/login/components/login-form"
import { GoogleLoginButton } from "@/app/(auth)/login/components/google-login-button"
import { Skeleton } from "@/components/shared/loading-skeleton"

export const metadata: Metadata = {
  title: "Connexion — QR Studio",
  description: "Connectez-vous à votre espace QR Studio",
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Connexion</h1>
        <p className="text-sm text-muted-foreground">
          Connectez-vous à votre espace QR Studio
        </p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Ou</span>
        </div>
      </div>
      <GoogleLoginButton />
      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <a
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          Créer un compte
        </a>
      </p>
    </div>
  )
}
