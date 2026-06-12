import { Suspense } from "react"
import type { Metadata } from "next"
import { LoginForm } from "@/app/(auth)/login/components/login-form"
import { GoogleLoginButton } from "@/app/(auth)/login/components/google-login-button"
import { Skeleton } from "@/components/shared/loading-skeleton"
import { Separator } from "@/components/ui/separator"

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
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase text-muted-foreground">Ou</span>
        <Separator className="flex-1" />
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
