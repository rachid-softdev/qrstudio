import type { Metadata } from "next"
import Link from "next/link"
import { SearchXIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/layout/logo"

export const metadata: Metadata = {
  title: "QR code introuvable — QR Studio",
}

export default function QRNotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
        <SearchXIcon className="size-8 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-2xl font-bold">QR code introuvable</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Ce QR code n&apos;existe pas ou a été supprimé.
        Vérifiez le lien ou contactez le propriétaire.
      </p>
      <Link href="/" className="mt-6">
        <Button variant="default" size="sm">
          Retour à l&apos;accueil
        </Button>
      </Link>
    </div>
  )
}
