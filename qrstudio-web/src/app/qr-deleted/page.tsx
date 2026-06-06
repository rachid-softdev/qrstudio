import type { Metadata } from "next"
import Link from "next/link"
import { Trash2Icon } from "lucide-react"

export const metadata: Metadata = {
  title: "QR code supprimé — QR Studio",
}

export default function QRDeletedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-muted">
        <Trash2Icon className="size-10 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">QR code supprimé</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Ce QR code n&apos;est plus actif. Il a été supprimé par son propriétaire.
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
