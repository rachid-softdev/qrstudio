import type { Metadata } from "next"
import Link from "next/link"
import { ShieldAlertIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Redirection bloquée — QR Studio",
}

export default function RedirectBlockedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-muted">
        <ShieldAlertIcon className="size-10 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">Redirection bloquée</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Cette redirection a été bloquée pour des raisons de sécurité.
        Le lien ne pointe pas vers une destination autorisée.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  )
}
